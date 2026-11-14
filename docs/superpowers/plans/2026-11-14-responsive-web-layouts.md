# Responsive web layouts

## Design and scope

Preserve the Studio interface, content, routes, form behavior and training data.
The login screenshot shows an unnecessary row between the Password label and
input: the recovery link is a separate item in the form grid. Group the label
and link in one wrapping row. The centered, bounded account column is retained.

Use the existing React and CSS stack. Shared CSS owns responsive layout.
Field pairs should use two columns only when both can keep a 12rem minimum;
otherwise they stack within their actual parent. Long content must wrap, with
horizontal scrolling confined to data tables. Fixed overlays should use the
viewport's available height rather than assume the header stays one row tall.

A viewport-only fix would leave narrow desktop panels crowded. Shrinking text
or hiding overflow would leave content difficult to read. Use content-based
columns, wrapping and scrollable overlays instead. No dependencies are needed.

## Implementation plan

- [x] Group the login password label and recovery link; retain their association,
  link destination, field behavior and tab order.
- [x] Apply shared field sizing and text wrapping to Trainer, Mixed, account
  forms, progress and summaries. Retain bounded page widths on large screens.
- [x] Implement viewport bounds for navigation, Utility and end-round controls.
  Provide an explicit close action when the web navigation panel covers its
  original toggle. Keep the short landscape split layout above its minimum width.
- [x] Make the sessions table a named keyboard-focusable scrolling region.
- [x] Inspect all nine routes and run focused local checks and the available
  official CodeScene/Codacy analyses. Record unavailable coverage accurately.

## Route coverage

| Routes | Layout and content to inspect |
| --- | --- |
| `/` | Setup controls, decimal pairs, active question, input, summaries, AI solver. |
| `/mixed` | Setup, switches, timer, stacked arithmetic, keypad and input variants. |
| `/stats` | Empty/error/loading states, metrics, operation cards, sessions, long results. |
| `/login`, `/signup` | Account column, field labels, visibility/recovery controls, validation. |
| `/forgot-password`, `/reset-password`, `/verify` | Messages, long identity text, forms and actions. |
| `/404` | Heading, explanation, navigation actions and decorative number. |
| Shared shell | Header, navigation, Utility/search, confirmation dialog and footer. |

## Verification boundary

Work alone in the existing runtime. Do not run browser/viewport/visual QA, native
mobile tests, builds, standalone linters/type checks, deployments or Git uploads.
Focused Node tests may compile their own fixtures as part of test execution.
No new source-mirroring CSS tests are planned. CodeScene does not support CSS;
Codacy currently has no repository configuration. Manual acceptance remains
necessary; source inspection cannot establish that every viewport renders well.

The human should review 320px and wider web windows, tablet/desktop widths, short
landscape windows, zoom and larger text. Verify wrapping rather than clipped
controls, table-only horizontal scrolling, and reachable menu/drawer/dialog
actions. Review empty, populated, loading, error and long-content states.

## Implementation and verification record

Changed production files: `styles/globals.css`, `styles/redesign.css`,
`pages/login.js`, `components/SiteLayout.js`, and `pages/stats.js`.
`DESIGN.md` was updated, and this plan/review record was created. No dependencies,
lockfiles, native sources, backend code or test files changed in this follow-up.

Source review covers every route in the table above. Next's installed Pages
Router head implementation already supplies the device-width viewport meta tag;
no duplicate viewport or zoom restriction was added. Account forms retain the
32rem maximum. The screenshot's recovery link now shares its Password label row
and can wrap when space is limited.

Shared changes include paired fields that fit their actual parent, bounded grid
tracks, long-result and label wrapping, dynamic viewport heights, viewport-bounded
menus/drawers, one scrolling Utility panel, and a minimum width for the short
landscape split. Header links can wrap. Metric/operation grids use their panel's
content width with one/two/four columns; the fallback is one column. Media-query
thresholds use em units. The navigation panel has an explicit Close menu action
that returns focus to its toggle. The sessions table remains the horizontal
scrolling surface and is now a named focusable region.

The final focused command was:

```sh
node --test tests/themes.test.cjs tests/themeStyles.test.cjs tests/displayMode.test.cjs tests/commandDesk.test.cjs tests/trainerPresentation.test.cjs tests/mixedTrainerPresentation.test.cjs tests/mobileNavigation.test.cjs
```

Result: **27 passed, zero failed**. The last file tests the responsive web shell
using React's test renderer in Node; it does not launch or test a mobile app.
Existing Node module-format warnings remain. These checks cover palette tokens,
presentation state, theme search and navigation behavior. They do not measure
rendered widths, overflow, focus appearance or scrolling in a browser.

CodeScene reviewed all three changed JavaScript files before and after the work:

| File | Baseline | Final | Remaining findings |
| --- | ---: | ---: | --- |
| `pages/login.js` | 9.39 | 9.39 | Existing page size/complexity; its reported size and complexity decreased. |
| `components/SiteLayout.js` | 8.46 | 8.46 | Existing overall/keyboard-handler complexity and conditional expressions. |
| `pages/stats.js` | 8.73 | 8.73 | Existing view size/complexity. |

No new or worsened JavaScript findings remain. The first inline login change
increased its existing large-method finding; the new field header was then
placed in a small local component, and the final version was reviewed again.
CodeScene rejected both CSS files as unsupported. Codacy's official CLI exited
2 because `.codacy/codacy.config.json` is absent, with zero configured tools.
Neither tool established CSS finding attribution; no analysis configuration was
created, weakened or changed.

Final source/diff review was performed by the sole agent. No browser clicking,
viewport checks, screenshots, visual self-review, mobile application testing,
build, standalone lint/type checks, packaging, deployment, commit or push was
performed. Human visual and interaction acceptance remains pending. This record
does not claim that every screen size or browser engine has been verified.
