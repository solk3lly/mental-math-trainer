const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const imp = p => import(pathToFileURL(path.join(root, p)).href);

function hooks() {
  const slots = [];
  let index = 0, dirty = false, effects = [], component;
  const equal = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const api = {
    useState(initial) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, v => {
        const next = typeof v === 'function' ? v(slots[i].value) : v;
        if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; }
      }];
    },
    useRef(value) { const i = index++; return slots[i] ||= { current: value }; },
    useMemo(fn, deps) {
      const i = index++;
      if (!slots[i] || !equal(deps, slots[i].deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useCallback(fn, deps) { return api.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = index++;
      if (!slots[i] || !equal(deps, slots[i].deps)) {
        const old = slots[i];
        slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
    createContext: v => v,
    useContext: v => v
  };
  function render() {
    let value, limit = 30;
    do {
      dirty = false; index = 0; value = component();
      const pending = effects; effects = [];
      for (const fn of pending) fn();
      assert(limit-- > 0, 'render did not settle');
    } while (dirty);
    return value;
  }
  return {
    api, set: c => { component = c; }, render,
    async settle() {
      let value;
      for (let i = 0; i < 10; i++) { await new Promise(resolve => setImmediate(resolve)); value = render(); }
      return value;
    }
  };
}

function compile(file, cutoff, tail, deps) {
  let source = read(file);
  assert(source.includes(cutoff), 'source boundary exists');
  source = source.slice(0, source.indexOf(cutoff));
  source = source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export (?:default )?/gm, '');
  const context = vm.createContext({
    ...deps, console, Date, Math, Promise, setTimeout, clearTimeout, performance, crypto, queueMicrotask,
    window: { setInterval: () => 1, clearInterval: () => {}, addEventListener: () => {}, removeEventListener: () => {}, ...deps.window }
  });
  return vm.runInContext(source + '\n' + tail, context, { filename: file });
}

async function main() {
  const math = await imp('utils/mathEngine.js');
  const round = await imp('utils/trainerRound.js');
  const progress = await imp('utils/progressLogs.js');
  const prefs = await imp('utils/accountPreferences.js');
  const sync = await imp('utils/accountPreferenceSync.js');
  const mixed = await imp('utils/mixedDifficulty.js');
  const mixedRound = await imp('utils/mixedTrainerRound.js');
  const presentation = await imp('utils/trainerPresentation.js');
  const findings = [];

  for (const mode of ['standard', 'mixed']) {
    const h = hooks();
    const calls = { guest: [], account: [], finish: [] };
    let auth = { client: {}, session: { access_token: 'test' }, user: null, isAdmin: false };
    const settings = math.sanitizeSettings({ roundSize: 3, operation: 'ADDITION', leftDigits: 1, rightDigits: 1 });
    const mixedSettings = mixed.sanitizeMixedSettings({
      roundSize: 3, exponentiationDifficulty: 'off', multiplicationDifficulty: 'off',
      additionDifficulty: 'warmup', subtractionDifficulty: 'off', divisionDifficulty: 'off'
    });
    const router = { pathname: mode === 'standard' ? '/' : '/mixed', events: { on: () => {}, off: () => {} } };
    const buffer = { enqueue: r => calls.account.push(r), flush: async () => {}, clear: () => {}, dispose: () => {} };
    const deps = {
      ...h.api, ...math, ...round, ...progress, ...mixed, ...mixedRound, ...presentation,
      useRouter: () => router, useSupabaseAuth: () => auth,
      useAccountPreferences: () => ({ trainerSettings: settings, isLoadingPreferences: false, upsertPreferences: async () => {} }),
      useMixedTrainer: () => ({ mixedSettings, isLoadingMixedSettings: false, upsertMixedSettings: async () => {} }),
      useActiveSession: () => ({ registerActiveSessionTerminator: () => () => {}, registerActiveSessionExitHandler: () => () => {}, requestActiveSessionExit: async () => true }),
      createProgressLogBuffer: () => buffer, createAiModeLogBuffer: () => buffer, getSupabaseRestConfig: () => null,
      formatHotkeyLabel: x => x, ROUND_CONTROL_HOTKEY: 'Enter', isShortcutEventEligible: () => false,
      startGuestSession: async () => {}, touchGuestSession: async () => {},
      recordGuestAttempt: async (id, i, r) => calls.guest.push(r), finishGuestSession: async id => calls.finish.push(id),
      TRAINER_INPUT_MODES: { MANUAL: 'manual', AI: 'ai' }, DIGIT_OPTIONS: [1, 2, 3, 4, 5, 6, 7, 8],
      MIXED_SUBMISSION_FEEDBACK_STATES: { IDLE: 'idle', CORRECT: 'correct', INCORRECT: 'incorrect' },
      AI_AUTO_CYCLE_TRANSITION_MS: 2000
    };
    const component = mode === 'standard'
      ? compile('pages/index.js', '  const renderAutoCycleToggle', 'return {activeRound,lastRound,beginRound,submitAnswer}; }\nTrainerPage;', deps)
      : compile('pages/mixed.js', '  return (\n    <>', 'return {activeRound,lastRound,beginRound,submitAnswer,advanceAfterSubmissionFeedback,pending:pendingAdvanceRef.current}; }\nMixedTrainerContent;', deps);
    h.set(component);
    let state = h.render(); await state.beginRound(); state = h.render();
    await state.submitAnswer(state.activeRound.currentProblem.correctAnswer, Date.now()); state = await h.settle();
    if (mode === 'mixed') { await state.advanceAfterSubmissionFeedback(state.pending); state = h.render(); }
    assert.equal(calls.guest.length, 1);
    const originalId = state.activeRound.sessionId;
    auth = { ...auth, user: { id: 'account-b', email: 'test@example.invalid' } }; state = await h.settle();
    assert(state.activeRound, 'guest round remains active after sign-in');
    await state.submitAnswer(state.activeRound.currentProblem.correctAnswer, Date.now()); state = await h.settle();
    if (mode === 'mixed') { await state.advanceAfterSubmissionFeedback(state.pending); state = h.render(); }
    assert.equal(calls.account.length, 1); assert.equal(calls.account[0].question_index, 2);
    assert.equal(calls.account[0].user_id, 'account-b'); assert.equal(calls.account[0].session_id, originalId);
    assert.equal(calls.guest.length, 1); assert.equal(calls.finish.length, 0);
    await state.submitAnswer(state.activeRound.currentProblem.correctAnswer, Date.now()); state = await h.settle();
    if (mode === 'mixed') { await state.advanceAfterSubmissionFeedback(state.pending); state = h.render(); }
    assert.equal(calls.account.length, 2); assert.equal(state.lastRound.total, 3);
    assert.equal(state.lastRound.saveState, 'saved');
    findings.push({ case: 'sign-in-during-guest-round', mode, guestRows: calls.guest.length, autoUploadedRows: calls.account.length, cloudQuestionIndexes: calls.account.map(row => row.question_index), guestSessionFinalized: calls.finish.length > 0, summaryTotal: state.lastRound.total, summarySaveState: state.lastRound.saveState });
  }

  const rows = new Map();
  let release;
  const wait = new Promise(r => release = r);
  const client = { from: () => ({ upsert: async batch => {
    await wait;
    for (const r of batch) rows.set(r.session_id + ':' + r.question_index, r);
    return { error: null };
  } }) };
  const buffer = progress.createProgressLogBuffer({ getClient: () => client, flushDelayMs: 100000 });
  buffer.enqueue({ user_id: 'account-a', session_id: 'before-reset', question_index: 1 });
  const inFlight = buffer.flush(); await new Promise(r => setImmediate(r));
  assert.equal(buffer.getInFlightRows().length, 1);
  const dashboard = await imp('utils/progressDashboard.js');
  const statsHooks = hooks();
  let cleared = 0, deleted = 0, recoveries = 0;
  const statsClient = {
    rpc: async () => ({ data: dashboard.createEmptyProgressDashboard(), error: null }),
    from: () => ({ delete: () => ({ eq: async () => { deleted++; rows.clear(); return { error: null }; } }) })
  };
  const statsComponent = compile('pages/stats.js', '  return (\n    <>',
    'return {handleReset,dashboardData,importOffer}; }\nStatsPage;', {
      ...statsHooks.api, ...dashboard,
      useSupabaseAuth: () => ({ client: statsClient, user: { id: 'account-a' }, isConfigured: true, isLoading: false, isAdmin: false }),
      getPendingAccountProgressRows: async () => [],
      clearPendingAccountProgressRows: async () => { cleared++; },
      getGuestHistory: async () => ({ sessions: [{ id: 'crashed', state: 'active', attemptCount: 1 }], attempts: [{ sessionId: 'crashed' }] }),
      recoverInterruptedGuestSessions: async () => { recoveries++; },
      window: { confirm: () => true }
    });
  statsHooks.set(statsComponent);
  let statsState = await statsHooks.settle();
  assert.equal(statsState.importOffer.sessions.length, 0);
  assert.equal(recoveries, 0);
  findings.push({ case: 'signed-in-import-offer-skips-interrupted-recovery', offeredSessions: statsState.importOffer.sessions.length, recoveries });
  await statsState.handleReset();
  assert.equal(cleared, 1); assert.equal(deleted, 1); assert.equal(rows.size, 0);
  release(); await inFlight;
  statsState = statsHooks.render();
  assert.equal(rows.size, 1); assert.equal(statsState.dashboardData.overview.totalAttempts, 0);
  buffer.dispose();
  findings.push({ case: 'in-flight-save-after-reset', rowsAfterDeleteAndDelayedSave: rows.size, displayedAttempts: statsState.dashboardData.overview.totalAttempts });
  console.log(JSON.stringify(findings, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
