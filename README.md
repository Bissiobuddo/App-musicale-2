# Armonia — riferimento musicale

App per **Android** e **PC** (web app installabile, funziona anche offline) che raccoglie i contenuti
del corso di musica in un unico strumento di consultazione interattivo.

## Sezioni

| Sezione | Cosa contiene |
|---|---|
| 🎸 **Accordi** | Diagrammi per **chitarra**, **ukulele** e **pianoforte** per 23 tipi di accordo e tutte le fondamentali. Più posizioni per ogni accordo (generate automaticamente), etichette con nome della nota o **intervallo**, tabella con il **significato di ogni intervallo** nell'accordo e struttura per terze. |
| 🔺 **Triadi e quadriadi** | Tutte le triadi (maggiore, minore, diminuita, aumentata, sus2, sus4) e quadriadi (maj7, 7, m7, m7♭5, °7, m(maj7), maj7♯5, 6, m6) con formula, intervalli, terze sovrapposte e carattere. Tabella “triade + settima = quadriade”. |
| 📏 **Intervalli** | I 13 intervalli dall'unisono all'ottava: semitoni, rapporto di frequenza, consonanza/dissonanza, carattere, **perché** suonano così e brani per ricordarli. Ascolto melodico/armonico e **quiz d'ascolto**. |
| 🎼 **Scale** | Maggiore, minori (naturale, armonica, melodica), modi greci, pentatoniche, blues, esatonale, cromatica: gradi, intervalli, toni/semitoni, tastiera, **manico** di chitarra/ukulele e accordi della scala. |
| 🔄 **Rivolti** | Stato fondamentale e rivolti di triadi e quadriadi: basso, sigla a barra, intervalli dal basso, numerica, uso; esempio di **condotta delle parti** con e senza rivolti. |
| 🔁 **Giri d'accordi** | Accordi della tonalità (triadi o quadriadi) con funzione, giri pronti (pop, anni '50, ii–V–I, blues, andalusa…) o personalizzati, riproduzione a tempo. Per ogni accordo: **note sicure per la melodia**, note di passaggio, note in comune con l'accordo successivo e **generatore di melodie**. |
| ⭕ **Circolo delle quinte** | Interattivo: armature, relative, scala, accordi della tonalità evidenziati sul cerchio, enarmonie. |
| 🎙️ **Accordatore** | Accordatore cromatico via microfono (chitarra, ukulele, basso) con note di riferimento e La₄ regolabile. |
| ⏱️ **Metronomo** | 30–260 BPM, tempi in battuta, accenti per battito, suddivisioni, tap tempo, schermo sempre acceso. |

Notazione selezionabile in alto: **Do Re Mi** oppure **C D E**. Le note sono scritte con l'enarmonia
corretta (es. Mi♭ maggiore ha Si♭, non La♯).

## Come usarla

### Sul PC
Basta aprirla nel browser (Chrome, Edge, Firefox). Con Chrome/Edge puoi anche installarla
come app con l'icona “Installa” nella barra degli indirizzi.

### Su Android
1. Apri l'indirizzo dell'app in **Chrome**.
2. Menu ⋮ → **Aggiungi a schermata Home** / **Installa app**.
3. L'app compare tra le altre app, si apre a schermo intero e funziona anche offline.

> Se vuoi un vero file **APK** (es. per il Play Store), puoi generarlo da questo stesso sito con
> [PWABuilder](https://www.pwabuilder.com): inserisci l'indirizzo pubblicato → *Package for stores* → *Android*.

## Pubblicazione (GitHub Pages)

Il workflow `.github/workflows/pages.yml` pubblica il sito ad ogni push su `main`.
Una sola volta: nel repository vai su **Settings → Pages → Source: GitHub Actions**.
L'app sarà disponibile su `https://<utente>.github.io/<repository>/`.

L'accordatore richiede HTTPS (GitHub Pages lo fornisce) per accedere al microfono.

## Sviluppo in locale

Nessuna dipendenza né build: è HTML, CSS e JavaScript (moduli ES).

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

Struttura:

```
index.html            shell dell'app
css/style.css         stile (tema chiaro/scuro automatico)
js/theory.js          teoria: note, intervalli, accordi, scale, tonalità
js/voicings.js        ricerca automatica delle diteggiature su chitarra/ukulele
js/audio.js           sintetizzatore Web Audio
js/ui.js              tastiera, diagrammi, manico (SVG)
js/views/*.js         una vista per sezione
sw.js                 service worker (offline) — aumenta VERSION ad ogni rilascio
```
