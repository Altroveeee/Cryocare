# Cryocare — Come Funziona l'Applicazione

## Cos'è Cryocare?

Cryocare è un'applicazione web interattiva progettata per un'installazione fisica. Presenta all'utente un "Guardiano Culturale" digitale — un personaggio che rappresenta una cultura in pericolo o perseguitata — e lo guida attraverso una sequenza di attività di cura: cucinare un piatto tradizionale, vestire il guardiano con l'abito cerimoniale e assistere a un rituale culturale. Ogni attività costruisce fiducia e sblocca dei ricordi — brevi momenti narrativi in cui il guardiano racconta perché la sua cultura ha dovuto essere preservata.

L'applicazione supporta attualmente sei culture: curda, amazigh, maori, palestinese, uigura e guaraní. Ciascuna ha il proprio nome del personaggio, cibo tradizionale, abiti, animazione rituale, musica e testo narrativo.

---

## Architettura

L'intera applicazione è una web app a pagina singola. C'è un file HTML che definisce la struttura visiva, un file CSS per lo stile e le animazioni, un file JavaScript contenente tutta la logica (circa 1.400 righe) e due file JSON di configurazione.

L'HTML è organizzato in livelli visivi sovrapposti l'uno all'altro all'interno di un contenitore dalla forma ovale. Dal fondo verso la superficie: il personaggio del guardiano, poi gli oggetti di scena come il tavolo e la ciotola, poi le zone di testo per i messaggi, poi i controlli interattivi come i pulsanti e la barra di progresso, e infine gli overlay a schermo intero per elementi come il pannello informativo e il visualizzatore dei ricordi. Ogni livello ha un z-index fisso, così gli elementi appaiono sempre nell'ordine corretto.

### Configurazione

L'applicazione carica due file di configurazione all'avvio. Il primo è un file di impostazioni globali che contiene tutti i percorsi degli asset, le posizioni di layout, i template di testo, i valori temporali e le soglie di interazione. Il secondo è un file per cultura che fornisce gli override specifici: il nome del guardiano, il nome e la descrizione del piatto tradizionale, l'ordine corretto degli ingredienti, il vestito cerimoniale corretto e i messaggi narrativi mostrati alla fine.

Quando viene selezionata una cultura, le sue regole specifiche vengono sovrapposte a quelle globali. Questo significa che aggiungere una nuova cultura non richiede di modificare il codice — basta fornire un nuovo set di asset (immagini, GIF, audio) e aggiungere una nuova voce nel file di configurazione delle culture.

### Sistema degli Asset

I percorsi degli asset nella configurazione utilizzano segnaposto come `{culture}` e `{id}` che vengono sostituiti a runtime con il nome della cultura attiva e l'identificativo dell'elemento rilevante. Ad esempio, un pattern come `assets/{culture}/pet/dress{id}.png` diventa `assets/amazigh/pet/dress2.png` quando la cultura amazigh è attiva e il vestito numero 2 è selezionato. I template di testo funzionano allo stesso modo — segnaposto come `{petName}` e `{foodName}` vengono sostituiti con i valori specifici della cultura.

Per evitare ritardi di caricamento visibili durante il gioco, tutte le immagini necessarie per la cultura selezionata vengono precaricate durante l'inizializzazione. Il sistema raccoglie ogni percorso di asset potenzialmente necessario — tutte le immagini del pet, tutte le icone dei pulsanti, tutte le varianti dei vestiti — e le carica in background prima che l'esperienza inizi.

### Firebase e Hardware

L'applicazione si connette a un Firebase Realtime Database, che funge da ponte di comunicazione tra la web app e i dispositivi fisici esterni.

In una direzione, l'app **ascolta** i cambiamenti di cultura. Quando un dispositivo esterno (come un selettore fisico dell'installazione) scrive un nuovo nome di cultura nel database, l'app rileva il cambiamento, si resetta completamente e riavvia l'esperienza per quella cultura. Questo è il punto di ingresso dell'applicazione — tutto ha inizio da questo listener.

Nell'altra direzione, l'app **scrive** segnali di attivazione nel database nei momenti chiave: quando l'utente fa una scelta sbagliata, quando il rituale ha inizio, quando il guardiano dice addio. Un Arduino collegato legge questi segnali e produce feedback fisico — vibrazioni, effetti luminosi o altre risposte sensoriali che rendono l'esperienza più immersiva.

---

## La Macchina a Stati

Il comportamento dell'applicazione è governato da una macchina a stati centrale. In ogni momento, l'app si trova in una di cinque fasi, e le attraversa in un ordine strettamente lineare:

**Schermo nero → In attesa di click → Sequenza introduttiva → Gameplay → Sequenza finale**

### Schermo Nero

L'app parte con uno schermo completamente nero. Il guardiano è "addormentato". Per svegliarlo, l'utente deve scuotere il dispositivo (l'app legge l'accelerometro) oppure, per il testing, premere il tasto S. Se l'esperienza è già stata completata una volta e l'utente sta tornando dopo un timeout, lo scuotimento lo riporta direttamente nel gameplay senza ripetere l'introduzione.

### In Attesa di Click

Dopo il risveglio, viene mostrata un'immagine statica — il guardiano nel suo stato dormiente. Un singolo tap ovunque sullo schermo avvia l'introduzione.

### Sequenza Introduttiva

Si tratta di una sequenza automatica a tempo, divisa in quattro passaggi. Prima, l'immagine statica svanisce. Poi una breve animazione istruttiva mostra all'utente come interagire (toccando le nuvole). Successivamente, un'animazione a onda viene riprodotta mentre appare il messaggio di benvenuto del guardiano: "Hello! Thank you for adopting me!" Infine, il guardiano si presenta con il suo nome e la sua cultura. Ogni passaggio dura circa tre secondi. L'intera sequenza include un meccanismo di sicurezza: se una nuova cultura viene selezionata a metà sequenza (dal selettore fisico), la sequenza corrente viene interrotta e ne inizia una nuova in modo pulito.

### Gameplay

È la fase interattiva principale, descritta in dettaglio più avanti.

### Sequenza Finale

Dopo il completamento di tutte le attività, l'app entra in un finale a più passaggi. Prima, appare un pulsante speciale con un'animazione a rimbalzo. Quando viene toccato, il guardiano si avvicina con uno zoom e vengono mostrati due messaggi narrativi specifici della cultura, ciascuno per cinque secondi. Si tratta di contenuti emotivamente intensi — spiegano con le parole del guardiano perché è entrato in crioconservazione (facendo riferimento a eventi reali come il divieto delle lingue o la distruzione di siti sacri). Dopo i messaggi, viene riprodotta un'animazione di saluto, l'hardware viene attivato un'ultima volta e lo schermo passa a un codice QR che rimanda a contenuti di approfondimento. Il codice QR ha quattro varianti a seconda che l'utente abbia visualizzato un determinato ricordo e che abbia svestito il guardiano durante il gameplay.

---

## Gameplay

Il gameplay è strutturato attorno a tre pagine e tre attività, da completare in un ordine fisso. L'utente non può saltare avanti — ogni attività deve essere terminata prima che la successiva diventi disponibile.

### Pagine

L'app ha tre pagine. La prima è la home, che mostra solo il guardiano. La seconda è la pagina del cibo, dove appaiono i pulsanti degli ingredienti. La terza è la pagina del vestito, dove appaiono i pulsanti degli abiti. L'utente non naviga tra le pagine manualmente — quando un'attività è pronta, un pulsante a forma di nuvola appare nella parte superiore dello schermo. Toccandolo, l'utente viene portato automaticamente alla pagina corretta.

Il design originale prevedeva frecce di navigazione sinistra/destra e gesti di swipe, e il codice sottostante per questi esiste ancora, ma attualmente sono disabilitati. Tutta la navigazione avviene attraverso i pulsanti nuvola.

### Sbloccamento e Pulsanti Nuvola

Il sistema dei pulsanti nuvola controlla il flusso dell'esperienza. In ogni momento, l'app determina quale sia il prossimo passaggio logico: cibo, vestito, rituale o un ricordo da visualizzare. Mostra quindi la nuvola appropriata sulla pagina corrente. Le nuvole appaiono con un breve ritardo (tre secondi fissi per la prima interazione, oppure un valore casuale tra uno e tre secondi per le successive) e sono accompagnate da un effetto sonoro.

Aspetto importante: le nuvole appaiono solo dopo che il traguardo precedente è stato riconosciuto. La nuvola del cibo appare solo dopo che l'utente ha visto il ricordo iniziale. La nuvola del vestito appare solo dopo il ricordo del cibo. Questo assicura che l'utente non possa correre attraverso l'esperienza senza interagire con il contenuto narrativo.

### Atto 1 — Cibo

Tre pulsanti ingrediente sono disposti in un arco curvo nella parte bassa dello schermo. L'utente deve trascinarne ciascuno al centro (sulla ciotola) nell'ordine corretto, che varia a seconda della cultura. Se l'ordine è sbagliato, il dispositivo vibra e l'ingrediente torna alla posizione originale.

Una volta che tutti e tre gli ingredienti sono stati posizionati correttamente, viene riprodotta un'animazione di cottura di circa quattro secondi, durante la quale appare il messaggio "Cooking...". Terminata l'animazione, vengono mostrati il nome e la descrizione del piatto tradizionale. Dopo una breve pausa, la ciotola si riempie del cibo preparato.

Da qui, l'utente procede cliccando attraverso una sequenza di alimentazione: la ciotola si muove leggermente mentre il guardiano mangia, poi la ciotola si avvicina all'utente mentre il guardiano condivide il cibo, e infine il guardiano fa un piccolo salto per esprimere felicità. L'intera sequenza di alimentazione coinvolge diversi stati interni (pronto per mangiare → che mangia → condivisione → completato) che controllano l'animazione e l'aspetto della ciotola.

Una volta completata l'attività del cibo, appare la nuvola del ricordo corrispondente.

### Atto 2 — Vestito

Tre pulsanti abito appaiono nella stessa disposizione ad arco. L'utente ne trascina uno sul guardiano, e l'immagine del guardiano cambia per mostrare quell'abito. Qualsiasi vestito può essere posizionato, ma solo uno è il corretto abito cerimoniale per il rituale a venire. Le scelte sbagliate attivano il feedback hardware.

Esiste anche una meccanica di svestizione: se l'utente tocca il centro del guardiano mentre questo indossa un abito, inizia un trascinamento inverso. Se l'utente trascina l'abito sufficientemente lontano dal centro, il guardiano viene svestito. Questo resetta il progresso del vestito e del rituale ed è tracciato come un flag che influenza la variante del codice QR finale.

Una volta selezionato il vestito corretto, appare la nuvola del rituale.

### Atto 3 — Rituale

Il rituale non ha una pagina dedicata — viene attivato da un pulsante nuvola che può apparire su qualsiasi pagina. Quando viene toccato, l'app naviga alla pagina del vestito (se non è già lì) e riproduce un'animazione rituale specifica della cultura con la musica corrispondente. Il file musicale è unico per ogni cultura. Al termine dell'animazione (circa quattro secondi), l'audio viene interrotto e appare la nuvola del ricordo del vestito.

### Barra di Progresso

Una barra di progresso visiva nella parte alta dello schermo traccia il completamento delle tre attività. Ogni volta che un'attività viene portata a termine, la barra avanza di un passo con una breve animazione e un effetto sonoro. La barra è visibile solo durante il gameplay e viene nascosta nelle sequenze di introduzione e finale.

### Ricordi

I ricordi sono immagini premio sbloccate in corrispondenza di tre traguardi: dopo l'ingresso nel gameplay (ricordo della casa), dopo il completamento dell'attività del cibo (ricordo del cibo) e dopo il rituale (ricordo del vestito). Ciascuno appare come un pulsante nuvola. Quando viene toccato, si apre un overlay a schermo intero con una breve animazione di apertura seguita dall'immagine vera e propria del ricordo. Toccando ovunque si chiude l'overlay e si segna quel ricordo come visualizzato.

La visualizzazione dell'ultimo ricordo (sulla pagina del vestito, dopo il rituale) è ciò che attiva la sequenza finale.

---

## Sistema di Interazione

L'applicazione utilizza un sistema di drag-and-drop per le interazioni del cibo e del vestito. Quando l'utente tocca un pulsante e inizia a trascinarlo, il pulsante si stacca visivamente dalla sua posizione e segue il dito dell'utente sullo schermo. Se l'utente lo rilascia abbastanza vicino al centro dello schermo (entro una distanza soglia), il rilascio viene considerato riuscito e l'azione di gioco corrispondente si attiva. Se il rilascio è troppo lontano dal centro, o se l'azione viene respinta (ordine degli ingredienti sbagliato), il pulsante torna alla posizione originale con un'animazione fluida.

Il sistema di trascinamento supporta sia gli eventi pointer (per desktop e dispositivi mobili moderni) sia gli eventi touch (specificamente per la compatibilità con versioni più vecchie di iOS). Un flag globale impedisce che più pulsanti vengano trascinati contemporaneamente.

Tutti i pulsanti interattivi riproducono un suono di click alla pressione, e il trascinamento riproduce un suono di swipe all'inizio. Questi segnali audio, combinati con le vibrazioni hardware, creano un circuito di feedback multisensoriale che rende le interazioni reattive e tangibili.

---

## Design Sonoro

L'applicazione utilizza otto effetti sonori distinti, sette dei quali vengono precaricati all'avvio dell'app:

- Un suono di **click** per le interazioni generali con i pulsanti
- Un suono **info** all'apertura del pannello informativo
- Un suono **ciotola** per ogni fase della sequenza di alimentazione
- Un suono **fiducia** quando la barra di progresso avanza
- Un suono di **apertura ricordo** quando viene toccata una nuvola ricordo
- Un suono **bolla** quando un qualsiasi pulsante nuvola appare sullo schermo
- Un suono **swipe** quando inizia un'interazione di trascinamento
- Un suono **rituale** che viene caricato dinamicamente in base alla cultura attiva, riproducendo musica tradizionale durante l'animazione del rituale

Il suono del rituale è l'unico creato al momento anziché precaricato, perché cambia a seconda della cultura attiva. Viene esplicitamente fermato quando l'animazione del rituale finisce, per evitare che l'audio si sovrapponga alle interazioni successive.

---

## Principi di Design

**Progressione sequenziale vincolata**: l'utente non può saltare contenuti. Ogni attività e ogni ricordo devono essere completati e riconosciuti prima che il successivo diventi disponibile.

**Gesti fisici** — scuotere, trascinare, toccare — fanno sì che ogni interazione assomigli a un atto di cura piuttosto che a una selezione da un menu.

**Specificità culturale** è integrata nell'architettura. Nulla è scritto nel codice per una cultura particolare. L'intero sistema è guidato da file di configurazione e percorsi di asset con template, quindi aggiungere una nuova cultura significa fornire nuove immagini, audio e una voce di configurazione — senza modifiche al codice.

**Ritmo emotivo**: l'esperienza è strutturata come un arco narrativo. Le interazioni leggere e giocose (cucinare, vestire) vengono prima. I contenuti più pesanti (il perché la cultura è in pericolo) vengono rivelati solo alla fine, dopo che la fiducia è stata costruita attraverso il gioco.
