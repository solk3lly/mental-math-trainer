const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loadPage } = require('./helpers/renderPage.cjs');

async function fixture(t, mode, initialUser = null, isAdmin = false) {
  const names = ['mathEngine', 'trainerRound', 'trainerPresentation', 'mixedDifficulty', 'mixedTrainerRound',
    'mixedTrainerPresentation', 'aiTrainer', 'aiCycle', 'aiModeLogs', 'progressLogs', 'progressWriteCoordinator', 'hotkeys', 'roundHistory', 'aiCalculator'];
  const dependencies = Object.fromEntries(await Promise.all(names.map(async name =>
    [`utils/${name}.js`, await import(`../utils/${name}.js`)])));
  const { exports: roundStart } = require('./helpers/renderPage.cjs').loadModule('utils/useAccountProgressRound.js', {
    './progressWriteCoordinator.js': dependencies['utils/progressWriteCoordinator.js']
  });
  dependencies['utils/useAccountProgressRound.js'] = roundStart;
  dependencies['utils/utils.js'] = { DIGIT_OPTIONS: [1, 2, 3, 4, 5, 6, 7, 8] };
  const calls = { guest: [], account: [], finished: [], stored: [] };
  let generation = '0';
  let flushFailure;
  let guestFailure;
  let settingsFailure;
  let flushWrites = true;
  const client = {
    rpc: async () => ({ data: generation, error: null }),
    from() {
      const filters = {};
      const query = {
        select: () => query,
        eq(key, value) { filters[key] = value; return query; },
        async lte(_key, total) {
          const count = calls.stored.filter(row =>
            Object.entries(filters).every(([key, value]) => row[key] === value) && row.question_index <= total
          ).length;
          return { count, error: null };
        }
      };
      return query;
    }
  };
  let auth = { client, session: { access_token: 'test' }, user: initialUser, isAdmin };
  const buffer = {
    enqueue: row => calls.account.push(row),
    async flush() {
      if (flushFailure) throw flushFailure;
      if (flushWrites) calls.stored = [...calls.account];
      return { flushedCount: 0 };
    },
    clear() {}, dispose() {}
  };
  const settings = dependencies['utils/mathEngine.js'].sanitizeSettings({ operation: 'ADDITION', roundSize: 3, leftDigits: 1, rightDigits: 1 });
  const mixedSettings = dependencies['utils/mixedDifficulty.js'].sanitizeMixedSettings({
    additionDifficulty: 'warmup', exponentiationDifficulty: 'off', multiplicationDifficulty: 'off', subtractionDifficulty: 'off', divisionDifficulty: 'off', roundSize: 3
  });
  const router = { pathname: mode === 'mixed' ? '/mixed' : '/', events: { on() {}, off() {} } };
  dependencies['next/router'] = { useRouter: () => router };
  dependencies['utils/supabaseAuthContext.js'] = { useSupabaseAuth: () => auth };
  const saveSettings = async () => ({ error: settingsFailure });
  dependencies['utils/accountPreferencesContext.js'] = { useAccountPreferences: () => ({ trainerSettings: settings, isLoadingPreferences: false, upsertPreferences: saveSettings }) };
  dependencies['utils/mixedTrainerContext.js'] = {
    MixedTrainerProvider: props => props.children,
    useMixedTrainer: () => ({ mixedSettings, isLoadingMixedSettings: false, upsertMixedSettings: saveSettings })
  };
  const activeSession = { registerActiveSessionTerminator: () => () => {}, registerActiveSessionExitHandler: () => () => {}, requestActiveSessionExit: async () => true };
  dependencies['utils/activeSessionContext.js'] = { useActiveSession: () => activeSession };
  dependencies['utils/progressLogs.js'] = { ...dependencies['utils/progressLogs.js'], createProgressLogBuffer: () => buffer };
  dependencies['utils/aiModeLogs.js'] = { ...dependencies['utils/aiModeLogs.js'], createAiModeLogBuffer: () => buffer };
  dependencies['utils/aiMath.js'] = {};
  const { exports: summaryExports } = require('./helpers/renderPage.cjs').loadModule('components/RoundSummaryPanel.js', dependencies);
  const summaryPanel = summaryExports.default;
  dependencies['components/RoundSummaryPanel.js'] = summaryExports;
  dependencies['utils/supabaseClient.js'] = { getSupabaseRestConfig: () => null };
  dependencies['utils/progressStorage.js'] = {
    startGuestSession: async () => {}, touchGuestSession: async () => {},
    async recordGuestAttempt(_id, _index, row) {
      if (guestFailure) throw guestFailure;
      calls.guest.push(row);
    },
    finishGuestSession: async (id, state) => calls.finished.push({ id, state })
  };
  const previousWindow = global.window;
  global.window = {
    addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {},
    setTimeout: (...args) => setTimeout(...args), clearTimeout: (...args) => clearTimeout(...args)
  };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { Page, components } = loadPage(mode === 'mixed' ? 'pages/mixed.js' : 'pages/index.js', dependencies);
  let renderer;
  await act(async () => { renderer = create(React.createElement(Page)); });
  t.after(async () => {
    await act(async () => renderer.unmount());
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  });
  const start = async () => {
    await act(async () => renderer.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }));
  };
  const submit = async () => {
    if (mode === 'mixed') {
      const Keypad = components.get('components/mixed/Keypad.js');
      await act(async () => renderer.root.findByType(Keypad).props.onDigit('99999'));
      await act(async () => renderer.root.findByType(Keypad).props.onSubmit());
    } else {
      await act(async () => renderer.root.findByProps({ id: 'answerInput' }).props.onChange({ target: { value: '99999' } }));
      await act(async () => renderer.root.findAllByType('form').find(form => form.props.className.includes('answer-form')).props.onSubmit({ preventDefault() {} }));
    }
  };
  const changeUser = async user => {
    auth = { ...auth, user };
    await act(async () => renderer.update(React.createElement(Page)));
  };
  const advance = async () => { await act(async () => t.mock.timers.tick(400)); };
  const isActive = () => mode === 'mixed'
    ? renderer.root.findAllByType(components.get('components/mixed/Keypad.js')).length > 0
    : renderer.root.findAllByProps({ id: 'answerInput' }).length > 0;
  return { start, submit, changeUser, advance, isActive, calls,
    async startAutoCycle() {
      const aiMode = renderer.root.findAllByType('button').find(button => button.children.includes('AI MODE'));
      await act(async () => aiMode.props.onClick());
      const autoCycle = renderer.root.findAllByProps({ role: 'switch' })[0];
      await act(async () => autoCycle.props.onClick());
      await act(async () => t.mock.timers.tick(0));
    },
    hasRetryButton: () => renderer.root.findAllByType('button').some(node => node.children.includes('Retry save')),
    setGuestFailure(error) { guestFailure = error; },
    async changeSetting(error) {
      settingsFailure = error;
      const select = renderer.root.findAllByType('select')[0];
      await act(async () => select.props.onChange({ target: { value: 'ADDITION' } }));
    },
    showsSettingsWarning: () => renderer.root.findAllByType('p').some(node =>
      node.props.role === 'status' && node.children.includes('Could not save settings on this device.')),
    resetOnServer() { generation = '1'; calls.stored = []; },
    setFlushFailure(error) { flushFailure = error; },
    stopWriting() { flushWrites = false; },
    summary: () => renderer.root.findByType(summaryPanel).props
  };
}

for (const mode of ['standard', 'mixed']) {
  test(`${mode} closes guest history after a failed answer checkpoint`, async t => {
    const app = await fixture(t, mode);
    await app.start();
    await app.submit();
    if (mode === 'mixed') await app.advance();
    app.setGuestFailure(new Error('Device history unavailable'));
    for (let index = 0; index < 2; index++) {
      await app.submit();
      if (mode === 'mixed') await app.advance();
    }
    assert.match(app.summary().saveStatus, /Device history unavailable/);
    assert.equal(app.calls.guest.length, 1);
    assert.equal(app.calls.finished.length, 1);
    assert.equal(app.calls.finished[0].state, 'ended');
  });

  test(`${mode} displays a settings write failure and clears it after a successful write`, async t => {
    const app = await fixture(t, mode);
    await app.changeSetting(new Error('Could not save settings on this device.'));
    assert.equal(app.showsSettingsWarning(), true);
    await app.changeSetting(null);
    assert.equal(app.showsSettingsWarning(), false);
  });

  test(`${mode} sign-in ends the guest round without uploading or splitting its answers`, async t => {
    const app = await fixture(t, mode);
    await app.start(); await app.submit();
    if (mode === 'mixed') await app.advance();
    await app.changeUser({ id: 'account-b' });
    assert.equal(app.isActive(), false);
    assert.equal(app.calls.guest.length, 1);
    assert.equal(app.calls.account.length, 0);
    assert.equal(app.calls.finished.length, 1);
    assert.equal(app.calls.finished[0].state, 'ended');
  });

  test(`${mode} retry distinguishes an empty flush from an acknowledged round or reset`, async t => {
    const app = await fixture(t, mode, { id: `${mode}-saved-round` });
    app.setFlushFailure(new Error('Temporary write failure'));
    await app.start();
    for (let index = 0; index < 3; index++) {
      await app.submit();
      if (mode === 'mixed') await app.advance();
    }
    assert.match(app.summary().saveStatus, /Temporary write failure/);
    app.setFlushFailure(null);
    app.stopWriting();
    await act(async () => app.summary().retryAction.onClick());
    assert.match(app.summary().saveStatus, /have not synced/);
    app.resetOnServer();
    await act(async () => app.summary().retryAction.onClick());
    assert.match(app.summary().saveStatus, /progress was reset/);
    assert.equal(app.summary().retryAction, null);
  });
}

test('a background upload can acknowledge a Standard round even when its final flush is empty', async t => {
  const app = await fixture(t, 'standard', { id: 'background-upload' });
  app.stopWriting();
  await app.start();
  for (let index = 0; index < 2; index++) await app.submit();
  app.calls.stored = [...app.calls.account];
  assert.equal(app.calls.stored.length, 2);
  await app.submit();
  assert.match(app.summary().saveStatus, /have not synced/);
  app.calls.stored = [...app.calls.account];
  await act(async () => app.summary().retryAction.onClick());
  assert.match(app.summary().saveStatus, /saved to your progress/);
});

test('Auto Cycle keeps the retry action available after a failed save', async t => {
  const app = await fixture(t, 'standard', { id: 'auto-cycle-owner' }, true);
  app.setFlushFailure(new Error('Temporary write failure'));
  await app.startAutoCycle();
  assert.equal(app.calls.account.length, 3);
  assert.equal(app.hasRetryButton(), true);
});

test('account changes cancel Mixed feedback instead of restoring the previous account round', async t => {
  const app = await fixture(t, 'mixed', { id: 'account-a' });
  await app.start(); await app.submit();
  await app.changeUser({ id: 'account-b' });
  assert.equal(app.isActive(), false);
  await app.advance();
  assert.equal(app.isActive(), false);
  assert.deepEqual(app.calls.account.map(row => row.user_id), ['account-a']);
});
