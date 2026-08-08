import { isSafeWord } from "../src/game/words/dictionary.ts";
import {
    clearCrosswordCache,
    crosswordFor,
    nextHintCell,
    placementsAreClean,
    solvedCellKeys,
} from "../src/game/words/crossword.ts";
import {
    FIRST_GENERATED_LEVEL,
    HANDCRAFTED_LEVELS,
    assertLevelUsesSafeWords,
    canSpell,
    clearLevelMemo,
    levelForNumber,
    maxWordLengthForLevel,
} from "../src/game/words/levels.ts";
import { evaluateWord, levelSparkReward } from "../src/game/words/rules.ts";
import { WHEELS, WHEEL_TABLE_VERSION } from "../src/game/words/wheels.data.ts";

clearCrosswordCache();
clearLevelMemo();

/**
 * Levels are generated at runtime and unbounded, so solvability cannot be proven by
 * inspecting shipped data. Instead we generate a deep prefix here and assert the same
 * invariants the twelve authored levels have always had to satisfy.
 */
const SIM_LEVELS = Number(process.env.WORDWHIRL_SIM_LEVELS ?? 2000);

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

let totalAnswers = 0;
let totalBonus = 0;
let previousReward = 0;
let previousMaxAnswerLen = 0;
let widest = 0;
let tallest = 0;

for (let levelNumber = 1; levelNumber <= SIM_LEVELS; levelNumber += 1) {
    const level = levelForNumber(levelNumber);
    const bandMax = maxWordLengthForLevel(levelNumber);
    assertLevelUsesSafeWords(level, levelNumber);

    assert(level.letters.length >= 3 && level.letters.length <= 6, `${level.id}: wheel must hold 3-6 letters`);

    const answerSet = new Set(level.answers);
    const bonusSet = new Set(level.bonus);
    assert(answerSet.size === level.answers.length, `${level.id}: duplicate answer`);
    assert(bonusSet.size === level.bonus.length, `${level.id}: duplicate bonus word`);
    let maxAnswerLen = 0;
    for (const answer of level.answers) {
        assert(isSafeWord(answer), `${level.id}: answer ${answer} not in safe dictionary`);
        assert(answer.length <= bandMax, `${level.id}: answer ${answer} exceeds band max ${bandMax}`);
        assert(canSpell(level.letters, answer), `${level.id}: ${answer} cannot be spelled from ${level.letters}`);
        assert(!bonusSet.has(answer), `${level.id}: ${answer} is both answer and bonus`);
        maxAnswerLen = Math.max(maxAnswerLen, answer.length);
    }
    for (const bonus of level.bonus) {
        assert(isSafeWord(bonus), `${level.id}: bonus ${bonus} not in safe dictionary`);
        assert(bonus.length <= bandMax, `${level.id}: bonus ${bonus} exceeds band max ${bandMax}`);
        assert(canSpell(level.letters, bonus), `${level.id}: bonus ${bonus} cannot be spelled`);
    }
    assert(maxAnswerLen <= bandMax, `${level.id}: answer length exceeds band`);
    if (levelNumber >= 4) {
        assert(maxAnswerLen === bandMax, `${level.id}: expected a ${bandMax}-letter answer in this band`);
    }
    assert(
        maxAnswerLen >= previousMaxAnswerLen || bandMax === previousMaxAnswerLen,
        `${level.id}: difficulty regressed (max answer ${maxAnswerLen} after ${previousMaxAnswerLen})`,
    );
    previousMaxAnswerLen = Math.max(previousMaxAnswerLen, maxAnswerLen);

    const crossword = crosswordFor(level);
    assert(crossword.placements.length === level.answers.length, `${level.id}: placement count mismatch`);
    assert(placementsAreClean(crossword.placements), `${level.id}: accidental adjacency creates fake word slots`);
    widest = Math.max(widest, crossword.width);
    tallest = Math.max(tallest, crossword.height);
    const cells = new Map(crossword.cells.map((cell) => [cell.key, cell]));
    for (const placement of crossword.placements) {
        for (let letterIndex = 0; letterIndex < placement.word.length; letterIndex += 1) {
            const x = placement.x + (placement.direction === "across" ? letterIndex : 0);
            const y = placement.y + (placement.direction === "down" ? letterIndex : 0);
            assert(
                cells.get(`${x},${y}`)?.letter === placement.word[letterIndex],
                `${level.id}: crossing conflict in ${placement.word}`,
            );
        }
    }

    const found: string[] = [];
    for (const answer of level.answers) {
        assert(evaluateWord(level, answer, found, []) === "answer", `${level.id}: ${answer} was not accepted`);
        found.push(answer);
        assert(evaluateWord(level, answer, found, []) === "duplicate", `${level.id}: duplicate ${answer} was accepted`);
    }
    const solved = solvedCellKeys(crossword, found, []);
    assert(solved.size === crossword.cells.length, `${level.id}: answers leave hidden cells`);

    const revealed: string[] = [];
    while (true) {
        const hint = nextHintCell(crossword, [], revealed);
        if (!hint) break;
        assert(!revealed.includes(hint.key), `${level.id}: hint repeated ${hint.key}`);
        revealed.push(hint.key);
    }
    assert(revealed.length === crossword.cells.length, `${level.id}: hints cannot reach every cell`);

    const reward = levelSparkReward(levelNumber);
    assert(reward >= previousReward, `${level.id}: reward curve decreased`);
    previousReward = reward;
    totalAnswers += level.answers.length;
    totalBonus += level.bonus.length;

    const sampled = levelNumber <= HANDCRAFTED_LEVELS.length || levelNumber % 250 === 0;
    if (sampled) {
        console.log(
            `${String(levelNumber).padStart(4, "0")} ${level.id.padEnd(12)} ${level.letters.padEnd(7)} ${crossword.width}x${crossword.height} · max ${maxAnswerLen}/${bandMax} · ${level.answers.length} answers · ${level.bonus.length} bonus · +${reward} Sparks`,
        );
    }
}

// Generation must be a pure function of the level number: same input, same level.
clearLevelMemo();
for (const probe of [FIRST_GENERATED_LEVEL, 100, 1000, SIM_LEVELS]) {
    const first = levelForNumber(probe);
    clearLevelMemo();
    const second = levelForNumber(probe);
    assert(first.letters === second.letters, `level ${probe}: wheel is not deterministic`);
    assert(first.answers.join(",") === second.answers.join(","), `level ${probe}: answers are not deterministic`);
}

assert(HANDCRAFTED_LEVELS.length === 12, "authored teaching sequence must contain twelve levels");
assert(WHEELS.length > 0, "wheel table is empty");
console.log(
    `\nSimulation passed: ${SIM_LEVELS} levels (${HANDCRAFTED_LEVELS.length} authored, ${SIM_LEVELS - HANDCRAFTED_LEVELS.length} generated), ` +
        `${totalAnswers} answers, ${totalBonus} bonus words, largest board ${widest}x${tallest}, ` +
        `wheel table v${WHEEL_TABLE_VERSION} (${WHEELS.length} wheels).`,
);
