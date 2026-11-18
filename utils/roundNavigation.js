const POSITION_KEY = 'mentalMathHistoryPosition';

export function installRoundNavigation({ history, navigation, router, isActive, requestExit }) {
  const push = history.pushState;
  const replace = history.replaceState;
  const entryIndex = () => {
    const index = navigation?.currentEntry?.index;
    return index >= 0 ? index : undefined;
  };
  let position = entryIndex() ?? history.state?.[POSITION_KEY] ?? 0;
  let pending = null;
  let disposed = false;

  history.pushState = function (state, title, url) {
    const nextPosition = position + 1;
    push.call(history, { ...state, [POSITION_KEY]: nextPosition }, title, url);
    position = entryIndex() ?? nextPosition;
  };
  history.replaceState = function (state, title, url) {
    replace.call(history, { ...state, [POSITION_KEY]: entryIndex() ?? position }, title, url);
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
    const target = entryIndex() ?? state?.[POSITION_KEY] ?? history.state?.[POSITION_KEY];
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
  const updatePositionOnPush = (event) => {
    if (event.navigationType === 'push') position = entryIndex() ?? position;
  };
  navigation?.addEventListener('currententrychange', updatePositionOnPush);

  return () => {
    disposed = true;
    history.pushState = push;
    history.replaceState = replace;
    navigation?.removeEventListener('currententrychange', updatePositionOnPush);
    router.beforePopState(() => true);
  };
}
