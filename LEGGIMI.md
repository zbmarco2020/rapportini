# Rapportini d'intervento – app Android con Firebase

| Cartella | Cosa è |
|---|---|
| `web` | L'applicazione e la configurazione Firebase (usata anche dall'app Android; si può pubblicare come sito) |
| `app-android` | Il progetto dell'app Android, da compilare in un file **APK** |
| `.github` | La compilazione automatica dell'APK su GitHub |

I dati sono nell'archivio **Firebase** (Google), condiviso tra tutti i tecnici: ognuno accede con la propria
email e password. L'app funziona anche **senza connessione** e sincronizza al ritorno della rete.

Funzioni dell'app Android:

- **Invia su WhatsApp:** genera il PDF e apre **direttamente WhatsApp** con il file già allegato;
  si sceglie il contatto e si invia. Se WhatsApp non è installato si apre il menu Condividi.
- **Fotocamera e microfono** usati direttamente dall'app.
- **Salva PDF** ed **Esporta CSV** aprono il menu Condividi (Drive, File, email, stampa…).
- Il tasto **Indietro** di Android chiude finestre e schede e torna all'elenco.

---

## 1. Progetto Firebase (una volta sola)

Prima di tutto attiva la **verifica in due passaggi** sull'account Google che userai
(<https://myaccount.google.com/security> → *Verifica in due passaggi*): senza, Google non apre la console Firebase.

1. Vai su <https://console.firebase.google.com> → **Crea un progetto** (es. `rapportini-codenotti`). Google Analytics non serve.
2. **Firestore Database** → *Crea database* → posizione **`europe-west8` (Milano)** → modalità **produzione**.
3. Sempre in Firestore, scheda **Regole**: sostituisci il testo con quello del file `web/firestore.rules` e premi **Pubblica**.
   In questo modo solo gli utenti creati da te possono leggere e scrivere.
4. **Authentication** → *Inizia* → abilita **Email/password**.
   In *Impostazioni → Azioni utente* togli la spunta a **Abilita creazione (registrazione)**: gli account li crei solo tu.
5. **Impostazioni progetto** (ingranaggio) → *Le tue app* → icona **Web `</>`** → registra l'app.
   Copia i valori mostrati in `firebaseConfig` dentro **`web/firebase-config.js`**, al posto delle scritte `INSERISCI…`.

## 2. Account dei tecnici

**Authentication → Utenti → Aggiungi utente**: email e password provvisoria per ogni tecnico.
Al primo accesso l'app chiede il nome, che compare sui rapportini e nelle modifiche.
Chi dimentica la password usa *Password dimenticata?* nella schermata di accesso.
Per togliere l'accesso: menu ⋮ accanto all'utente → *Disattiva account*.

## 3. Compilare l'APK con GitHub (senza installare nulla sul PC)

1. Crea un account gratuito su <https://github.com>.
2. Crea un repository **privato** (pulsante *New*), ad esempio `rapportini`.
3. Nella pagina del repository scegli *uploading an existing file* e trascina **tutto il contenuto** di questa cartella,
   compresa la cartella `.github` (su Mac è nascosta: mostrala con Cmd+Maiusc+punto) e il `firebase-config.js` già compilato.
   Poi *Commit changes*.
4. Scheda **Actions**: parte da sola *Compila app Android* (5-8 minuti).
5. A compilazione finita (spunta verde) apri l'esecuzione e scarica **Rapportini-app-android**: è uno zip con `Rapportini-N.apk`.

Ogni modifica caricata su GitHub produce un nuovo APK che si installa sopra il precedente senza perdere i dati
(la firma dell'app è fissa, nella cartella `app-android/firma`).

**In alternativa, con Android Studio** sul PC (servono Node.js e Android Studio), nella cartella `app-android`:
```
npm install
npm run android
npm run icone
npx cap open android
```
poi in Android Studio *Build → Build App Bundle(s) / APK(s) → Build APK(s)*.

## 4. Installare l'app sui telefoni

1. Copia l'APK sul telefono (email, WhatsApp, Drive, cavo USB) e aprilo.
2. Consenti l'installazione da questa fonte, poi *Installa*.
3. Accedi con email e password create al punto 2.
4. Al primo uso di fotocamera e microfono, Android chiede il permesso: **Consenti**.

## 5. Facoltativo: la stessa applicazione da browser

La cartella `web` si può pubblicare con Firebase Hosting (istruzioni in `web/LEGGIMI.md`): così si usa anche
dal PC dell'ufficio, con gli stessi dati dell'app.

## Problemi frequenti

| Messaggio | Cosa controllare |
|---|---|
| *Configurazione mancante* | `web/firebase-config.js` non compilato prima della compilazione dell'APK |
| *Email o password non corretti* | L'utente esiste in Authentication → Utenti ed è attivo? |
| Errori di permesso nel salvataggio | Le regole del punto 1.3 sono state pubblicate? |
| *auth/network-request-failed* | Il primo accesso richiede la connessione a internet |
| Accesso bloccato con chiave API limitata | Se in Google Cloud hai limitato la chiave API ai siti web, aggiungi `https://localhost` |
