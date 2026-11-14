const test = require('node:test');
const assert = require('node:assert/strict');

test('a timed-out or cancelled calculation terminates its worker', async t => {
  const { solveCalculatorExpression, CALCULATOR_TIMEOUT_MS } = await import('../utils/aiCalculator.js');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let terminated = 0;
  const createWorker = () => ({ postMessage() {}, terminate() { terminated++; } });
  const pending = solveCalculatorExpression('2+3', { createWorker });
  const expired = assert.rejects(pending, /time limit/);
  t.mock.timers.tick(CALCULATOR_TIMEOUT_MS);
  await expired;
  const controller = new AbortController();
  const cancelled = solveCalculatorExpression('2+3', { createWorker, signal: controller.signal });
  const rejected = assert.rejects(cancelled, /cancelled/);
  controller.abort();
  await rejected;
  assert.equal(terminated, 2);
});

test('worker startup failure is reported and cleans up the worker', async () => {
  const { solveCalculatorExpression } = await import('../utils/aiCalculator.js');
  let terminated = false;
  await assert.rejects(solveCalculatorExpression('2+3', { createWorker: () => ({
    postMessage() { throw new Error('Worker unavailable'); },
    terminate() { terminated = true; }
  }) }), /Worker unavailable/);
  assert.equal(terminated, true);
});
