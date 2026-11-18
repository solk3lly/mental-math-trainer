---
name: Mental Math Trainer
description: Fixed Studio interface with shared tokens and independent semantic color themes.
colors:
  primary: "var(--accent-main)"
  primary-text: "var(--button-strong-text)"
  paper: "var(--paper)"
  ink: "var(--text-main)"
  muted-ink: "var(--text-subtle)"
  outline: "var(--control-border)"
  input: "var(--surface-input)"
  focus: "var(--focus-ring)"
---

# Studio design system

Studio is the single web interface. Choose a color theme and a Light, Dark, or
Adaptive display mode. Appearance changes do not change training or account data.

The [Stageshow article](https://benji.org/stageshow) informs the composition:
make the subject obvious, group related information, use restrained surfaces,
and make motion explain a change. This is a working trainer. Its real controls
and content remain fully visible; illustration cropping and filler are not
applied to functional UI.

## Tokens and ownership

`styles/globals.css` defines the system and browser defaults.
`styles/redesign.css` applies it to every route and shared component.
`utils/themes.js` remains the source for the existing semantic palettes.
Theme-dependent aliases are declared on `.app-shell` so changing a palette also
changes borders and shadows without stale inherited colors.

| Area | Tokens and decisions |
| --- | --- |
| Type | `--font-ui` uses the existing Syne family. `--font-number` uses IBM Plex Mono for mathematical data and keycaps. `--type-*` supplies labels, body, headings, metrics and problems. `--leading-*`, `--weight-*`, `--tracking-*` supply the remaining type roles. |
| Color | Existing `--text-*`, `--surface-*`, `--accent-*`, `--header-*`, `--control-border` and `--focus-ring` preserve the generated light/dark contrast contracts. Hover surfaces use existing validated surfaces. Status is also conveyed with existing text. |
| Rhythm | `--space-1` through `--space-16` use a four-pixel base. `--gutter` and `--panel-pad` scale with the available space. |
| Layout | `--layout-main-max` sets a 70rem workspace. `--width-auth`, `--width-round`, `--width-drawer` and `--width-dialog` define focused surfaces. Setup and result columns share layout tokens. |
| Surface | `--radius-sm/md/lg/pill`, `--line-width`, `--rule` and `--edge` define geometry. Soft, raised and dialog shadow roles distinguish page content from overlays. Dark surfaces retain the palette's value steps. |
| Controls | `--control-size` is 44px; `--input-size` is 48px. Inputs, buttons, keypad actions, navigation and drawer controls share this sizing and spacing. |
| Motion | Press feedback: 120ms; state feedback: 180ms; page arrival: 480ms. Arrival and travel curves follow distinct roles. No decorative loops, cursors or demonstration timers are added. |
| Accessibility | Focus uses shared width/offset/ring tokens; dark header/drawer focus uses header text. Reduced motion removes presentation animation and transitions. Forced colors preserve selected controls and progress indicators. |

CSS custom properties cannot define media-query boundaries. System breakpoints
are documented together in `redesign.css` in em units. At a 16px default font,
they correspond to 420px for the compact header, 700px for answer/configuration
rows, 900px for the setup/arena composition, and 1080px for desktop navigation.
The short landscape layout corresponds to a 500px height boundary and requires
at least 700px of width at that default.
These are shared system thresholds, not individual page exceptions.

## Responsive behavior

`--width-field-min` and `--layout-pair-columns` keep paired controls in two
columns only when each can retain 12rem; otherwise they stack within their
actual parent. Solver values use `--layout-auto-columns`. Metric and operation
grids use [container-size queries](https://www.w3.org/TR/css-contain-3/#container-queries)
at 21rem and 43rem of panel content width, with a single-column fallback.

The account column stays centered and bounded on wide screens. The login
password label and recovery link share a wrapping row. Long labels, messages,
identities and numeric results can wrap; data tables retain their own horizontal
scroll area, exposed as a named keyboard-focusable region. No page-level
horizontal clipping is used to hide overflowing content.

Navigation and Utility use viewport-bounded scroll surfaces, independent of
header wrapping. Navigation includes a close action that returns focus to its
toggle. Dynamic viewport height also bounds dialogs and the page shell.
Rendered behavior across widths, text sizes and browser engines still needs
the human's manual review.

## Composition and states

Navigation uses a quiet product wordmark and a visible active-route indicator.
Page introductions establish the title before the task surface. During a round,
the existing focus mode removes setup and introduces the problem as the main
object. Authentication uses a narrow reading column. Progress uses aligned
metrics, quiet operation cards and ruled history rows.

Default controls have visible edges. Hover changes a surface or edge; presses
provide small immediate feedback. Focus has an outline, selection has both an
edge and a fill, and disabled controls retain readable labels. Existing loading,
empty, success, warning, error, retry and confirmation content uses these same
roles. Controls remain mounted and their existing handlers retain ownership of
state and timing. Reduced motion leaves a complete static surface; the existing
AI transition label remains present while its decorative progress strip is full.

Existing training/account content, routes, images, data, API calls, SEO metadata
and integrations are retained. Responsive navigation adds an explicit Close menu
action. The previous removal of alternate interfaces and artwork remains intact.
No illustration, fake workflow or platform device frame was introduced into the
trainer.

See `docs/stageshow-redesign.md` for the route inventory, reference coverage,
verification results and human review checklist.
