import { solveAiExpression } from '../utils/aiMath.js';

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ result: solveAiExpression(data) });
  } catch (error) {
    self.postMessage({ error: error.message || 'The expression could not be solved.' });
  }
};
