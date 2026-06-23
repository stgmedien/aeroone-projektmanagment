// window.AeroAPI — thin networking layer between the dc-runtime app and the
// serverless backend. Kept separate so the edits inside the app's logic class
// are just call sites. Every method degrades gracefully when the backend is
// unreachable or the user is not authenticated (the app then behaves like the
// original local demo).

(function () {
  const opts = { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };

  async function req(method, url, body) {
    const r = await fetch(url, {
      ...opts,
      method,
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

  const api = {
    loginUrl: '/api/auth/google',

    // Returns { authed:boolean, user? }. Never throws.
    async me() {
      try {
        return await req('GET', '/api/auth/me');
      } catch {
        return { authed: false, offline: true };
      }
    },

    logout() {
      return req('POST', '/api/auth/logout').catch(() => {});
    },

    // ── Data layer (wired in the persistence step) ──
    // loadState / initState / createTask / patchTask / deleteTask / createBoard
    // / patchBoard / deleteBoard / savePerson — added next.
  };

  window.AeroAPI = api;
})();
