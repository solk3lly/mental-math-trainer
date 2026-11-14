const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const databaseName = 'mental-math-review-' + Date.now();
const testScript = `
import * as storage from '/utils/progressStorage.js';
import {createProgressLogBuffer} from '/utils/progressLogs.js';
import {resetAccountProgress} from '/utils/progressWriteCoordinator.js';
const out = document.querySelector('pre');
const results = [];
function check(condition, message) { if (!condition) throw Error(message); }
function result(value) { results.push(value); out.textContent = JSON.stringify(results, null, 2); }
const db = await new Promise((resolve,reject) => {
  const r = indexedDB.open('${databaseName}',2);
  r.onupgradeneeded = () => {
    r.result.createObjectStore('sessions',{keyPath:'id'});
    const a = r.result.createObjectStore('attempts',{keyPath:'key'}); a.createIndex('sessionId','sessionId');
    const q = r.result.createObjectStore('accountQueue',{keyPath:'key'}); q.createIndex('userId','userId');
  };
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
});
function transaction(store, callback) {
  return new Promise((resolve,reject)=> { const tx=db.transaction(store,'readwrite'); callback(tx.objectStore(store)); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); });
}
function all(store) {
  return new Promise((resolve,reject)=> {const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
const row = { operation:'ADDITION',digits_left:1,digits_right:1,left_operand:'2',right_operand:'3',correct_answer:'5',submitted_answer:'5',is_correct:true,response_ms:1000,created_at:new Date().toISOString() };
await storage.startGuestSession({id:'crashed-round',kind:'trainer',settings:{},requestedCount:3});
await storage.recordGuestAttempt('crashed-round',1,row);
await storage.finishGuestSession('crashed-round','interrupted');
const oldSession=(await all('sessions')).find(s=>s.id==='crashed-round');
oldSession.state='active';
oldSession.updatedAt=new Date(Date.now()-10*60*1000).toISOString();
await transaction('sessions',s=>s.put(oldSession));
const before=await storage.getGuestHistory();
const eligibleBefore=before.sessions.filter(s=>s.state!=='active'&&s.attemptCount>0);
check(before.attempts.length===1&&eligibleBefore.length===0,'stale committed session excluded from import');
await storage.recoverInterruptedGuestSessions();
const recovered=await storage.getGuestHistory();
check(recovered.sessions[0].state==='interrupted','explicit guest recovery makes it importable');
result({case:'stale-session-import',committedAttempts:before.attempts.length,eligibleWithoutRecovery:eligibleBefore.length,stateAfterExplicitRecovery:recovered.sessions[0].state});
await storage.claimGuestSessionImport('crashed-round','account-a');
await storage.markGuestSessionImported('crashed-round','account-a');
oldSession.importOwnerId='account-a'; oldSession.importedTo='account-a';oldSession.state='completed';oldSession.updatedAt=new Date(Date.now()-100*86400000).toISOString();
await transaction('sessions',s=>s.put(oldSession));
await storage.pruneGuestHistory();
result({case:'imported-history-pruning',sessionsRemaining:(await all('sessions')).length,attemptsRemaining:(await all('attempts')).length});
// Use the actual durable queue and buffer against a deferred backend.
let release; const wait = new Promise(resolve=>release=resolve); const remote=[];
const client={from:()=>({upsert:async rows=>{await wait;remote.push(...rows);return {error:null};}})};
const buffer=createProgressLogBuffer({getClient:()=>client,flushDelayMs:600000});
buffer.enqueue({...row,user_id:'account-a',session_id:'before-reset',question_index:1});
const inFlight=buffer.flush();
while(buffer.getInFlightRows().length===0) await new Promise(resolve=>setTimeout(resolve,0));
check((await storage.getPendingAccountProgressRows('account-a')).length===1,'durable row is in flight');
const reset=resetAccountProgress('account-a',async()=>{remote.length=0;},
  ()=>storage.clearPendingAccountProgressRows('account-a'));
release(); await Promise.all([inFlight,reset]);
check(remote.length===0,'reset waits for the old write and keeps history empty');
result({case:'reset-during-in-flight-save',queuedAfterReset:(await storage.getPendingAccountProgressRows('account-a')).length,remoteRowsAfterDelayedWrite:remote.length});
buffer.dispose();
document.title='Audit checks complete';
`;
const page = '<!doctype html><meta charset="utf-8"><title>Audit checks running</title><h1>Isolated storage verification</h1><pre>Running...</pre><script type="module">' + testScript + '\n</script>';
const server = http.createServer((req,res)=> {
  if(req.url==='/') {res.setHeader('Content-Type','text/html');res.end(page);return;}
  const modules = ['/utils/progressStorage.js', '/utils/progressLogs.js',
    '/utils/progressWriteCoordinator.js', '/utils/browserStorage.js', '/utils/guestSessionLocks.js'];
  if(modules.includes(req.url)) {
    res.setHeader('Content-Type','text/javascript');
    res.end(fs.readFileSync(path.join(root,req.url),'utf8').replace("'mental-math-device-history'",JSON.stringify(databaseName)));
    return;
  }
  res.statusCode=404;res.end();
});
module.exports = server;
if (require.main === module) {
  server.listen(3012, '127.0.0.1', () => console.log('Review checks at http://127.0.0.1:3012/'));
}
