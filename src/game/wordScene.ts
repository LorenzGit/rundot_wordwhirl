import {
    Container,
    Graphics,
    Rectangle,
    Text,
    type Application,
    type FederatedPointerEvent,
    type Ticker,
} from "pixi.js";
import { audioManager } from "../audio/audioManager.ts";
import { recordGesture, submitWord } from "./gameController.ts";
import { crosswordFor, solvedCellKeys, type CrosswordCell } from "./words/crossword.ts";
import { levelForNumber } from "./words/levels.ts";
import { store } from "../state/store.ts";
import { createParticleEmitter } from "./particles.ts";
import { NoiseRandom } from "./noiseRandom.ts";
import { createTweenController, ease } from "./tween.ts";
import type { Stage } from "./stage.ts";

export interface Scene {
    destroy(): void;
}

interface LetterView {
    originalIndex: number;
    group: Container;
    disc: Graphics;
    label: Text;
    x: number;
    y: number;
    baseScale: number;
}

interface CellView {
    key: string;
    group: Container;
    pop: number;
}

const FONT = '"Arial Rounded MT Bold", "Avenir Next", "Trebuchet MS", sans-serif';
const COLORS = {
    ink: 0x173249,
    deep: 0x10263a,
    paper: 0xfff2d7,
    mint: 0x99e1c3,
    mintLight: 0xd9fff0,
    apricot: 0xffc78d,
    coral: 0xf28175,
    aurora: 0xbca8ff,
    auroraLight: 0xe7defe,
    path: 0x5ce8b4,
    pathGlow: 0xb6ffe0,
    good: 0x7ef0c0,
};

function createLabel(text: string, size: number, color = COLORS.paper, weight: "800" | "900" = "800"): Text {
    const label = new Text({
        text,
        style: { fontFamily: FONT, fontSize: size, fontWeight: weight, fill: color, align: "center", letterSpacing: 1 },
    });
    label.anchor.set(0.5);
    return label;
}

export function createWordScene(app: Application, stage: Stage): Scene {
    const level = levelForNumber(store.get().level);
    const crossword = crosswordFor(level);
    const reducedMotion = store.get().reducedMotion;
    const backdrop = new Graphics();
    const ambient = new Graphics();
    const boardLayer = new Container();
    const wheelLayer = new Container();
    const wheelBackdrop = new Graphics();
    const compassTicks = new Graphics();
    const trace = new Graphics();
    const traceGlow = new Graphics();
    const lettersLayer = new Container();
    const labelCluster = new Container();
    const labelPill = new Graphics();
    const wordLabel = createLabel("", 44, COLORS.paper, "900");
    const feedbackLabel = createLabel("", 34, COLORS.mintLight, "900");
    const emitter = createParticleEmitter(stage.root);
    const tweens = createTweenController();
    const letterViews: LetterView[] = [];
    const cellViews = new Map<string, CellView>();

    stage.root.addChild(backdrop, ambient, boardLayer, wheelLayer);
    labelCluster.addChild(labelPill, wordLabel, feedbackLabel);
    wheelLayer.addChild(wheelBackdrop, compassTicks, traceGlow, trace, lettersLayer, labelCluster);

    let wheelOrder = [...level.letters].map((_, index) => index);
    let selected: number[] = [];
    let dragging = false;
    let shuffling = false;
    let wheelCenterX = 0;
    let wheelCenterY = 0;
    let wheelRadius = 190;
    let letterRadius = 51;
    let lastShuffleNonce = store.get().shuffleNonce;
    let lastFeedbackId = store.get().wordFeedback?.id ?? 0;
    let lastFoundKey = store.get().currentFoundWords.join("|");
    let lastRevealedKey = store.get().revealedCells.join("|");
    let lastResult = Boolean(store.get().result);
    let feedbackLife = 0;
    let feedbackTone: "good" | "bonus" | "bad" | "neutral" | null = null;
    let shakeLife = 0;
    let boardPulse = 0;
    let celebrateLife = 0;
    let ambientT = 1.7;
    let celebratePulse = 0;
    const fxRandom = new NoiseRandom((store.get().level * 9973 + 41) >>> 0);
    let alive = true;

    const isAurora = () => store.get().ownedProductIds.includes("aurora_compass");

    function selectedWord(): string {
        return selected.map((index) => level.letters[index] ?? "").join("");
    }

    function pathColor(): number {
        return isAurora() ? COLORS.aurora : COLORS.path;
    }

    function orbitPoint(position: number, count: number): { x: number; y: number } {
        const orbit = wheelRadius * 0.66;
        const angle = -Math.PI / 2 + (position * Math.PI * 2) / Math.max(1, count);
        return { x: Math.cos(angle) * orbit, y: Math.sin(angle) * orbit };
    }

    function syncLabelPill(): void {
        const feedbackActive = feedbackLife > 0 && feedbackLabel.visible && feedbackLabel.text.length > 0;
        const word = selectedWord();
        const showWord = !feedbackActive && word.length > 0;
        wordLabel.text = word;
        wordLabel.visible = showWord;
        wordLabel.style.fill = COLORS.paper;
        wordLabel.alpha = 1;

        const active = feedbackActive ? feedbackLabel : showWord ? wordLabel : null;
        labelPill.clear();
        labelPill.visible = Boolean(active);
        if (!active) return;

        const width = Math.max(active.width, 28);
        const height = Math.max(active.height, 28);
        const padX = 22;
        const padY = 12;
        const pillW = width + padX * 2;
        const pillH = height + padY * 2;
        let fill = COLORS.deep;
        let stroke: number = COLORS.mintLight;
        if (feedbackActive) {
            if (feedbackTone === "bad") {
                fill = 0x3a1822;
                stroke = COLORS.coral;
            } else if (feedbackTone === "bonus") {
                fill = 0x3a2a14;
                stroke = COLORS.apricot;
            } else if (feedbackTone === "good") {
                fill = 0x143528;
                stroke = COLORS.good;
            } else {
                fill = 0x1a3044;
                stroke = COLORS.mintLight;
            }
        } else {
            fill = 0x12283a;
            stroke = pathColor();
        }
        labelPill
            .roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2)
            .fill({ color: fill, alpha: 0.92 })
            .stroke({ color: stroke, width: 3, alpha: 0.9 });
        labelPill.alpha = active.alpha;
    }

    function updateTrace(): void {
        trace.clear();
        traceGlow.clear();
        const points = selected
            .map((index) => letterViews.find((view) => view.originalIndex === index))
            .filter((view): view is LetterView => Boolean(view));
        if (points.length > 1) {
            const color = pathColor();
            const glow = isAurora() ? COLORS.auroraLight : COLORS.pathGlow;
            const first = points[0];
            if (first) {
                traceGlow.moveTo(first.group.x, first.group.y);
                for (const point of points.slice(1)) traceGlow.lineTo(point.group.x, point.group.y);
                traceGlow.stroke({ color: glow, width: 28, alpha: 0.28, cap: "round", join: "round" });
                trace.moveTo(first.group.x, first.group.y);
                for (const point of points.slice(1)) trace.lineTo(point.group.x, point.group.y);
                trace.stroke({ color, width: 16, alpha: 0.92, cap: "round", join: "round" });
            }
        }
        for (const view of letterViews) {
            const active = selected.includes(view.originalIndex);
            const fill = active ? pathColor() : COLORS.paper;
            view.disc
                .clear()
                .circle(0, 0, letterRadius)
                .fill(fill)
                .stroke({
                    color: active ? COLORS.paper : COLORS.deep,
                    width: active ? 5 : 4,
                    alpha: active ? 0.95 : 0.9,
                });
            view.label.style.fill = active ? COLORS.paper : COLORS.ink;
            const target = active && !reducedMotion ? 1.12 : 1;
            if (Math.abs(view.baseScale - target) > 0.01) {
                const from = view.baseScale;
                view.baseScale = target;
                if (reducedMotion) view.group.scale.set(target);
                else {
                    tweens.addTween(
                        (value) => view.group.scale.set(from + (target - from) * value),
                        0,
                        1,
                        ease.outBack,
                        undefined,
                        { durationMs: 160 },
                    );
                }
            }
        }
        syncLabelPill();
    }

    /**
     * Where the win celebration launches from.
     *
     * The clear/results card slides up over the bottom 33-46% of the screen
     * (46% on a 320x568 phone), and the wheel sits inside that band — confetti
     * fired from the wheel is spawned entirely behind the card and never seen.
     * Launch from the upper-middle instead so the arc plays in open sky.
     */
    function celebrateOriginY(): number {
        return Math.min(wheelCenterY - 40, stage.designHeight() * 0.42);
    }

    function publishQaGeometry(): void {
        if (!import.meta.env.DEV) return;
        window.__wordwhirlQaGeometry = () => ({
            designWidth: stage.designWidth(),
            designHeight: stage.designHeight(),
            letters: letterViews.map((view) => ({
                letter: level.letters[view.originalIndex] ?? "",
                x: wheelCenterX + view.group.x,
                y: wheelCenterY + view.group.y,
            })),
            particles: emitter.sample(),
        });
    }

    function layoutLetters(animateFrom: Map<number, { x: number; y: number }> | null = null): void {
        letterViews.length = 0;
        lettersLayer.removeChildren().forEach((child) => {
            child.destroy({ children: true });
        });
        const count = wheelOrder.length;
        for (let position = 0; position < count; position += 1) {
            const originalIndex = wheelOrder[position] ?? position;
            const target = orbitPoint(position, count);
            const from = animateFrom?.get(originalIndex);
            const group = new Container();
            const disc = new Graphics();
            const label = createLabel(level.letters[originalIndex] ?? "", 42, COLORS.ink, "900");
            group.x = from?.x ?? target.x;
            group.y = from?.y ?? target.y;
            group.eventMode = "static";
            group.cursor = "pointer";
            group.hitArea = new Rectangle(-letterRadius, -letterRadius, letterRadius * 2, letterRadius * 2);
            group.addChild(disc, label);
            group.on("pointerdown", (event: FederatedPointerEvent) => {
                if (store.get().paused || store.get().result || shuffling) return;
                event.stopPropagation();
                dragging = true;
                selected = [originalIndex];
                recordGesture();
                audioManager.play("letter");
                updateTrace();
            });
            lettersLayer.addChild(group);
            letterViews.push({
                originalIndex,
                group,
                disc,
                label,
                x: target.x,
                y: target.y,
                baseScale: 1,
            });
            if (from && !reducedMotion && (from.x !== target.x || from.y !== target.y)) {
                const startX = from.x;
                const startY = from.y;
                tweens.addTween(
                    (value) => {
                        group.x = startX + (target.x - startX) * value;
                        group.y = startY + (target.y - startY) * value;
                    },
                    0,
                    1,
                    ease.outCubic,
                    () => {
                        group.x = target.x;
                        group.y = target.y;
                        publishQaGeometry();
                    },
                    { durationMs: 420 },
                );
            }
        }
        updateTrace();
        publishQaGeometry();
    }

    /** Fisher–Yates using NoiseRandom (no Math.random). Prefer a new layout when possible. */
    function shuffleWheelOrder(order: number[]): number[] {
        const next = [...order];
        if (next.length < 2) return next;
        const rng = new NoiseRandom((store.get().shuffleNonce * 7919 + store.get().level * 104729 + 17) >>> 0);
        for (let attempt = 0; attempt < 6; attempt += 1) {
            for (let i = next.length - 1; i > 0; i -= 1) {
                const j = rng.int(0, i + 1);
                const a = next[i] ?? 0;
                const b = next[j] ?? 0;
                next[i] = b;
                next[j] = a;
            }
            const same = next.every((value, index) => value === order[index]);
            if (!same) return next;
        }
        // Degenerate fallback for tiny multisets (e.g. all identical letters).
        return next.length > 2 ? [...next.slice(1), next[0] ?? 0] : [...next].reverse();
    }

    function animateShuffle(): void {
        const previous = new Map<number, { x: number; y: number }>();
        for (const view of letterViews) {
            previous.set(view.originalIndex, { x: view.group.x, y: view.group.y });
        }
        wheelOrder = shuffleWheelOrder(wheelOrder);
        selected = [];
        if (reducedMotion || previous.size === 0) {
            layoutLetters();
            return;
        }
        shuffling = true;
        layoutLetters(previous);
        window.setTimeout(() => {
            if (!alive) return;
            shuffling = false;
            for (const view of letterViews) {
                view.group.x = view.x;
                view.group.y = view.y;
            }
            publishQaGeometry();
        }, 430);
    }

    function drawBoard(popKeys: Set<string> = new Set()): void {
        boardLayer.removeChildren().forEach((child) => {
            child.destroy({ children: true });
        });
        cellViews.clear();
        const state = store.get();
        const visible = solvedCellKeys(crossword, state.currentFoundWords, state.revealedCells);
        const height = stage.designHeight();
        const maxBoardWidth = stage.designWidth() * 0.72;
        const maxBoardHeight = Math.min(430, height * (height < 640 ? 0.28 : 0.34));
        const cellSize = Math.floor(Math.min(82, maxBoardWidth / crossword.width, maxBoardHeight / crossword.height));
        const gap = Math.max(5, Math.floor(cellSize * 0.08));
        const tileSize = cellSize - gap;
        const boardTop = Math.round(Math.max(height < 640 ? 120 : 150, height * 0.16));
        boardLayer.pivot.set((crossword.width * cellSize) / 2, (crossword.height * cellSize) / 2);
        boardLayer.x = Math.round((stage.designWidth() - crossword.width * cellSize) / 2) + boardLayer.pivot.x;
        boardLayer.y = boardTop + boardLayer.pivot.y;

        for (const cell of crossword.cells) {
            const isVisible = visible.has(cell.key);
            const hinted = state.revealedCells.includes(cell.key);
            const group = drawCell(cell, isVisible, hinted, cellSize, tileSize);
            const pop = popKeys.has(cell.key) && !reducedMotion ? 1 : 0;
            if (pop > 0) group.scale.set(0.55);
            cellViews.set(cell.key, { key: cell.key, group, pop });
            boardLayer.addChild(group);
            if (pop > 0) {
                const cx = group.x;
                const cy = group.y;
                emitter.burst(
                    boardLayer.x - boardLayer.pivot.x + cx + tileSize / 2,
                    boardLayer.y - boardLayer.pivot.y + cy + tileSize / 2,
                    {
                        burst: 5,
                        hue: hinted ? 38 : isAurora() ? 270 : 150,
                        lifeMinMs: 220,
                        lifeMaxMs: 480,
                        speedMinPxPerSec: 40,
                        speedMaxPxPerSec: 160,
                        radiusMinPx: 4,
                        radiusMaxPx: 10,
                        gravityPxPerSec2: 220,
                    },
                );
            }
        }
    }

    function drawCell(
        cell: CrosswordCell,
        visible: boolean,
        hinted: boolean,
        cellSize: number,
        tileSize: number,
    ): Container {
        const group = new Container();
        group.x = cell.x * cellSize + (cellSize - tileSize) / 2;
        group.y = cell.y * cellSize + (cellSize - tileSize) / 2;
        const radius = Math.max(8, tileSize * 0.18);
        const tile = new Graphics().roundRect(0, 0, tileSize, tileSize, radius);
        const fill = visible
            ? hinted
                ? COLORS.apricot
                : isAurora()
                  ? COLORS.auroraLight
                  : COLORS.mintLight
            : COLORS.deep;
        tile.fill({ color: fill, alpha: visible ? 0.97 : 0.78 }).stroke({
            color: visible ? COLORS.paper : 0x7bb0ad,
            width: 3,
            alpha: visible ? 0.82 : 0.3,
        });
        group.addChild(tile);
        if (visible) {
            const label = createLabel(cell.letter, Math.max(32, tileSize * 0.55), COLORS.ink, "900");
            label.x = tileSize / 2;
            label.y = tileSize / 2 + 1;
            group.addChild(label);
        }
        return group;
    }

    function drawCompass(): void {
        const ring = isAurora() ? COLORS.auroraLight : COLORS.mintLight;
        wheelBackdrop
            .clear()
            .circle(0, 0, wheelRadius + 10)
            .fill({ color: COLORS.deep, alpha: 0.22 })
            .circle(0, 0, wheelRadius)
            .fill({ color: COLORS.deep, alpha: 0.82 })
            .stroke({ color: ring, width: 4, alpha: 0.62 })
            .circle(0, 0, wheelRadius - 18)
            .stroke({ color: COLORS.paper, width: 2, alpha: 0.14 });
        compassTicks.clear();
        for (let index = 0; index < 24; index += 1) {
            const angle = (index * Math.PI * 2) / 24;
            const outer = wheelRadius - 6;
            const inner = outer - (index % 6 === 0 ? 19 : 10);
            compassTicks
                .moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
                .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        }
        compassTicks.stroke({ color: COLORS.paper, width: 3, alpha: 0.26, cap: "round" });
    }

    function drawAmbient(): void {
        ambient.clear();
        const width = stage.designWidth();
        const height = stage.designHeight();
        for (let i = 0; i < 12; i += 1) {
            const x = (((i * 97 + Math.sin(ambientT + i) * 18) % width) + width) % width;
            const y =
                (((i * 143 + Math.cos(ambientT * 0.7 + i * 0.4) * 22) % (height * 0.55)) + height * 0.08) %
                (height * 0.6);
            const r = 1.4 + (i % 3) * 0.7;
            ambient.circle(x, y, r).fill({ color: COLORS.mintLight, alpha: 0.12 + (i % 4) * 0.03 });
        }
    }

    function layout(): void {
        const width = stage.designWidth();
        const height = stage.designHeight();
        backdrop
            .clear()
            .rect(0, 0, width, height)
            .fill({ color: 0x10243a, alpha: 0.08 })
            .circle(width * 0.14, height * 0.55, 150)
            .fill({ color: COLORS.mint, alpha: 0.04 })
            .circle(width * 0.86, height * 0.28, 110)
            .fill({ color: COLORS.apricot, alpha: 0.035 });
        stage.root.hitArea = new Rectangle(0, 0, width, height);
        // Orbs sit mid-flank of the wheel; leave side gutters and a modest bottom margin.
        wheelRadius = Math.min(190, width * 0.26, Math.max(124, height * 0.165));
        letterRadius = Math.min(50, wheelRadius * 0.28);
        wheelCenterX = width / 2;
        wheelCenterY = height - Math.max(height < 640 ? 128 : 148, height * 0.175);
        wheelLayer.x = wheelCenterX;
        wheelLayer.y = wheelCenterY;
        labelCluster.y = -wheelRadius - 56;
        drawCompass();
        drawAmbient();
        layoutLetters();
        drawBoard();
        syncLabelPill();
    }

    function addLetterAtPoint(pointX: number, pointY: number): void {
        if (!dragging || shuffling) return;
        for (const view of letterViews) {
            const distance = Math.hypot(pointX - (wheelCenterX + view.group.x), pointY - (wheelCenterY + view.group.y));
            if (distance > letterRadius * 1.15 || selected.includes(view.originalIndex)) continue;
            selected.push(view.originalIndex);
            audioManager.play("letter");
            updateTrace();
            if (!reducedMotion) {
                emitter.burst(wheelCenterX + view.x, wheelCenterY + view.y, {
                    burst: 3,
                    hue: isAurora() ? 270 : 330,
                    lifeMinMs: 160,
                    lifeMaxMs: 320,
                    speedMinPxPerSec: 20,
                    speedMaxPxPerSec: 90,
                    radiusMinPx: 2.5,
                    radiusMaxPx: 6,
                    // Near-weightless: this sparkle should hang on the orb, not drop off it.
                    gravityPxPerSec2: 80,
                });
            }
            break;
        }
    }

    const onPointerMove = (event: FederatedPointerEvent) => {
        const point = event.getLocalPosition(stage.root);
        addLetterAtPoint(point.x, point.y);
    };
    const finishDrag = () => {
        if (!dragging) return;
        dragging = false;
        const word = selectedWord();
        selected = [];
        updateTrace();
        if (word) submitWord(word);
    };

    function onKeyDown(event: KeyboardEvent): void {
        if (store.get().paused || store.get().result || shuffling) return;
        if (event.key === "Enter") {
            const word = selectedWord();
            selected = [];
            updateTrace();
            if (word) submitWord(word);
            event.preventDefault();
            return;
        }
        if (event.key === "Backspace") {
            selected.pop();
            updateTrace();
            event.preventDefault();
            return;
        }
        const letter = event.key.toUpperCase();
        if (!/^[A-Z]$/.test(letter)) return;
        const originalIndex = [...level.letters].findIndex(
            (candidate, index) => candidate === letter && !selected.includes(index),
        );
        if (originalIndex < 0) return;
        selected.push(originalIndex);
        recordGesture();
        audioManager.play("letter");
        updateTrace();
        event.preventDefault();
    }

    stage.root.eventMode = "static";
    stage.root.on("globalpointermove", onPointerMove);
    stage.root.on("pointerup", finishDrag);
    stage.root.on("pointerupoutside", finishDrag);
    window.addEventListener("keydown", onKeyDown);

    const unsubscribe = store.subscribe(() => {
        if (!alive) return;
        const state = store.get();
        if (state.shuffleNonce !== lastShuffleNonce && !dragging && !shuffling) {
            lastShuffleNonce = state.shuffleNonce;
            animateShuffle();
        }

        const foundKey = state.currentFoundWords.join("|");
        const revealedKey = state.revealedCells.join("|");
        if (foundKey !== lastFoundKey || revealedKey !== lastRevealedKey) {
            const prevVisible = solvedCellKeys(
                crossword,
                lastFoundKey ? lastFoundKey.split("|").filter(Boolean) : [],
                lastRevealedKey ? lastRevealedKey.split("|").filter(Boolean) : [],
            );
            const nextVisible = solvedCellKeys(crossword, state.currentFoundWords, state.revealedCells);
            const popKeys = new Set<string>();
            for (const key of nextVisible) if (!prevVisible.has(key)) popKeys.add(key);
            lastFoundKey = foundKey;
            lastRevealedKey = revealedKey;
            boardPulse = reducedMotion ? 0 : 0.32;
            drawBoard(popKeys);
        }

        if ((state.wordFeedback?.id ?? 0) !== lastFeedbackId) {
            lastFeedbackId = state.wordFeedback?.id ?? 0;
            const feedback = state.wordFeedback;
            feedbackTone = feedback?.tone ?? null;
            feedbackLabel.text = feedback?.text ?? "";
            feedbackLabel.style.fill =
                feedback?.tone === "bad"
                    ? COLORS.coral
                    : feedback?.tone === "bonus"
                      ? COLORS.apricot
                      : feedback?.tone === "good"
                        ? COLORS.good
                        : COLORS.mintLight;
            feedbackLabel.visible = Boolean(feedback);
            feedbackLabel.alpha = 1;
            feedbackLabel.scale.set(reducedMotion ? 1 : 0.86);
            // Hold winning words longer so the last answer is readable before results.
            feedbackLife = state.result ? 1.75 : feedback?.tone === "bad" ? 1.15 : 1.45;
            labelCluster.scale.set(reducedMotion ? 1 : 0.9);
            if (!reducedMotion) {
                tweens.addTween(
                    (value) => {
                        feedbackLabel.scale.set(0.86 + 0.14 * value);
                        labelCluster.scale.set(0.9 + 0.1 * value);
                    },
                    0,
                    1,
                    ease.outBack,
                    undefined,
                    {
                        durationMs: 220,
                    },
                );
            }
            syncLabelPill();
            if (feedback?.tone === "bad" && !reducedMotion) shakeLife = 0.28;
            if ((feedback?.tone === "good" || feedback?.tone === "bonus") && !reducedMotion) {
                emitter.burst(wheelCenterX, wheelCenterY - wheelRadius - 45, {
                    burst: feedback.tone === "bonus" ? 18 : 13,
                    hue: feedback.tone === "bonus" ? 38 : 150,
                    lifeMinMs: 280,
                    lifeMaxMs: 620,
                    // The sky paintings are busy; 2-6 unit dots disappear into them.
                    speedMinPxPerSec: 90,
                    speedMaxPxPerSec: 330,
                    radiusMinPx: 5,
                    radiusMaxPx: 12,
                    gravityPxPerSec2: 380,
                });
            }
        }

        if (Boolean(state.result) !== lastResult) {
            lastResult = Boolean(state.result);
            if (state.result && !reducedMotion) {
                celebrateLife = 1.7;
                emitter.burst(wheelCenterX, celebrateOriginY(), {
                    burst: 34,
                    hue: 150,
                    lifeMinMs: 520,
                    lifeMaxMs: 1050,
                    speedMinPxPerSec: 140,
                    speedMaxPxPerSec: 520,
                    radiusMinPx: 5,
                    radiusMaxPx: 13,
                    // Lighter drag than the default so the fan actually spreads
                    // across the sky before gravity takes it back down.
                    dragPerSec: 0.62,
                    // Fire a wide upward fan rather than a ring, so the confetti
                    // climbs into open sky instead of straight into the card.
                    directionRad: -Math.PI / 2,
                    arcRad: Math.PI * 1.2,
                    gravityPxPerSec2: 620,
                });
                emitter.burst(stage.designWidth() / 2, boardLayer.y, {
                    burst: 18,
                    hue: 38,
                    lifeMinMs: 360,
                    lifeMaxMs: 760,
                });
            }
        }

        drawCompass();
        updateTrace();
    });

    const offResize = stage.onResize(layout);
    layout();

    const tick = (ticker: Ticker) => {
        const dt = Math.min(0.05, ticker.deltaMS / 1000);
        emitter.update(dt);
        tweens.update(dt);
        if (!reducedMotion) {
            compassTicks.rotation += dt * 0.04;
            ambientT += dt * 0.35;
            if (Math.floor(ambientT * 8) !== Math.floor((ambientT - dt * 0.35) * 8)) drawAmbient();
        }
        if (feedbackLife > 0) {
            feedbackLife -= dt;
            feedbackLabel.alpha = Math.min(1, feedbackLife * 2.6);
            if (feedbackLife <= 0) {
                feedbackLabel.visible = false;
                feedbackTone = null;
            }
            syncLabelPill();
        }
        if (shakeLife > 0) {
            shakeLife -= dt;
            wheelLayer.x = wheelCenterX + Math.sin(shakeLife * 90) * 8 * (shakeLife / 0.28);
        } else wheelLayer.x = wheelCenterX;
        if (boardPulse > 0) {
            boardPulse -= dt;
            const pulse = 1 + Math.sin((1 - boardPulse / 0.32) * Math.PI) * 0.03;
            boardLayer.scale.set(pulse);
        } else boardLayer.scale.set(1);
        if (celebrateLife > 0) {
            celebrateLife -= dt;
            celebratePulse += dt;
            if (!reducedMotion && celebrateLife > 0.4 && celebratePulse >= 0.12) {
                celebratePulse = 0;
                emitter.burst(wheelCenterX + fxRandom.float(-140, 140), celebrateOriginY() + fxRandom.float(-40, 40), {
                    burst: 3,
                    hue: fxRandom.float(0, 1) > 0.5 ? 150 : 38,
                    lifeMinMs: 240,
                    lifeMaxMs: 480,
                    speedMinPxPerSec: 30,
                    speedMaxPxPerSec: 120,
                    gravityPxPerSec2: 160,
                });
            }
        }
        for (const cell of cellViews.values()) {
            if (cell.pop <= 0) continue;
            cell.pop = Math.max(0, cell.pop - dt * 3.4);
            const t = 1 - cell.pop;
            const scale = 0.55 + ease.outBack(Math.min(1, t)) * 0.45;
            cell.group.scale.set(scale);
        }
    };
    app.ticker.add(tick);

    return {
        destroy() {
            alive = false;
            app.ticker.remove(tick);
            offResize();
            unsubscribe();
            tweens.clear();
            window.removeEventListener("keydown", onKeyDown);
            stage.root.off("globalpointermove", onPointerMove);
            stage.root.off("pointerup", finishDrag);
            stage.root.off("pointerupoutside", finishDrag);
            emitter.destroy();
            if (import.meta.env.DEV) delete window.__wordwhirlQaGeometry;
            backdrop.destroy();
            ambient.destroy();
            boardLayer.destroy({ children: true });
            wheelLayer.destroy({ children: true });
        },
    };
}
