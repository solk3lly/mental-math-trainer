const POSITION_KEY = 'mentalMathHistoryPosition';

export function installRoundNavigation({ history, router, isActive, requestExit }) {
  const push = history.pushState;
  const replace = history.replaceState;
  let position = history.state?.[POSITION_KEY] ?? 0;
  let pending = null;
  let disposed = false;

  history.pushState = function (state, title, url) {
    const nextPosition = position + 1;
    push.call(history, { ...state, [POSITION_KEY]: nextPosition }, title, url);
    position = nextPosition;
  };
  history.replaceState = function (state, title, url) {
    replace.call(history, { ...state, [POSITION_KEY]: position }, title, url);
  };
  history.replaceState(history.state, '', undefined);

  function askToLeave(traversal) {
    traversal.requested = true;
    Promise.resolve().then(requestExit).then(confirmed => {
      if (disposed || pending !== traversal) return;
      if (!confirmed) {
        pending = null;
        return;
      }
      traversal.confirmed = true;
      history.go(traversal.target - position);
    }).catch(() => { if (pending === traversal) pending = null; });
  }

  function restoreOrConfirm(target) {
    if (pending?.confirmed && target === pending.target) {
      position = target;
      pending = null;
      return true;
    }
    if (target === position) {
      if (!pending.requested) askToLeave(pending);
      return false;
    }
    history.go(position - target);
    return false;
  }

  function handleTraversal(state) {
    const target = state?.[POSITION_KEY] ?? history.state?.[POSITION_KEY];
    if (!Number.isInteger(target)) return true;
    if (pending) return restoreOrConfirm(target);
    if (target === position || !isActive()) {
      position = target;
      return true;
    }
    pending = { target, requested: false, confirmed: false };
    history.go(position - target);
    return false;
  }
  router.beforePopState(handleTraversal);

  return () => {
    disposed = true;
    history.pushState = push;
    history.replaceState = replace;
    router.beforePopState(() => true);
  };
}
