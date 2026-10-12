# Rapportini d'intervento – app Android con server in ufficio e Tailscale

Il pacchetto contiene due parti:

| Cartella | Cosa è |
|---|---|
| `server` | Il server che gira sul PC dell'ufficio e custodisce tutti i dati (cartella `server/dati`) |
| `app-android` | L'app Android per i tecnici, da compilare in un file **APK** |

**Tailscale** collega i telefoni al server dell'ufficio da qualsiasi posto (Wi-Fi del cliente, rete mobile),
come se fossero in ufficio, senza aprire porte sul router. In più fornisce un indirizzo `https://` valido,
senza certificati da installare sui telefoni.

Funzioni dell'app Android rispetto alla versione da browser:

- **WhatsApp:** il pulsante *Invia su WhatsApp* genera il PDF e apre **direttamente WhatsApp** con il file
  già allegato: si sceglie il contatto e si invia. Se WhatsApp non è installato si apre il menu Condividi.
- **Fotocamera e microfono** usati direttamente dall'app.
- **Senza rete** si continua a lavorare: i rapportini restano sul telefono e partono appena il server è raggiungibile.
- **Salva PDF** ed **Esporta CSV** aprono il menu Condividi (Drive, File, email, stampa…).
- Il tasto **Indietro** di Android chiude finestre e schede e torna all'elenco.

---

## 1. Server in ufficio

Sul PC che resterà acceso (serve **Node.js** 18 o successivo, versione LTS da <https://nodejs.org>):

1. Copia la cartella `server` ad esempio in `C:\Rapportini`.
2. Doppio clic su **`avvia.bat`**. La finestra deve restare aperta (per l'avvio automatico vedi `server/LEGGIMI.md`).
3. Crea gli account dei tecnici con **`nuovo-utente.bat`** (email, nome, password provvisoria).

Se usavi già la versione per rete locale, sostituisci solo i file del programma e **conserva la cartella `dati`**:
account e rapportini restano gli stessi.

## Solo in rete locale (senza Tailscale)

L'app Android usa **lo stesso server e gli stessi dati** della versione da browser: rapportini creati dal telefono
e dal PC dell'ufficio sono nello stesso archivio (cartella `server/dati`).

Se ai tecnici basta sincronizzare quando sono in ufficio, **Tailscale non serve**: al primo avvio dell'app si scrive
come indirizzo del server quello mostrato nella finestra di `avvia.bat`, ad esempio **`http://192.168.1.50:8080`**.
Fuori ufficio l'app continua a funzionare e invia i rapportini appena il telefono torna sul Wi-Fi aziendale.
Conviene dare al PC server un **IP fisso** nel router, altrimenti l'indirizzo può cambiare.

Tailscale (punti 2 e 3) serve solo se volete sincronizzare anche fuori ufficio.

## 2. Tailscale sul server (facoltativo)

1. Crea un account su <https://tailscale.com> (accesso con Google, Microsoft o altro).
2. Scarica e installa Tailscale sul PC server, poi accedi con lo stesso account.
3. Nella console di amministrazione (<https://login.tailscale.com/admin/dns>) attiva **MagicDNS** e,
   più in basso, **HTTPS Certificates**.
4. Con il server avviato, doppio clic su **`attiva-tailscale.bat`** (nella cartella `server`).
   Mostra un indirizzo simile a **`https://pc-ufficio.tail1234.ts.net`**: è l'indirizzo del server da usare nell'app.
   Basta farlo una volta: il collegamento resta attivo anche dopo il riavvio del PC.

Lo stesso indirizzo funziona anche dal browser di un telefono o PC collegato a Tailscale, con HTTPS completo.

## 3. Tailscale sui telefoni (facoltativo)

1. Installa l'app **Tailscale** dal Play Store e accedi.
   - Più semplice: tutti i telefoni accedono con l'account Tailscale aziendale.
   - In alternativa inviti ogni tecnico dalla console (*Users → Invite users*).
   Il piano gratuito ha un limite di utenti e dispositivi: verifica quello attuale su <https://tailscale.com/pricing>.
2. Lascia Tailscale **attivo**. Per non doverci pensare: Impostazioni Android → Rete → VPN → ingranaggio
   accanto a Tailscale → **VPN sempre attiva**.

## 4. Compilare l'APK (senza installare nulla sul PC) con GitHub

1. Crea un account gratuito su <https://github.com>.
2. Crea un nuovo repository **privato** (pulsante *New*), ad esempio `rapportini`.
3. Nella pagina del repository scegli *uploading an existing file* e trascina **tutto il contenuto** di
   questa cartella (anche la cartella `.github`; su Mac è nascosta, mostrala con Cmd+Maiusc+punto), poi *Commit changes*.
4. Apri la scheda **Actions**: parte da sola la compilazione *Compila app Android* (circa 5-8 minuti).
5. A compilazione finita (spunta verde) apri l'esecuzione e, in fondo, scarica **Rapportini-app-android**.
   È uno zip che contiene il file `Rapportini-N.apk`.

Ad ogni modifica caricata su GitHub viene compilato un nuovo APK, che si installa sopra il precedente
senza perdere i dati (la firma dell'app è fissa, nella cartella `app-android/firma`).

**In alternativa, con Android Studio** sul PC: installa Node.js e Android Studio, poi nella cartella `app-android`:
```
npm install
npm run android
npm run icone
npx cap open android
```
e in Android Studio *Build → Build App Bundle(s) / APK(s) → Build APK(s)*.

## 5. Installare l'app sui telefoni

1. Copia l'APK sul telefono (email, WhatsApp, cavo USB, Drive…) e aprilo.
2. Android chiede di consentire l'installazione da questa fonte: **Consenti**, poi *Installa*.
3. Al primo avvio l'app chiede **Indirizzo del server** (quello di rete locale, es. `http://192.168.1.50:8080`, oppure quello di Tailscale), email e password.
4. La prima volta che usi fotocamera o microfono, Android chiede il permesso: **Consenti**.

L'indirizzo del server si può cambiare in **Azienda → Server → Cambia server**.

## Problemi frequenti

| Messaggio | Cosa controllare |
|---|---|
| *Server non raggiungibile* | Tailscale attivo sul telefono? PC server acceso con `avvia.bat` aperto? Indirizzo scritto giusto? |
| *Email o password non corretti* | Nella finestra del server compare il motivo del rifiuto |
| Barra gialla con modifiche in attesa | Il telefono non raggiunge il server: partiranno da sole al ritorno della connessione |
| L'app non si installa sopra la vecchia | Disinstalla la vecchia versione (succede solo se era compilata con un'altra firma) |

Non uscire dall'account con modifiche in attesa: andrebbero perse (l'app avvisa).
