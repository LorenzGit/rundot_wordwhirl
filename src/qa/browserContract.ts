import { audioManager } from "../audio/audioManager.ts";
import { requestHint, shuffleLetters, startCurrentLevel, submitWord } from "../game/gameController.ts";
import { levelForNumber } from "../game/words/levels.ts";
import { store, type AppState } from "../state/store.ts";
import { setHostPaused } from "../systems/hostPause.ts";
import { saveSystem } from "../systems/save.ts";
import { adHintDiagnostics } from "../systems/ads.ts";

export interface WordwhirlQaContract {
    snapshot(): Record<string, unknown>;
    startGame(): void;
    submit(word: string): void;
    solveLevel(): void;
    shuffle(): void;
    hint(): Promise<void>;
    unlockAudio(): Promise<boolean>;
    setPaused(paused: boolean): void;
    setSetting(key: "musicEnabled" | "sfxEnabled" | "hapticsEnabled" | "reducedMotion", value: boolean): Promise<void>;
    seedLevel(level: number): Promise<void>;
}

declare global {
    interface Window {
        __gameQa?: WordwhirlQaContract;
        __wordwhirlQaGeometry?: () => {
            designWidth: number;
            designHeight: number;
            letters: Array<{ letter: string; x: number; y: number }>;
            particles: Array<{ x: number; y: number; vy: number; alpha: number; radius: number }>;
        };
    }
}

export function installBrowserQaContract(): void {
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get("qa") !== "1") return;
    window.__gameQa = {
        snapshot() {
            const state = store.get();
            return {
                phase: state.phase,
                menuScreen: state.menuScreen,
                level: state.level,
                sparks: state.sparks,
                foundWords: [...state.currentFoundWords],
                bonusWords: [...state.currentBonusWords],
                revealedCells: [...state.revealedCells],
                result: state.result,
                paused: state.paused,
                reducedMotion: state.reducedMotion,
                renderer: document.documentElement.dataset.renderer ?? "unknown",
                audio: audioManager.debugSnapshot(),
                ads: adHintDiagnostics(),
            };
        },
        startGame: startCurrentLevel,
        submit: submitWord,
        solveLevel() {
            const level = levelForNumber(store.get().level);
            for (const answer of level.answers) submitWord(answer);
        },
        shuffle: shuffleLetters,
        hint: requestHint,
        unlockAudio: () => audioManager.unlock(),
        setPaused(paused) {
            setHostPaused("qa_pause", paused);
        },
        async setSetting(key, value) {
            store.patch({ [key]: value } as Pick<AppState, typeof key>);
            if (key === "reducedMotion") document.documentElement.dataset.reducedMotion = String(value);
            await saveSystem.flush();
        },
        async seedLevel(level) {
            store.patch({
                level: Math.max(1, Math.min(12, Math.floor(level))),
                currentFoundWords: [],
                currentBonusWords: [],
                revealedCells: [],
                hintsUsed: 0,
                invalidAttempts: 0,
                result: null,
                phase: "playing",
            });
            await saveSystem.flush();
        },
    };
}
