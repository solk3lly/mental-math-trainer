import Head from 'next/head';
import Link from 'next/link';
import IconLabel from 'components/IconLabel.js';
import PageIntro from 'components/PageIntro.js';
import ArrowsClockwiseIcon from 'images/phosphor/arrows-clockwise.svg';
import ChartLineUpIcon from 'images/phosphor/chart-line-up.svg';
import FunctionIcon from 'images/phosphor/function.svg';
import HouseIcon from 'images/phosphor/house.svg';
import ListChecksIcon from 'images/phosphor/list-checks.svg';
import TimerIcon from 'images/phosphor/timer.svg';
import { formatDuration } from 'utils/mathEngine.js';
import {
  getOperationDisplayLabel,
  PROGRESS_SOURCE_LABELS,
  RECENT_PROGRESS_WINDOW_DAYS
} from 'utils/progressDashboard.js';
import { DEVICE_HISTORY_DAYS } from 'utils/progressStorage.js';
import { useSupabaseAuth } from 'utils/supabaseAuthContext.js';
import useProgressDashboard from 'utils/useProgressDashboard.js';

function formatTimestamp(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(isoDate));
}

export default function StatsPage() {
  const auth = useSupabaseAuth();
  return <StatsContent key={auth.user?.id || 'guest'} auth={auth} />;
}

function StatsContent({ auth }) {
  const { user, isConfigured, isLoading: isCheckingAccount } = auth;
  const { dashboardData, isLoading, isResetting, errorMessage, syncError, rejectedCount, importOffer,
    isImporting, importDismissed, setImportDismissed, loadLogs, handleClearGuestHistory,
    handleImport, handleReset } = useProgressDashboard(auth);
  const { overview, operationBreakdown, recentSessions, recentAttempts } = dashboardData;

  return (
    <>
      <Head>
        <title>Progress Dashboard | Mental Math Studio</title>
        <meta
          name='description'
          content='Explore your mental math progress analytics, recent sessions, and speed trends.'
        />
      </Head>

      <PageIntro title='Progress' description={`Recent ${RECENT_PROGRESS_WINDOW_DAYS}-day history · ${user ? 'Account' : 'This device'}`} />

      {isCheckingAccount && <section className='panel paper-panel empty-state-panel' role='status'>Checking your account…</section>}

      {!isCheckingAccount && (
        <>
          {user && importOffer?.attempts.length > 0 && !importDismissed && (
            <section className='panel paper-panel appear-up import-offer'>
              <h2>Save this device history to your account?</h2>
              <p>{importOffer.sessions.length} {importOffer.sessions.length === 1 ? 'session' : 'sessions'} and {importOffer.attempts.length} submitted answers can be imported to {user.email}. Nothing is uploaded until you choose Import.</p>
              <div className='inline-actions'>
                <button type='button' className='button button-strong' onClick={() => void handleImport()} disabled={isImporting}>
                  {isImporting ? 'Importing…' : 'Import history'}
                </button>
                <button type='button' className='button button-quiet' onClick={() => setImportDismissed(true)} disabled={isImporting}>Not now</button>
              </div>
            </section>
          )}
          <section className='stats-actions appear-up'>
            <button
              type='button'
              onClick={() => void loadLogs()}
              className='button button-quiet'
              disabled={isLoading || isResetting || isImporting}
            >
              <IconLabel icon={ArrowsClockwiseIcon} className='icon-label-button'>
                {isLoading ? 'Refreshing...' : 'Refresh data'}
              </IconLabel>
            </button>
            <button
              type='button'
              onClick={user ? handleReset : handleClearGuestHistory}
              className='button button-danger'
              disabled={isResetting || isImporting || isLoading}
            >
              {isResetting ? 'Clearing...' : user ? 'Reset account progress' : 'Clear device history'}
            </button>
          </section>

          {syncError && <p className='feedback warning' role='status'>{syncError}</p>}
          {rejectedCount > 0 && (
            <div className='feedback warning'>
              <p role='status'>{rejectedCount} {rejectedCount === 1 ? 'answer was' : 'answers were'} rejected by account sync and kept on this device.</p>
              <button type='button' className='button button-quiet'
                disabled={isLoading || isResetting || isImporting}
                onClick={() => void loadLogs({ retryRejected: true })}>Retry rejected answers</button>
            </div>
          )}

          {!user && !isLoading && !errorMessage && (
            <p className='save-status'>Saved on this device · Last {DEVICE_HISTORY_DAYS} days, up to 100 sessions or 10,000 attempts. Clearing browser data removes this history. {isConfigured && <Link href='/login' className='text-link'>Log in to sync it</Link>}</p>
          )}

          {errorMessage && (
            <section className='panel warning-panel appear-up empty-state-panel'>
              <p className='panel-kicker'>Request failed</p>
              <h2>Dashboard data could not load</h2>
              <p>{errorMessage}</p>
            </section>
          )}

          {isLoading && (
            <section className='panel paper-panel appear-up empty-state-panel'>
              <p className='panel-kicker'>Loading</p>
              <h2>Building your latest dashboard snapshot</h2>
            </section>
          )}

          {!isLoading && !errorMessage && overview.totalAttempts === 0 && (
            <section className='panel paper-panel appear-up empty-state-panel'>
                <p className='panel-kicker'>No history yet</p>
              <h2>Start a round to build your history</h2>
              <p>
                Submitted answers from Trainer and Mixed rounds will appear here.
              </p>
              <div className='inline-actions'>
                <Link href='/' className='button button-strong'>
                  <IconLabel icon={HouseIcon} className='icon-label-button'>
                    Open trainer
                  </IconLabel>
                </Link>
                <Link href='/mixed' className='button button-quiet'>
                  Train mixed mode
                </Link>
              </div>
            </section>
          )}

          {!isLoading && !errorMessage && overview.totalAttempts > 0 && (
            <>
              <section className='summary-panel appear-up summary-panel-dashboard'>
                <div className='panel-title-row'>
                  <h2>
                    <IconLabel icon={ChartLineUpIcon} className='icon-label-heading'>
                      Overall Performance
                    </IconLabel>
                  </h2>
                </div>
                <p className='section-intro'>
                  A quick read on volume, accuracy, and response speed.
                </p>
                <div className='summary-grid'>
                  <article>
                    <h3>Total Attempts</h3>
                    <p className='summary-metric-value'>{overview.totalAttempts}</p>
                  </article>
                  <article>
                    <h3>Accuracy</h3>
                    <p className='summary-metric-value'>{overview.accuracy.toFixed(1)}%</p>
                  </article>
                  <article>
                    <h3>Avg Response</h3>
                    <p className='summary-metric-value'>
                      {formatDuration(overview.averageResponseMs)}
                    </p>
                  </article>
                  <article>
                    <h3>Fastest Answer</h3>
                    <p className='summary-metric-value'>{formatDuration(overview.fastest)}</p>
                  </article>
                </div>
              </section>

              <section className='panel paper-panel appear-up dashboard-section'>
                <div className='panel-title-row'>
                  <h2>
                    <IconLabel icon={FunctionIcon} className='icon-label-heading'>
                      Operation Breakdown
                    </IconLabel>
                  </h2>
                </div>
                <p className='section-intro'>
                  Compare how each operation behaves before you choose the next repetition block.
                </p>
                <div className='operation-grid'>
                  {operationBreakdown.map((row) => (
                    <article key={row.operation} className='operation-card'>
                      <h3>{getOperationDisplayLabel(row.operation)}</h3>
                      <p>Attempts: {row.attempts}</p>
                      <p>Accuracy: {row.accuracy.toFixed(1)}%</p>
                      <p>Avg speed: {formatDuration(row.averageResponseMs)}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className='panel chalk-panel appear-up dashboard-section'>
                <div className='panel-title-row'>
                  <h2>
                    <IconLabel icon={TimerIcon} className='icon-label-heading'>
                      Recent Sessions
                    </IconLabel>
                  </h2>
                </div>
                <p className='section-intro'>
                  Showing sessions from the last {RECENT_PROGRESS_WINDOW_DAYS} days.
                </p>
                <div className='table-wrap' role='region' aria-label='Recent training sessions' tabIndex={0}>
                  <table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Source</th>
                        <th>Mode</th>
                        <th>Digits</th>
                        <th>Score</th>
                        <th>Avg Speed</th>
                        {!user && <th>Round</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.map((session) => (
                        <tr key={session.sessionKey}>
                          <td>{formatTimestamp(session.latestCreatedAt)}</td>
                          <td>
                            <span className={`mode-pill mode-pill-${session.sourceMode}`}>
                              {PROGRESS_SOURCE_LABELS[session.sourceMode]}
                            </span>
                          </td>
                          <td>{session.modeLabel}</td>
                          <td>{session.digitsLabel}</td>
                          <td>
                            {session.correct}/{session.attempts}
                          </td>
                          <td>{formatDuration(session.averageResponseMs)}</td>
                          {!user && <td>{session.state === 'ended' ? 'Ended early' :
                            session.state === 'interrupted' ? 'Interrupted' :
                            session.state === 'completed' ? 'Completed' : 'In progress'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className='panel paper-panel appear-up dashboard-section'>
                <div className='panel-title-row'>
                  <h2>
                    <IconLabel icon={ListChecksIcon} className='icon-label-heading'>
                      Recent Attempts
                    </IconLabel>
                  </h2>
                </div>
                <p className='section-intro'>
                  Showing attempts from the last {RECENT_PROGRESS_WINDOW_DAYS} days.
                </p>
                <ul className='attempt-list'>
                  {recentAttempts.map((entry) => (
                    <li key={entry.id}>
                      <div className='attempt-equation'>{entry.promptText}</div>
                      <div className='attempt-result'>
                        <span className={`mode-pill mode-pill-${entry.sourceMode}`}>
                          {PROGRESS_SOURCE_LABELS[entry.sourceMode]}
                        </span>
                        <span className={entry.isCorrect ? 'good' : 'bad'}>
                          {entry.sourceMode === 'ai'
                            ? entry.sourceKind === 'custom'
                              ? 'Solved'
                              : 'Auto-solved'
                            : entry.isCorrect
                            ? 'Correct'
                            : 'Incorrect'}
                        </span>
                        {entry.sourceMode === 'ai' && (
                          <span className='attempt-answer'>{entry.resultExactText}</span>
                        )}
                        {entry.sourceMode === 'ai' && entry.resultKind === 'fraction' && (
                          <span className='attempt-answer'>{entry.resultDecimalText}</span>
                        )}
                        <span>{formatDuration(entry.responseMs)}</span>
                        <span>{formatTimestamp(entry.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
