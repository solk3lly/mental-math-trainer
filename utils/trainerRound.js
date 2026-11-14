import { appendRoundAttempt, copyActiveRound, getActiveRoundStats, getRoundProblemKeys } from './roundHistory.js';
import {
  buildDirectExponentiationOperandPool,
  createProblem,
  parseTrainerAnswer,
  PRACTICE_MODES
} from './mathEngine.js';

export function createActiveRound(
  settings,
  currentProblem,
  questionStartedAt,
  sessionId = null
) {
  return {
    sessionId,
    settings,
    attempts: [],
    currentProblem,
    questionStartedAt,
    questionId: 1
  };
}

export function shouldAutoSubmitAnswer(inputValue, currentProblemOrCorrectAnswer) {
  const currentProblem =
    typeof currentProblemOrCorrectAnswer === 'object' &&
    currentProblemOrCorrectAnswer !== null &&
    'correctAnswer' in currentProblemOrCorrectAnswer
      ? currentProblemOrCorrectAnswer
      : null;
  const correctAnswer = currentProblem
    ? currentProblem.correctAnswer
    : currentProblemOrCorrectAnswer;
  const parsedAnswer = parseTrainerAnswer(
    inputValue,
    currentProblem?.practiceMode
  );

  return parsedAnswer !== null && parsedAnswer === correctAnswer
    ? parsedAnswer
    : null;
}

export function createAttempt(
  currentProblem,
  submittedAnswer,
  responseMs,
  createdAt = new Date().toISOString()
) {
  return {
    practiceMode: currentProblem.practiceMode,
    operation: currentProblem.operation,
    leftOperand: currentProblem.leftOperand,
    rightOperand: currentProblem.rightOperand,
    correctAnswer: currentProblem.correctAnswer,
    submittedAnswer,
    isCorrect: submittedAnswer === currentProblem.correctAnswer,
    responseMs,
    createdAt
  };
}

function getExponentiationProblemKey(base, exponent) {
  return `${PRACTICE_MODES.POSITIVE}:EXPONENTIATION:${base}:${exponent}`;
}

function buildExponentiationProblem(base, exponent) {
  return {
    practiceMode: PRACTICE_MODES.POSITIVE,
    operation: 'EXPONENTIATION',
    leftOperand: base,
    rightOperand: exponent,
    correctAnswer: BigInt(base) ** BigInt(exponent)
  };
}

function createNextExponentiationProblem(settings, excludedProblemKeys) {
  const allOperands = buildDirectExponentiationOperandPool(settings.maxBase);
  const availableOperands = allOperands.filter(
    ([base, exponent]) => !excludedProblemKeys.has(getExponentiationProblemKey(base, exponent))
  );
  const candidates = availableOperands.length ? availableOperands : allOperands;
  const [base, exponent] = candidates[Math.floor(Math.random() * candidates.length)] || [2, 2];

  return buildExponentiationProblem(base, exponent);
}

function createNextProblem(activeRound, acceptedRound, createProblemImpl = createProblem) {
  const { settings } = activeRound;

  if (
    settings.practiceMode === PRACTICE_MODES.POSITIVE &&
    settings.operation === 'EXPONENTIATION' &&
    createProblemImpl === createProblem
  ) {
    return createNextExponentiationProblem(settings, getRoundProblemKeys(acceptedRound));
  }

  return createProblemImpl(settings);
}

export function resolveRoundSubmission(
  activeRound,
  submittedAnswer,
  responseMs,
  nextQuestionStartedAt,
  createProblemImpl = createProblem,
  createdAt = new Date(nextQuestionStartedAt).toISOString()
) {
  const attempt = createAttempt(
    activeRound.currentProblem,
    submittedAnswer,
    responseMs,
    createdAt
  );
  const acceptedRound = appendRoundAttempt(activeRound, attempt);
  const attemptCount = getActiveRoundStats(acceptedRound).total;
  const isComplete = attemptCount >= activeRound.settings.roundSize;
  let nextActiveRound = null;
  let generationError = null;
  if (!isComplete) {
    try {
      const nextProblem = createNextProblem(activeRound, acceptedRound, createProblemImpl);
      nextActiveRound = copyActiveRound(acceptedRound, {
        currentProblem: nextProblem,
        questionStartedAt: nextQuestionStartedAt,
        questionId: activeRound.questionId + 1
      });
    } catch (error) {
      generationError = error;
      nextActiveRound = acceptedRound;
    }
  }
  return {
    attempt, attemptCount, isComplete, nextActiveRound, generationError,
    get attempts() { return acceptedRound.attempts; }
  };
}

export function processRoundSubmission(
  activeRound,
  submittedAnswer,
  submittedAt,
  handledQuestionId,
  createProblemImpl = createProblem
) {
  if (!activeRound) {
    return { ignored: true, handledQuestionId };
  }

  const questionId = activeRound.questionId;
  if (handledQuestionId === questionId) {
    return { ignored: true, handledQuestionId };
  }

  const responseMs = Math.max(1, submittedAt - activeRound.questionStartedAt);
  const submission = resolveRoundSubmission(
      activeRound,
      submittedAnswer,
      responseMs,
      submittedAt,
      createProblemImpl,
      new Date(submittedAt).toISOString()
    );
  return Object.defineProperties(submission, {
    ignored: { value: false, enumerable: true },
    handledQuestionId: { value: questionId, enumerable: true },
    responseMs: { value: responseMs, enumerable: true }
  });
}
