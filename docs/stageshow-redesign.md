# Studio redesign record

## Scope and reference study

The baseline is the current Studio-only working tree, including the previously
requested removal of interface switching and artwork. Earlier uncommitted work
was preserved. This redesign changes `styles/globals.css`,
`styles/redesign.css`, `DESIGN.md`, and this record. React markup and application
logic are unchanged.

Stageshow 1.1.1 was absent and was installed globally for Codex from
`benjitaylor/skills`. The installed entry point is
`/home/dot/.agents/skills/stageshow/SKILL.md`; it was not edited.

The full [article](https://benji.org/stageshow), skill, its fifteen Markdown
references, the example gallery's source files and the teaching comparisons'
source files were read. The closest examples studied before implementation were
`static-card`, `form-error`, `dark-hero`, `choreography`, and `loading`. The
remaining gallery and comparison source review finished after implementation.
That ordering differs from the brief's requirement to finish every example
before changing code. These were source reviews; no examples were run or filmed.

The skill's workflow starts with the medium and placement, maps product tokens,
plans a short causal story, starts with a suitable example, builds the screen,
choreographs it, and rehearses it. Here the medium is the existing working web
interface: a real practice surface, not an illustration. The frame is the
existing shell; the focal object is the current problem or completed result;
the actions and payoff remain the actual user-owned training flow. No fake
screen, placeholder content, copied product identity or animated demo was added.

The before-implementation summaries were presented in chat. The existing
Next.js 15 / React 18 Pages Router stack, plain JavaScript, shared CSS,
Supabase integration and mathematical engine were retained. Styles originally
combined two overlapping global layers, three Google font families and
per-component values. The new system uses two font families and shared tokens;
there are no new runtime dependencies or scripts.

## Website inventory and coverage

| Route | Existing content and states retained; shared redesign applied |
| --- | --- |
| `/` | Round setup; positive, negative and decimal practice; operations and digit/base controls; loading preferences; manual/AI input modes; custom solver; active problem/input/progress; auto-cycle; success/error/early-end summaries; save/retry actions; end-round dialog. |
| `/mixed` | Difficulty, operations, round length, input direction and timer controls; active stacked problem or square; desktop input and numeric keypad; correct/incorrect feedback; timer/progress; end confirmation and summary. |
| `/stats` | Guest/account/loading/error/empty views; refresh/reset and device-history import states; four overview metrics; operation breakdown; sessions table; attempts list; synchronization messages. |
| `/login` | Email/password; busy/error state; recovery/signup/guest links; unavailable account service and login handoff warning. |
| `/signup` | Email; password/confirmation visibility controls; five password requirements and strength; mismatch, busy, error and confirmation states; login/guest links. |
| `/verify` | Checking link, confirmed, pending and unavailable/error content; account identity and route actions. |
| `/forgot-password` | Email entry, sending, uniform sent confirmation, throttling/error and unavailable-service states; login and guest links. |
| `/reset-password` | Checking, expired/invalid link, new password/confirmation, guidance, saving, failure and completed states. |
| `/404` | Existing 404 typography, explanation, Trainer and Mixed links. |

`_app` retains the existing auth/session/preferences providers and global style
imports; `_document` retains the document and language. `SiteLayout` retains
skip navigation, header, desktop links, responsive web menu, guest/account
actions, utility drawer, navigation confirmation, focus management and footer.
`PageIntro` retains route headings. `CommandDesk` retains the 59-theme search,
collection groups, swatches, selected/no-results states, display-mode controls,
reset, keyboard settings, shortcut disclosure and keyboard navigation.
`RoundSummaryPanel`, `EndRoundDialog`, `IconLabel`, `HotkeyHint`, `Keypad`,
`ProgressBar`, `QuestionTimer` and `StackedProblem` use the shared tokens through
their existing selectors.

## Verification

The focused local command was:

```sh
node --test tests/themes.test.cjs tests/themeStyles.test.cjs tests/trainerPresentation.test.cjs tests/mixedTrainerPresentation.test.cjs tests/commandDesk.test.cjs tests/displayMode.test.cjs
```

Result: 25 passed, zero failed. Existing Node module-format warnings were
reported; package module configuration was not changed. Theme checks cover all
118 generated theme/mode sets and the shared semantic text roles. Presentation
checks cover idle, active, summary, AI transition/error and Mixed feedback
mapping. These checks do not establish rendered layout or full accessibility.
After the final focus and expression-layout adjustments, the two theme test
files were rerun: nine passed, zero failed.

CodeScene rejected both final CSS files as unsupported, as it did the baseline
attempt. A baseline was saved from the current working tree before editing, but
CodeScene cannot compare CSS findings against it. No JavaScript was changed for
this redesign.

The existing official Codacy CLI was inspected for the affected files and exited
2: `No .codacy/codacy.config.json found.` It found zero tools. Analysis is
unavailable, not passed; no configuration was created or weakened.

Build, independent lint/type checking, and the complete test suite were not run.
The brief asks for these checks, but the standing AGENTS policy prohibits
standalone compilation, linter and type checks outside CodeScene/Codacy. The
package has no type-check script. The complete test script includes unrelated
database migration checks; only tests focused on this redesign were run, as
allowed by section 5. No native mobile application was tested or modified.

No browser, viewport test, screenshot, recording, filming script, visual
self-review, hosted runner, isolated runtime, benchmark, deployment, commit or
push was performed for this redesign. No measured performance or complete
WCAG conformance claim is made. Font requests were reduced and no JavaScript
payload was added; runtime and visual acceptance remain unverified.

## Human review

- Open Trainer and Mixed Trainer in desktop, tablet, narrow and short landscape
  web windows. Read all controls and long numeric expressions without clipping;
  start, answer, end early, cancel the end dialog, finish and restart a round.
- Review account pages including invalid/expired recovery, password visibility,
  strength, mismatches, pending requests, confirmations and long email addresses.
- Review Progress with no history, loading/error, populated history, imports,
  clearing/reset cancellation, retry and long session/attempt data. Tables should
  scroll horizontally in their own surface.
- Open and close both navigation and Utility using keyboard and pointer. Check
  focus return, Escape, drawer trapping, selected items, theme search/no results,
  shortcut disclosure, reset and account actions during a round.
- Check the palette catalog in Light, Dark and Adaptive modes, keyboard focus,
  browser zoom, reduced motion and forced colors. Labels should remain legible;
  presentation motion should stop under reduced motion.

## Unresolved requirements and trade-offs

The prohibited build/lint/type-check checks remain unfulfilled. The extended
example review finished after implementation rather than before it. Visual
acceptance and interaction QA belong to the human, as the brief explicitly
requires. The skill's mandated filming, viewport rehearsal, gate, screenshots
and independent reviewer were skipped because the user's instructions prohibit
visual QA and delegation. No REHEARSAL pass is claimed.
The redesign uses the real product components rather than copying the kit;
there are no illustration surfaces that would justify a new kit dependency.
