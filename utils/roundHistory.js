const histories = new WeakMap();

function append(history, attempt) {
  let problemKeys = history.problemKeys;
  if (attempt.operation === 'EXPONENTIATION') {
    problemKeys = new Set(problemKeys);
    problemKeys.add(`${attempt.practiceMode || 'POSITIVE'}:${attempt.operation}:${attempt.leftOperand}:${attempt.rightOperand}`);
  }
  return {
    previous: history,
    attempt,
    count: history.count + 1,
    correct: history.correct + Number(attempt.isCorrect),
    totalResponseMs: history.totalResponseMs + attempt.responseMs,
    problemKeys
  };
}

function historyFor(round) {
  if (!histories.has(round)) {
    let history = { count: 0, correct: 0, totalResponseMs: 0 };
    for (const attempt of round.attempts || []) history = append(history, attempt);
    histories.set(round, history);
  }
  return histories.get(round);
}

export function copyActiveRound(round, patch) {
  const descriptors = Object.getOwnPropertyDescriptors(round);
  for (const [key, value] of Object.entries(patch)) {
    descriptors[key] = { value, writable: true, enumerable: true, configurable: true };
  }
  const copy = Object.defineProperties({}, descriptors);
  histories.set(copy, historyFor(round));
  return copy;
}

export function appendRoundAttempt(round, attempt) {
  const next = copyActiveRound(round, {});
  const history = append(historyFor(round), attempt);
  histories.set(next, history);
  let attempts;
  Object.defineProperty(next, 'attempts', {
    enumerable: true, configurable: true,
    get() {
      if (!attempts) {
        attempts = new Array(history.count);
        for (let cursor = history; cursor.attempt; cursor = cursor.previous) {
          attempts[cursor.count - 1] = cursor.attempt;
        }
      }
      return attempts;
    }
  });
  return next;
}

export function getActiveRoundStats(round) {
  const { count: total, correct, totalResponseMs } = historyFor(round || {});
  return { total, correct, incorrect: total - correct, totalResponseMs,
    accuracy: total ? (correct / total) * 100 : 0,
    averageResponseMs: total ? Math.round(totalResponseMs / total) : 0 };
}

export function getRoundProblemKeys(round) {
  return historyFor(round).problemKeys || new Set();
}
