# Remove selectable interface designs

Keep Studio as the fixed layout. Preserve Standard and Mixed training, accounts,
progress, all 59 color palettes, and Light, Dark, and Adaptive modes. The pasted
Stageshow brief is reference material; this task does not implement a redesign.

1. Remove the interface selector, variant branding, and variant PageIntro paths.
2. Delete the interface registry, four variant stylesheets, variant artwork,
   variant-only fonts, and their dedicated documentation and design metadata.
3. Remove interface preference fields from guest normalization, account context,
   selected database columns, and preference writes.
4. Add a forward migration to drop the retired database column. Preserve already
   applied migrations so fresh installations and existing migration histories work.
5. Update focused preference tests and dependent web fixtures, then run permitted
   local tests and CodeScene/Codacy analysis where supported and available.

Do not edit native application sources, run mobile application tests, install
dependencies, run builds or standalone checkers, commit, push, or deploy.

Deploy the new web code before applying the column-removal migration. The new code
works with either schema; older clients that still select the retired column need
a refresh or update after the database change. This task prepares that migration
and leaves the production schema and deployment unchanged.

Success means no active interface registry, selector, artwork, variant CSS, or
style-preference API field remains. Manually check Studio branding and page
introductions, theme/mode changes and appearance reset, and training, account,
and progress flows. Visual and system QA remain with the user.

## Delivered changes

- `components/CommandDesk.js` removes the selector and its save callback. Reset
  appearance restores Carbon Paper and Adaptive mode.
- `components/SiteLayout.js` renders the Studio brand and no longer reads or
  writes interface choices or renders variant attributes.
- `components/PageIntro.js` keeps the existing Studio title and description.
- `pages/_app.js` loads only the existing Studio stylesheets.
- `utils/accountPreferences.js` and `utils/accountPreferencesContext.js` remove
  the retired preference from defaults, normalization, context, database selects,
  and writes. Existing stored choices are ignored and omitted from later saves.
- `supabase/migrations/20261114020000_remove_interface_style.sql` drops only the
  retired column. Historical migrations remain unchanged. The new migration has
  not been applied to any database.
- `README.md` and `DESIGN.md` describe the fixed Studio layout and rollout order.
  This file records the implementation and verification limits.
- `tests/accountPreferences.test.cjs` checks retained theme and trainer data when
  guest or account rows contain an old interface choice. The focused case failed
  before the implementation and passes afterward. Obsolete interface assertions
  were removed from this file and `tests/accountPreferenceSync.test.cjs`.
- `tests/mobileNavigation.test.cjs` updates only its web-shell dependency map to
  remove the deleted registry and artwork. This test was not run.

Deleted feature files:

- `utils/interfaceStyle.js`, `components/InterfaceArtwork.js`, and
  `tests/interfaceStyles.test.cjs`.
- `styles/interfaceStyles.css`, `styles/korner.css`, `styles/kira.css`, and
  `styles/collections.css`.
- `public/images/kira-math-pattern.svg`, `public/images/korner-slow-garden.svg`,
  `public/images/korner-study.png`, and its `.json` provenance file.
- The variant-only Barlow Condensed font and license, plus the Inter regular,
  500, 600, and 700 WOFF and WOFF2 files in `public/fonts`. Studio's existing
  Newsreader, Syne, and IBM Plex Mono definitions remain unchanged.
- `docs/design-collections.md`, `docs/design-korner.md`, `docs/design-kira.md`,
  `docs/design-kira-brief.md`, and `docs/mockups/opaline-abacus.html`.
- `docs/plans/2026-09-27-opaline-abacus-theme.md` and
  `docs/plans/2026-09-29-interface-style-switch.md`.
- `.impeccable/design.json`, `.impeccable/questions/roll.json`, and
  `.impeccable/surfaces/components-pageintro-js.md`.

## Verification

The final focused local runs passed 27 tests:

```bash
node --test tests/accountPreferences.test.cjs tests/accountPreferenceSync.test.cjs tests/preferenceWrites.test.cjs tests/displayMode.test.cjs tests/themes.test.cjs
node --test --test-name-pattern='^theme search' tests/commandDesk.test.cjs
```

These cover preferences, subscription ownership and revisions, independent
preference writes, retained theme/mode round trips, theme tokens, and theme
search. They do not establish browser rendering or live database behavior.
Mounted React tests could not run because the project has no installed React,
React Test Renderer, or Next.js dependencies. No dependencies were installed.
No mobile application tests, builds, standalone linters, type checks, syntax
validators, or visual/system QA were run.

CodeScene reviewed all six changed production JavaScript files against HEAD
copies under the same rules. No introduced or worsened findings were reported.
CommandDesk and SiteLayout retain pre-existing complexity and size warnings.
The preference provider retains its pre-existing loading-function complexity
warning. The other three files report no findings.

| File | Before | After |
| --- | ---: | ---: |
| `components/CommandDesk.js` | 7.97 | 8.10 |
| `components/SiteLayout.js` | 5.89 | 5.98 |
| `components/PageIntro.js` | 9.59 | 10.00 |
| `pages/_app.js` | 10.00 | 10.00 |
| `utils/accountPreferences.js` | 10.00 | 10.00 |
| `utils/accountPreferencesContext.js` | 9.68 | 9.68 |

Static analysis is partial: CodeScene does not support the SQL migration, and
its installed CLI rejected CJS test files. Codacy's official CLI exited with
`runner/toolConfig`: `.codacy/codacy.config.json` is missing. It analyzed zero
tools. No configuration was added or changed to work around that limit.

Source inspection found no remaining references to the removed modules, fonts,
stylesheets, or artwork in active application code. Retired field names remain
in historical migrations, the removal migration, rollout notes, and the focused
legacy-data test. Historical audit reports continue to describe their original
reviewed revision.

## Manual acceptance and rollout limits

1. In a desktop web browser, check Trainer, Mixed, Progress, login, signup,
   verification, and password reset. They should use Studio introductions and
   branding with no alternate artwork or Interface selector.
2. Check theme search, Light/Dark/Adaptive, and Reset appearance. A prior guest
   or account choice such as Kira should have no effect. Trainer settings and
   saved progress should remain intact.
3. Check Standard and Mixed start, submit, end-round confirmation, and saving.
   Sign in, refresh, and confirm retained theme and trainer preferences sync.
4. Deploy the updated web code before applying the column-removal migration.
   The migration was inspected, not executed. Verify retained preferences can
   still be read and saved after it runs. Older clients that explicitly select
   the retired column require a refresh or update. Native clients were neither
   changed nor tested in this task.

The current changes are local and uncommitted. No deployment or production
schema change was performed for this removal.
