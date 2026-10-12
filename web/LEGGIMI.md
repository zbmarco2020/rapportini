# Rapportini d'intervento – applicazione web

Applicazione web installabile (PWA) per compilare i rapportini d'intervento dal telefono o dal computer.
I dati sono in un archivio condiviso su **Firebase** (Google): ogni tecnico accede con la propria email e password.

Funziona anche **senza connessione**: si compila, si firma e si salva; i dati si sincronizzano al ritorno della rete.
I rapportini salvati offline ricevono il numero progressivo appena il telefono torna online.

## Contenuto della cartella

| File | A cosa serve |
|---|---|
| `index.html` | L'applicazione |
| `firebase-config.js` | I dati del vostro progetto Firebase (da compilare) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installazione sul telefono e funzionamento offline |
| `firestore.rules` | Regole di sicurezza: solo gli utenti autorizzati leggono e scrivono |
| `firebase.json` | Configurazione per la pubblicazione |

## 1. Creare il progetto Firebase (una volta sola)

1. Vai su <https://console.firebase.google.com> con l'account Google aziendale e crea un nuovo progetto (es. `rapportini-codenotti`). Google Analytics non serve.
2. **Firestore Database** → *Crea database* → modalità **produzione** → posizione in Europa: `europe-west8` (Milano).
3. **Authentication** → *Inizia* → abilita il metodo **Email/password**.
   - In *Impostazioni → Azioni utente* togli la spunta a **Abilita creazione (registrazione)**: così gli account li crei solo tu.
4. **Impostazioni progetto** (ingranaggio) → *Le tue app* → icona **Web `</>`** → registra l'app (puoi attivare anche Firebase Hosting).
   Copia i valori di `firebaseConfig` dentro `firebase-config.js`, al posto delle scritte `INSERISCI…`.

## 2. Pubblicare l'applicazione

Serve un computer con [Node.js](https://nodejs.org) installato. Dal terminale, dentro questa cartella:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # scegli il progetto creato al punto 1
firebase deploy
```

Alla fine compare l'indirizzo dell'applicazione, ad esempio `https://rapportini-codenotti.web.app`.
Il comando pubblica anche le regole di sicurezza di `firestore.rules`.

Per pubblicare una nuova versione dopo una modifica basta ripetere `firebase deploy`.

## 3. Creare gli account dei tecnici

**Authentication → Utenti → Aggiungi utente**: email e password provvisoria per ogni tecnico.
Al primo accesso l'app chiede il nome, che comparirà sui rapportini e nella dicitura delle modifiche.
Chi dimentica la password usa *Password dimenticata?* nella schermata di accesso.

Per togliere l'accesso a qualcuno: *Authentication → Utenti → menu ⋮ → Disattiva account*.

## 4. Installare l'app sul telefono

- **Android (Chrome):** apri l'indirizzo dell'app → menu ⋮ → **Installa app** (o *Aggiungi a schermata Home*).
- **iPhone (Safari):** apri l'indirizzo → pulsante Condividi → **Aggiungi alla schermata Home**.
- **Computer (Chrome/Edge):** icona di installazione nella barra degli indirizzi.

L'app si apre a schermo intero con l'icona Codenotti, come un'app normale.

## Cosa funziona meglio rispetto alla versione su Claude

- **WhatsApp:** il pulsante *Invia su WhatsApp* apre il menu Condividi del telefono con il **PDF già allegato**.
- **Microfono:** la registrazione delle note vocali avviene direttamente nell'app.
- **Offline:** si lavora anche senza campo, con sincronizzazione automatica.
- **Accessi:** ogni tecnico ha il suo account, senza dipendere dalla condivisione di un link.

## Costi

Il piano gratuito di Firebase (*Spark*) è sufficiente per un'azienda con alcuni tecnici
(1 GB di archivio, 50.000 letture e 20.000 scritture al giorno). Foto e note vocali sono compresse e salvate
nel database; se l'archivio diventasse molto grande si può passare al piano a consumo (*Blaze*).

## Privacy

L'archivio contiene dati dei clienti (nomi, telefoni, firme, foto). Con la posizione `europe-west8` i dati restano
in Italia. Ricordate di citare il servizio nell'informativa privacy aziendale.

## Dati dell'archivio attuale

I rapportini compilati nella versione su Claude non vengono trasferiti automaticamente.
