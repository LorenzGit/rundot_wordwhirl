import type { WordLevel } from "./levels.ts";

export type Direction = "across" | "down";

export interface WordPlacement {
    word: string;
    x: number;
    y: number;
    direction: Direction;
}

export interface CrosswordCell {
    key: string;
    x: number;
    y: number;
    letter: string;
    words: readonly string[];
}

export interface Crossword {
    width: number;
    height: number;
    placements: readonly WordPlacement[];
    cells: readonly CrosswordCell[];
}

interface MutableCell {
    x: number;
    y: number;
    letter: string;
    words: string[];
    directions: Set<Direction>;
}

const cellKey = (x: number, y: number): string => `${x},${y}`;

function coordinates(
    word: string,
    x: number,
    y: number,
    direction: Direction,
): Array<{ x: number; y: number; letter: string }> {
    return [...word].map((letter, index) => ({
        x: x + (direction === "across" ? index : 0),
        y: y + (direction === "down" ? index : 0),
        letter,
    }));
}

function bounds(cells: Iterable<{ x: number; y: number }>): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const cell of cells) {
        minX = Math.min(minX, cell.x);
        minY = Math.min(minY, cell.y);
        maxX = Math.max(maxX, cell.x);
        maxY = Math.max(maxY, cell.y);
    }
    return { minX, minY, maxX, maxY };
}

/**
 * Every orthogonal adjacency must be consecutive letters of a real placement.
 * Rejects packed layouts that invent fake slots (e.g. vertical "WO" next to OWN/WON).
 */
export function placementsAreClean(placements: readonly WordPlacement[]): boolean {
    const letters = new Map<string, string>();
    const acrossFrom = new Set<string>();
    const downFrom = new Set<string>();

    for (const placement of placements) {
        const points = coordinates(placement.word, placement.x, placement.y, placement.direction);
        for (let index = 0; index < points.length; index += 1) {
            const point = points[index];
            if (!point) continue;
            const key = cellKey(point.x, point.y);
            const existing = letters.get(key);
            if (existing && existing !== point.letter) return false;
            letters.set(key, point.letter);
            if (index === 0) continue;
            const prev = points[index - 1];
            if (!prev) continue;
            if (placement.direction === "across") acrossFrom.add(cellKey(prev.x, prev.y));
            else downFrom.add(cellKey(prev.x, prev.y));
        }
    }

    for (const key of letters.keys()) {
        const [xs, ys] = key.split(",");
        const x = Number(xs);
        const y = Number(ys);
        if (letters.has(cellKey(x + 1, y)) && !acrossFrom.has(key)) return false;
        if (letters.has(cellKey(x, y + 1)) && !downFrom.has(key)) return false;
    }
    return true;
}

function cloneGrid(grid: Map<string, MutableCell>): Map<string, MutableCell> {
    const next = new Map<string, MutableCell>();
    for (const [key, cell] of grid) {
        next.set(key, {
            x: cell.x,
            y: cell.y,
            letter: cell.letter,
            words: [...cell.words],
            directions: new Set(cell.directions),
        });
    }
    return next;
}

function applyPlacement(
    grid: Map<string, MutableCell>,
    word: string,
    x: number,
    y: number,
    direction: Direction,
): void {
    for (const point of coordinates(word, x, y, direction)) {
        const key = cellKey(point.x, point.y);
        const existing = grid.get(key);
        if (existing) {
            existing.words.push(word);
            existing.directions.add(direction);
        } else {
            grid.set(key, { ...point, words: [word], directions: new Set([direction]) });
        }
    }
}

function candidateFits(
    grid: Map<string, MutableCell>,
    word: string,
    x: number,
    y: number,
    direction: Direction,
): { overlap: number } | null {
    const points = coordinates(word, x, y, direction);
    let overlap = 0;
    for (const point of points) {
        const existing = grid.get(cellKey(point.x, point.y));
        if (!existing) continue;
        if (existing.letter !== point.letter || existing.directions.has(direction)) return null;
        overlap += 1;
    }
    if (overlap === 0 && grid.size > 0) return null;
    return { overlap };
}

interface SearchState {
    grid: Map<string, MutableCell>;
    placements: WordPlacement[];
    remaining: string[];
}

function searchLayout(state: SearchState): SearchState | null {
    if (state.remaining.length === 0) {
        return placementsAreClean(state.placements) ? state : null;
    }

    const word = state.remaining[0];
    if (!word) return null;
    const rest = state.remaining.slice(1);
    const candidates: Array<{ x: number; y: number; direction: Direction; score: number }> = [];

    if (state.placements.length === 0) {
        candidates.push({ x: 0, y: 0, direction: "across", score: 0 });
    } else {
        for (let letterIndex = 0; letterIndex < word.length; letterIndex += 1) {
            const letter = word[letterIndex];
            for (const target of state.grid.values()) {
                if (target.letter !== letter) continue;
                for (const direction of ["across", "down"] as const) {
                    if (target.directions.has(direction)) continue;
                    const x = target.x - (direction === "across" ? letterIndex : 0);
                    const y = target.y - (direction === "down" ? letterIndex : 0);
                    const fit = candidateFits(state.grid, word, x, y, direction);
                    if (!fit) continue;
                    const trialPlacements = [...state.placements, { word, x, y, direction }];
                    if (!placementsAreClean(trialPlacements)) continue;
                    const points = coordinates(word, x, y, direction);
                    const candidateBounds = bounds([...state.grid.values(), ...points]);
                    const area =
                        (candidateBounds.maxX - candidateBounds.minX + 1) *
                        (candidateBounds.maxY - candidateBounds.minY + 1);
                    // Prefer more overlap, then tighter boards, then stable coords.
                    const score = -fit.overlap * 100 + area * 10 + Math.abs(x) + Math.abs(y);
                    candidates.push({ x, y, direction, score });
                }
            }
        }
    }

    candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x || a.direction.localeCompare(b.direction));

    for (const candidate of candidates) {
        const nextGrid = cloneGrid(state.grid);
        applyPlacement(nextGrid, word, candidate.x, candidate.y, candidate.direction);
        const nextPlacements = [
            ...state.placements,
            { word, x: candidate.x, y: candidate.y, direction: candidate.direction },
        ];
        const solved = searchLayout({ grid: nextGrid, placements: nextPlacements, remaining: rest });
        if (solved) return solved;
    }
    return null;
}

export function buildCrossword(level: WordLevel): Crossword {
    const ordered = [...level.answers].sort(
        (a, b) => b.length - a.length || level.answers.indexOf(a) - level.answers.indexOf(b),
    );
    const solved = searchLayout({ grid: new Map(), placements: [], remaining: ordered });
    if (!solved) {
        throw new Error(`${level.id}: no clean crossword layout (no accidental word slots)`);
    }

    const gridBounds = bounds(solved.grid.values());
    const shiftX = -gridBounds.minX;
    const shiftY = -gridBounds.minY;
    const normalizedPlacements = solved.placements.map((placement) => ({
        ...placement,
        x: placement.x + shiftX,
        y: placement.y + shiftY,
    }));
    if (!placementsAreClean(normalizedPlacements)) {
        throw new Error(`${level.id}: layout failed clean-run validation`);
    }
    const cells = [...solved.grid.values()]
        .map((cell) => ({
            key: cellKey(cell.x + shiftX, cell.y + shiftY),
            x: cell.x + shiftX,
            y: cell.y + shiftY,
            letter: cell.letter,
            words: [...cell.words],
        }))
        .sort((a, b) => a.y - b.y || a.x - b.x);
    return {
        width: gridBounds.maxX - gridBounds.minX + 1,
        height: gridBounds.maxY - gridBounds.minY + 1,
        placements: normalizedPlacements,
        cells,
    };
}

const CACHE = new Map<string, Crossword>();
/**
 * Bounded: generated levels mint a fresh id each time, so an unlimited run would
 * otherwise grow this map for every level the player ever touches. Insertion order
 * makes the first key the least recently added.
 */
const CACHE_LIMIT = 64;

export function crosswordFor(level: WordLevel): Crossword {
    const cached = CACHE.get(level.id);
    if (cached) {
        // Refresh recency so the active level is never the next one evicted.
        CACHE.delete(level.id);
        CACHE.set(level.id, cached);
        return cached;
    }
    const built = buildCrossword(level);
    CACHE.set(level.id, built);
    if (CACHE.size > CACHE_LIMIT) {
        const oldest = CACHE.keys().next().value;
        if (oldest !== undefined) CACHE.delete(oldest);
    }
    return built;
}

/** Test helper: drop cached layouts after level data changes. */
export function clearCrosswordCache(): void {
    CACHE.clear();
}

export function solvedCellKeys(
    crossword: Crossword,
    foundWords: readonly string[],
    revealedCells: readonly string[],
): Set<string> {
    const visible = new Set(revealedCells);
    const found = new Set(foundWords);
    for (const placement of crossword.placements) {
        if (!found.has(placement.word)) continue;
        for (const point of coordinates(placement.word, placement.x, placement.y, placement.direction)) {
            visible.add(cellKey(point.x, point.y));
        }
    }
    return visible;
}

export function nextHintCell(
    crossword: Crossword,
    foundWords: readonly string[],
    revealedCells: readonly string[],
): CrosswordCell | null {
    const visible = solvedCellKeys(crossword, foundWords, revealedCells);
    return crossword.cells.find((cell) => !visible.has(cell.key)) ?? null;
}
