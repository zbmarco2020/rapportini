#!/usr/bin/env node
// Rapportini d'intervento – server per rete locale.
// Nessuna dipendenza esterna: serve solo Node.js (versione 18 o successiva).
//
//   node server.js                                  avvia il server
//   node server.js utente-aggiungi EMAIL "NOME" PWD crea un account
//   node server.js utente-password EMAIL PWD        cambia la password
//   node server.js utente-disattiva EMAIL           blocca un account
//   node server.js utente-attiva EMAIL              riattiva un account
//   node server.js utenti                           elenca gli account
"use strict";
const http = require("http"), https = require("https"), fs = require("fs"), path = require("path"),
  crypto = require("crypto"), os = require("os");

const BASE = __dirname;
const PUBLIC = path.join(BASE, "public");
const DATI = path.join(BASE, "dati");
const PRIVATO = path.join(DATI, "_privato");
const CERT = path.join(BASE, "certificato");
const PORTA = Number(process.env.PORTA || process.env.PORT || 0);
const MAX_BODY = 12 * 1024 * 1024;

fs.mkdirSync(PRIVATO, { recursive: true });

// ---------------------------------------------------------------- utenti
const F_UTENTI = path.join(PRIVATO, "utenti.json"), F_SESSIONI = path.join(PRIVATO, "sessioni.json");
const leggiJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
const scriviJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp" + process.pid; fs.writeFileSync(t, JSON.stringify(v)); fs.renameSync(t, f); };
let utenti = leggiJson(F_UTENTI, {});        // uid -> {email,nome,sale,hash,attivo}
let sessioni = leggiJson(F_SESSIONI, {});    // token -> {uid,creata}
// gli account si possono creare con nuovo-utente.bat anche mentre il server è acceso:
// prima di ogni uso si rilegge il file se è cambiato, così il server non lavora su una copia vecchia
const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
let mtU = mtime(F_UTENTI), mtS = mtime(F_SESSIONI);
function aggiorna() {
  const u = mtime(F_UTENTI); if (u !== mtU) { utenti = leggiJson(F_UTENTI, utenti); mtU = u; }
  const s = mtime(F_SESSIONI); if (s !== mtS) { sessioni = leggiJson(F_SESSIONI, sessioni); mtS = s; }
}
function salvaUtenti() { scriviJson(F_UTENTI, utenti); mtU = mtime(F_UTENTI); }
function salvaSessioni() { scriviJson(F_SESSIONI, sessioni); mtS = mtime(F_SESSIONI); }
const hashPw = (pw, sale) => crypto.scryptSync(String(pw), sale, 64).toString("hex");
const trovaEmail = em => Object.entries(utenti).find(([, u]) => u.email === String(em).trim().toLowerCase());
function salvaProfiloPubblico(uid) {
  const u = utenti[uid];
  scriviDoc(["utenti", uid], { nome: u.nome || "", email: u.email });
}

// ---------------------------------------------------------------- archivio documenti (un file JSON per documento)
const SEG = /^[A-Za-z0-9_\-.:@+~]{1,200}$/;
function segmenti(p) {
  const s = String(p || "").split("/").filter(Boolean);
  if (!s.length || s.length > 15) return null;
  for (const x of s) if (!SEG.test(x) || x === "." || x === ".." || x.startsWith("_")) return null;
  return s;
}
const fileDoc = s => path.join(DATI, ...s) + ".json";
const dirCol = s => path.join(DATI, ...s);
function leggiDoc(s) { return leggiJson(fileDoc(s), null); }
function scriviDoc(s, d) { scriviJson(fileDoc(s), d); }
function cancellaDoc(s) {
  try { fs.unlinkSync(fileDoc(s)); } catch (e) {}
  // con il documento si cancellano anche le sue sotto-raccolte (foto, note vocali)
  try { fs.rmSync(dirCol(s), { recursive: true, force: true }); } catch (e) {}
}
function elencoCol(s, limite) {
  let nomi = [];
  try { nomi = fs.readdirSync(dirCol(s)).filter(n => n.endsWith(".json")); } catch (e) {}
  if (limite) nomi = nomi.slice(0, limite);
  const out = [];
  for (const n of nomi) { const d = leggiJson(path.join(dirCol(s), n), null); if (d) out.push({ id: n.slice(0, -5), data: d }); }
  return out;
}
const ELIMINA = "__elimina__";
function unisci(base, delta) {
  const r = { ...(base || {}) };
  for (const [k, v] of Object.entries(delta || {})) { if (v === ELIMINA) delete r[k]; else r[k] = v; }
  return r;
}

// ---------------------------------------------------------------- comandi da terminale
const cmd = process.argv[2];
if (cmd === "utente-nuovo") {
  // creazione guidata: i dati si scrivono qui, quindi la password può contenere qualsiasi carattere
  const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
  const righe = [], attese = [];
  rl.on("line", l => { const f = attese.shift(); if (f) f(l.trim()); else righe.push(l.trim()); });
  const chiedi = q => { process.stdout.write(q); return righe.length ? Promise.resolve(righe.shift()) : new Promise(ok => attese.push(ok)); };
  (async () => {
    console.log("Creazione di un nuovo account\n");
    const email = await chiedi("Email: "), nome = await chiedi("Nome e cognome: "), pw = await chiedi("Password provvisoria (almeno 6 caratteri): ");
    rl.close();
    if (!email || !nome || !pw) { console.error("\nErrore: tutti i campi sono obbligatori"); process.exit(1); }
    if (trovaEmail(email)) { console.error("\nErrore: esiste già un account con questa email"); process.exit(1); }
    if (pw.length < 6) { console.error("\nErrore: la password deve avere almeno 6 caratteri"); process.exit(1); }
    const uid = crypto.randomBytes(10).toString("hex"), sale = crypto.randomBytes(16).toString("hex");
    utenti[uid] = { email: email.toLowerCase(), nome, sale, hash: hashPw(pw, sale), attivo: true };
    scriviJson(F_UTENTI, utenti); salvaProfiloPubblico(uid);
    console.log(`\nAccount creato: ${email.toLowerCase()} (${nome})\nPuò accedere subito, anche con il server già acceso.`);
    process.exit(0);
  })();
} else if (cmd && cmd.startsWith("utent")) {
  const [, , , a, b, c] = process.argv;
  const fine = m => { console.log(m); process.exit(0); }, errore = m => { console.error("Errore: " + m); process.exit(1); };
  if (cmd === "utenti") {
    const r = Object.values(utenti).map(u => `${u.attivo ? "attivo     " : "disattivato"}  ${u.email}  ${u.nome || ""}`);
    fine(r.length ? r.join("\n") : "Nessun account. Creane uno con: node server.js utente-aggiungi EMAIL \"NOME\" PASSWORD");
  }
  if (cmd === "utente-aggiungi") {
    if (!a || !b || !c) errore('uso: node server.js utente-aggiungi EMAIL "NOME E COGNOME" PASSWORD');
    if (trovaEmail(a)) errore("esiste già un account con questa email");
    if (String(c).length < 6) errore("la password deve avere almeno 6 caratteri");
    const uid = crypto.randomBytes(10).toString("hex"), sale = crypto.randomBytes(16).toString("hex");
    utenti[uid] = { email: a.trim().toLowerCase(), nome: b, sale, hash: hashPw(c, sale), attivo: true };
    scriviJson(F_UTENTI, utenti); salvaProfiloPubblico(uid); fine(`Account creato: ${a} (${b})`);
  }
  if (cmd === "utente-password") {
    const t = trovaEmail(a); if (!t || !b) errore("uso: node server.js utente-password EMAIL NUOVA_PASSWORD");
    if (String(b).length < 6) errore("la password deve avere almeno 6 caratteri");
    t[1].sale = crypto.randomBytes(16).toString("hex"); t[1].hash = hashPw(b, t[1].sale);
    for (const [k, s] of Object.entries(sessioni)) if (s.uid === t[0]) delete sessioni[k];
    scriviJson(F_UTENTI, utenti); scriviJson(F_SESSIONI, sessioni); fine("Password aggiornata per " + a);
  }
  if (cmd === "utente-disattiva" || cmd === "utente-attiva") {
    const t = trovaEmail(a); if (!t) errore("account non trovato");
    t[1].attivo = cmd === "utente-attiva";
    if (!t[1].attivo) for (const [k, s] of Object.entries(sessioni)) if (s.uid === t[0]) delete sessioni[k];
    scriviJson(F_UTENTI, utenti); scriviJson(F_SESSIONI, sessioni); fine(`Account ${t[1].attivo ? "riattivato" : "disattivato"}: ${a}`);
  }
  errore("comando non riconosciuto");
}

// ---------------------------------------------------------------- eventi in diretta (Server-Sent Events)
const ascoltatori = new Set();
function notifica(s) {
  const msg = `data: ${JSON.stringify({ path: s.join("/") })}\n\n`;
  for (const res of ascoltatori) { try { res.write(msg); } catch (e) {} }
}
setInterval(() => { for (const res of ascoltatori) { try { res.write(": ping\n\n"); } catch (e) {} } }, 25000);

// ---------------------------------------------------------------- http
const TIPI = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
function invia(res, code, obj) {
  const b = JSON.stringify(obj); res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(b);
}
function corpo(req) {
  return new Promise((ok, ko) => {
    let n = 0; const parti = [];
    req.on("data", c => { n += c.length; if (n > MAX_BODY) { ko(Object.assign(new Error("troppo grande"), { code: 413 })); req.destroy(); } else parti.push(c); });
    req.on("end", () => { try { ok(parti.length ? JSON.parse(Buffer.concat(parti).toString("utf8")) : {}); } catch (e) { ko(Object.assign(e, { code: 400 })); } });
    req.on("error", ko);
  });
}
function utenteDa(req, url) {
  aggiorna();
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : url.searchParams.get("token");
  const s = tok && sessioni[tok]; if (!s) return null;
  const u = utenti[s.uid]; if (!u || !u.attivo) return null;
  return { uid: s.uid, ...u };
}
function statico(req, res, url) {
  let p = decodeURIComponent(url.pathname); if (p.endsWith("/")) p += "index.html";
  const f = path.normalize(path.join(PUBLIC, p));
  if (!f.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Non trovato"); }
    const ext = path.extname(f);
    res.writeHead(200, { "Content-Type": TIPI[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" || f.endsWith("sw.js") ? "no-cache" : "public, max-age=3600" });
    res.end(buf);
  });
}

async function api(req, res, url) {
  const r = url.pathname.slice(5), m = req.method;
  if (r === "login" && m === "POST") {
    aggiorna();
    const b = await corpo(req), t = trovaEmail(b.email || "");
    const motivo = !t ? "account inesistente" : !t[1].attivo ? "account disattivato" : ![String(b.password || ""), String(b.password || "").trim()].some(p => hashPw(p.normalize("NFC"), t[1].sale) === t[1].hash) ? "password errata (lunghezza ricevuta " + String(b.password || "").length + " caratteri)" : "";
    if (motivo) {
      // il dettaglio compare solo nella finestra del server, per aiutare l'amministratore
      console.log(`${new Date().toLocaleString("it-IT")}  Accesso rifiutato per "${String(b.email || "").trim()}": ${motivo}`);
      await new Promise(z => setTimeout(z, 600)); return invia(res, 401, { errore: "credenziali" });
    }
    console.log(`${new Date().toLocaleString("it-IT")}  Accesso di ${t[1].email}`);
    const token = crypto.randomBytes(32).toString("hex");
    sessioni[token] = { uid: t[0], creata: Date.now() }; salvaSessioni();
    return invia(res, 200, { token, uid: t[0], email: t[1].email, nome: t[1].nome || "" });
  }
  const u = utenteDa(req, url);
  if (!u) return invia(res, 401, { errore: "accesso richiesto" });
  if (r === "logout" && m === "POST") { for (const [k, s] of Object.entries(sessioni)) if (s.uid === u.uid && req.headers.authorization === "Bearer " + k) delete sessioni[k]; salvaSessioni(); return invia(res, 200, { ok: true }); }
  if (r === "me") return invia(res, 200, { uid: u.uid, email: u.email, nome: u.nome || "" });
  if (r === "nome" && m === "POST") {
    const b = await corpo(req); const n = String(b.nome || "").trim().slice(0, 80);
    if (!n) return invia(res, 400, { errore: "nome vuoto" });
    aggiorna(); utenti[u.uid].nome = n; salvaUtenti(); salvaProfiloPubblico(u.uid); return invia(res, 200, { ok: true });
  }
  if (r === "eventi") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write("retry: 5000\n\n"); ascoltatori.add(res); req.on("close", () => ascoltatori.delete(res)); return;
  }
  if (r === "contatore" && m === "POST") {
    // Node esegue una richiesta alla volta: lettura e scrittura del contatore non possono sovrapporsi
    const b = await corpo(req); const anno = String(b.anno || "").replace(/\D/g, "").slice(0, 4);
    if (anno.length !== 4) return invia(res, 400, { errore: "anno" });
    const s = ["contatori", anno], d = leggiDoc(s) || {};
    const n = Math.max(Number(d.ultimo) || 0, Number(b.minimo) || 0) + (b.allinea ? 0 : 1);
    if (n !== Number(d.ultimo)) scriviDoc(s, { ultimo: n });
    return invia(res, 200, { n });
  }
  if (r === "doc" || r === "col") {
    const s = segmenti(url.searchParams.get("path"));
    if (!s) return invia(res, 400, { errore: "percorso non valido" });
    if (r === "col") {
      if (s.length % 2 !== 1) return invia(res, 400, { errore: "non è una raccolta" });
      return invia(res, 200, { docs: elencoCol(s, Number(url.searchParams.get("limit")) || 0) });
    }
    if (s.length % 2 !== 0) return invia(res, 400, { errore: "non è un documento" });
    if (m === "GET") { const d = leggiDoc(s); return invia(res, 200, { exists: !!d, data: d }); }
    if (m === "PUT") { const b = await corpo(req); scriviDoc(s, b.merge ? unisci(leggiDoc(s), b.data) : unisci({}, b.data)); notifica(s); return invia(res, 200, { ok: true }); }
    if (m === "PATCH") { const b = await corpo(req); const cur = leggiDoc(s); if (!cur) return invia(res, 404, { errore: "non trovato" }); scriviDoc(s, unisci(cur, b.data)); notifica(s); return invia(res, 200, { ok: true }); }
    if (m === "DELETE") { cancellaDoc(s); notifica(s); return invia(res, 200, { ok: true }); }
  }
  invia(res, 404, { errore: "sconosciuto" });
}

function gestore(req, res) {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    // l'app Android arriva da un'altra origine (https://localhost): l'accesso è protetto dal token, non dai cookie
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    api(req, res, url).catch(e => { console.error(e); invia(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { errore: e.message }); });
  } else statico(req, res, url);
}

// HTTPS se nella cartella "certificato" ci sono chiave.pem e certificato.pem, altrimenti HTTP
if (!(cmd && cmd.startsWith("utent"))) avviaServer(); // con i comandi da terminale il server non parte
function avviaServer() {
let server, protocollo;
try {
  const key = fs.readFileSync(path.join(CERT, "chiave.pem")), cert = fs.readFileSync(path.join(CERT, "certificato.pem"));
  server = https.createServer({ key, cert }, gestore); protocollo = "https";
} catch (e) { server = http.createServer(gestore); protocollo = "http"; }
const porta = PORTA || (protocollo === "https" ? 8443 : 8080);
server.listen(porta, "0.0.0.0", () => {
  const ip = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
  console.log("\nRapportini d'intervento – server avviato\n");
  for (const a of ip) console.log(`  Dalla rete locale:  ${protocollo}://${a}:${porta}`);
  console.log(`  Da questo computer: ${protocollo}://localhost:${porta}\n`);
  if (protocollo === "http") console.log("  Attenzione: senza certificato (HTTPS) microfono, installazione dell'app e invio del PDF su WhatsApp\n  funzionano solo in modo limitato. Vedi LEGGIMI.md.\n");
  if (!Object.keys(utenti).length) console.log('  Nessun account: creane uno con  node server.js utente-aggiungi EMAIL "NOME" PASSWORD\n');
  console.log("  Archivio dati: " + DATI + "\n  Per fermare il server: Ctrl+C\n");
});
}
