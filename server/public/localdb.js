// Collegamento al server in rete locale, con le stesse chiamate usate dall'applicazione
// (collection / doc / get / set / update / delete / onSnapshot).
// Fuori dalla rete dell'ufficio i dati restano nel telefono (IndexedDB) e le modifiche
// vengono messe in coda: partono da sole appena il server torna raggiungibile.
(function () {
  "use strict";
  const ELIMINA = "__elimina__";
  const TOKEN_KEY = "rapportini-token";
  const SERVER_KEY = "rapportini-server";
  // nel browser il server è la pagina stessa; nell'app Android è l'indirizzo scritto al primo accesso
  const BASE = () => (localStorage.getItem(SERVER_KEY) || "").replace(/\/+$/, "");

  // ---------------- IndexedDB: copia locale dei documenti e coda delle modifiche
  let dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise((ok, ko) => {
      const r = indexedDB.open("rapportini-locale", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("cache"); r.result.createObjectStore("coda", { autoIncrement: true }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const db = await idb();
    return new Promise((ok, ko) => {
      const t = db.transaction(store, mode), s = t.objectStore(store); let out;
      Promise.resolve(fn(s)).then(v => { out = v; });
      t.oncomplete = () => ok(out); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error);
    });
  }
  const req2p = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  const cacheGet = p => tx("cache", "readonly", s => req2p(s.get(p)));
  const cachePut = (p, d) => tx("cache", "readwrite", s => { d == null ? s.delete(p) : s.put(d, p); });
  async function cacheCol(colPath) {
    const pref = colPath + "/";
    return tx("cache", "readonly", s => new Promise(ok => {
      const out = []; const r = s.openCursor(IDBKeyRange.bound(pref, pref + "\uffff"));
      r.onsuccess = () => { const c = r.result; if (!c) return ok(out);
        const rest = c.key.slice(pref.length); if (!rest.includes("/")) out.push({ id: rest, data: c.value }); c.continue(); };
    }));
  }
  async function cacheDeleteTree(p) {
    await cachePut(p, null);
    const pref = p + "/";
    await tx("cache", "readwrite", s => { s.delete(IDBKeyRange.bound(pref, pref + "\uffff")); });
  }
  const unisci = (b, d) => { const r = { ...(b || {}) }; for (const [k, v] of Object.entries(d || {})) { if (v === ELIMINA) delete r[k]; else r[k] = v; } return r; };

  // ---------------- rete
  const token = () => localStorage.getItem(TOKEN_KEY) || "";
  class ErroreRete extends Error { constructor() { super("server non raggiungibile"); this.code = "unavailable"; } }
  async function chiama(metodo, url, body) {
    let r;
    try {
      r = await fetch(BASE() + url, { method: metodo, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    } catch (e) { stato.online = false; avvisa(); throw new ErroreRete(); }
    if (!stato.online) { stato.online = true; avvisa(); svuotaCoda(); }
    if (r.status === 401) { const e = new Error("accesso scaduto"); e.code = "unauthenticated"; window.dispatchEvent(new Event("rapportini-logout")); throw e; }
    if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.errore || ("errore " + r.status)); e.code = r.status === 413 ? "too_large" : "server"; throw e; }
    return r.json();
  }

  // ---------------- stato connessione
  const stato = { online: true, inCoda: 0 };
  const ascoltaStato = new Set();
  function avvisa() { for (const f of ascoltaStato) try { f({ ...stato }); } catch (e) {} }
  async function contaCoda() { stato.inCoda = await tx("coda", "readonly", s => req2p(s.count())); avvisa(); }

  // ---------------- coda delle modifiche fatte senza server
  let svuotando = false;
  async function accoda(op) { await tx("coda", "readwrite", s => { s.add(op); }); contaCoda(); }
  async function svuotaCoda() {
    if (svuotando) return; svuotando = true;
    try {
      for (;;) {
        const primo = await tx("coda", "readonly", s => new Promise(ok => { const r = s.openCursor(); r.onsuccess = () => ok(r.result ? { k: r.result.key, op: r.result.value } : null); }));
        if (!primo) break;
        try { await esegui(primo.op); }
        catch (e) { if (e instanceof ErroreRete) break; console.warn("modifica in coda scartata", primo.op, e); }
        await tx("coda", "readwrite", s => { s.delete(primo.k); });
      }
    } finally { svuotando = false; contaCoda(); }
  }
  function esegui(op) {
    const q = "/api/doc?path=" + encodeURIComponent(op.path);
    if (op.tipo === "set") return chiama("PUT", q, { data: op.data, merge: !!op.merge });
    if (op.tipo === "update") return chiama("PATCH", q, { data: op.data });
    if (op.tipo === "delete") return chiama("DELETE", q);
  }
  async function scrivi(op) {
    // la copia locale si aggiorna subito, così l'app funziona anche fuori rete
    if (op.tipo === "delete") await cacheDeleteTree(op.path);
    else { const cur = await cacheGet(op.path); await cachePut(op.path, op.tipo === "set" && !op.merge ? unisci({}, op.data) : unisci(cur, op.data)); }
    notificaLocale(op.path);
    if (stato.inCoda) { await accoda(op); svuotaCoda(); return; }
    try { await esegui(op); }
    catch (e) { if (e instanceof ErroreRete) { await accoda(op); return; } throw e; }
  }

  // ---------------- ascolto delle modifiche
  const ascoltatori = new Map(); // colPath -> Set(fn)
  function notificaLocale(docPath) {
    const col = docPath.split("/").slice(0, -1).join("/");
    const set = ascoltatori.get(col); if (set) for (const f of set) f(true);
  }
  let es = null;
  function avviaEventi() {
    if (es || !window.EventSource) return;
    es = new EventSource(BASE() + "/api/eventi?token=" + encodeURIComponent(token()));
    es.onmessage = e => {
      try { const p = JSON.parse(e.data).path, col = p.split("/").slice(0, -1).join("/");
        const set = ascoltatori.get(col); if (set) for (const f of set) f(false); } catch (x) {}
    };
    es.onopen = () => { if (!stato.online) { stato.online = true; avvisa(); } svuotaCoda(); for (const set of ascoltatori.values()) for (const f of set) f(false); };
    es.onerror = () => { if (stato.online) { stato.online = false; avvisa(); } };
  }

  // ---------------- oggetti simili a Firestore
  class DocSnap {
    constructor(id, d, fromCache) { this.id = id; this._d = d; this.exists = d != null; this.metadata = { fromCache: !!fromCache }; }
    data() { return this._d == null ? undefined : JSON.parse(JSON.stringify(this._d)); }
  }
  class DocRef {
    constructor(p) { this.path = p; this.id = p.split("/").pop(); }
    collection(sub) { return new ColRef(this.path + "/" + sub); }
    async get() {
      try { const r = await chiama("GET", "/api/doc?path=" + encodeURIComponent(this.path));
        if (!stato.inCoda) await cachePut(this.path, r.exists ? r.data : null);
        else if (r.exists) { const c = await cacheGet(this.path); return new DocSnap(this.id, c || r.data, false); }
        return new DocSnap(this.id, r.exists ? r.data : null, false); }
      catch (e) { if (!(e instanceof ErroreRete)) throw e; return new DocSnap(this.id, (await cacheGet(this.path)) || null, true); }
    }
    set(data, opt) { return scrivi({ tipo: "set", path: this.path, data, merge: !!(opt && opt.merge) }); }
    update(data) { return scrivi({ tipo: "update", path: this.path, data }); }
    delete() { return scrivi({ tipo: "delete", path: this.path }); }
  }
  class ColRef {
    constructor(p, lim) { this.path = p; this._lim = lim || 0; }
    doc(id) { return new DocRef(this.path + "/" + id); }
    limit(n) { return new ColRef(this.path, n); }
    async get() {
      let docs, fromCache = false;
      try {
        const r = await chiama("GET", "/api/col?path=" + encodeURIComponent(this.path) + (this._lim ? "&limit=" + this._lim : ""));
        docs = r.docs;
        if (!this._lim) {
          if (stato.inCoda) docs = await cacheCol(this.path); // modifiche locali non ancora inviate: vale la copia locale
          else {
            const vecchi = await cacheCol(this.path), ids = new Set(docs.map(d => d.id));
            for (const d of docs) await cachePut(this.path + "/" + d.id, d.data);
            for (const v of vecchi) if (!ids.has(v.id)) await cachePut(this.path + "/" + v.id, null);
          }
        }
      } catch (e) { if (!(e instanceof ErroreRete)) throw e; docs = await cacheCol(this.path); fromCache = true; }
      return { docs: docs.map(d => new DocSnap(d.id, d.data, fromCache)), metadata: { fromCache } };
    }
    onSnapshot(cb, onErr) {
      const giro = async soloLocale => {
        try {
          if (soloLocale) { const docs = await cacheCol(this.path); cb({ docs: docs.map(d => new DocSnap(d.id, d.data, true)), metadata: { fromCache: true } }); }
          else cb(await this.get());
        } catch (e) { onErr && onErr(e); }
      };
      if (!ascoltatori.has(this.path)) ascoltatori.set(this.path, new Set());
      ascoltatori.get(this.path).add(giro);
      avviaEventi();
      return () => ascoltatori.get(this.path).delete(giro);
    }
  }

  window.addEventListener("online", () => svuotaCoda());
  setInterval(() => { if (stato.inCoda) svuotaCoda(); }, 15000);

  window.LocalDB = {
    ELIMINA,
    db: { collection: p => new ColRef(p), doc: p => new DocRef(p) },
    stato: () => ({ ...stato }),
    ascoltaStato(f) { ascoltaStato.add(f); f({ ...stato }); contaCoda(); },
    async login(email, password) {
      let r; try { r = await fetch(BASE() + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); }
      catch (e) { throw new ErroreRete(); }
      if (r.status === 401) { const e = new Error("credenziali"); e.code = "credenziali"; throw e; }
      if (!r.ok) throw new Error("errore " + r.status);
      const j = await r.json(); localStorage.setItem(TOKEN_KEY, j.token);
      localStorage.setItem("rapportini-utente", JSON.stringify({ uid: j.uid, email: j.email, nome: j.nome })); return j;
    },
    utente() { try { return token() ? JSON.parse(localStorage.getItem("rapportini-utente") || "null") : null; } catch (e) { return null; } },
    async aggiornaUtente() { // verifica il token quando il server è raggiungibile; fuori rete si resta collegati
      try { const j = await chiama("GET", "/api/me"); localStorage.setItem("rapportini-utente", JSON.stringify(j)); return j; }
      catch (e) { if (e instanceof ErroreRete) return this.utente(); throw e; }
    },
    async impostaNome(nome) {
      await chiama("POST", "/api/nome", { nome });
      const u = this.utente(); if (u) { u.nome = nome; localStorage.setItem("rapportini-utente", JSON.stringify(u)); }
      await cachePut("utenti/" + (u && u.uid), { nome, email: u && u.email });
    },
    async logout() {
      try { await chiama("POST", "/api/logout"); } catch (e) {}
      localStorage.removeItem(TOKEN_KEY); localStorage.removeItem("rapportini-utente");
    },
    // numero progressivo: lo assegna il server, uno alla volta
    async contatore(anno, minimo, allinea) { return (await chiama("POST", "/api/contatore", { anno, minimo, allinea })).n; },
    svuotaCoda,
    server: () => localStorage.getItem(SERVER_KEY) || "",
    // cambio di server: si azzera la copia locale, che apparteneva al server precedente
    async impostaServer(url) {
      if (url === (localStorage.getItem(SERVER_KEY) || "")) return;
      localStorage.setItem(SERVER_KEY, url);
      localStorage.removeItem(TOKEN_KEY); localStorage.removeItem("rapportini-utente");
      if (es) { es.close(); es = null; }
      await tx("cache", "readwrite", s => { s.clear(); }); await tx("coda", "readwrite", s => { s.clear(); }); contaCoda();
    },
    async inCoda() { return tx("coda", "readonly", s => req2p(s.count())); }
  };
})();
