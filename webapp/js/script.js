// 1. Import Firebase from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// 2. Paste your specific configuration here
const firebaseConfig = {
  apiKey: "AIzaSyDm_V5mxoagUzTBZPc7COPWz_iw_X_ADdM",
  authDomain: "cryocare-46397.firebaseapp.com",
  databaseURL: "https://cryocare-46397-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "cryocare-46397",
  storageBucket: "cryocare-46397.firebasestorage.app",
  messagingSenderId: "245430472807",
  appId: "1:245430472807:web:4b778c9201066ed69984c2"
};

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 4. Listen for changes in the "culture" node
const cultureRef = ref(db, 'device/culture');

onValue(cultureRef, (snapshot) => {
  const selectedCulture = snapshot.val();
  console.log("Database updated! New culture:", selectedCulture);

  if (selectedCulture) {
    init(selectedCulture);
  }
});

// CONFIG & STATE
let CONFIG = {};
let CULTURE_CONFIGS = {};

const PAGES = [
    { id: 'home', content: { type: 'empty' } },
    { id: 'food', content: { type: 'curved-buttons', count: 3, ids: ['1', '2', '3'] } },
    { id: 'dress', content: { type: 'curved-buttons', count: 3, ids: ['1', '2', '3'] } },
];

const state = {
    sessionToken: 0,
    timers: {},
    appPhase: 'black_screen', // black_screen -> waiting_for_click -> sequence_running -> gameplay -> ending_sequence
    endingStep: null, // button_wait -> zoomed_sequence -> goodbye
    loadingStep: null, 
    hasStarted: false,
    currentCulture: 'kurd',
    currentPageIndex: 0,
    progress: { food: false, dress: false, ritual: false },
    unlocked: { food: false, dress: false },
    memoriesViewed: { home: false, food: false, dress: false },
    gameplay: {
        foodSequence: [],
        chosenDressId: null,
        currentPetImage: null,
        bakingState: 'none', // none -> baking -> baked
        feedingState: 'idle', // idle -> ready_to_eat -> eating -> sharing -> done
    },
    ui: {
        isAnyButtonDragging: false,
        inactivityTimer: null,
        touchStartX: 0,
        isGifPlaying: false,
        lastProgressScore: 0,
        isProgressAnimating: false,
        progressTimer: null,
        tempContent: { top: null, bot: null },
        tempTimers: { top: null, bot: null },
        topButton: {
            activeType: null, // 'food', 'dress', 'ritual', 'memory'
            visible: false,
            timer: null
        }
    }
};

const dom = {}; // Populated in init

const CLICK_SOUND = new Audio('assets/audio/click_sound.mp3');
CLICK_SOUND.volume = 0.5;

const INFO_SOUND = new Audio('assets/audio/interazione/info.mp3'); // Assicurati che il file esista
INFO_SOUND.volume = 0.5;

const BOWL_SOUND = new Audio('assets/audio/interazione/ciotola.mp3'); 
BOWL_SOUND.volume = 0.5;

const PROGRESS_SOUND = new Audio('assets/audio/interazione/trust.mp3'); 
PROGRESS_SOUND.volume = 0.6;

const MEMORY_SOUND = new Audio('assets/audio/interazione/apertura_ricordo.mov'); 
MEMORY_SOUND.volume = 0.5;

const BUBBLE_SOUND = new Audio('assets/audio/interazione/appear_nuvola.mp3'); 
BUBBLE_SOUND.volume = 0.5;

const DRAG_START_SOUND = new Audio('assets/audio/interazione/swipe.mp3');
DRAG_START_SOUND.volume = 0.5;


/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

async function init(selectedCulture) {
    // 1. Load Config
    await loadConfiguration();
    
    // 2. Cache DOM elements
    cacheDomElements();

    // 3. Preload Assets (Base & First Culture)
    await preloadImages([
        CONFIG.ASSETS.LOADING_STATIC,
        CONFIG.ASSETS.LOADING_ANIMATION
    ]);

    // 4. Reset Game (Selects culture)
    resetGame(selectedCulture);
    
    // 5. Preload Culture Specifics
    const cultureAssets = collectCultureAssets(state.currentCulture);
    await preloadImages(cultureAssets);
    
    // 6. Start
    setupEventListeners();
    
    // Initial State: Black Screen
    dom.overlayBlack.style.display = 'block';
    updateUI();
    wakeUp();
}

async function loadConfiguration() {
    try {
        const [def, cult] = await Promise.all([
            fetch('config/default.json').then(r => r.json()),
            fetch('config/cultures.json').then(r => r.json())
        ]);
        CONFIG = def;
        CULTURE_CONFIGS = cult;
    } catch (e) {
        console.error("Config Load Failed", e);
    }
}

function cacheDomElements() {
    dom.ovalContainer = document.getElementById('oval-container');
    dom.petImage = document.getElementById('pet-image');
    dom.tableImage = document.getElementById('table-image');
    dom.bowlImage = document.getElementById('bowl-image');
    dom.progressBarContainer = document.getElementById('progress-bar-container');
    dom.progressBarImage = document.getElementById('progress-bar-image');
    dom.navLeft = document.getElementById('nav-arrow-left');
    dom.navLeftImg = dom.navLeft.querySelector('img');
    dom.navRight = document.getElementById('nav-arrow-right');
    dom.navRightImg = dom.navRight.querySelector('img');
    dom.zoneTop = document.getElementById('content-zone-top');
    dom.zoneBot = document.getElementById('content-zone-bot');
    dom.buttonsContainer = document.getElementById('buttons-container');
    dom.infoContainer = document.getElementById('info-button-container');
    dom.overlayBlack = document.getElementById('black-screen-overlay');
    dom.overlayInfo = document.getElementById('info-overlay');
    dom.infoContent = document.getElementById('info-content');
    dom.overlayMemory = document.getElementById('memory-overlay');
    dom.memoryContentImage = document.getElementById('memory-content-image');
}

function preloadImages(urls) {
    const promises = urls.map(url => {
        return new Promise(resolve => {
            const img = new Image();
            img.src = url;
            img.onload = resolve;
            img.onerror = resolve; // Proceed anyway
        });
    });
    return Promise.all(promises);
}

function collectCultureAssets(culture) {
    // Helper to generate list of assets for current culture to prevent flicker
    const assets = [];
    const push = (p) => assets.push(p.replace('{culture}', culture));

    // Pet
    push(CONFIG.ASSETS.PET_BAKING);
    push(CONFIG.ASSETS.PET_RITUAL);
    push(CONFIG.ASSETS.BYE_BYE_ANIMATION);
    for(let i=1; i<=3; i++) push(CONFIG.ASSETS.PET_DRESS.replace('{id}', i));
    push(CONFIG.ASSETS.BAKED_FOOD);

    // Buttons
    PAGES.forEach(page => {
        if(page.content.type === 'curved-buttons') {
            page.content.ids.forEach(id => {
                const path = CONFIG.ASSETS.BUTTON_PREFIX.replace('{culture}', culture) + `${page.id}${id}.png`;
                assets.push(path);
            });
        }
    });

    return assets;
}

/* ==========================================================================
   GAME LOGIC & STATE
   ========================================================================== */

function resetGame(culture = null) {
    // 1. Reset System & UI
    resetTimers();
    resetVisuals();
    state.sessionToken++;

    if (culture && CONFIG.CULTURES.includes(culture)) {
        state.currentCulture = culture;
    } else {
        const idx = Math.floor(Math.random() * CONFIG.CULTURES.length);
        state.currentCulture = CONFIG.CULTURES[idx];
    }

    if (CULTURE_CONFIGS[state.currentCulture]) {
        CONFIG.RULES = { ...CONFIG.RULES, ...CULTURE_CONFIGS[state.currentCulture].RULES };
    }

    if (CONFIG.ASSETS.ARROW_LEFT) dom.navLeftImg.src = CONFIG.ASSETS.ARROW_LEFT;
    if (CONFIG.ASSETS.ARROW_RIGHT) dom.navRightImg.src = CONFIG.ASSETS.ARROW_RIGHT;

    state.appPhase = 'black_screen'; 
    state.endingStep = null;
    state.loadingStep = null;
    state.hasStarted = false;
    state.progress = { food: false, dress: false, ritual: false };
    state.unlocked = { food: false, dress: false };
    state.memoriesViewed = { home: false, food: false, dress: false };
    state.gameplay = {
        foodSequence: [],
        chosenDressId: null,
        currentPetImage: getAssetPath(CONFIG.ASSETS.PET_DEFAULT),
        bakingState: 'none',
        feedingState: 'idle'
    };
    state.currentPageIndex = 0;
    
    // Reset UI Flags
    state.ui.isGifPlaying = false;
    state.ui.lastProgressScore = 0;
    state.ui.isProgressAnimating = false;
    
    // Top button timer cleared in resetTimers, just reset state object
    state.ui.topButton = { activeType: null, visible: false, timer: null };

    resetInactivityTimer();
}

function resetTimers() {
    // Clear generic timers
    if (state.ui.inactivityTimer) clearTimeout(state.ui.inactivityTimer);
    if (state.ui.progressTimer) clearTimeout(state.ui.progressTimer);
    if (state.ui.topButton.timer) clearTimeout(state.ui.topButton.timer);
    
    // Clear map timers
    if (state.ui.tempTimers) {
        Object.values(state.ui.tempTimers).forEach(t => { if(t) clearTimeout(t); });
    }
    state.ui.tempTimers = { top: null, bot: null };

    // Clear specific logic timers
    if (state.timers.baking) clearTimeout(state.timers.baking);
    if (state.timers.ritual) clearTimeout(state.timers.ritual);
    if (state.timers.memory) clearTimeout(state.timers.memory);
    state.timers = {};
}

function resetVisuals() {
    // Hide Overlays
    if (dom.overlayInfo) dom.overlayInfo.style.display = 'none';
    if (dom.overlayMemory) dom.overlayMemory.classList.remove('visible');
    
    // Reset Pet visual state
    if (dom.petImage) {
        dom.petImage.classList.remove('pet-zoomed');
        dom.petImage.style.opacity = '1'; // Ensure visible if it was fading
    }
    
    // Reset Bowl
    if (dom.bowlImage) dom.bowlImage.className = 'game-layer prop';
}


/* ==========================================================================
   RENDERING & LAYOUT
   ========================================================================== */

function updateUI() {
    evaluateTopButton();
    applyLayoutPositions();
    updateImages();
    updateControls();
    updateContentZones();
}

function evaluateTopButton() {
    if (state.appPhase !== 'gameplay') return;

    let desiredType = null;
    const pageId = PAGES[state.currentPageIndex].id;

    // 1. Determine Local Memory Availability
    let showMemory = false;
    if (pageId === 'home') {
        if (!state.memoriesViewed.home) showMemory = true;
    } else if (pageId === 'food') {
        // Only show memory if idle (before baking) or fully done
        const isBeforeBaking = state.gameplay.bakingState === 'none';
        const isAfterBaking = state.gameplay.bakingState === 'done' && state.gameplay.feedingState === 'done';
        if (!state.memoriesViewed.food && (isBeforeBaking || isAfterBaking)) {
            showMemory = true;
        }
    } else if (pageId === 'dress') {
        if (!state.memoriesViewed.dress) showMemory = true;
    }

    // 2. Determine Global Next Step
    // Logic: Food -> Dress -> Ritual
    let globalNextStep = null;
    if (!state.progress.food) globalNextStep = 'food';
    else if (!state.progress.dress) globalNextStep = 'dress';
    else if (!state.progress.ritual) globalNextStep = 'ritual';

    // 3. Decision Logic
    if (showMemory) {
        desiredType = 'memory';
    } else if (globalNextStep) {
        const isBeforeBaking = state.gameplay.bakingState === 'none';
        const isAfterBaking = state.gameplay.bakingState === 'done' && state.gameplay.feedingState === 'done';
        // Ensure nothing is rendered during baking or feeding interaction
        if (isBeforeBaking || isAfterBaking) {
            // If the next step is Ritual, show it everywhere (logic in updateContentZones handles navigation)
            if (globalNextStep === 'ritual') {
                desiredType = 'ritual';
            } 
            // If next step is Food, show button if we are NOT on food page
            else if (globalNextStep === 'food' && pageId !== 'food') {
                desiredType = 'food';
            }
            // If next step is Dress, show button if we are NOT on dress page
            else if (globalNextStep === 'dress' && pageId !== 'dress') {
                desiredType = 'dress';
            }
        }
    }

    // Handle State Changes
    if (state.ui.topButton.activeType !== desiredType) {
        // Clear existing timer if type changes
        if (state.ui.topButton.timer) clearTimeout(state.ui.topButton.timer);
        
        state.ui.topButton.activeType = desiredType;
        state.ui.topButton.visible = false;

        if (desiredType) {
            if (desiredType === 'ritual') {
                state.ui.topButton.visible = true; // Immediate

                // --- AGGIUNTA: Suono per la nuvoletta del rituale ---
                BUBBLE_SOUND.currentTime = 0;
                BUBBLE_SOUND.play().catch(()=>{});
                // ----------------------------------------------------
            } else {
                // Random Delay 1-3s
                const delay = 1000 + Math.random() * 2000;
                state.ui.topButton.timer = setTimeout(() => {
                    state.ui.topButton.visible = true;

                    // --- AGGIUNTA: Suono quando la nuvoletta appare dopo il delay ---
                    BUBBLE_SOUND.currentTime = 0;
                    BUBBLE_SOUND.play().catch(()=>{});
                    // ----------------------------------------------------------------
                    updateUI();
                }, delay);
            }
        }
    }
}

function applyLayoutPositions() {
    const layout = CONFIG.LAYOUT;

    // Helper: Percent to CSS Top (Center = 50%)
    const setY = (el, yPct) => {
        if(el) el.style.top = `calc(50% + ${yPct}%)`;
    };

    setY(dom.progressBarContainer, layout.PROGRESS_BAR_Y);
    setY(dom.petImage, layout.PET_Y);
    setY(dom.tableImage, layout.PET_Y);
    // Bowl might need specific tweaking or stick to pet Y
    setY(dom.bowlImage, layout.PET_Y + 10); 
    
    setY(dom.zoneTop, layout.TEXT_TOP_Y);
    setY(dom.zoneBot, layout.TEXT_BOT_Y);
    
    // Buttons Container is centered (0), individual buttons are offset
    dom.buttonsContainer.style.top = '50%'; 
    
    setY(dom.infoContainer, layout.INFO_BTN_Y);
}

function updateImages() {
    const s = state.gameplay;
    
    // 1. Progress Bar
    if (state.appPhase !== 'gameplay') {
        dom.progressBarContainer.style.display = 'none';
    } else {
        dom.progressBarContainer.style.display = 'block';
        let score = 0;
        if (state.progress.food) score++;
        if (state.progress.dress) score++;
        if (state.progress.ritual) score++;
        
        if (score > state.ui.lastProgressScore) {
            state.ui.lastProgressScore = score;
            state.ui.isProgressAnimating = true;

            // --- AGGIUNTA: Fai partire il suono ---
            PROGRESS_SOUND.currentTime = 0;
            PROGRESS_SOUND.play().catch(e => console.warn("Audio Progress failed", e));
            // --------------------------------------
            
            // Play GIF
            dom.progressBarImage.src = `${CONFIG.ASSETS.PROGRESS_BAR_PREFIX}${score}.gif`;
            
            if (state.ui.progressTimer) clearTimeout(state.ui.progressTimer);
            state.ui.progressTimer = setTimeout(() => {
                state.ui.isProgressAnimating = false;
                dom.progressBarImage.src = `${CONFIG.ASSETS.PROGRESS_BAR_PREFIX}${score}.png`;
            }, 1000); 
        } else if (!state.ui.isProgressAnimating) {
            const pngSrc = `${CONFIG.ASSETS.PROGRESS_BAR_PREFIX}${score}.png`;
            if (!dom.progressBarImage.src.endsWith(`${score}.png`)) {
                dom.progressBarImage.src = pngSrc;
            }
        }
    }

    // 2. Pet Image
    // Priority: GIF > Baked > Loading > Default
    let petSrc = s.currentPetImage;
    let showPet = true;
    
    if (state.ui.isGifPlaying) {
        petSrc = dom.petImage.src; // Keep current GIF
    } else if (state.appPhase === 'waiting_for_click') {
        petSrc = CONFIG.ASSETS.LOADING_STATIC;
    } else if (state.appPhase === 'sequence_running') {
        // While sequence running, if in static step -> static, else animation
        petSrc = state.loadingStep === 'static' ? CONFIG.ASSETS.LOADING_STATIC : CONFIG.ASSETS.LOADING_ANIMATION;
    } else if (s.bakingState === 'baked') {
        petSrc = CONFIG.ASSETS.BAKED_FOOD;
    }
    
    // Apply Pet
    const finalPetSrc = getAssetPath(petSrc);
    if (dom.petImage.getAttribute('src') !== finalPetSrc && !state.ui.isGifPlaying) {
        dom.petImage.src = finalPetSrc;
    }
    
    // Pet Absolute Positioning refinement
    dom.petImage.style.display = showPet ? 'block' : 'none';

    // 3. Props (Table & Bowl)
    const isFoodPage = state.currentPageIndex === 1;
    const isBaking = s.bakingState === 'baking';
    const isBaked = s.bakingState === 'baked';
    const isFeeding = s.feedingState !== 'idle' && s.feedingState !== 'done';
    
    if (state.appPhase === 'gameplay' && isFoodPage && !isBaking && !isBaked) {
        dom.tableImage.style.display = 'block';
        dom.tableImage.src = CONFIG.ASSETS.TABLE;
        
        // Bowl Logic
        dom.bowlImage.style.display = 'block';

        if (s.feedingState === 'ready_to_eat' || s.feedingState === 'eating' || s.feedingState === 'sharing') {             
             if (s.feedingState === 'eating' && !dom.bowlImage.classList.contains('bowl-eat-anim')) {
                dom.bowlImage.classList.add('bowl-eat-anim');
                setTimeout(() => {
                    dom.bowlImage.src = CONFIG.ASSETS.BOWL_STATE_2;
                    dom.bowlImage.classList.remove('bowl-eat-anim');
                }, 1500);
             } else if (s.feedingState === 'sharing' && !dom.bowlImage.classList.contains('bowl-share-anim')) {
                dom.bowlImage.classList.add('bowl-share-anim');
                setTimeout(() => {
                    dom.bowlImage.src = CONFIG.ASSETS.BOWL_EMPTY;
                    dom.bowlImage.classList.remove('bowl-share-anim');
                    dom.petImage.src = getAssetPath(CONFIG.ASSETS.JUMP_ANIMATION);
                }, 1500);
                setTimeout(() => {
                    dom.petImage.src = getAssetPath(CONFIG.ASSETS.PET_DEFAULT);
                }, 1500 + CONFIG.GIF_DURATION_MS);
             } else if (s.feedingState === 'ready_to_eat') {
                dom.bowlImage.src = CONFIG.ASSETS.BOWL_STATE_3; // Full bowl
                dom.bowlImage.className = 'game-layer prop'; // Clear any leftover anims
             }

        } else if (!state.progress.food) {
            dom.bowlImage.className = 'game-layer prop'; // Reset anim classes
            const count = s.foodSequence.length;
            let bowlKey = 'BOWL_EMPTY';
            if (count === 1) bowlKey = 'BOWL_STATE_1';
            else if (count === 2) bowlKey = 'BOWL_STATE_2';
            else if (count >= 3) bowlKey = 'BOWL_STATE_3';
            dom.bowlImage.src = CONFIG.ASSETS[bowlKey];
        } else {
             // Already done with food task (revisiting page) -> Empty or Full? Usually Full/Done
             dom.bowlImage.style.display = 'none'; // Or keep it full? Requirement implies arrows appear after sharing.
        }

    } else {
        dom.tableImage.style.display = 'none';
        dom.bowlImage.style.display = 'none';
    }
}

function updateControls() {
    // 1. Arrows
    // Hide during loading, baking, or feeding interaction
    const isBaking = state.gameplay.bakingState !== 'none' && state.gameplay.bakingState !== 'done';
    const isFeeding = state.gameplay.feedingState !== 'idle' && state.gameplay.feedingState !== 'done';
    const hideArrows = state.appPhase !== 'gameplay' || isBaking || isFeeding || state.appPhase === 'ending_sequence';

    if (hideArrows) {
        dom.navLeft.style.display = 'none';
        dom.navRight.style.display = 'none';
    } else {
        dom.navLeft.style.display = state.currentPageIndex > 0 ? 'block' : 'none';
        
        // Lock Logic: Show Right Arrow only if next page is unlocked
        let canGoRight = false;
        if (state.currentPageIndex === 0 && state.unlocked.food) canGoRight = true;
        else if (state.currentPageIndex === 1 && state.unlocked.dress) canGoRight = true;
        
        dom.navRight.style.display = canGoRight ? 'block' : 'none';
    }

    // 2. Info Button
    dom.infoContainer.innerHTML = ''; // clear
    if (state.appPhase === 'gameplay' && !isBaking && !isFeeding) {
        const infoBtn = document.createElement('img');
        infoBtn.src = 'assets/defaults/info.png';
        infoBtn.onclick = () => {
            // --- AGGIUNTA: Riproduci il suono ---
            INFO_SOUND.currentTime = 0; 
            INFO_SOUND.play().catch(e => console.warn("Audio Info failed", e));
    // ------------------------------------
             dom.infoContent.innerText = getText(`INFO_${PAGES[state.currentPageIndex].id.toUpperCase()}`);
             dom.overlayInfo.style.display = 'flex';
        };
        dom.infoContainer.appendChild(infoBtn);
    }

    // 3. Dynamic Buttons
    renderButtons();
}

function renderButtons() {
    dom.buttonsContainer.innerHTML = '';
    
    if (state.appPhase !== 'gameplay') return;
    
    const page = PAGES[state.currentPageIndex];
    if (shouldHideControls(page.id)) return;
    
    const content = page.content;
    if (content.type === 'curved-buttons') {
        
        const count = content.count;
        
        content.ids.forEach((id, index) => {
            if (!shouldButtonBeVisible(page.id, id)) return;

            const pos = getButtonArcPosition(index, count);

            const btn = document.createElement('div');
            btn.className = 'round-button ' + (page.id === 'food' ? 'food-button' : 'dress-button');
            const size = 50; 
            btn.style.width = `${size}px`;
            btn.style.height = `${size}px`;
            
            btn.style.left = pos.left;
            btn.style.top = pos.top;
            
            // Image
            const img = document.createElement('img');
            const path = CONFIG.ASSETS.BUTTON_PREFIX.replace('{culture}', state.currentCulture) + `${page.id}${id}.png`;
            img.src = path;
            btn.appendChild(img);
            
            // Logic
            setupDragAndDrop(btn, btn.style.left, btn.style.top, () => {
                return handleInteraction(id, page.id);
            });
            
            dom.buttonsContainer.appendChild(btn);
        });
    }
}

function getButtonArcPosition(index, count) {
    const radius = CONFIG.UI.BUTTON_RADIUS; 
    const span = 60; // +/- 60 degrees
    const step = span * 2 / (count - 1 || 1);
    const currentDeg = -span + (step * index); 
    
    const rad = (currentDeg + 90) * (Math.PI / 180);
    
    // Layout Y serves as anchor
    const layoutY = CONFIG.LAYOUT.BUTTONS_Y; 
    
    const x = radius * Math.cos(rad);
    const y = radius * Math.sin(rad);

    const size = 15; // match the size in renderButtons
    
    return {
        left: `calc(50% + ${x}px - ${size/2}%)`,
        top: `calc(50% + ${layoutY}% + ${y}px - ${radius}px - ${size/2}%)`
    };
}

function updateContentZones() {
    dom.zoneTop.innerHTML = '';
    dom.zoneBot.innerHTML = '';

    // Logic for what to show
    let topContent = null;
    let botContent = null;

    if (state.ui.tempContent.top) topContent = state.ui.tempContent.top;
    else if (state.appPhase === 'sequence_running' && state.loadingStep === 'welcome') topContent = { type:'text', value: getText('WELCOME') };
    else if (state.gameplay.bakingState === 'baked') topContent = { type:'text', value: getText('FOOD_NAME')};
    
    // Ending Sequence Logic
    if (state.appPhase === 'ending_sequence') {
        if (state.endingStep === 'button_wait') {
            topContent = { 
                type: 'button', 
                image: CONFIG.ASSETS.END_BUTTON, 
                action: () => runFinalZoomSequence(),
                isEndButton: true 
            };
        } else if (state.endingStep === 'goodbye') {
            topContent = { type: 'text', value: getText('END_MSG_FINAL_TOP') };
            botContent = { type: 'text', value: getText('END_MSG_FINAL_BOT') };
        }
    }
    
    // Generic Top Button Logic
    if (state.ui.topButton.visible && state.ui.topButton.activeType) {
        const type = state.ui.topButton.activeType;
        let action = () => {};
        let image = "";

        if (type === 'food') {
            image = CONFIG.ASSETS.BUTTON_ICON_FOOD;
            action = () => { 
                state.unlocked.food = true;
                state.currentPageIndex = 1; 
                updateUI(); 
            };
        } else if (type === 'dress') {
            image = CONFIG.ASSETS.BUTTON_ICON_DRESS;
            action = () => { 
                state.unlocked.dress = true;
                state.currentPageIndex = 2; 
                updateUI(); 
            };
        } else if (type === 'ritual') {
            image = CONFIG.ASSETS.BUTTON_ICON_RITUAL;
            action = () => {
                if (state.currentPageIndex !== 2) {
                    state.currentPageIndex = 2;
                    updateUI();
                    triggerRitual();
                } else {
                    triggerRitual();
                }
            };
        } else if (type === 'memory') {
            image = CONFIG.ASSETS.BUTTON_ICON_MEMORY;
            action = () => triggerMemory();
        }

        topContent = { type: 'button', image, action };
    }

    if (state.ui.tempContent.bot) botContent = state.ui.tempContent.bot;
    else if (state.gameplay.bakingState === 'baked') botContent = { type:'text', value: getText('FOOD_DESCRIPTION') };
    else if (state.appPhase === 'sequence_running' && state.loadingStep === 'instructions') {
        topContent = { type:'text', value: getText('WELCOME') };
        botContent = { type:'text', value: getText('INTRO') };
    };

    renderZone(dom.zoneTop, topContent);
    renderZone(dom.zoneBot, botContent);
}

function renderZone(container, content) {
    if (!content) return;
    if (content.type === 'text') {
        const s = document.createElement('span');

        // MODIFICA QUESTA RIGA: cambia .textContent in .innerHTML
        s.innerHTML = content.value; 
        
        container.appendChild(s);
    } else if (content.type === 'html') {
        
        s.textContent = content.value;
        container.appendChild(s);
    } else if (content.type === 'button') {
        const b = document.createElement('div');
        b.className = content.isEndButton ? 'end-button' : 'ritual-btn';
        const i = document.createElement('img');
        i.src = content.image;
        b.appendChild(i);
        b.onclick = (e) => { 
            e.stopPropagation(); // Prevent global body click
            animateButtonPress(b); 
            content.action(); 
        };
        container.appendChild(b);
    }
}

/* ==========================================================================
   INTERACTIONS
   ========================================================================== */

function startUndressSequence(e) {
    const dressId = state.gameplay.chosenDressId;
    if (!dressId) return;

    // Normalizza coordinate evento iniziale (Touch vs Mouse)
    const point = e.touches ? e.touches[0] : e;

    state.ui.isGifPlaying = true;
    dom.petImage.src = getAssetPath(CONFIG.ASSETS.PET_UNDRESS);
    triggerHardware();
    
    // Spawn bottone
    const btn = document.createElement('div');
    btn.className = 'round-button dress-button';
    const size = 50; 
    btn.style.width = `${size}px`;
    btn.style.height = `${size}px`;
    
    const initialLeft = point.clientX; 
    const initialTop = point.clientY;
    
    document.body.appendChild(btn);
    btn.style.position = 'fixed';
    btn.style.left = (initialLeft) + 'px';
    btn.style.top = (initialTop) + 'px';
    
    const img = document.createElement('img');
    img.src = CONFIG.ASSETS.BUTTON_PREFIX.replace('{culture}', state.currentCulture) + `dress${dressId}.png`;
    btn.appendChild(img);
    
    btn.style.zIndex = 1000;
    btn.style.transform = 'translate(-50%, -50%)'; 
    
    state.ui.isAnyButtonDragging = true;
    
    let startX = point.clientX;
    let startY = point.clientY;
    
    const onMove = (mv) => {
        // FIX iOS 12
        if (mv.cancelable) mv.preventDefault();
        
        const mvPoint = mv.touches ? mv.touches[0] : mv;
        const dx = mvPoint.clientX - startX;
        const dy = mvPoint.clientY - startY;
        btn.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    
    const onEnd = (endEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);

        state.ui.isAnyButtonDragging = false;
        state.ui.isGifPlaying = false; 
        
        const btnRect = btn.getBoundingClientRect();
        const btnCx = btnRect.left + btnRect.width / 2;
        const btnCy = btnRect.top + btnRect.height / 2;
        
        const screenCx = window.innerWidth / 2;
        const screenCy = window.innerHeight / 2;
        
        const dist = Math.hypot(btnCx - screenCx, btnCy - screenCy);
        const THRESHOLD = 80;
        
        if (dist > THRESHOLD) {
            state.gameplay.chosenDressId = null;
            state.progress.dress = false;
            state.progress.ritual = false; 
            state.gameplay.currentPetImage = getAssetPath(CONFIG.ASSETS.PET_DEFAULT);
            
            setTimeout(() => {
                btn.remove(); 
                updateUI();   
            }, 500);
        } else {
            btn.remove();
            updateUI(); 
        }
    };
    
    // Listener ibridi
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
}

function setupDragAndDrop(element, resetLeft, resetTop, onDropCallback) {
    let startX, startY;
    let initialLeft, initialTop;

    // Funzione unificata per iniziare il drag (supporta Touch e Mouse)
    const onStart = (e) => {
        if (state.ui.isAnyButtonDragging) return;
        
        // Importante per iOS 12: Previene comportamenti fantasma e scroll
        if (e.cancelable && e.type === 'touchstart') e.preventDefault();

        // Normalizza le coordinate (Touch vs Mouse)
        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX;
        startY = point.clientY;

        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        document.body.appendChild(element);
        element.style.position = 'fixed';
        element.style.left = initialLeft + 'px';
        element.style.top = initialTop + 'px';
        element.style.transform = 'none';
        element.style.zIndex = 1000;

        // --- AGGIUNTA: Suono quando si inizia a trascinare ---
        DRAG_START_SOUND.currentTime = 0;
        DRAG_START_SOUND.play().catch(()=>{});
        // -----------------------------------------------------

        animateButtonPress(element);

        state.ui.isAnyButtonDragging = true;

        // Handler per il movimento
        const onMove = (mv) => {
            // FIX CRITICO iOS 12: preventDefault qui blocca lo scroll della pagina
            if (mv.cancelable) mv.preventDefault();
            
            const mvPoint = mv.touches ? mv.touches[0] : mv;
            const dx = mvPoint.clientX - startX;
            const dy = mvPoint.clientY - startY;
            element.style.transform = `translate(${dx}px, ${dy}px)`;
        };

        // Handler per la fine del drag
        const onEnd = (endEvent) => {
            // Rimuovi listener Mouse E Touch
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);

            state.ui.isAnyButtonDragging = false;

            const btnRect = element.getBoundingClientRect();
            const btnCx = btnRect.left + btnRect.width / 2;
            const btnCy = btnRect.top + btnRect.height / 2;

            const screenCx = window.innerWidth / 2;
            const screenCy = window.innerHeight / 2;

            const dist = Math.hypot(btnCx - screenCx, btnCy - screenCy);
            const DROP_THRESHOLD = 80;

            let success = false;
            if (dist < DROP_THRESHOLD) {
                success = onDropCallback();
            }

            if (!success) {
                element.style.transition = 'transform 0.3s';
                element.style.transform = 'translate(0,0)';
                setTimeout(() => {
                    dom.buttonsContainer.appendChild(element);
                    element.style.transition = '';
                    element.style.position = 'absolute';
                    element.style.left = resetLeft;
                    element.style.top = resetTop;
                    element.style.transform = '';
                    element.style.zIndex = '';
                }, 300);
            } else {
                element.style.display = 'none';
            }
        };

        // Aggiungi listener con { passive: false } per iOS 12
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    };

    // Attacca l'evento di inizio sia per Pointer che per Touch
    element.addEventListener('pointerdown', onStart);
    element.addEventListener('touchstart', onStart, { passive: false });
    
    // Fallback CSS (anche se su iOS 12 serve il preventDefault JS sopra)
    element.style.touchAction = 'none';
}

function handleInteraction(buttonId, pageId) {
    if (pageId === 'food') {
        const idx = state.gameplay.foodSequence.length;
        const correct = CONFIG.RULES.CORRECT_FOOD_ORDER[idx];
        if (buttonId === correct) {
            state.gameplay.foodSequence.push(buttonId);
            if (state.gameplay.foodSequence.length === 3) {
                startBaking();
            } else {
                updateUI();
            }
            return true;
        } else {
            triggerHardware();
            return false;
        }
    } else if (pageId === 'dress') {
        state.gameplay.chosenDressId = buttonId;
        state.progress.dress = buttonId === CONFIG.RULES.CORRECT_DRESS_ID;
        state.gameplay.currentPetImage = CONFIG.ASSETS.PET_DRESS.replace('{id}', buttonId);
        if (buttonId !== CONFIG.RULES.CORRECT_DRESS_ID) triggerHardware();
        updateUI();
        return true;
    }
    return false;
}

function startBaking() {
    state.gameplay.bakingState = 'baking';
    // NOTE: progress.food is NOT set here, but in the eating phase
    updateUI();
    showTempMessage('bot', 'COOKING', CONFIG.GIF_DURATION_MS);
    
    // Play GIF logic
    state.ui.isGifPlaying = true;
    dom.petImage.src = getAssetPath(CONFIG.ASSETS.PET_BAKING);
    
    state.timers.baking = setTimeout(() => {
        state.ui.isGifPlaying = false;
        state.gameplay.bakingState = 'baked';
        updateUI();
    }, CONFIG.GIF_DURATION_MS);
}

function triggerRitual() {
    state.progress.ritual = true;
    state.ui.isGifPlaying = true;
    dom.petImage.src = getAssetPath(CONFIG.ASSETS.PET_RITUAL);

   // --- LOGICA AUDIO DINAMICO ---
    // Recupera l'ID della cultura corrente (es. 'amazigh', 'maori', 'kurd')
    const culturaAttiva = state.currentCulture; 
    
    // Costruisce il percorso: assets/audio/rito/ritual_amazigh.mp3
    const percorsoAudio = `assets/audio/rito/ritual_${culturaAttiva}.mov`;
    
    const suonoRituale = new Audio(percorsoAudio);
    suonoRituale.volume = 0.6;
    
    suonoRituale.play().catch(e => {
        console.error("Non trovo l'audio:", percorsoAudio);
    });
    // ------------------------------

    updateUI();
    triggerHardware();
    state.timers.ritual = setTimeout(() => {
        state.ui.isGifPlaying = false;
        // --- AGGIUNTA: Ferma l'audio quando finisce la GIF ---
        suonoRituale.pause();
        suonoRituale.currentTime = 0; // Riporta l'audio all'inizio per la prossima volta
        startEndingPhase();
    }, CONFIG.GIF_DURATION_MS);
}

function triggerMemory() {
    const memoryIndex = state.currentPageIndex + 1; // 1, 2, 3

    // --- AGGIUNTA: Riproduci il suono ---
    MEMORY_SOUND.currentTime = 0;
    MEMORY_SOUND.play().catch(e => console.warn("Audio Memory failed", e));
    // ------------------------------------
    
    dom.overlayMemory.classList.add('visible');
    dom.memoryContentImage.src = CONFIG.ASSETS.MEMORY_OPENING_GIF;
    
    state.timers.memory = setTimeout(() => {
        dom.memoryContentImage.src = `${CONFIG.ASSETS.MEMORY_IMAGE}`.replace('{culture}', state.currentCulture).replace('{id}', memoryIndex);
    }, 500); // GIF duration is 0.5s
}

function startEndingPhase() {
    state.appPhase = 'ending_sequence';
    state.endingStep = 'button_wait';
    updateUI();
}

async function runFinalZoomSequence() {
    const myToken = state.sessionToken;
    state.endingStep = 'zoomed_sequence';
    dom.petImage.classList.add('pet-zoomed');
    updateUI();

    // 1. Message 1
    state.ui.tempContent.top = { type: 'text', value: getText('END_MSG_1') };
    updateUI();
    await new Promise(r => setTimeout(r, 5000));
    if (state.sessionToken !== myToken) return;

    // 2. Message 2
    state.ui.tempContent.top = { type: 'text', value: getText('END_MSG_2') };
    updateUI();
    await new Promise(r => setTimeout(r, 5000));
    if (state.sessionToken !== myToken) return;

    // Clear temp content
    state.ui.tempContent.top = null;

    // 3. Goodbye
    dom.petImage.classList.remove('pet-zoomed');
    state.endingStep = 'goodbye';
    
    // Play Bye Bye GIF
    state.ui.isGifPlaying = true;
    dom.petImage.src = getAssetPath(CONFIG.ASSETS.BYE_BYE_ANIMATION);
    
    updateUI();
    triggerHardware();
}

/* ==========================================================================
   HELPERS & UTILS
   ========================================================================== */

function getAssetPath(pattern) {
    return pattern.replace('{culture}', state.currentCulture);
}

function getText(key) {
    const tpl = CONFIG.TEXT_TEMPLATES[key] || "";
    const vars = (CULTURE_CONFIGS[state.currentCulture]?.VARIABLES) || {};
    return tpl.replace(/{(\w+)}/g, (_, k) => vars[k] || "");
}

function showTempMessage(zone, key, duration) {
    state.ui.tempContent[zone] = { type: 'text', value: getText(key) };
    updateUI();
    state.ui.tempTimers[zone] = setTimeout(() => {
        state.ui.tempContent[zone] = null;
        updateUI();
    }, duration);
}

function animateButtonPress(el) {
    CLICK_SOUND.currentTime = 0;
    CLICK_SOUND.play().catch(()=>{});
    el.classList.add('clicked');
    setTimeout(() => el.classList.remove('clicked'), 200);
}

function shouldHideControls(pageId) {
    // Hide controls if we are baking, or if food is done (revisiting), OR if feeding sequence is active
    if (pageId === 'food') {
         if (state.gameplay.bakingState !== 'none') return true;
         if (state.gameplay.feedingState !== 'idle' && state.gameplay.feedingState !== 'done') return true;
         if (state.progress.food) return true; // Already done
    }
    if (pageId === 'dress' && state.progress.ritual) return true;
    return false;
}
function shouldButtonBeVisible(pageId, id) {
    if (pageId === 'food') return !state.gameplay.foodSequence.includes(id);
    if (pageId === 'dress') return state.gameplay.chosenDressId !== id;
    return true;
}

function triggerHardware() {
    // const ip = CONFIG.HARDWARE?.ESP_IP;
    // if(ip) fetch(`${ip}/servo`).catch(e => console.warn("Hardware err", e));
    set(ref(db, 'device/trigger'), true)
    .then(() => {
        console.log("Command Sent! Waiting for Arduino...");
    })
    .catch((error) => {
        console.error("Error sending command:", error);
    });
}

function resetInactivityTimer() {
    // if (state.ui.inactivityTimer) clearTimeout(state.ui.inactivityTimer);
    // state.ui.inactivityTimer = setTimeout(() => {
    //     // Only show black screen overlay if we are already in gameplay
    //     if (state.appPhase === 'gameplay') {
    //         dom.overlayBlack.style.display = 'block';
    //         state.appPhase = 'black_screen'; // Effectively go back to sleep
    //     }
    // }, CONFIG.TIMEOUT_MS);
}

function setupEventListeners() {
    if (state.areListenersSetup) return;

    // Navigation
    const nav = (dir) => {
        const isBaking = state.gameplay.bakingState !== 'none' && state.gameplay.bakingState !== 'done';
        const isFeeding = state.gameplay.feedingState !== 'idle' && state.gameplay.feedingState !== 'done';
        const hideArrows = state.appPhase !== 'gameplay' || isBaking || isFeeding || state.appPhase === 'ending_sequence';

        let canGoRight = false;
        if (state.currentPageIndex === 0 && state.unlocked.food) canGoRight = true;
        else if (state.currentPageIndex === 1 && state.unlocked.dress) canGoRight = true;

        if (!hideArrows) {
            if(dir==='prev' && state.currentPageIndex > 0) state.currentPageIndex--;
            if(dir==='next' && canGoRight && state.currentPageIndex < PAGES.length-1) state.currentPageIndex++;
            updateUI();
            resetInactivityTimer();
        }
    };
    dom.navLeft.onclick = () => nav('prev');
    dom.navRight.onclick = () => nav('next');
    
    // Swipe
    dom.ovalContainer.addEventListener('touchstart', e => state.ui.touchStartX = e.touches[0].clientX, {passive:true});
    dom.ovalContainer.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - state.ui.touchStartX;
        if(Math.abs(dx) > CONFIG.UI.SWIPE_THRESHOLD) nav(dx < 0 ? 'next' : 'prev');
    });

    // Shake
    window.addEventListener('devicemotion', e => {
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if(!acc) return;
        if ((Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z)) > CONFIG.UI.SHAKE_THRESHOLD) wakeUp();
    });

    // 'S' Key for Shake Simulation
    window.addEventListener('keydown', (e) => {
        if (e.key === 's' || e.key === 'S') wakeUp();
    });

    // Undress Interaction (Reverse Drag)
    dom.ovalContainer.addEventListener('pointerdown', (e) => {
        if (state.appPhase === 'gameplay' 
            && state.currentPageIndex === 2 
            && state.gameplay.chosenDressId 
            && !state.ui.isAnyButtonDragging) {
            
            // Check distance from center
            const screenCx = window.innerWidth / 2;
            const screenCy = window.innerHeight / 2;
            const dist = Math.hypot(e.clientX - screenCx, e.clientY - screenCy);
            
            if (dist < 80) { // Same threshold as drop
                e.preventDefault();
                startUndressSequence(e);
            }
        }
    });

    // Global Click State Machine
    document.body.addEventListener('click', () => {
        resetInactivityTimer();

        if (state.appPhase === 'black_screen') {
            // Wake up usually handled by Shake/S
        } else if (state.appPhase === 'waiting_for_click') {
            handleStartupSequence();
        } else if (state.appPhase === 'gameplay') {
            
            // 1. If Memory Overlay is open, close it
            if (dom.overlayMemory.classList.contains('visible')) {
                dom.overlayMemory.classList.remove('visible');
                
                // Mark current memory as viewed
                const pageId = PAGES[state.currentPageIndex].id;
                state.memoriesViewed[pageId] = true;
                
                updateUI();
                return;
            }

            // 2. Food interaction logic
            if (state.currentPageIndex === 1) { // Food Page
                const s = state.gameplay;
                
                if (s.bakingState === 'baked') {
                    // Clicchi per tirare fuori il cibo dal forno
                    BOWL_SOUND.currentTime = 0;
                    BOWL_SOUND.play().catch(()=>{});

                    s.bakingState = 'done';
                    s.feedingState = 'ready_to_eat';
                    updateUI();
                } else if (s.feedingState === 'ready_to_eat') {
                    // Clicchi sulla ciotola per far mangiare l'omino
                    BOWL_SOUND.currentTime = 0;
                    BOWL_SOUND.play().catch(()=>{});

                    s.feedingState = 'eating';
                    state.progress.food = true;
                    updateUI();
                } else if (s.feedingState === 'eating') {
                    // Clicchi per condividere il cibo 
                    BOWL_SOUND.currentTime = 0;
                    BOWL_SOUND.play().catch(()=>{});

                    s.feedingState = 'sharing';
                    updateUI();
                    triggerHardware();
                    setTimeout(() => {
                        s.feedingState = 'done';
                        updateUI();
                    }, 1500 + CONFIG.GIF_DURATION_MS); 
                }
            }
        }
    });

    // Info Overlay Close
    dom.overlayInfo.addEventListener('click', (e) => {
        e.stopPropagation(); 
        dom.overlayInfo.style.display = 'none';
    });
}

function wakeUp() {
    if (state.appPhase === 'black_screen') {
        dom.overlayBlack.style.display = 'none';
        
        if (state.hasStarted) {
            state.appPhase = 'gameplay';
        } else {
            state.appPhase = 'waiting_for_click';
        }

        updateUI(); 
        resetInactivityTimer();
    }
}

async function handleStartupSequence() {
    const myToken = state.sessionToken;
    state.appPhase = 'sequence_running';
    state.loadingStep = 'static';
    // Transition: Fade out static image? 
    // Logic: 'sequence_running' + 'static' shows LOADING_STATIC.
    
    updateUI();
    // Allow render
    await new Promise(r => setTimeout(r, 100));
    if (state.sessionToken !== myToken) return;
    
    // Fade out static
    dom.petImage.style.opacity = '0';
    await new Promise(r => setTimeout(r, 500));
    if (state.sessionToken !== myToken) return;
    
    // Switch to Welcome (Animation) and Fade In
    state.loadingStep = 'welcome';
    updateUI();
    triggerHardware();
    dom.petImage.style.opacity = '1';
    
    await new Promise(r => setTimeout(r, 3000));
    if (state.sessionToken !== myToken) return;
    
    state.loadingStep = 'instructions';
    updateUI();
    await new Promise(r => setTimeout(r, 3000));
    if (state.sessionToken !== myToken) return;
    
    state.appPhase = 'gameplay';
    state.hasStarted = true;
    updateUI();
}
