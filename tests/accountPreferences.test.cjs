const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let buildUserPreferencesRow;
let createDefaultAccountPreferences;
let GUEST_THEME_ROLLOUT_STORAGE_KEY;
let GUEST_THEME_ROLLOUT_VERSION;
let getThemeOptionLabel;
let readGuestAccountPreferences;
let readGuestAccountPreferencesWithThemeRollout;
let mergeAccountPreferences;
let sanitizeAccountPreferences;
let THEME_OPTIONS;
let USER_PREFERENCES_COLUMNS;
let writeGuestAccountPreferences;
let DEFAULT_THEME_KEY;

function createStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    }
  };
}

test.before(async () => {
  const accountPreferences = await import(
    pathToFileURL(path.resolve(__dirname, '../utils/accountPreferences.js'))
      .href
  );
  const themes = await import(
    pathToFileURL(path.resolve(__dirname, '../utils/themes.js')).href
  );
  ({
    buildUserPreferencesRow,
    createDefaultAccountPreferences,
    GUEST_THEME_ROLLOUT_STORAGE_KEY,
    GUEST_THEME_ROLLOUT_VERSION,
    readGuestAccountPreferences,
    readGuestAccountPreferencesWithThemeRollout,
    mergeAccountPreferences,
    sanitizeAccountPreferences,
    USER_PREFERENCES_COLUMNS,
    writeGuestAccountPreferences
  } = accountPreferences);
  ({ DEFAULT_THEME_KEY, getThemeOptionLabel, THEME_OPTIONS } = themes);
});

test('sanitizeAccountPreferences falls back to defaults when the row is missing', () => {
  const preferences = sanitizeAccountPreferences();

  assert.deepEqual(preferences, createDefaultAccountPreferences());
  assert.equal(preferences.themeKey, 'carbon-paper');
});

test('theme catalog exposes carbon-paper as the first option with the default label', () => {
  assert.equal(THEME_OPTIONS[0].key, 'carbon-paper');
  assert.equal(getThemeOptionLabel(THEME_OPTIONS[0]), 'Carbon Paper (Default)');
});

test('sanitizeAccountPreferences clamps invalid trainer data and falls back to the default theme', () => {
  const preferences = sanitizeAccountPreferences({
    theme_key: 'not-a-real-theme',
    display_mode: 'sepia',
    trainer_practice_mode: 'DECIMAL',
    trainer_operation: 'DIVISION',
    trainer_left_digits: 2,
    trainer_right_digits: 8,
    trainer_left_decimal_digits: 0,
    trainer_right_decimal_digits: 99,
    trainer_round_size: 99999
  });

  assert.equal(preferences.themeKey, DEFAULT_THEME_KEY);
  assert.equal(preferences.displayMode, 'adaptive');
  assert.deepEqual(preferences.trainerSettings, {
    practiceMode: 'DECIMAL',
    operation: 'DIVISION',
    leftDigits: 2,
    rightDigits: 2,
    leftDecimalDigits: 1,
    rightDecimalDigits: 8,
    maxBase: 10,
    roundSize: 10000
  });
});

test('mergeAccountPreferences preserves unrelated fields across partial updates', () => {
  const current = sanitizeAccountPreferences({
    theme_key: 'studio-vermouth',
    display_mode: 'dark',
    trainer_practice_mode: 'POSITIVE',
    trainer_operation: 'ADDITION',
    trainer_left_digits: 3,
    trainer_right_digits: 2,
    trainer_left_decimal_digits: 2,
    trainer_right_decimal_digits: 2,
    trainer_round_size: 40
  });

  const themeUpdate = mergeAccountPreferences(current, {
    themeKey: 'paper-lantern'
  });
  assert.equal(themeUpdate.themeKey, 'paper-lantern');
  assert.equal(themeUpdate.displayMode, 'dark');
  assert.deepEqual(themeUpdate.trainerSettings, current.trainerSettings);

  const displayModeUpdate = mergeAccountPreferences(current, {
    displayMode: 'light'
  });
  assert.equal(displayModeUpdate.themeKey, current.themeKey);
  assert.equal(displayModeUpdate.displayMode, 'light');
  assert.deepEqual(displayModeUpdate.trainerSettings, current.trainerSettings);

  const trainerUpdate = mergeAccountPreferences(current, {
    trainerSettings: {
      practiceMode: 'DECIMAL',
      operation: 'DIVISION',
      rightDigits: 8,
      leftDecimalDigits: 4,
      rightDecimalDigits: 5,
      roundSize: 10000
    }
  });
  assert.equal(trainerUpdate.themeKey, current.themeKey);
  assert.equal(trainerUpdate.displayMode, 'dark');
  assert.deepEqual(trainerUpdate.trainerSettings, {
    practiceMode: 'DECIMAL',
    operation: 'DIVISION',
    leftDigits: 3,
    rightDigits: 3,
    leftDecimalDigits: 4,
    rightDecimalDigits: 5,
    maxBase: 10,
    roundSize: 10000
  });
});

test('buildUserPreferencesRow produces the expected database payload', () => {
  const row = buildUserPreferencesRow(
    'user-123',
    {
      themeKey: 'paper-lantern',
      displayMode: 'dark',
      trainerSettings: {
        practiceMode: 'DECIMAL',
        operation: 'SUBTRACTION',
        leftDigits: 4,
        rightDigits: 2,
        leftDecimalDigits: 3,
        rightDecimalDigits: 1,
        roundSize: 250
      }
    }
  );

  assert.deepEqual(row, {
    user_id: 'user-123',
    theme_key: 'paper-lantern',
    display_mode: 'dark',
    trainer_practice_mode: 'DECIMAL',
    trainer_operation: 'SUBTRACTION',
    trainer_left_digits: 4,
    trainer_right_digits: 2,
    trainer_left_decimal_digits: 3,
    trainer_right_decimal_digits: 1,
    trainer_max_base: 10,
    trainer_round_size: 250
  });
});

test('guest account preferences persist through local storage helpers', () => {
  const storage = createStorageMock();

  const wrote = writeGuestAccountPreferences(
    {
      themeKey: 'paper-lantern',
      displayMode: 'light',
      trainerSettings: {
        practiceMode: 'DECIMAL',
        operation: 'DIVISION',
        leftDigits: 3,
        rightDigits: 8,
        leftDecimalDigits: 0,
        rightDecimalDigits: 99,
        maxBase: 10,
        roundSize: 99999
      }
    },
    storage
  );

  assert.equal(wrote, true);
  assert.deepEqual(readGuestAccountPreferences(storage), {
    themeKey: 'paper-lantern',
    displayMode: 'light',
    trainerSettings: {
      practiceMode: 'DECIMAL',
      operation: 'DIVISION',
      leftDigits: 3,
      rightDigits: 3,
      leftDecimalDigits: 1,
      rightDecimalDigits: 8,
      maxBase: 10,
      roundSize: 10000
    }
  });
});

test('first-time guests land on the carbon-paper default theme and store the rollout marker', () => {
  const storage = createStorageMock();

  const preferences = readGuestAccountPreferencesWithThemeRollout(storage);

  assert.equal(preferences.themeKey, DEFAULT_THEME_KEY);
  assert.equal(preferences.displayMode, 'adaptive');
  assert.equal(
    storage.getItem(GUEST_THEME_ROLLOUT_STORAGE_KEY),
    JSON.stringify(GUEST_THEME_ROLLOUT_VERSION)
  );
});

test('guest theme rollout preserves a saved theme and display mode', () => {
  const storage = createStorageMock();

  writeGuestAccountPreferences(
    {
      themeKey: 'paper-lantern',
      displayMode: 'dark',
      trainerSettings: {
        practiceMode: 'POSITIVE',
        operation: 'ADDITION',
        leftDigits: 2,
        rightDigits: 2,
        leftDecimalDigits: 2,
        rightDecimalDigits: 2,
        maxBase: 10,
        roundSize: 10
      }
    },
    storage
  );

  const rolledOutPreferences =
    readGuestAccountPreferencesWithThemeRollout(storage);
  assert.equal(rolledOutPreferences.themeKey, 'paper-lantern');
  assert.equal(rolledOutPreferences.displayMode, 'dark');

  writeGuestAccountPreferences(
    {
      ...rolledOutPreferences,
      themeKey: 'paper-lantern'
    },
    storage
  );

  const preservedPreferences =
    readGuestAccountPreferencesWithThemeRollout(storage);
  assert.equal(preservedPreferences.themeKey, 'paper-lantern');
  assert.equal(preservedPreferences.displayMode, 'dark');
});

test('signed-in preference selection includes the display mode column', () => {
  assert.match(USER_PREFERENCES_COLUMNS, /(?:^|, )display_mode(?:,|$)/);
});

test('every theme and display mode serializes for Supabase sync', () => {
  for (const theme of THEME_OPTIONS) {
    for (const displayMode of ['light', 'dark', 'adaptive']) {
      const row = buildUserPreferencesRow('user-123', { themeKey: theme.key, displayMode });
      const restored = sanitizeAccountPreferences(row);
      assert.equal(row.theme_key, theme.key);
      assert.equal(row.display_mode, displayMode);
      assert.equal(restored.themeKey, theme.key);
      assert.equal(restored.displayMode, displayMode);
    }
  }
});

test('retired interface choices do not enter cloud payloads or overwrite retained guest preferences', () => {
  const current = createDefaultAccountPreferences();
  current.themeKey = 'paper-lantern';
  current.displayMode = 'dark';
  const legacyGuest = { ...current, interfaceStyle: 'kira' };
  const storageKey = 'mathtrainer:guest-account-preferences';
  const storage = createStorageMock({ [storageKey]: JSON.stringify(legacyGuest) });
  const restored = readGuestAccountPreferences(storage);
  assert.deepEqual(restored, current);
  assert.equal(writeGuestAccountPreferences(restored, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(storageKey)), current);

  const row = buildUserPreferencesRow('user-123', restored);
  assert.equal(Object.hasOwn(row, 'interface_style'), false);
  assert.equal(USER_PREFERENCES_COLUMNS.split(', ').includes('interface_style'), false);
  const oldCloudRow = { ...row, interface_style: 'korner' };
  assert.deepEqual(sanitizeAccountPreferences(oldCloudRow), current);
  assert.deepEqual(mergeAccountPreferences(restored, { interfaceStyle: 'opaline' }), current);
});
