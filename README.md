# Mental Math Trainer

Mental Math Trainer is a focused arithmetic trainer for fast, repeated practice.
It runs in the browser, works in guest mode by default, and can sync progress
through Supabase when account features are configured.

## Features

- Standard trainer (`/`) for one operation and practice mode at a time.
- Mixed trainer (`/mixed`) for rotating across selected operations in one round.
- Positive-number drills for addition, subtraction, multiplication, division, and
  exponentiation.
- Decimal drills for addition, subtraction, multiplication, and division.
- Automatic answer checking, keyboard input, and an on-screen keypad.
- Configurable round length, timer visibility, and digit direction.
- A fixed Studio layout and 99 color themes, with independent Light, Dark, and
  system-adaptive display modes.
- Round summaries with accuracy, correct-answer counts, average response, and total time.
- Device history and a 90-day Progress view for guests; account progress and
  optional guest-history import after signing in.
- End-round confirmation that keeps submitted answers and pauses the timer while
  you decide whether to continue.
- Optional accounts with synced preferences, progress, and password recovery.

## Training Options

The standard trainer lets you choose a practice mode, operation, digit counts,
and question count. Exponentiation uses a maximum base instead of left/right
digit settings.

The mixed trainer uses difficulty levels per operation:

| Operation      | Levels                                  |
| -------------- | --------------------------------------- |
| Exponentiation | Off, Warmup, Easy, Medium, Hard         |
| Addition       | Off, Warmup, Easy, Medium, Hard, Expert |
| Subtraction    | Off, Warmup, Easy, Medium, Hard, Expert |
| Multiplication | Off, Warmup, Easy, Medium, Hard, Expert |
| Division       | Off, Warmup, Easy, Medium, Hard         |

Letter shortcuts can be disabled under **Utility → Keyboard shortcuts**. The
choice is stored in this browser when storage is available. Enter continues to submit answers.

The administrator's custom calculator runs in a cancellable worker with a
1.5-second deadline. Expressions are limited to 1,024 characters, 128 syntax
nodes, 32 levels of nesting, and 4,096 output characters. Exponents are limited
to ±4,096; numeric constants and estimated powers also have a decimal magnitude
budget of 4,096. A timeout asks for a
smaller expression and leaves the trainer responsive.

## Appearance

Studio is the fixed interface. Open **Utility → Appearance** to choose from 99
color themes and Light, Dark, or Adaptive display modes. Appearance reset restores
Carbon Paper and Adaptive mode.

## Guest Mode and Progress

The app works without an account. Guest settings are stored in the browser, so
practice mode, operation choices, round length, appearance, timer visibility, and
digit direction carry across sessions on the same device.

Submitted guest answers are stored separately in IndexedDB. The **Progress** page
(`/stats`) shows accuracy, response speed, operation breakdowns, recent sessions,
and recent attempts. Device history covers the most recent 90 days, with retention
limits of 100 inactive sessions and 10,000 attempts. Clearing browser data removes
this history.

After signing in, choose **Import history** on the Progress page to copy guest
history into your account. Import happens only when you choose it.
If the database permanently rejects a queued answer, Progress shows how many
answers were kept on this device and offers a separate retry. Other answers
continue syncing.

## Local Development

Use Node.js 22 or newer and npm.

```bash
git clone https://github.com/prezvious/mental-math-trainer.git
cd mental-math-trainer
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command         | Purpose                       |
| --------------- | ----------------------------- |
| `npm run dev`   | Start the development server. |
| `npm run build` | Create a production build.    |
| `npm run start` | Serve the production build.   |
| `npm run test`  | Run the Node.js test suite.   |
| `npm run lint`  | Check the app with ESLint.    |

Run `npm run build` before `npm run start`.

## Optional Account Sync

Account sync requires Supabase. Copy `.env.example` to `.env.local` and fill in
these public client values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Without those values, the app still works in guest mode.

Apply all SQL migrations in [`supabase/migrations`](supabase/migrations) in
chronological order. They create the progress and preference tables, dashboard
functions, retention rules, and account preference sync. Historical migrations
remain in the sequence for existing installations and fresh setup.

Apply `20261114030000_grant_authenticated_web_table_access.sql` to grant the
authenticated role access to the web preference and progress tables. This works
with Supabase automatic table exposure disabled. Row policies still govern which
rows the signed-in account can access.

Deploy the Studio-only web client before applying
`20261114020000_remove_interface_style.sql`, which drops the retired
`user_preferences.interface_style` column. If your backend also serves Android
1.0.5, defer this column drop until users can install a compatible Android
release. The installed 1.0.5 app selects the column when reading preferences.

Apply the November 14 migrations before serving this web version:

- `20261114000000_reset_account_progress.sql` adds atomic account resets and a
  generation checked on every progress insert. Android 1.0.5 omits the generation
  and loses cloud write access for an account after its first reset. Coordinate
  the reset rollout with a compatible release if both clients share a backend.
- `20261114010000_schedule_progress_retention.sql` requires `pg_cron` and schedules
  deletion of account answers older than 90 days, hourly at minute 17. Confirm the
  named job `mental-math-progress-retention` is active and inspect its run history.

Apply `20261118000000_record_mixed_progress_mode.sql` before deploying this
version so new Mixed rounds and imported Mixed history retain their mode label.

The retention job runs as the migration owner. For a self-hosted database, arrange
`pg_cron` support before applying that migration. See the
[extension setup instructions](https://github.com/citusdata/pg_cron#setting-up-pg_cron)
and [Supabase Cron guide](https://supabase.com/docs/guides/cron).

Guest tabs use Web Locks to protect live rounds during recovery and import.
Without Web Locks, the browser protects rounds in the current tab and treats
rounds in other tabs as abandoned after 24 hours without an update. Clear device
history includes those abandoned rounds. Finish rounds before leaving another
tab suspended for a day or more.

Apply `20261102055520_add_user_preferences_revision.sql` before deploying this
version. Preference saves and Realtime updates use a database-generated revision
to preserve their order across devices with different clocks.

Add each environment's `/verify` and `/reset-password` URLs to the
Supabase Auth redirect URL allowlist, including
`http://localhost:3000/reset-password` for local development. Configure email
delivery and verify the reset-link flow. Users request a link at
`/forgot-password` and choose a new password at `/reset-password`.

## Android release

The GitHub-distributed Android app has a separate native packaging source archive.
The signed [Android 1.0.5 release](https://github.com/solk3lly/mental-math-trainer/releases/tag/android-v1.0.5)
includes the Android 10 updater compatibility fix, update manifest, and full source
archive. See [updater compatibility and recovery](docs/android-update-compatibility.md)
for the Android 10 compatibility issue. If an earlier updater rejects 1.0.5,
install the downloaded 1.0.5 APK over the existing app to keep device data.

The updater in 1.0.5 uses the former repository path and can fail to check for
updates. The [updater source patch](docs/android-1.0.5-updater.patch) applies to
the published 1.0.5 source archive. Install the next compatible signed APK from
the release page over the existing app when it is available.

## Tech Stack

- Next.js 15
- React 18
- Tailwind CSS 3
- mathjs for high-precision calculations
- Supabase Auth, Postgres, and Realtime
- Browser local storage and IndexedDB for guest preferences and history

## License

[GNU General Public License, version 3](LICENSE)
