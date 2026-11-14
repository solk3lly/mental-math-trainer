import IconLabel from 'components/IconLabel.js';
import ArrowsClockwiseIcon from 'images/phosphor/arrows-clockwise.svg';
import SlidersHorizontalIcon from 'images/phosphor/sliders-horizontal.svg';
import TrophyIcon from 'images/phosphor/trophy.svg';
import { formatDuration } from 'utils/mathEngine.js';

const SAVE_MESSAGES = {
  saving: ['Saving this round...', 'Ending session and saving progress...'],
  saved: ['Round saved to your progress history.', 'Session ended early and progress was saved to your history.'],
  'device-saved': ['Round saved on this device.', 'Ended early. Submitted answers were saved on this device.'],
  idle: ['Sign in to store completed rounds.', 'Session ended early. Sign in to store partial progress.'],
  discarded: ['Account progress was reset. This round was not saved.', 'Account progress was reset. This round was not saved.']
};

export function getSaveStatusMessage({ saveState, saveError, wasTerminated }) {
  if (saveState === 'error') {
    const label = wasTerminated ? 'this ended session' : 'this round';
    return `Could not save ${label}: ${saveError}`;
  }
  return SAVE_MESSAGES[saveState]?.[Number(Boolean(wasTerminated))] ?? '';
}

function RoundCompletionNote({ round }) {
  if (!round.wasTerminated) return null;
  return <>
    <p className='round-completion-note'>Ended early · {round.total} submitted {round.total === 1 ? 'answer' : 'answers'}</p>
    {round.generationError && <p className='feedback warning' role='alert'>{round.generationError}</p>}
  </>;
}

export default function RoundSummaryPanel({
  title = 'Round Summary',
  badgeLabel = '',
  badgeClassName = 'mode-pill-manual',
  round,
  saveStatus = '',
  primaryAction = null,
  secondaryAction = null,
  retryAction = null,
  className = '',
  children = null
}) {
  if (!round) {
    return null;
  }

  return (
    <section className={`summary-panel appear-up round-summary-panel ${className}`.trim()}>
      <div className='panel-title-row'>
        <h2>
          <IconLabel icon={TrophyIcon} className='icon-label-heading'>
            {title}
          </IconLabel>
        </h2>
        {badgeLabel && <span className={`mode-pill ${badgeClassName}`}>{badgeLabel}</span>}
      </div>
      <RoundCompletionNote round={round} />
      <div className='summary-grid'>
        <article>
          <h3>Accuracy</h3>
          <p className='summary-metric-value'>{round.accuracy.toFixed(1)}%</p>
        </article>
        <article>
          <h3>Correct Answers</h3>
          <div className='summary-count-stack' aria-label={`${round.correct} out of ${round.total}`}>
            <span className='summary-count-primary'>{round.correct}</span>
            <span className='summary-count-divider'>/</span>
            <span className='summary-count-secondary'>{round.total}</span>
          </div>
        </article>
        <article>
          <h3>Avg Response</h3>
          <p className='summary-metric-value'>{formatDuration(round.averageResponseMs)}</p>
        </article>
        <article>
          <h3>Total Time</h3>
          <p className='summary-metric-value'>{formatDuration(round.totalResponseMs)}</p>
        </article>
      </div>
      {children}
      {saveStatus && <p className='save-status'>{saveStatus}</p>}
      {retryAction && (
        <button type='button' className='button button-strong' onClick={retryAction.onClick}
          disabled={retryAction.disabled}>
          {retryAction.label || 'Retry save'}
        </button>
      )}
      {primaryAction && secondaryAction && (
        <div className='summary-actions'>
          <button
            type='button'
            className='button button-strong'
            onClick={primaryAction.onClick}
            aria-keyshortcuts='Enter'
          >
            <IconLabel icon={ArrowsClockwiseIcon} className='icon-label-button'>
              {primaryAction.label}
            </IconLabel>
          </button>
          <button
            type='button'
            className='button button-quiet'
            onClick={secondaryAction.onClick}
          >
            <IconLabel icon={SlidersHorizontalIcon} className='icon-label-button'>
              {secondaryAction.label}
            </IconLabel>
          </button>
        </div>
      )}
    </section>
  );
}
