import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CommandDesk from 'components/CommandDesk.js';
import IconLabel from 'components/IconLabel.js';
import ChartLineUpIcon from 'images/phosphor/chart-line-up.svg';
import CommandIcon from 'images/phosphor/command-bold.svg';
import HouseIcon from 'images/phosphor/house.svg';
import ListChecksIcon from 'images/phosphor/list-checks.svg';
import SquaresFourIcon from 'images/phosphor/squares-four.svg';
import { useAccountPreferences } from 'utils/accountPreferencesContext.js';
import { useActiveSession } from 'utils/activeSessionContext.js';
import {
  GLOBAL_HOTKEY_ACTIONS,
  getGlobalHotkeyAction,
  getGlobalHotkeyLabel,
  getNextThemeKey,
  isGlobalHotkeyAvailable,
  isShortcutEventEligible
} from 'utils/hotkeys.js';
import { useSupabaseAuth } from 'utils/supabaseAuthContext.js';
import { DEFAULT_DISPLAY_MODE } from 'utils/displayMode.js';
import {
  DEFAULT_THEME_KEY,
  getThemeByKey,
  THEME_OPTIONS
} from 'utils/themes.js';
import { useResolvedDisplayMode } from 'utils/useResolvedDisplayMode.js';
import { useLetterShortcuts } from 'utils/useLetterShortcuts.js';
import { installRoundNavigation } from 'utils/roundNavigation.js';

export default function SiteLayout({ children }) {
  const router = useRouter();
  const { user, isConfigured, signOut } = useSupabaseAuth();
  const { requestActiveSessionExit, hasActiveSession } = useActiveSession();
  const { themeKey, displayMode, isLoadingPreferences, upsertPreferences } =
    useAccountPreferences();
  const [isUtilityDrawerOpen, setIsUtilityDrawerOpen] = useState(false);
  const [signOutFailure, setSignOutFailure] = useState(null);
  const signingOutRef = useRef(false);
  const [letterShortcutsEnabled, changeLetterShortcuts] = useLetterShortcuts();
  const utilityButtonRef = useRef(null);
  const utilityCloseButtonRef = useRef(null);
  const utilityDrawerRef = useRef(null);
  const wasUtilityDrawerOpenRef = useRef(false);
  const mobileMenuRef = useRef(null);
  const navigationRef = useRef(null);
  navigationRef.current = { hasActiveSession, requestActiveSessionExit };

  const closeUtilityDrawer = useCallback(() => {
    setIsUtilityDrawerOpen(false);
    if (mobileMenuRef.current) mobileMenuRef.current.open = false;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const closeOutside = event => {
      const menu = mobileMenuRef.current;
      if (menu?.open && !menu.contains(event.target)) menu.open = false;
    };
    const closeOnEscape = event => {
      const menu = mobileMenuRef.current;
      if (event.key === 'Escape' && menu?.open) {
        event.preventDefault();
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    };
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    router.events.on('routeChangeStart', closeUtilityDrawer);
    return () => router.events.off('routeChangeStart', closeUtilityDrawer);
  }, [closeUtilityDrawer, router.events]);

  useEffect(() => {
    if (
      !isUtilityDrawerOpen ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return undefined;
    }

    const getFocusableUtilityElements = () => {
      if (!utilityDrawerRef.current) {
        return [];
      }

      return Array.from(
        utilityDrawerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (element) =>
          !element.hasAttribute('hidden') &&
          element.getAttribute('aria-hidden') !== 'true'
      );
    };

    const onKeyDown = (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === 'Escape') {
        closeUtilityDrawer();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableUtilityElements();
      if (!focusableElements.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!utilityDrawerRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeUtilityDrawer, isUtilityDrawerOpen]);

  useEffect(() => {
    if (!isUtilityDrawerOpen || typeof window === 'undefined') {
      return undefined;
    }

    const onClickOutside = (event) => {
      if (
        utilityDrawerRef.current &&
        !utilityDrawerRef.current.contains(event.target) &&
        utilityButtonRef.current &&
        !utilityButtonRef.current.contains(event.target)
      ) {
        closeUtilityDrawer();
      }
    };

    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, [closeUtilityDrawer, isUtilityDrawerOpen]);

  useEffect(() => {
    if (!isUtilityDrawerOpen || typeof document === 'undefined') {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior =
      document.body.style.overscrollBehavior;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [isUtilityDrawerOpen]);

  useEffect(() => {
    if (isUtilityDrawerOpen) {
      wasUtilityDrawerOpenRef.current = true;
      utilityCloseButtonRef.current?.focus();
      return;
    }

    if (wasUtilityDrawerOpenRef.current) {
      utilityButtonRef.current?.focus();
      wasUtilityDrawerOpenRef.current = false;
    }
  }, [isUtilityDrawerOpen]);

  const activeTheme = useMemo(() => getThemeByKey(themeKey), [themeKey]);
  const resolvedDisplayMode = useResolvedDisplayMode(displayMode);
  const activeThemeTokens = activeTheme.tokensByMode[resolvedDisplayMode];
  const themeChromeColor = activeThemeTokens.paper;
  const trainerShortcut = getGlobalHotkeyLabel(GLOBAL_HOTKEY_ACTIONS.TRAINER);
  const mixedShortcut = getGlobalHotkeyLabel(GLOBAL_HOTKEY_ACTIONS.MIXED);
  const progressShortcut = getGlobalHotkeyLabel(GLOBAL_HOTKEY_ACTIONS.PROGRESS);
  const loginShortcut = getGlobalHotkeyLabel(GLOBAL_HOTKEY_ACTIONS.LOGIN);
  const signupShortcut = getGlobalHotkeyLabel(GLOBAL_HOTKEY_ACTIONS.SIGNUP);
  const logoutShortcut = getGlobalHotkeyLabel(GLOBAL_HOTKEY_ACTIONS.LOGOUT);

  const themeStyle = useMemo(
    () => ({
      colorScheme: activeThemeTokens.colorScheme,
      '--ink-900': activeThemeTokens.ink900,
      '--ink-700': activeThemeTokens.ink700,
      '--ink-500': activeThemeTokens.ink500,
      '--paper': activeThemeTokens.paper,
      '--paper-strong': activeThemeTokens.paperStrong,
      '--sand': activeThemeTokens.sand,
      '--accent-main': activeThemeTokens.accentMain,
      '--accent-warm': activeThemeTokens.accentWarm,
      '--accent-soft': activeThemeTokens.accentSoft,
      '--accent-alert': activeThemeTokens.accentAlert,
      '--text-main': activeThemeTokens.textMain,
      '--text-subtle': activeThemeTokens.textSubtle,
      '--text-accent': activeThemeTokens.textAccent,
      '--text-danger': activeThemeTokens.textDanger,
      '--line': activeThemeTokens.line,
      '--control-border': activeThemeTokens.controlBorder,
      '--focus-ring': activeThemeTokens.focusRing,
      '--button-strong-text': activeThemeTokens.buttonStrongText,
      '--button-quiet-text': activeThemeTokens.buttonQuietText,
      '--button-danger-text': activeThemeTokens.buttonDangerText,
      '--surface-raised': activeThemeTokens.surfaceRaised,
      '--surface-raised-strong': activeThemeTokens.surfaceRaisedStrong,
      '--surface-input': activeThemeTokens.surfaceInput,
      '--surface-selected': activeThemeTokens.surfaceSelected,
      '--surface-positive': activeThemeTokens.surfacePositive,
      '--surface-warning': activeThemeTokens.surfaceWarning,
      '--surface-danger': activeThemeTokens.surfaceDanger,
      '--surface-highlight': activeThemeTokens.surfaceHighlight,
      '--surface-shadow': activeThemeTokens.surfaceShadow,
      '--surface-scrim': activeThemeTokens.surfaceScrim,
      '--header-surface': activeThemeTokens.headerSurface,
      '--header-surface-alt': activeThemeTokens.headerSurfaceAlt,
      '--header-text': activeThemeTokens.headerText,
      '--header-text-accent': activeThemeTokens.headerTextAccent,
      '--header-text-subtle': activeThemeTokens.headerTextSubtle,
      '--header-control-surface': activeThemeTokens.headerControlSurface,
      '--header-control-border': activeThemeTokens.headerControlBorder,
      '--header-border': activeThemeTokens.headerBorder,
      '--toggle-thumb': activeThemeTokens.toggleThumb,
      '--hero-decor-stroke': activeThemeTokens.heroDecorStroke,
      '--hero-decor-fill': activeThemeTokens.heroDecorFill,
      '--glow-main': activeThemeTokens.glowMain,
      '--glow-warm': activeThemeTokens.glowWarm,
      '--glow-soft': activeThemeTokens.glowSoft,
      '--glow-line': activeThemeTokens.glowLine
    }),
    [activeThemeTokens]
  );

  const navLinks = [
    {
      href: '/',
      label: 'Trainer',
      icon: HouseIcon,
      hotkey: trainerShortcut
    },
    {
      href: '/mixed',
      label: 'Mixed',
      icon: SquaresFourIcon,
      hotkey: mixedShortcut
    },
    {
      href: '/stats',
      label: 'Progress',
      icon: ChartLineUpIcon,
      hotkey: progressShortcut
    }
  ];

  const handleSignOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSignOutFailure(null);
    try {
      closeUtilityDrawer();
      if (!(await requestActiveSessionExit('sign-out'))) return;
      const { error } = await signOut();
      if (error) throw error;
    } catch {
      setSignOutFailure(user?.id);
      return;
    } finally {
      signingOutRef.current = false;
    }
    await router.push('/login');
  }, [closeUtilityDrawer, requestActiveSessionExit, router, signOut, user?.id]);

  const handleInternalLinkCapture = useCallback((event) => {
    if (!hasActiveSession || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const target = new URL(anchor.href, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname === router.pathname) return;
    event.preventDefault();
    event.stopPropagation();
    closeUtilityDrawer();
    void requestActiveSessionExit('navigation').then((confirmed) => {
      if (confirmed) void router.push(target.pathname + target.search + target.hash);
    });
  }, [closeUtilityDrawer, hasActiveSession, requestActiveSessionExit, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    return installRoundNavigation({
      history: window.history, router,
      isActive: () => navigationRef.current.hasActiveSession,
      requestExit: () => {
        closeUtilityDrawer();
        return navigationRef.current.requestActiveSessionExit('history');
      }
    });
  }, [closeUtilityDrawer, router]);

  const handleThemeChange = useCallback(
    (nextThemeKey) => upsertPreferences({ themeKey: nextThemeKey }),
    [upsertPreferences]
  );

  const handleDisplayModeChange = useCallback(
    (nextDisplayMode) => upsertPreferences({ displayMode: nextDisplayMode }),
    [upsertPreferences]
  );

  const handleResetAppearance = useCallback(
    () =>
      upsertPreferences({
        themeKey: DEFAULT_THEME_KEY,
        displayMode: DEFAULT_DISPLAY_MODE
      }),
    [upsertPreferences]
  );

  const cycleTheme = useCallback(() => {
    if (isLoadingPreferences) {
      return;
    }

    void upsertPreferences({
      themeKey: getNextThemeKey(activeTheme.key, THEME_OPTIONS)
    });
  }, [activeTheme.key, isLoadingPreferences, upsertPreferences]);

  const handleUtilityDrawerToggle = useCallback(() => {
    setIsUtilityDrawerOpen((currentState) => !currentState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const routeByAction = {
      [GLOBAL_HOTKEY_ACTIONS.TRAINER]: '/',
      [GLOBAL_HOTKEY_ACTIONS.MIXED]: '/mixed',
      [GLOBAL_HOTKEY_ACTIONS.PROGRESS]: '/stats',
      [GLOBAL_HOTKEY_ACTIONS.LOGIN]: '/login',
      [GLOBAL_HOTKEY_ACTIONS.SIGNUP]: '/signup'
    };

    const handleGlobalShortcut = (event) => {
      if (!letterShortcutsEnabled || !isShortcutEventEligible(event)) {
        return;
      }

      const action = getGlobalHotkeyAction(event.key);
      if (!action) {
        return;
      }

      if (
        !isGlobalHotkeyAvailable(action, {
          isAuthenticated: Boolean(user)
        })
      ) {
        return;
      }

      if (action === GLOBAL_HOTKEY_ACTIONS.THEME) {
        event.preventDefault();
        cycleTheme();
        return;
      }

      if (action === GLOBAL_HOTKEY_ACTIONS.LOGOUT) {
        event.preventDefault();
        void handleSignOut();
        return;
      }

      const nextRoute = routeByAction[action];
      if (!nextRoute || router.pathname === nextRoute) {
        return;
      }

      event.preventDefault();
      closeUtilityDrawer();
      void requestActiveSessionExit('shortcut').then((confirmed) => {
        if (confirmed) void router.push(nextRoute);
      });
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [closeUtilityDrawer, cycleTheme, handleSignOut, letterShortcutsEnabled, requestActiveSessionExit, router, user]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document
      .querySelector("meta[name='theme-color']")
      ?.setAttribute('content', themeChromeColor);
    document
      .querySelector("meta[name='msapplication-TileColor']")
      ?.setAttribute('content', themeChromeColor);
  }, [themeChromeColor]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const documentElement = document.documentElement;
    documentElement.dataset.displayMode = displayMode;
    documentElement.dataset.resolvedMode = resolvedDisplayMode;
    documentElement.style.colorScheme = resolvedDisplayMode;
    documentElement.style.backgroundColor = activeThemeTokens.paper;

    return () => {
      delete documentElement.dataset.displayMode;
      delete documentElement.dataset.resolvedMode;
      documentElement.style.removeProperty('color-scheme');
      documentElement.style.removeProperty('background-color');
    };
  }, [activeThemeTokens.paper, displayMode, resolvedDisplayMode]);

  return (
    <div
      className='app-shell'
      onClickCapture={handleInternalLinkCapture}
      data-theme-key={activeTheme.key}
      data-display-mode={displayMode}
      data-session-active={hasActiveSession || undefined}
      data-resolved-mode={resolvedDisplayMode}
      style={themeStyle}
    >
      <Head>
        <meta name='theme-color' content={themeChromeColor} key='theme-color' />
        <meta
          name='msapplication-TileColor'
          content={themeChromeColor}
          key='msapplication-TileColor'
        />
      </Head>
      <a className='skip-link' href='#main-content'>
        Skip to content
      </a>
      <header className='site-header'>
        <div className='site-header-inner'>
          <Link href='/' className='brand' aria-label='Mental Math home'>
            <span className='brand-chip'>Studio</span>
            <span className='brand-title'>Mental Math</span>
          </Link>

          <nav className='site-nav' aria-label='Primary'>
            {navLinks.map((link) => {
              const isActive = router.pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`site-nav-link ${
                    isActive ? 'is-active' : ''
                  }`.trim()}
                  aria-keyshortcuts={link.hotkey}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <IconLabel icon={link.icon} className='icon-label-nav'>
                    {link.label}
                  </IconLabel>
                </Link>
              );
            })}
          </nav>

          <div className={`site-actions${user ? ' has-user-session' : ''}`}>
            <details ref={mobileMenuRef} className='mobile-navigation'>
              <summary className='site-utility-toggle mobile-navigation-toggle' aria-label='Navigation menu'
                onClick={() => setIsUtilityDrawerOpen(false)}>
                <IconLabel icon={ListChecksIcon} className='icon-label-button'>Menu</IconLabel>
              </summary>
              <div className='mobile-navigation-panel'>
                <button
                  type='button'
                  className='button button-quiet mobile-navigation-close'
                  onClick={() => {
                    closeUtilityDrawer();
                    mobileMenuRef.current?.querySelector('summary')?.focus();
                  }}
                >
                  Close menu
                </button>
                <nav aria-label='Mobile primary'>
                  {navLinks.map(link => (
                    <Link key={link.href} href={link.href}
                      className={`mobile-navigation-link${router.pathname === link.href ? ' is-active' : ''}`}
                      aria-current={router.pathname === link.href ? 'page' : undefined}
                      onClick={closeUtilityDrawer}>
                      <IconLabel icon={link.icon} className='icon-label-nav'>{link.label}</IconLabel>
                    </Link>
                  ))}
                </nav>
                <div className='mobile-account-actions'>
                  {user ? (
                    <>
                      <p className='mobile-account-email'>{user.email}</p>
                      <button type='button' className='button button-quiet button-full' onClick={handleSignOut}>Log out</button>
                    </>
                  ) : (
                    <>
                      {!isConfigured && <p className='mobile-account-email'>Guest mode · Accounts unavailable</p>}
                      <Link href='/login' className='button button-quiet' onClick={closeUtilityDrawer}>Log in</Link>
                      <Link href='/signup' className='button button-strong' onClick={closeUtilityDrawer}>Sign up</Link>
                    </>
                  )}
                </div>
              </div>
            </details>
            {!isConfigured && (
              <span className='status-badge'>Guest mode</span>
            )}
            {user ? (
              <div className='site-session'>
                <span className='user-pill'>{user.email}</span>
                <button
                  type='button'
                  className='button button-quiet'
                  onClick={handleSignOut}
                  aria-keyshortcuts={logoutShortcut}
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className='site-auth-links'>
                <Link
                  href='/login'
                  className='button button-quiet'
                  aria-keyshortcuts={loginShortcut}
                >
                  Log in
                </Link>
                <Link
                  href='/signup'
                  className='button button-strong'
                  aria-keyshortcuts={signupShortcut}
                >
                  Sign up
                </Link>
              </div>
            )}

            <div className='site-utility-shell'>
              <button
                ref={utilityButtonRef}
                type='button'
                className='site-utility-toggle'
                onClick={handleUtilityDrawerToggle}
                aria-label={
                  isUtilityDrawerOpen
                    ? 'Close utility drawer'
                    : 'Open utility drawer'
                }
                aria-expanded={isUtilityDrawerOpen}
                aria-controls='utility-drawer'
                aria-haspopup='dialog'
              >
                <IconLabel icon={CommandIcon} className='icon-label-button'>
                  Utility
                </IconLabel>
              </button>
            </div>
          </div>
        </div>
      </header>

      {isUtilityDrawerOpen && (
        <>
          <button
            type='button'
            className='utility-backdrop'
            aria-hidden='true'
            tabIndex={-1}
            onClick={closeUtilityDrawer}
          />
          <CommandDesk
            letterShortcutsEnabled={letterShortcutsEnabled}
            onLetterShortcutsChange={changeLetterShortcuts}
            activeTheme={activeTheme}
            closeButtonRef={utilityCloseButtonRef}
            displayMode={displayMode}
            drawerRef={utilityDrawerRef}
            isLoadingPreferences={isLoadingPreferences}
            onClose={closeUtilityDrawer}
            onDisplayModeChange={handleDisplayModeChange}
            onResetAppearance={handleResetAppearance}
            onThemeChange={handleThemeChange}
          />
        </>
      )}

      <main id='main-content' className='site-main'>
        {user && signOutFailure === user.id && (
          <div className='feedback warning'>
            <p role='alert'>Could not log out. This browser may still be signed in.</p>
            <button type='button' className='button button-quiet' onClick={handleSignOut}>Retry log out</button>
          </div>
        )}
        {children}
      </main>

      <footer className='site-footer'>
        <p>
          Built for focused repetition, measurable progress, and ruthless
          consistency.
        </p>
      </footer>
    </div>
  );
}
