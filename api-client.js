// window.AeroAPI — networking layer between the dc-runtime app and the backend.
// Kept separate so edits inside the app's logic class are just call sites.
// - Reads/writes go to /api/* (session-cookie protected).
// - Writes are optimistic in the app; here they persist in the background.
// - Text edits are debounced per-entity; everything flushes on tab hide/unload.
// - Degrades silently when offline or unauthenticated (app keeps local state).

(function () {
  const pending = new Set();   // keys currently dirty/in-flight (poll waits on these)
  const timers = {};           // key -> debounce timer
  const saveFns = {};          // key -> latest () => Promise performing the save

  async function req(method, url, body, keepalive) {
    const r = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      keepalive: !!keepalive,
      body: body == null ? undefined : JSON.stringify(body),
    });
    if (r.status === 401 || r.status === 403) {
      const e = new Error('unauthorized');
      e.unauthorized = true;
      throw e;
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    return ct.includes('application/json') ? r.json() : r.text();
  }

  // Fire-and-forget with logging (immediate writes: create/delete).
  function fire(key, makeReq) {
    pending.add(key);
    return makeReq(false)
      .catch((e) => { if (!e || !e.unauthorized) console.warn('[AeroAPI] ' + key + ' failed', e); })
      .finally(() => pending.delete(key));
  }

  // Debounced writes (text edits). Coalesces rapid changes per entity.
  function schedule(key, makeReq, delay) {
    pending.add(key);
    saveFns[key] = makeReq;
    if (timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(() => run(key, false), delay);
  }
  function run(key, keepalive) {
    if (timers[key]) { clearTimeout(timers[key]); delete timers[key]; }
    const fn = saveFns[key];
    if (!fn) { pending.delete(key); return; }
    delete saveFns[key];
    fn(keepalive)
      .catch((e) => { if (!e || !e.unauthorized) console.warn('[AeroAPI] ' + key + ' failed', e); })
      .finally(() => pending.delete(key));
  }
  function flushAll() { Object.keys(saveFns).forEach((k) => run(k, true)); }
  window.addEventListener('pagehide', flushAll);
  window.addEventListener('beforeunload', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });

  const enc = encodeURIComponent;

  const api = {
    loginUrl: '/api/auth/google',

    async me() {
      try { return await req('GET', '/api/auth/me'); }
      catch { return { authed: false, offline: true }; }
    },
    logout() { return req('POST', '/api/auth/logout').catch(() => {}); },

    // Returns { people, boards, tasks, empty } or { unauthorized:true } or null.
    async loadState() {
      try { return await req('GET', '/api/state'); }
      catch (e) { return e && e.unauthorized ? { unauthorized: true } : null; }
    },
    initState(s) { return req('POST', '/api/state', s).catch(() => {}); },

    createTask(t) { return fire('task:new:' + t.id, (ka) => req('POST', '/api/tasks', t, ka)); },
    saveTask(t)   { schedule('task:' + t.id, (ka) => req('PATCH', '/api/tasks/' + enc(t.id), t, ka), 500); },
    deleteTask(id){ return fire('task:del:' + id, (ka) => req('DELETE', '/api/tasks/' + enc(id), null, ka)); },

    createBoard(b){ return fire('board:new:' + b.id, (ka) => req('POST', '/api/boards', b, ka)); },
    saveBoard(b)  { schedule('board:' + b.id, (ka) => req('PATCH', '/api/boards/' + enc(b.id), b, ka), 500); },
    deleteBoard(id){ return fire('board:del:' + id, (ka) => req('DELETE', '/api/boards/' + enc(id), null, ka)); },

    createPerson(p){ return fire('person:new:' + p.id, (ka) => req('POST', '/api/people', p, ka)); },
    savePerson(p)  { schedule('person:' + p.id, (ka) => req('PATCH', '/api/people/' + enc(p.id), p, ka), 400); },

    // How many writes are dirty/in-flight — the poller skips refresh while > 0.
    pendingSaves() { return pending.size; },
    flush: flushAll,
  };

  window.AeroAPI = api;
})();
