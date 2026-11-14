const test = require('node:test');
const assert = require('node:assert/strict');

test('a blocked open closes its late connection and a version change reopens history', async t => {
  const { getGuestHistory } = await import('../utils/progressStorage.js');
  const requests = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open() {
      const request = {};
      requests.push(request);
      return request;
    }
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous);
    else delete globalThis.indexedDB;
  });
  const createConnection = () => ({
    closed: false,
    close() { this.closed = true; },
    transaction() {
      assert.equal(this.closed, false);
      const transaction = { objectStore: () => ({ getAll: () => {
        const request = { result: [] };
        queueMicrotask(() => request.onsuccess());
        return request;
      } }) };
      setImmediate(() => transaction.oncomplete());
      return transaction;
    }
  });
  const open = (index, connection = createConnection()) => {
    requests[index].result = connection;
    requests[index].onsuccess();
    return connection;
  };

  const blocked = getGuestHistory();
  requests[0].onblocked();
  await assert.rejects(blocked, /Close other open tabs/);
  const retry = getGuestHistory();
  assert.equal(open(0).closed, true);
  const connection = open(1);
  assert.deepEqual(await retry, { sessions: [], attempts: [] });
  connection.onversionchange();
  assert.equal(connection.closed, true);
  const reopened = getGuestHistory();
  open(2);
  assert.deepEqual(await reopened, { sessions: [], attempts: [] });
});
