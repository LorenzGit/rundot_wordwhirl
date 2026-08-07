import { isSafeWord } from "../src/game/words/dictionary.ts";
import {
    clearCrosswordCache,
    crosswordFor,
    nextHintCell,
    placementsAreClean,
    solvedCellKeys,
} from "../src/game/words/crossword.ts";
import { LEVELS, assertLevelUsesSafeWords, canSpell, maxWordLengthForLevel } from "../src/game/words/levels.ts";
import { evaluateWord, levelSparkReward } from "../src/game/words/rules.ts";

clearCrosswordCache();

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

let totalAnswers = 0;
let totalBonus = 0;
let previousReward = 0;
let previousMaxAnswerLen = 0;

for (const [index, level] of LEVELS.entries()) {
    const levelNumber = index + 1;
    const bandMax = maxWordLengthForLevel(levelNumber);
    assertLevelUsesSafeWords(level, levelNumber);
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

    const reward = levelSparkReward(index + 1);
    assert(reward >= previousReward, `${level.id}: reward curve decreased`);
    previousReward = reward;
    totalAnswers += level.answers.length;
    totalBonus += level.bonus.length;
    console.log(
        `${String(levelNumber).padStart(2, "0")} ${level.id.padEnd(12)} ${crossword.width}x${crossword.height} · max ${maxAnswerLen}/${bandMax} · ${level.answers.length} answers · +${reward} Sparks`,
    );
}

assert(LEVELS.length === 12, "launch route must contain twelve levels");
console.log(`Simulation passed: ${LEVELS.length} levels, ${totalAnswers} answers, ${totalBonus} bonus words.`);
