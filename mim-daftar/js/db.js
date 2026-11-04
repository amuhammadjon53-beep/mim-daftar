/* =====================================================================
   МИМ Дафтар — everything that talks to the database lives here.
   app.js only calls DB.something(); it never talks to Supabase directly.

   WORKS WITHOUT INTERNET:
   - After every successful load, all data is saved on the phone (cache).
   - With no internet, the app opens from that saved copy.
   - New records made offline go into an "outbox" on the phone and are
     sent to the database automatically when internet comes back.
   - Every record gets its id on the phone, so sending twice is harmless.
   ===================================================================== */
"use strict";

const TABLES = ["settings", "rolls", "customers", "production", "sales", "payments", "expenses"];
const CACHE_KEY = "mim_cache_v2";
const OUTBOX_KEY = "mim_outbox_v2";

const DB = (() => {
  let sb = null;            // Supabase client
  let snapshot = null;      // last data from the server
  let syncing = false;
  let onChange = () => {};  // app.js sets this to re-draw the screen

  /* ---------- small helpers ---------- */
  const check = (error) => { if (error) throw error; };
  const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn("Storage full?", e); } };
  const newId = () => (crypto.randomUUID ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  /** true when the error means "no internet", not "the database said no" */
  function isNetworkError(e) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
    const m = String((e && (e.message || e.details)) || e || "");
    return /fetch|network|Failed to|Load failed|timeout|ECONN|ENOTFOUND|NetworkError/i.test(m);
  }

  // Supabase returns at most 1000 rows per request, so we read in pages.
  async function fetchAll(table) {
    const out = [];
    const step = 1000;
    for (let from = 0; ; from += step) {
      const { data, error } = await sb.from(table).select("*").range(from, from + step - 1);
      check(error);
      out.push(...data);
      if (data.length < step) break;
    }
    return out;
  }

  /* ---------- outbox (records waiting to be sent) ---------- */
  const outbox = () => read(OUTBOX_KEY, []);
  const setOutbox = (list) => write(OUTBOX_KEY, list);

  /** Apply one change to a data object (used for the offline view) */
  function applyOp(data, op) {
    const list = data[op.table] || (data[op.table] = []);
    if (op.type === "insert") { if (!list.some((r) => r.id === op.row.id)) list.push(Object.assign({ created_at: new Date().toISOString() }, op.row)); }
    else if (op.type === "update") { const r = list.find((x) => x.id === op.id); if (r) Object.assign(r, op.row); }
    else if (op.type === "delete") { data[op.table] = list.filter((x) => x.id !== op.id); }
    else if (op.type === "settings") { if (list[0]) Object.assign(list[0], op.row); else list.push(Object.assign({ id: 1 }, op.row)); }
  }

  /** Send one change to Supabase */
  async function sendOp(op) {
    if (op.type === "insert") {
      // upsert + ignoreDuplicates: if it was already sent, nothing happens
      const { error } = await sb.from(op.table).upsert(op.row, { onConflict: "id", ignoreDuplicates: true });
      check(error);
    } else if (op.type === "update") {
      const { error } = await sb.from(op.table).update(op.row).eq("id", op.id); check(error);
    } else if (op.type === "delete") {
      const { error } = await sb.from(op.table).delete().eq("id", op.id); check(error);
    } else if (op.type === "settings") {
      const { error } = await sb.from("settings").upsert(Object.assign({ id: 1, updated_at: new Date().toISOString() }, op.row)); check(error);
    }
  }

  /** Save a change: try to send now; if offline, keep it in the outbox */
  async function change(op) {
    const box = outbox();
    if (!box.length && navigator.onLine !== false) {
      try { await sendOp(op); applyOp(snapshot, op); write(CACHE_KEY, { at: Date.now(), data: snapshot }); return { queued: false }; }
      catch (e) { if (!isNetworkError(e)) throw e; }
    }
    box.push(Object.assign({ qid: newId(), at: Date.now() }, op));
    setOutbox(box);
    return { queued: true };
  }

  return {
    newId,
    isNetworkError,
    setOnChange(fn) { onChange = fn; },

    /** Has config.js been filled in? */
    configured() {
      const c = window.CONFIG || {};
      return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY &&
        !c.SUPABASE_URL.includes("YOUR_") && !c.SUPABASE_ANON_KEY.includes("YOUR_"));
    },
    init() {
      sb = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY,
        { auth: { persistSession: true, autoRefreshToken: true } });
      window.addEventListener("online", () => this.sync());
    },

    /* ---------- login ---------- */
    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    onSignedOut(callback) {
      sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") callback(); });
    },
    async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); check(error); },
    async signOut() {
      await sb.auth.signOut();
      try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(OUTBOX_KEY); } catch (e) {}
      snapshot = null;
    },
    async isMember() { const { data, error } = await sb.rpc("is_member"); check(error); return data === true; },

    /* ---------- reading ---------- */
    hasCache: () => !!read(CACHE_KEY, null),
    cacheTime: () => (read(CACHE_KEY, null) || {}).at || null,
    pendingCount: () => outbox().length,

    /** Load everything. Online → from server (and save a copy). Offline → saved copy. */
    async loadAll() {
      try {
        const results = await Promise.all(TABLES.map(fetchAll));
        snapshot = {};
        TABLES.forEach((t, i) => (snapshot[t] = results[i]));
        write(CACHE_KEY, { at: Date.now(), data: snapshot });
        return { online: true };
      } catch (e) {
        const cached = read(CACHE_KEY, null);
        if (cached && isNetworkError(e)) { snapshot = cached.data; return { online: false }; }
        throw e;
      }
    },
    /** Data to show = server copy + changes still waiting in the outbox */
    view() {
      const data = JSON.parse(JSON.stringify(snapshot || {}));
      TABLES.forEach((t) => (data[t] = data[t] || []));
      outbox().forEach((op) => applyOp(data, op));
      return data;
    },

    /** Send everything in the outbox. Returns how many were sent. */
    async sync() {
      if (syncing || !sb) return 0;
      const box = outbox();
      if (!box.length) return 0;
      syncing = true;
      let sent = 0;
      const failed = [];
      try {
        for (const op of box) {
          try { await sendOp(op); sent++; }
          catch (e) {
            if (isNetworkError(e)) break;           // still offline: stop, try later
            console.error("Could not save", op, e);  // the database refused it (bad data)
            failed.push({ op, message: e.message });
            sent++;                                  // remove it so it doesn't block the rest
          }
        }
        setOutbox(outbox().slice(sent));
        if (failed.length) write("mim_failed", read("mim_failed", []).concat(failed));
        if (sent) { try { await this.loadAll(); } catch (e) {} }
      } finally { syncing = false; }
      if (sent) onChange({ sent, failed: failed.length });
      return sent;
    },

    /* ---------- writing (all work offline too) ---------- */
    insert(table, row) { if (!row.id) row.id = newId(); return change({ type: "insert", table, row }); },
    update(table, id, row) { return change({ type: "update", table, id, row }); },
    remove(table, id) { return change({ type: "delete", table, id }); },
    saveSettings(row) { return change({ type: "settings", table: "settings", row }); },

    failedCount: () => read("mim_failed", []).length,
    clearFailed: () => write("mim_failed", [])
  };
})();
