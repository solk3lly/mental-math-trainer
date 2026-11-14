import assert from 'node:assert/strict';
import { createProblem, sanitizeSettings, PRACTICE_MODES } from './utils/mathEngine.js';
import { solveAiExpression } from './utils/aiMath.js';
import { solveTrainerProblem } from './utils/aiTrainer.js';
import { createActiveRound, processRoundSubmission } from './utils/trainerRound.js';

let seed = 7418923;
const originalRandom = Math.random;
Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
function fraction(value) {
  const text = String(value);
  const [whole, decimal = ''] = text.split('.');
  return [BigInt(whole + decimal), 10n ** BigInt(decimal.length)];
}
function verify(problem) {
  const [a, ad] = fraction(problem.leftOperand);
  const [b, bd] = fraction(problem.rightOperand);
  const [answer, d] = fraction(problem.correctAnswer);
  switch (problem.operation) {
    case 'ADDITION': assert.equal(answer * ad * bd, (a * bd + b * ad) * d); break;
    case 'SUBTRACTION': assert.equal(answer * ad * bd, (a * bd - b * ad) * d); assert(answer >= 0n); break;
    case 'MULTIPLICATION': assert.equal(answer * ad * bd, a * b * d); break;
    case 'DIVISION': assert(b > 0n); assert.equal(answer * ad * b, a * bd * d); break;
  }
}
let checked = 0;
try {
  for (const practiceMode of Object.values(PRACTICE_MODES)) {
    for (const operation of ['ADDITION', 'SUBTRACTION', 'MULTIPLICATION', 'DIVISION']) {
      for (let leftDigits = 1; leftDigits <= 8; leftDigits++) {
        for (let rightDigits = 1; rightDigits <= 8; rightDigits++) {
          for (let leftDecimalDigits = 1; leftDecimalDigits <= (practiceMode === 'DECIMAL' ? 8 : 1); leftDecimalDigits++) {
            for (let rightDecimalDigits = 1; rightDecimalDigits <= (practiceMode === 'DECIMAL' ? 8 : 1); rightDecimalDigits++) {
              const settings = sanitizeSettings({ practiceMode, operation, leftDigits, rightDigits, leftDecimalDigits, rightDecimalDigits });
              verify(createProblem(settings)); checked++;
            }
          }
        }
      }
    }
  }
  console.log(JSON.stringify({ arithmeticProblemsChecked: checked, result: 'all exact arithmetic checks passed' }));
  for (const expression of ['+2', '2 + +3', 'sqrt(+4)', '-2', '1e3+2', '2^(-3)', '0.00000001 * 0.00000001', '1.12345678 * 1.87654321']) {
    try { console.log(JSON.stringify({ expression, result: solveAiExpression(expression) })); }
    catch (error) { console.log(JSON.stringify({ expression, error: error.message })); }
  }
  let aiMismatches = 0;
  const examples = [];
  const decimalSettings = sanitizeSettings({ practiceMode: 'DECIMAL', operation: 'MULTIPLICATION', leftDigits: 1, rightDigits: 1, leftDecimalDigits: 8, rightDecimalDigits: 8, roundSize: 3 });
  for (let index = 0; index < 100; index++) {
    const problem = createProblem(decimalSettings);
    const solved = solveTrainerProblem(problem);
    const submission = processRoundSubmission(createActiveRound(decimalSettings, problem, 1000, 'test'), solved.submittedAnswer, 1001, null);
    if (!submission.attempt.isCorrect) {
      aiMismatches++;
      if (examples.length < 3) examples.push({ left: problem.leftOperand, right: problem.rightOperand, expected: problem.correctAnswer, aiAnswer: solved.submittedAnswer });
    }
  }
  assert(aiMismatches > 0);
  console.log(JSON.stringify({ aiDecimalMultiplicationProblems: 100, aiMismatches, examples }));
} finally { Math.random = originalRandom; }
