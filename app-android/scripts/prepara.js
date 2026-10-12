// Copia nella cartella www l'applicazione (presa dalla cartella web, così app e sito sono sempre la stessa versione)
// e le librerie che nell'app devono funzionare anche senza internet.
const fs = require("fs"), path = require("path");
const qui = path.join(__dirname, ".."), www = path.join(qui, "www"), pub = path.join(qui, "..", "web");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, "lib"), { recursive: true });
for (const f of ["index.html", "firebase-config.js"]) fs.copyFileSync(path.join(pub, f), path.join(www, f));
fs.cpSync(path.join(pub, "icons"), path.join(www, "icons"), { recursive: true });
const lib = (pkg, file, nome) => {
  const src = path.join(qui, "node_modules", pkg, file);
  if (!fs.existsSync(src)) throw new Error("Manca " + src + ": esegui prima  npm install");
  fs.copyFileSync(src, path.join(www, "lib", nome));
};
lib("jspdf", "dist/jspdf.umd.min.js", "jspdf.umd.min.js");
lib("@capacitor/core", "dist/capacitor.js", "capacitor.js");
for (const f of ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"]) lib("firebase", f, f);
const cfg = fs.readFileSync(path.join(www, "firebase-config.js"), "utf8");
if (cfg.includes("INSERISCI")) console.warn("ATTENZIONE: web/firebase-config.js non è ancora compilato: l'app mostrerà 'Configurazione mancante'");
console.log("Cartella www pronta");
