// Aggiunge al progetto Android generato da Capacitor:
//  - i permessi per fotocamera e microfono
//  - la visibilità di WhatsApp (Android 11+)
//  - il componente che passa il PDF direttamente a WhatsApp
//  - il numero di versione (dalla compilazione automatica su GitHub)
const fs = require("fs"), path = require("path");
const qui = path.join(__dirname, ".."), and = path.join(qui, "android");
if (!fs.existsSync(and)) { console.error("Cartella android assente: esegui  npx cap add android"); process.exit(1); }
const main = path.join(and, "app", "src", "main");

// 1. AndroidManifest.xml
const mf = path.join(main, "AndroidManifest.xml");
let m = fs.readFileSync(mf, "utf8");
const perm = ["android.permission.CAMERA", "android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS"];
for (const p of perm) if (!m.includes(`"${p}"`)) m = m.replace("</manifest>", `    <uses-permission android:name="${p}" />\n</manifest>`);
if (!m.includes("<queries>")) m = m.replace("</manifest>",
  `    <queries>\n        <package android:name="com.whatsapp" />\n        <package android:name="com.whatsapp.w4b" />\n    </queries>\n</manifest>`);
if (!m.includes("usesCleartextTraffic")) m = m.replace("<application", '<application\n        android:usesCleartextTraffic="true"');
fs.writeFileSync(mf, m);

// 2. percorsi condivisibili (il PDF viene scritto nella cache dell'app)
const xml = path.join(main, "res", "xml"); fs.mkdirSync(xml, { recursive: true });
fs.writeFileSync(path.join(xml, "file_paths.xml"), `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="cache" path="." />
    <files-path name="files" path="." />
    <external-path name="external" path="." />
    <external-cache-path name="external_cache" path="." />
</paths>
`);

// 3. componente WhatsApp + registrazione nell'attività principale
const pkgDir = path.join(main, "java", "it", "codenotti", "rapportini"); fs.mkdirSync(pkgDir, { recursive: true });
for (const f of ["WhatsappSharePlugin.java", "MainActivity.java"])
  fs.copyFileSync(path.join(qui, "android-extra", f), path.join(pkgDir, f));

// 4. numero di versione
const n = Number(process.env.GITHUB_RUN_NUMBER || process.env.VERSIONE || 0);
if (n) {
  const bg = path.join(and, "app", "build.gradle");
  let g = fs.readFileSync(bg, "utf8");
  g = g.replace(/versionCode\s+\d+/, "versionCode " + n).replace(/versionName\s+"[^"]*"/, `versionName "1.0.${n}"`);
  fs.writeFileSync(bg, g);
}
console.log("Progetto Android aggiornato");
