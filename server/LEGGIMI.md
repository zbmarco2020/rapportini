# Rapportini d'intervento – versione per rete locale

L'applicazione gira su un computer dell'ufficio (o un server/NAS con Node.js) e i tecnici la usano
dal telefono, dal tablet o dal PC collegati alla **rete aziendale**. I dati restano in ufficio,
nella cartella `dati`, senza servizi cloud.

Fuori ufficio l'app continua a funzionare: i rapportini si compilano, si firmano e si salvano sul telefono,
e vengono inviati al server automaticamente appena il tecnico torna sulla rete aziendale
(o si collega tramite VPN). Il numero progressivo viene assegnato in quel momento.

## Cosa serve

- Un computer sempre acceso in ufficio, con **Node.js** versione 18 o successiva (<https://nodejs.org>, versione "LTS").
  Non servono altri programmi né collegamento a internet per il server.
- I telefoni dei tecnici collegati al Wi-Fi aziendale.

## 1. Avvio

1. Copia la cartella `rapportini-lan` sul computer server, ad esempio in `C:\Rapportini`.
2. Doppio clic su **`avvia.bat`** (su Linux/Mac: `./avvia.sh`).
3. La finestra mostra gli indirizzi, ad esempio `http://192.168.1.50:8080`: è quello da aprire sui telefoni.
4. Se Windows chiede il permesso del firewall, consenti l'accesso sulle **reti private**.

La finestra deve restare aperta: chiudendola il server si ferma. Per avviarlo da solo all'accensione del computer
usa l'*Utilità di pianificazione* di Windows (attività "All'avvio" che esegue `avvia.bat`).

Conviene assegnare al computer server un **indirizzo IP fisso** nel router, così l'indirizzo dell'app non cambia.

## 2. Account dei tecnici

Doppio clic su **`nuovo-utente.bat`** e inserisci email, nome e password provvisoria.
L'account si può creare anche con il server acceso ed è utilizzabile subito.

Se un tecnico non riesce ad accedere, guarda la finestra del server: per ogni tentativo rifiutato
indica il motivo (*account inesistente*, *password errata*, *account disattivato*).

Gli stessi comandi sono disponibili dal terminale, nella cartella del programma:

```
node server.js utente-aggiungi mario@azienda.it "Mario Rossi" password123
node server.js utente-password mario@azienda.it nuovapassword
node server.js utente-disattiva mario@azienda.it
node server.js utente-attiva mario@azienda.it
node server.js utenti
```

Il primo accesso di ogni tecnico deve avvenire collegato alla rete dell'ufficio.

## 3. HTTPS (consigliato)

**Modo più semplice: Tailscale.** Con `attiva-tailscale.bat` il server riceve un indirizzo `https://….ts.net`
valido, raggiungibile anche fuori ufficio e senza certificati da installare sui telefoni
(vedi il LEGGIMI principale). Il metodo con mkcert qui sotto serve solo se non volete usare Tailscale.

Con il semplice indirizzo `http://` l'app funziona, ma i browser per sicurezza limitano alcune funzioni:

| Funzione | `http://` | `https://` |
|---|---|---|
| Rapportini, firme, foto, fotocamera, PDF | sì | sì |
| Registrazione vocale dentro l'app | si apre il registratore del telefono | sì, diretta |
| Invio su WhatsApp con PDF allegato | PDF scaricato, da allegare a mano | sì, menu Condividi |
| Installazione come app e apertura senza rete | no | sì |

Per attivare HTTPS si crea un certificato con **mkcert** (<https://github.com/FiloSottile/mkcert/releases>):

1. Sul computer server, in un terminale aperto nella cartella del programma:
   ```
   mkcert -install
   mkcert -key-file certificato\chiave.pem -cert-file certificato\certificato.pem 192.168.1.50 localhost
   ```
   (al posto di `192.168.1.50` metti l'indirizzo IP del server).
2. Riavvia `avvia.bat`: ora l'indirizzo è `https://192.168.1.50:8443`.
3. Sui telefoni va installato il certificato dell'ufficio, una volta sola:
   - il comando `mkcert -CAROOT` indica la cartella con il file `rootCA.pem`: copialo sul telefono;
   - **Android:** Impostazioni → Sicurezza → Altre impostazioni di sicurezza → Crittografia e credenziali →
     Installa un certificato → **Certificato CA** → scegli `rootCA.pem` (il percorso varia leggermente tra marche);
   - **iPhone:** apri il file, poi Impostazioni → Generali → VPN e gestione dispositivi → installa il profilo;
     poi Impostazioni → Generali → Info → Impostazioni certificati → attiva l'attendibilità completa.

## 4. Installare l'app sul telefono

Con HTTPS attivo: apri l'indirizzo in Chrome → menu ⋮ → **Installa app**. Su iPhone: Safari → Condividi →
**Aggiungi alla schermata Home**. Con `http://` puoi comunque aggiungere un collegamento alla schermata Home.

## 5. Backup

Tutti i dati (rapportini, foto, note vocali, firme, account) sono nella cartella **`dati`**.
Per il backup basta copiarla regolarmente, ad esempio con una copia pianificata su un disco esterno o sul NAS.
Per ripristinare: fermare il server, rimettere la cartella `dati`, riavviare.

## Da sapere

- **Fuori ufficio:** l'app mostra una barra gialla "Server dell'ufficio non raggiungibile" con il numero
  di modifiche in attesa. Quando il tecnico torna sulla rete aziendale le modifiche partono da sole.
  Per ricevere i numeri progressivi e i rapportini dei colleghi bisogna essere collegati.
- **Non uscire dall'account con modifiche in attesa:** andrebbero perse. L'app avvisa prima di farlo.
- **Accesso da fuori senza aspettare il rientro:** si può configurare una VPN verso la rete aziendale.
  Sconsigliato invece aprire la porta del server direttamente su internet.
- **Due tecnici sullo stesso rapportino:** chi salva per secondo viene avvisato, come nella versione online.
