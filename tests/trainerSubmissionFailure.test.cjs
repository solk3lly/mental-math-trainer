const test = require('node:test');
const assert = require('node:assert/strict');

test('an accepted answer survives next-problem failure with its session and metadata', async () => {
  const { createActiveRound, processRoundSubmission } = await import('../utils/trainerRound.js');
  const round = createActiveRound({ roundSize: 3, operation: 'ADDITION' },
    { operation: 'ADDITION', correctAnswer: 5n, leftOperand: 2, rightOperand: 3 }, 100, 'session');
  round.resetGeneration = '7';
  const submission = processRoundSubmission(round, 5n, 200, null, () => { throw new Error('Generation failed'); });
  assert.equal(submission.attempts.length, 1);
  assert.equal(submission.attempts[0].isCorrect, true);
  assert.equal(submission.generationError.message, 'Generation failed');
  assert.equal(submission.nextActiveRound.sessionId, 'session');
  assert.equal(submission.nextActiveRound.resetGeneration, '7');
  assert.deepEqual(round.attempts, []);
});

test('the maximum Standard round preserves exact ordered attempts and incremental statistics', async () => {
  const { createActiveRound, processRoundSubmission } = await import('../utils/trainerRound.js');
  const { copyActiveRound, getActiveRoundStats } = await import('../utils/roundHistory.js');
  const problem = { operation: 'ADDITION', leftOperand: 2, rightOperand: 3, correctAnswer: 5n };
  const original = createActiveRound({ roundSize: 10000, operation: 'ADDITION' }, problem, 0, 'long-round');
  let round = original;
  let submission;
  for (let index = 1; index <= 10000; index++) {
    submission = processRoundSubmission(round, 5n, index, null, () => problem);
    if (submission.nextActiveRound) round = copyActiveRound(submission.nextActiveRound, { sourceMode: 'manual' });
  }
  assert.equal(submission.isComplete, true);
  assert.equal(submission.attempts.length, 10000);
  assert.equal(submission.attempts[0].createdAt, new Date(1).toISOString());
  assert.equal(submission.attempts.at(-1).createdAt, new Date(10000).toISOString());
  assert.equal(getActiveRoundStats(round).total, 9999);
  assert.deepEqual(original.attempts, []);
});

test('an AI batch returns accepted steps when generating the next question fails', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { pathToFileURL } = require('node:url');
  const filename = path.resolve(__dirname, '../utils/aiTrainer.js');
  let source = fs.readFileSync(filename, 'utf8').replace("import { solveAiExpression } from './aiMath.js';",
    "const solveAiExpression = () => { throw new Error('Unexpected calculator call'); };");
  source = source.replace(/from '(\.\/[^']+)'/g, (_match, name) =>
    `from '${new URL(name, pathToFileURL(filename)).href}'`);
  const { advanceAiTrainerRound } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const { createActiveRound, processRoundSubmission } = await import('../utils/trainerRound.js');
  const round = { ...createActiveRound({ roundSize: 3, operation: 'ADDITION' },
    { operation: 'ADDITION', correctAnswer: 5n, leftOperand: 2, rightOperand: 3 }, 100, 'ai-round'), sourceMode: 'ai' };
  const result = advanceAiTrainerRound(round, null, {
    maxSteps: 3,
    solveProblem: () => ({ submittedAnswer: 5n, responseMs: 1 }),
    processSubmission: (active, answer, at, handled) => processRoundSubmission(active, answer, at, handled,
      () => { throw new Error('Generation failed'); })
  });
  assert.equal(result.isComplete, true);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.solvedSteps.length, 1);
  assert.equal(result.generationError.message, 'Generation failed');
});
