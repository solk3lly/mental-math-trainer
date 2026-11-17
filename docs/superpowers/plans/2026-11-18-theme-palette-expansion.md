# Theme Palette Expansion Implementation Plan

**Goal:** Add the 40 approved palettes and retain readable text across every theme in Light, Dark, and Adaptive appearance.

**Architecture:** Append palette data to the existing catalog. Reuse its contrast-aware token generation, shared fonts, grouped theme browser, and independent appearance setting. Preserve existing theme keys, order, aliases, and saved preferences.

**Tech stack:** Existing Next.js, React, JavaScript, CSS variables, and Node test runner.

**Spec:** The 40 palettes approved in the design discussion, plus the user's instruction to implement them with adaptive text colors. `NEW_THEME_COLORS` in `tests/themes.test.cjs` records their approved hex colors.

## Constraints

- Work alone in the existing workspace; no commits, builds, installs, or deployment.
- Keep the existing typefaces and default appearance.
- Check affected code with CodeScene and Codacy when available; use focused local tests only.
- Use agent-browser for UI checks only if its CLI, guide, and dependencies are available.

## Task 1: Add the approved palettes

Files: `utils/themes.js`, `tests/themes.test.cjs`, `README.md`.

- [x] Extend catalog expectations for 99 themes: 19 Classic, 40 Light, 40 Dark. Preserve the original 59 entries and pin the approved colors.
- [x] Run `node --test tests/themes.test.cjs`; confirm missing palettes fail before implementation.
- [x] Append all 40 palettes with stable keys, collection metadata, descriptions, and original hex colors. Update the documented count.
- [x] Run the focused theme tests; require readable text and controls in all 198 generated theme/appearance combinations.

## Task 2: Verify adaptive appearance

Files to inspect: `components/SiteLayout.js`, `components/CommandDesk.js`, `styles/globals.css`, `styles/redesign.css`, `utils/useResolvedDisplayMode.js`.

- [x] Confirm normal, secondary, accent, error, header, input, placeholder, and button text use the corresponding mode-dependent tokens. Fix only demonstrated gaps.
- [x] Run `node --test tests/themes.test.cjs tests/themeStyles.test.cjs tests/displayMode.test.cjs tests/displayModeHook.test.cjs`.
- [x] Review the final diff and applicable CodeScene/Codacy results against the pre-change baseline.
- [x] Report unavailable checks and manual checks: theme selection, both appearances, system changes in Adaptive, persistence, forms, feedback, and small-screen layout.

## Review focus

- Old saved theme keys and aliases continue to resolve.
- Both collections work in either appearance; Adaptive follows the system.
- Four approved swatches remain unchanged while generated UI colors meet contrast requirements.
- The theme browser and cycling include every new theme without changing the existing order.
- Shared fonts and layout remain consistent across the palette catalog.

## Initial evidence

- Working tree clean before edits.
- CodeScene baseline for `utils/themes.js`: 8.53; existing Large Method findings in `buildLightTokenSet` and `buildDarkTokenSet`.
- `agent-browser`, `codacy`, and `codacy-cli` are not available on PATH. Do not install replacements or run an alternative UI backend.

## Results

- Test-first evidence: catalog assertions failed with 59 rather than 99 themes before implementation.
- The expanded contrast test then found `mulberry-oat/light` danger-button text below 4.5:1. Its generated background was `#617E6D`; neither the preferred near-black nor white label met the threshold. `pickTextColor` now considers pure black and white when none of its preferred candidates meets 4.5:1. Approved palette swatches remain unchanged.
- Theme/style/appearance command above: 15 tests passed, including all 198 generated theme/appearance token sets. Normal, secondary, accent, error, header, and button text meet the tested 4.5:1 requirement; tested control borders and focus indicators meet 3:1.
- `node --test tests/accountPreferences.test.cjs tests/commandDesk.test.cjs`: 15 tests passed, including serialization of every theme in all three appearance settings.
- Existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings remain; package configuration was not changed.
- CodeScene final `utils/themes.js`: 8.53, unchanged from baseline. Both pre-existing Large Method findings remain unchanged. Comparative safeguard: passed, one eligible file checked, no new findings. `.cjs` test files are unsupported; Markdown is not applicable.
- CodeScene installation diagnostics confirmed authentication, CLI connectivity, and a binary runtime. They also noted the absence of a repository instruction file; no policy/configuration changes were made.
- Codacy: unavailable. Browser semantic and visual verification: unavailable because `agent-browser` is absent; no screenshots were captured.
- Final review performed by the author, without delegation. Existing theme order, aliases, defaults, fonts, and preference formats are preserved. The end-round dialog portals into the themed app shell and inherits its tokens.
- Manual QA remains with the user: select new themes under Utility → Appearance; check Light and Dark, system changes in Adaptive, persistence after reload, trainer/feedback/forms/dialog readability, and narrow-screen theme names without clipping.

## Follow-up verification

- The user subsequently authorized installing the missing browser CLI. Installed `agent-browser` 0.43.0 in the user's local executable directory using the [official installation guide](https://agent-browser.dev/installation). Existing system Chrome works with a fresh task-owned profile; project dependencies are unchanged.
- CLI diagnostics passed with eight checks and no warnings or failures.
- Semantic checks on the local Trainer and Appearance screens confirmed 99 listed themes, Mulberry Oat selection, explicit Light and Dark modes, Adaptive responses to both emulated system appearances, and persistence after reload.
- Visual inspection covered the Trainer at 375, 420, 700, 900, 1080, and 1440 CSS pixels in Mulberry Oat's light appearance, plus the Appearance drawer at 1440 pixels in dark appearance. Text and controls were readable, with no horizontal overflow. Screenshots remain outside the repository.
- No page errors were reported. Supabase emitted auth-lock warnings; their cause was not investigated in this change. The first navigation returned a daemon response error after opening the page; subsequent snapshots and interactions worked.
- The test browser and development server were closed. Other pages, dialog states, and themes still need manual visual review.
- The user subsequently requested committing and pushing these updates to the repository's `main` branch.
