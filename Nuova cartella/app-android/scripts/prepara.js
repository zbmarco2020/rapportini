// Copia nella cartella www l'applicazione (presa dal server, così è sempre la stessa versione)
// e le librerie che nell'app devono funzionare anche senza internet.
const fs = require("fs"), path = require("path");
const qui = path.join(__dirname, ".."), www = path.join(qui, "www"), pub = path.join(qui, "..", "server", "public");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, "lib"), { recursive: true });
for (const f of ["index.html", "localdb.js"]) fs.copyFileSync(path.join(pub, f), path.join(www, f));
fs.cpSync(path.join(pub, "icons"), path.join(www, "icons"), { recursive: true });
const lib = (pkg, file, nome) => {
  const src = path.join(qui, "node_modules", pkg, file);
  if (!fs.existsSync(src)) throw new Error("Manca " + src + ": esegui prima  npm install");
  fs.copyFileSync(src, path.join(www, "lib", nome));
};
lib("jspdf", "dist/jspdf.umd.min.js", "jspdf.umd.min.js");
lib("@capacitor/core", "dist/capacitor.js", "capacitor.js");
console.log("Cartella www pronta");
