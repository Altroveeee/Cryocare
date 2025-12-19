/**
 * CONFIGURATION & CONSTANTS
 * Sezione dedicata alla configurazione globale dell’app
 */

// Oggetto che conterrà la configurazione di default caricata da JSON
let CONFIG = {};

// Oggetto che conterrà le configurazioni specifiche per ogni cultura
let CULTURE_CONFIGS = {};

// Funzione asincrona che carica i file di configurazione
async function loadConfiguration() {
    try {
        // Carica in parallelo i due file JSON
        const [defaultConfigRes, cultureConfigsRes] = await Promise.all([
            fetch('config/default.json'),     // configurazione base
            fetch('config/cultures.json')     // regole specifiche per cultura
        ]);

        // Controlla se almeno una richiesta è fallita
        if (!defaultConfigRes.ok || !cultureConfigsRes.ok) {
            throw new Error('Failed to load configuration files');
        }

        // Converte le risposte in oggetti JS
        CONFIG = await defaultConfigRes.json();
        CULTURE_CONFIGS = await cultureConfigsRes.json();

        console.log('Configuration loaded successfully');
    } catch (error) {
        // Gestione errori di caricamento
        console.error('Error loading configuration:', error);
    }

    /*
    Blocco di test COMMENTATO:
    - ascolta il tasto "F"
    - avvia una GIF
    - invia un comando seriale ad Arduino
    (usato solo per debug / prototipazione hardware)
    */
}
