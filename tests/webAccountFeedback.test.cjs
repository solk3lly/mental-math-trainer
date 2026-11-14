const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loadModule, loadPage } = require('./helpers/renderPage.cjs');

const user = { id: 'account-a', email: 'first@example.invalid', email_confirmed_at: '2026-11-14T12:00:00Z' };
const link = { __esModule: true, default: props => React.createElement('a', props, props.children) };

async function render(t, Page) {
  let renderer;
  await act(async () => { renderer = create(React.createElement(Page)); });
  let mounted = true;
  const unmount = async () => {
    if (!mounted) return;
    mounted = false;
    await act(async () => renderer.unmount());
  };
  t.after(unmount);
  renderer.unmountFixture = unmount;
  return renderer;
}

for (const sample of [
  { label: 'bare visit', url: '/verify', title: 'Already signed in' },
  { label: 'expired confirmation', url: '/verify#error_code=otp_expired', title: 'Confirmation link could not be verified' },
  { label: 'callback rejected by Auth', url: '/verify#type=signup&access_token=new-session', failed: true,
    title: 'Confirmation link could not be verified' },
  { label: 'callback activated a different session', url: '/verify#type=signup&access_token=new-session', token: 'previous-session',
    title: 'Confirmation link could not be verified' },
  { label: 'confirmed signup', url: '/verify#type=signup&access_token=new-session', token: 'new-session', title: 'Email confirmed' }
]) {
  test(`verify page reports ${sample.label} separately from an existing login`, async t => {
    const previousWindow = global.window;
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-publishable';
    let timer;
    const redirects = [];
    global.window = {
      location: new URL(sample.url, 'https://trainer.example.invalid'),
      setTimeout(fn) { timer = fn; return 1; }, clearTimeout() { timer = undefined; }
    };
    t.after(() => {
      if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
      if (savedKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey;
      if (previousWindow === undefined) delete global.window;
      else global.window = previousWindow;
    });
    const session = { access_token: sample.token ?? 'previous-session', user };
    const client = loadModule('utils/supabaseClient.js', {
      '@supabase/supabase-js': { createClient() {
        global.window.location.hash = '';
        return { auth: {
          initialize: async () => ({ error: sample.failed ? new Error('Invalid link') : null }),
          getSession: async () => ({ data: { session }, error: null })
        } };
      } }
    }).exports;
    client.getSupabaseClient();
    const router = { replace: destination => redirects.push(destination) };
    const { Page } = loadPage('pages/verify.js', {
      'next/link': link, 'next/router': { useRouter: () => router },
      'components/PageIntro.js': { __esModule: true, default: props => React.createElement('h1', null, props.title) },
      'utils/supabaseClient.js': client,
      'utils/supabaseAuthContext.js': { useSupabaseAuth: () => ({ user, isLoading: false }) }
    });
    const renderer = await render(t, Page);
    assert.equal(renderer.root.findByType('h1').children[0], sample.title);
    timer?.();
    assert.deepEqual(redirects, sample.title === 'Email confirmed' ? ['/'] : []);
    await renderer.unmountFixture();
  });
}

test('a failed logout shows an alert and can be retried', async t => {
  const deps = {};
  for (const name of ['hotkeys', 'displayMode', 'themes', 'roundNavigation', 'useLetterShortcuts']) {
    deps[`utils/${name}.js`] = await import(`../utils/${name}.js`);
  }
  const pushed = [];
  const router = { pathname: '/', events: { on() {}, off() {} }, push: async value => pushed.push(value) };
  let attempts = 0;
  const { Page } = loadPage('components/SiteLayout.js', {
    ...deps, 'next/link': link, 'next/router': { useRouter: () => router },
    'utils/useResolvedDisplayMode.js': { useResolvedDisplayMode: () => 'light' },
    'utils/accountPreferencesContext.js': { useAccountPreferences: () => ({ themeKey: 'carbon-paper', displayMode: 'light' }) },
    'utils/activeSessionContext.js': { useActiveSession: () => ({ requestActiveSessionExit: async () => true }) },
    'utils/supabaseAuthContext.js': { useSupabaseAuth: () => ({ user, isConfigured: true,
      signOut: async () => ({ error: attempts++ ? null : new Error('Service unavailable') })
    }) }
  });
  const renderer = await render(t, Page);
  const button = label => renderer.root.findAllByType('button').find(item => item.children.includes(label));
  await act(() => button('Log out').props.onClick());
  assert.match(renderer.root.findByProps({ role: 'alert' }).children[0], /still be signed in/);
  assert.deepEqual(pushed, []);
  await act(() => button('Retry log out').props.onClick());
  assert.deepEqual(pushed, ['/login']);
  assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0);
});

test('Utility warns when a shortcut change succeeds in memory but storage rejects it', async t => {
  const previousWindow = global.window;
  global.window = { localStorage: { getItem: () => null, setItem() { throw new Error('Storage denied'); } } };
  t.after(() => {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  });
  const deps = {};
  for (const name of ['commandDesk', 'displayMode', 'hotkeys', 'themes', 'useLetterShortcuts']) {
    deps[`utils/${name}.js`] = await import(`../utils/${name}.js`);
  }
  const { Page: CommandDesk } = loadPage('components/CommandDesk.js', deps);
  function Page() {
    const [enabled, change] = deps['utils/useLetterShortcuts.js'].useLetterShortcuts();
    return React.createElement(CommandDesk, { activeTheme: deps['utils/themes.js'].getThemeByKey('carbon-paper'),
      displayMode: 'light', letterShortcutsEnabled: enabled, onLetterShortcutsChange: change });
  }
  const renderer = await render(t, Page);
  const checkbox = () => renderer.root.findByProps({ type: 'checkbox' });
  await act(() => checkbox().props.onChange({ target: { checked: false } }));
  assert.equal(checkbox().props.checked, false);
  assert.match(renderer.root.findByProps({ className: 'command-desk-status' }).children[0], /could not save/);
});
