/**
 * Regression: hinting out the last cells of an answer used to leave the board fully
 * revealed but the level uncompleted, because hints wrote to `revealedCells` while
 * completion only ever read `currentFoundWords`. The player saw a finished board and
 * had nothing left to do. Reported live on level 7 (STORM).
 *
 * These assertions cover the pure rule: a word whose cells are all visible counts as
 * solved. `gameController` applies the same rule on every reveal.
 */
import { answersFullyRevealed, crosswordFor, nextHintCell } from "../src/game/words/crossword.ts";
import { levelForNumber } from "../src/game/words/levels.ts";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

/** Calls the same helper gameController uses, so a regression here fails the build. */
function wordsFullyRevealed(levelNumber: number, foundWords: string[], revealedCells: string[]): string[] {
    const level = levelForNumber(levelNumber);
    return answersFullyRevealed(crosswordFor(level), level.answers, foundWords, revealedCells);
}

/** Spend hints until the board runs out of hidden cells, as a player with stock would. */
function hintUntilExhausted(levelNumber: number): { revealedCells: string[]; foundWords: string[] } {
    const level = levelForNumber(levelNumber);
    const crossword = crosswordFor(level);
    const revealedCells: string[] = [];
    const foundWords: string[] = [];
    for (let guard = 0; guard <= crossword.cells.length; guard += 1) {
        const cell = nextHintCell(crossword, foundWords, revealedCells);
        if (!cell) break;
        revealedCells.push(cell.key);
        foundWords.push(...wordsFullyRevealed(levelNumber, foundWords, revealedCells));
    }
    return { revealedCells, foundWords };
}

// The exact reported case, plus a generated level and the deepest authored board.
for (const levelNumber of [7, 12, 13, 500]) {
    const level = levelForNumber(levelNumber);
    const { foundWords } = hintUntilExhausted(levelNumber);
    for (const answer of level.answers) {
        assert(
            foundWords.includes(answer),
            `level ${levelNumber} (${level.id}): revealing every cell left "${answer}" uncredited — board looks solved but the level cannot complete`,
        );
    }
    console.log(
        `level ${String(levelNumber).padStart(3)} ${level.id.padEnd(11)} hint-only clear credits all ${level.answers.length} answers`,
    );
}

// The shape of an already-broken save: every cell revealed, nothing credited. One call
// must repair the whole board, because entering the level is the only recovery point -
// spending another hint finds nothing to reveal and bails out early.
for (const levelNumber of [7, 13]) {
    const level = levelForNumber(levelNumber);
    const everyCell = crosswordFor(level).cells.map((cell) => cell.key);
    const repaired = wordsFullyRevealed(levelNumber, [], everyCell);
    for (const answer of level.answers) {
        assert(
            repaired.includes(answer),
            `level ${levelNumber} (${level.id}): a fully revealed board left "${answer}" uncredited on entry — an existing stuck save would never recover`,
        );
    }
    console.log(
        `level ${String(levelNumber).padStart(3)} ${level.id.padEnd(11)} stuck save repairs all ${level.answers.length} answers on entry`,
    );
}

// A partially hinted word must NOT be credited early.
const partial = levelForNumber(7);
const partialCrossword = crosswordFor(partial);
const firstAnswer = partial.answers[0];
assert(firstAnswer, "level 7 has no answers");
const answerCells = partialCrossword.cells.filter((entry) => entry.words.includes(firstAnswer));
assert(answerCells.length > 1, "expected a multi-cell answer to test partial reveals");
const allButOne = answerCells.slice(0, -1).map((entry) => entry.key);
assert(
    !wordsFullyRevealed(7, [], allButOne).includes(firstAnswer),
    `"${firstAnswer}" was credited with one cell still hidden`,
);
console.log(`level   7 partial reveal correctly withholds credit for "${firstAnswer}"`);

console.log("\nHint-completion regression passed.");
