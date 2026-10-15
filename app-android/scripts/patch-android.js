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

// 2b. il server dell'ufficio risponde in http: consentito esplicitamente (Android lo blocca di serie)
fs.writeFileSync(path.join(xml, "network_security_config.xml"), `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
`);
{
  let m2 = fs.readFileSync(mf, "utf8");
  if (!m2.includes("networkSecurityConfig")) m2 = m2.replace("<application", '<application\n        android:networkSecurityConfig="@xml/network_security_config"');
  fs.writeFileSync(mf, m2);
}

// 3. componente WhatsApp + registrazione nell'attività principale
const pkgDir = path.join(main, "java", "it", "codenotti", "rapportini"); fs.mkdirSync(pkgDir, { recursive: true });
for (const f of ["WhatsappSharePlugin.java", "MainActivity.java"])
  fs.copyFileSync(path.join(qui, "android-extra", f), path.join(pkgDir, f));

// 3b. firma dell'app sempre uguale (chiave nella cartella firma), scritta direttamente nel progetto:
//     senza firma identica Android rifiuta l'aggiornamento ("pacchetto in conflitto")
{
  const chiave = path.join(qui, "firma", "debug.keystore");
  if (!fs.existsSync(chiave)) { console.error("Manca firma/debug.keystore: senza questo file gli aggiornamenti non si installano"); process.exit(1); }
  fs.copyFileSync(chiave, path.join(and, "app", "firma-rapportini.keystore"));
  const bg = path.join(and, "app", "build.gradle");
  let g = fs.readFileSync(bg, "utf8");
  if (!g.includes("signingConfigs.rapportini")) {
    g = g.replace(/\n(\s*)buildTypes\s*\{/, `
$1signingConfigs {
$1    rapportini {
$1        storeFile file("firma-rapportini.keystore")
$1        storePassword "android"
$1        keyAlias "androiddebugkey"
$1        keyPassword "android"
$1    }
$1}
$1buildTypes {
$1    debug { signingConfig signingConfigs.rapportini }`);
    if (!g.includes("signingConfigs.rapportini")) { console.error("build.gradle: sezione buildTypes non trovata"); process.exit(1); }
    fs.writeFileSync(bg, g);
  }
}

// 4. numero di versione: cresce sempre (minuti trascorsi dal 1970), anche cambiando repository,
//    così ogni nuova compilazione si installa sopra la precedente
{
  const codice = Math.floor(Date.now() / 60000);
  // data e ora italiane (GitHub compila con l'ora di Greenwich)
  const pz = {}; for (const x of new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date())) pz[x.type] = x.value;
  const nome = `1.${pz.year}${pz.month}${pz.day}.${pz.hour}${pz.minute}`;
  const bg = path.join(and, "app", "build.gradle");
  let g = fs.readFileSync(bg, "utf8");
  g = g.replace(/versionCode\s+\d+/, "versionCode " + codice).replace(/versionName\s+"[^"]*"/, `versionName "${nome}"`);
  fs.writeFileSync(bg, g);
  console.log("Versione " + nome + " (codice " + codice + ")");
}
console.log("Progetto Android aggiornato");
