# Web audit fixes

Implement the web and repository findings in [the codebase audit](../../../CODEBASE_AUDIT.md). The published Android app and its updater are outside the current implementation scope. The web documentation fix for the public release link does not require an Android change.

- Account progress (1–3, 5–6). Cover failed resets, mixed-generation batches, account switches, and replay errors. Preserve retry data on failure. Give account reset and ordinary writes a shared server-side boundary across devices. Scope the Progress view, import offer, and async completion to the account that opened them.
- Guest history and retention (7–9). Keep live sessions out of import and reclaim blocked IndexedDB connections. Add ongoing account log retention and document the rollout. Compare the account and guest data paths where they cross at import.
- Preferences and auth (10–12, 22). Preserve unrelated preferences across simultaneous writes, surface failed guest persistence, bind recovery to its originating session, and use uniform signup confirmation copy.
- Arithmetic and navigation (13–17, 21). Bound calculator work off the UI thread. Keep accepted attempts when later generation fails and remove quadratic work from Standard's supported long rounds. Preserve browser history around the end-round dialog, add a control for letter shortcuts, and validate complete Mixed clipboard input.
- Dependency and repository maintenance (4, 19–20, 23). Patch the framework and disable its unused image optimizer. Match the README to the existing license file and current public release. Make the local review fixture serve its actual module graph and check current behavior.

For each group, use focused local behavior tests where the existing runtime supports them and inspect the changed files against the audit. Record any remaining checks that require an installed dependency, a browser, or a configured database. Keep existing line endings and unrelated work.

## Implementation references

- PostgreSQL's transaction-level locks can order writes and resets inside the database. Volatile procedures observe writes through fresh snapshots at Read Committed. [Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS) · [Function volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html)
- Supabase Cron uses the PostgreSQL extension to schedule SQL jobs. [Supabase Cron](https://supabase.com/docs/guides/cron) · [Extension setup](https://github.com/citusdata/pg_cron#setting-up-pg_cron)
- IndexedDB exposes a version-change event to every blocking connection. An open request can remain pending after its blocked event. [IndexedDB opening algorithm](https://w3c.github.io/IndexedDB/#opening)
- Next.js 15.5.29 includes the fix for the self-hosted image optimizer advisory. [Next.js 15.5.29 release](https://github.com/vercel/next.js/releases/tag/v15.5.29)
- For letter shortcuts, an off switch satisfies WCAG 2.2 criterion 2.1.4. [Character-key shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)

## Implementation record — 14 November 2026

The 22 web, shared-backend, and repository findings are implemented in the working tree. Finding 18, the native Android updater, remains excluded. No mobile application was edited, built, launched, or tested. The original audit records the earlier revision; this record describes the fixes. Nothing was committed, published, deployed, or applied to a live database.

### Findings and resulting behavior

| Audit finding | Implementation and evidence |
| --- | --- |
| 1. Failed reset loses pending answers | The coordinator changes local generations and discards stale buffers only after the reset RPC succeeds. The RPC deletes both account tables and advances the server generation in one transaction. A rejecting reset retains its queued answer in the focused test. |
| 2. Mixed generations lose newer answers | Buffers group by account and filter each row inside the write lock. Known server generations distinguish new answers from stale ones. Tests cover another tab's reset, a new cloud generation in an older batch, and a new answer arriving while the reset response is still pending. Standard, Mixed, and custom-calculator saves check their generation before reporting success. |
| 3. Another device restores reset history | Both insert paths require the account's server generation. Transaction-level shared locks order inserts against the reset's exclusive lock. Replay retires rejected stale rows while retrying current rows from the same batch. The server migration still requires real-database verification. |
| 4. Affected web framework | Next.js, its resolved platform packages, and its ESLint configuration are updated to 15.5.29 using official registry metadata. The unused image optimizer is disabled. No dependency installation or server build was performed. |
| 5. Replay errors hide readable history | Loading a dashboard captures replay failures separately and still fetches readable history. A focused test observes the history and sync warning together. |
| 6. Stale import completion changes the new account's view | Progress content remounts by account identity. Its hook guards loads, offers, completion, errors, and busy state against account changes and unmount. Import checks the authenticated owner before claiming and before each batch. A focused test checks cancellation before claim/upload; mounted React interactions remain unverified here. |
| 7. Live guest round becomes importable | A live round holds a Web Lock until finish. Recovery and pruning skip held sessions; import claims recheck the lock and current database state. Attempts and heartbeats restore interrupted sessions to active. Resumed active sessions survive stale pruning snapshots. Without Web Locks, automatic recovery conservatively leaves active sessions alone. A focused test covers lock lifetime and fallback detection. |
| 8. Blocked database connection leaks | Late connections from rejected blocked opens close immediately. Version changes close and invalidate the cached connection. The connection lifecycle test passes. |
| 9. Missing ongoing retention | A new migration creates a privileged purge function, retention indexes, and the named hourly job `mental-math-progress-retention`. It deletes account rows older than 90 days. This is prepared SQL, not a claim that any production purge is running. |
| 10. Preference writes lose unrelated fields | Existing rows receive only changed database fields. Failed writes merge their patch back with later pending changes. Initial inserts ignore conflicts and read the winning row. A focused test preserves independent edits and the winning initialization defaults. |
| 11. Recovery outlives its login | The tab marker stores the account, JWT session identity, and a 30-minute expiry. Auth events retain it only for the originating session, including refreshes. Password submission checks expiry again. The helper test covers session changes, expiry, and the old marker. |
| 12. Signup exposes existing registration | Non-session signup results use uniform confirmation guidance and offer the same login/reset links. Known duplicate errors receive that guidance. Provider signup settings and real email flows still need review. |
| 13. Calculator blocks the UI | Custom calculations use a worker that is terminated on completion, error, cancellation, or the 1.5-second deadline. Input, tree size/depth, numeric magnitude, powers, and display length have explicit budgets. Editing input, switching mode/account, and unmount cancel pending work. Worker lifecycle tests pass; actual mathjs execution and worker bundling are unverified without the project dependencies. |
| 14. Next-problem failure drops an accepted answer | Submission records the attempt before generation and returns a generation error alongside that accepted history. Standard finalizes/checkpoints it and displays the generation failure separately from save state. AI batches also return their accepted steps on this path. Focused tests cover both. |
| 15. Standard round copies full history repeatedly | Active attempts use persistent linked history with incremental counts and a lazy ordered array at read boundaries. Only exponentiation keeps its bounded prompt pool. Page updates preserve the lazy history. The supported 10,000-answer round preserves order, timestamps, and previous snapshots in a focused test. No speedup or latency was measured. |
| 16. Back/Forward destroys forward entries | The guard restores an interrupted traversal with `history.go`, asks once, and replays the original traversal on confirmation. It preserves state markers and does not push replacement entries. A focused history test covers cancel and confirm. Real browser traversal still needs manual QA. |
| 17. Global letter shortcuts have no off switch | Utility includes a persistent browser-local Letter shortcuts checkbox. The global handler respects it; round Enter controls stay available. Mounted UI and accessibility behavior require manual QA. |
| 18. Android updater | Excluded by the user's instruction. |
| 19. README license mismatch | README links to the existing GNU GPL version 3 license. LICENSE was not changed by this work. |
| 20. Obsolete public release link | README links to the already published Android 1.0.5 release. No native artifact was changed or tested. |
| 21. Mixed paste changes numbers | The complete trimmed clipboard text must parse as an integer. Invalid text is rejected; signs are preserved instead of stripping punctuation into another number. Manual browser paste behavior remains to be checked. |
| 22. Guest preferences claim a failed save succeeded | Providers return a persistence error when browser storage rejects a write. Utility uses the returned result for theme, display, interface, and reset feedback. Session-only changes remain usable. |
| 23. Review fixture cannot load dependencies | The review server serves the entire storage/coordinator/lock module graph and opens a listener only when explicitly launched. Its crash/reset scenarios follow the new semantics. A focused test follows all imports through request handlers without opening a listener or running browser QA. |

### Research and design decisions

The reset guarantee uses a server generation rather than client timestamps. This avoids depending on device clock agreement. PostgreSQL's transaction-level advisory locks provide the database ordering; the trigger intentionally keeps the default volatile classification so its generation lookup uses a fresh statement snapshot after waiting under the normal Read Committed isolation level. This is a design inference from the documented lock and snapshot semantics, not a live concurrency measurement. [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS) · [Function volatility and snapshots](https://www.postgresql.org/docs/current/xfunc-volatility.html)

The retention migration uses the database scheduler rather than relying on visits to Progress. Its migration owner runs the purge, and ordinary clients cannot execute the privileged cleanup function. The database must already support the scheduler extension before this migration is applied. [Supabase Cron](https://supabase.com/docs/guides/cron) · [pg_cron setup](https://github.com/citusdata/pg_cron#setting-up-pg_cron)

A heartbeat cannot prove that a suspended tab is dead. A held Web Lock supplies stronger same-origin ownership; the fallback favors keeping a possibly live session. IndexedDB's blocked event does not cancel its open request, which is why closing a late successful connection is necessary. [Web Locks draft specification](https://www.w3.org/TR/web-locks/) · [IndexedDB opening algorithm](https://w3c.github.io/IndexedDB/#opening)

Partial preference updates preserve fields that another device changed. First-insert conflicts must also preserve the winning initial row. Recovery follows the provider's session identity rather than the access token string, because a refresh changes that token. [Update](https://supabase.com/docs/reference/javascript/update) · [Upsert](https://supabase.com/docs/reference/javascript/upsert) · [JWT session claims](https://supabase.com/docs/guides/auth/jwts) · [Signup behavior](https://supabase.com/docs/reference/javascript/auth-signup)

Worker termination provides the deadline; input and tree budgets reduce work before evaluation and result formatting. Powers are checked from child expressions outward. The magnitude estimate is deliberately conservative. The numerical budgets and 30-minute recovery lifetime are practical policy choices, not measured optimal thresholds. Review their fit before rollout. [mathjs expression trees](https://mathjs.org/docs/expressions/expression_trees.html) · [mathjs BigNumber implementation](https://mathjs.org/docs/datatypes/bignumbers.html) · [decimal.js exponent property](https://mikemcl.github.io/decimal.js/#exponent)

The navigation guard preserves the history traversal rather than recreating the target route. The pinned framework passes the history state to its before-pop callback. The letter-shortcut setting implements an off switch. [Next.js 15.5.29 router source](https://github.com/vercel/next.js/blob/v15.5.29/packages/next/src/shared/lib/router/router.ts) · [WCAG character-key shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)

The framework version and optimizer setting address the advisory's affected component. They do not establish the exposure of any deployed instance. [Image optimizer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-7qx7-33qx-rqx2)

### Verification actually completed

The final focused Node runs passed **71 tests**: 64 selected arithmetic, progress, preference, recovery, storage-connection, lock, calculator-worker, navigation, and fixture checks, plus 7 selected reset checks. The 10,000-question check asserts behavior and ordering; it is not a benchmark. An earlier combined invocation also selected the dependency-backed durable-reset test and failed to load `fake-indexeddb/auto`. That test remains unavailable, not passed. Subsequent runs explicitly selected only the available checks.

The project dependencies are absent. Mounted React/page/preference tests, real mathjs tests, and the full IndexedDB persistence checks could not run. No dependencies were installed. No mobile application tests, browser/device QA, builds, standalone linters/type checks/syntax checks, security scans, benchmarks, isolated testing runtimes, packaging, or deployment were run.

CodeScene reviewed all **31 changed production JavaScript files**. Existing tracked files were compared with HEAD copies under identical defaults. New helper modules and the worker have no reported findings. The supported existing files retain pre-existing complexity, nesting, argument-count, and size warnings; their scores did not decrease. The Progress view's extracted render function changes the analyzer's function boundaries, so automated attribution of its large/complex view warning is limited. Source comparison shows the view was moved intact apart from the sync-warning rendering. This is not a claim that every file is warning-free.

| Existing production file | Baseline score | Final score |
| --- | ---: | ---: |
| `components/CommandDesk.js` | 7.96 | 7.97 |
| `components/RoundSummaryPanel.js` | 9.53 | 9.54 |
| `components/SiteLayout.js` | 5.89 | 5.89 |
| `next.config.js` | 10.00 | 10.00 |
| `pages/index.js` | 7.15 | 7.45 |
| `pages/mixed.js` | 5.28 | 5.28 |
| `pages/reset-password.js` | 9.41 | 10.00 |
| `pages/signup.js` | 9.63 | 10.00 |
| `pages/stats.js` | 7.92 | 8.73 |
| `utils/accountPreferencesContext.js` | 9.68 | 9.68 |
| `utils/aiMath.js` | 8.57 | 8.62 |
| `utils/aiModeLogs.js` | 8.15 | 8.15 |
| `utils/aiTrainer.js` | 9.68 | 9.68 |
| `utils/mixedTrainerContext.js` | 8.75 | 9.68 |
| `utils/mixedTrainerRound.js` | 9.24 | 9.24 |
| `utils/progressLogs.js` | 6.52 | 6.52 |
| `utils/progressStorage.js` | 7.21 | 9.09 |
| `utils/progressWriteCoordinator.js` | 10.00 | 10.00 |
| `utils/supabaseAuthContext.js` | 9.12 | 9.14 |
| `utils/trainerRound.js` | 9.38 | 9.38 |

CodeScene rejected the SQL migrations and the CLI rejected `.cjs` files, including changed/new tests and the review fixture, despite the MCP tool advertising that extension. Package JSON/lockfile content was inspected, not analyzed as JavaScript. These are explicit gaps in automated static coverage.

Codacy's installed official CLI could not run the requested file analysis: this repository lacks `.codacy/codacy.config.json`, and the CLI requested initialization. It produced no tool analysis. Configuration/setup was outside this task's permissions, so no replacement analyzer or configuration was installed.

### File inventory

The table above lists the 20 changed existing production JavaScript files. The 11 new production modules are:

- `utils/accountProgress.js`, `utils/aiCalculator.js`, `utils/guestSessionLocks.js`, and `utils/preferenceWrites.js`.
- `utils/recoverySession.js`, `utils/roundHistory.js`, and `utils/roundNavigation.js`.
- `utils/useAccountProgressRound.js`, `utils/useLetterShortcuts.js`, and `utils/useProgressDashboard.js`.
- `workers/aiCalculator.js`.

Other changed existing files are `package.json`, `package-lock.json`, `README.md`, and four web test fixtures: `tests/preferenceContexts.test.cjs`, `tests/progressReset.test.cjs`, `tests/trainerOwnership.test.cjs`, and `tests/mobileNavigation.test.cjs`. The last fixture tests the responsive web header; only its dependency map was updated, and it was not run. The existing untracked `review-storage-server.cjs` was corrected. The other two pre-existing untracked review scripts were preserved.

New migrations are `supabase/migrations/20261114000000_reset_account_progress.sql` and `supabase/migrations/20261114010000_schedule_progress_retention.sql`.

New focused test files are `tests/accountProgress.test.cjs`, `tests/aiCalculatorWorker.test.cjs`, `tests/guestSessionLocks.test.cjs`, `tests/preferenceWrites.test.cjs`, `tests/progressStorageConnection.test.cjs`, `tests/recoverySession.test.cjs`, `tests/reviewStorageServer.test.cjs`, `tests/roundNavigation.test.cjs`, and `tests/trainerSubmissionFailure.test.cjs`.

This record was created, and `CODEBASE_AUDIT.md` links to it without rewriting the historical findings. No source files were deleted. Pre-existing line-ending-only changes remain separate from the functional diff.

### Rollout and manual acceptance

1. Review and apply the two November 14 migrations in order using the project's database process before serving this web code. They have not been executed here. Verify function permissions, reset transaction rollback, cross-connection insert/reset ordering, and preservation of post-reset rows against a real configured database.
2. Confirm `pg_cron` is available, the named retention job is active, and its run history shows both tables pruned beyond 90 days. The job is hourly, so physical deletion follows the next successful run.
3. **Older-client compatibility:** clients that omit the generation use the default zero. They can save before the account's first reset and are rejected afterward. A refresh only helps a client that contains this new web protocol. An older separately published Android build may require a future native update to resume cloud writes after a reset. Native changes are excluded here; decide the shared-backend rollout with that constraint in mind.
4. In a desktop web browser, check Standard/Mixed start, finish, interrupted save, repeated start clicks, and generation-failure summaries. Accepted answers should remain visible and retryable when storage/network writes fail. Check guest resume in one tab while Progress is open in another; live rounds should never be offered for import or pruned.
5. With two account sessions, check failed reset/retry, old offline rows, new post-reset rows, mixed stale/current batches, and a reset response still in flight. Switch accounts during import and dashboard requests; the new account should retain its own offer, results, and busy state. A replay error should show a warning alongside readable history.
6. Check independent preference changes from two tabs, first-save races, and denied browser storage. Unrelated fields should survive and failed persistence should show an accurate message.
7. Check provider email-confirmation settings and recovery email redirects. A recovery marker should survive token refresh for its original session, expire after 30 minutes, and become invalid after a different login. Signup should show the same non-session confirmation guidance for new and existing addresses.
8. Check normal custom calculations and cancellation when editing, changing mode/account, or leaving the page. Oversized work should produce the budget/deadline message while the UI remains responsive. A reset during calculation/save must not show a false saved success.
9. Check Back and Forward in both directions with an active round: cancel keeps the same page and forward entries; confirm traverses the existing entry once. Disable Letter shortcuts, reload, and check that letters stop global actions while Enter submits. Paste complete integers and invalid text such as decimal or mixed-character input into Mixed; invalid text must leave the answer unchanged.

These are manual acceptance steps for the web and shared database. They have not been performed by the user or by this agent.
