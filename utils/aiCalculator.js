export const CALCULATOR_TIMEOUT_MS = 1500;

export function solveCalculatorExpression(expression, { signal, createWorker = () =>
  new Worker(new URL('../workers/aiCalculator.js', import.meta.url), { type: 'module' }) } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Calculation cancelled.'));
      return;
    }
    startCalculation(createWorker(), expression, { signal, resolve, reject });
  });
}

function startCalculation(worker, expression, { signal, resolve, reject }) {
  let finished = false;
  function finish(error, result) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    worker.terminate();
    if (error) reject(error);
    else resolve(result);
  }
  const abort = () => finish(new Error('Calculation cancelled.'));
  const timer = setTimeout(() => finish(new Error('This calculation exceeded the time limit. Use a smaller expression.')), CALCULATOR_TIMEOUT_MS);
  signal?.addEventListener('abort', abort, { once: true });
  worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result);
  worker.onerror = () => finish(new Error('The calculation could not finish. Try a smaller expression.'));
  try { worker.postMessage(expression); }
  catch (error) { finish(error); }
}
