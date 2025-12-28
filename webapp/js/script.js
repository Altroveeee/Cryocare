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
}

/**
 * PAGE DEFINITIONS
 * Defines the content and behavior for each navigable section.
 */
const PAGES = [
    {
        id: 'home',
        content: { type: 'empty' }
    },
    {
        id: 'food',
        content: { type: 'curved-buttons', count: 3, ids: ['1', '2', '3'] }
    },
    {
        id: 'dress',
        content: { type: 'curved-buttons', count: 3, ids: ['1', '2', '3'] }
    },
];

/**
 * STATE MANAGEMENT
 * Single source of truth for the application state.
 */
const state = {
    appPhase: 'loading', // 'loading' | 'gameplay'
    loadingStep: 'static', // 'static' | 'animation'
    hasStarted: false,
    currentCulture: 'kurd',
    currentPageIndex: 0,
    progress: {
        food: false,
        dress: false,
        ritual: false,
    },
    gameplay: {
        foodSequence: [],
        chosenDressId: null,
        currentPetImage: null,
    },
    ui: {
        isAnyButtonDragging: false,
        inactivityTimer: null,
        touchStartX: 0,
        touchEndX: 0,
        isMouseDragging: false,
        isGifPlaying: false,
        tempContent: {
            top: null,
            bot: null
        },
        tempTimers: {
            top: null,
            bot: null
        }
    }
};

/**
 * DOM ELEMENTS
 * Cached references to DOM elements.
 */
const dom = {
    section3: document.getElementById('section3'),
    ovalContainer: document.getElementById('oval-container'),
    blackScreenOverlay: document.getElementById('black-screen-overlay'),
    petImage: document.getElementById('pet-image'),
    progressBarImage: document.getElementById('progress-bar-image'),
    contentZoneTop: document.getElementById('content-zone-top'),
    contentZoneBot: document.getElementById('content-zone-bot'),
    navContainerLeft: document.getElementById('nav-container-left'),
    navContainerRight: document.getElementById('nav-container-right'),
    navArrowLeft: document.getElementById('nav-arrow-left'),
    navArrowRight: document.getElementById('nav-arrow-right'),
};

/* ==========================================================================
   TEXT SYSTEM HELPERS
   ========================================================================== */

function getText(key, params = {}) {
    const template = CONFIG.TEXT_TEMPLATES[key] || "";
    const cultureVars = CULTURE_CONFIGS[state.currentCulture] ? CULTURE_CONFIGS[state.currentCulture].VARIABLES : {};
    
    const allParams = { ...cultureVars, ...params };

    return template.replace(/{(\w+)}/g, (_, k) => allParams[k] || "");
}

function showTempMessage(zone, key, duration = 3000) {
    if (!state.ui.tempContent[zone] && !state.ui.tempTimers[zone]) {
        // Only if not already showing something or reset
    }

    if (state.ui.tempTimers[zone]) {
        clearTimeout(state.ui.tempTimers[zone]);
    }

    state.ui.tempContent[zone] = {
        type: 'text',
        value: getText(key)
    };

    updateUI();

    state.ui.tempTimers[zone] = setTimeout(() => {
        state.ui.tempContent[zone] = null;
        state.ui.tempTimers[zone] = null;
        updateUI();
    }, duration);
}

/* ==========================================================================
   GAME LOGIC HANDLERS
   ========================================================================== */

/**
 * Resets the game to initial state and optionally selects a new culture.
 * @param {string|null} culture - Specific culture to load, or null for random.
 */
function resetGame(culture = null) {
    // 1. Select Culture
    if (culture && CONFIG.CULTURES.includes(culture)) {
        state.currentCulture = culture;
    } else {
        // Random selection
        const randomIndex = Math.floor(Math.random() * CONFIG.CULTURES.length);
        state.currentCulture = CONFIG.CULTURES[randomIndex];
    }
    console.log(`Game Reset. Active Culture: ${state.currentCulture}`);

    // Apply Culture Specific Rules
    if (CULTURE_CONFIGS[state.currentCulture]) {
        CONFIG.RULES = { ...CONFIG.RULES, ...CULTURE_CONFIGS[state.currentCulture].RULES };
        console.log(`Applied rules for ${state.currentCulture}`, CONFIG.RULES);
    }

    // Set Navigation Arrow Images
    if (CONFIG.ASSETS.ARROW_LEFT) dom.navArrowLeft.src = CONFIG.ASSETS.ARROW_LEFT;
    if (CONFIG.ASSETS.ARROW_RIGHT) dom.navArrowRight.src = CONFIG.ASSETS.ARROW_RIGHT;

    // 2. Reset Progress
    state.progress = {
        food: false,
        dress: false,
        ritual: false,
    };

    // 3. Reset Gameplay State
    state.gameplay = {
        foodSequence: [],
        chosenDressId: null,
        currentPetImage: getAssetPath(CONFIG.ASSETS.PET_DEFAULT),
    };

    // 4. Reset Navigation
    state.currentPageIndex = 0;

    // 5. Update UI
    state.ui.isGifPlaying = false;
    state.ui.tempContent = { top: null, bot: null };
    state.ui.tempTimers = { top: null, bot: null };
    
    updateUI();
    resetInactivityTimer();
}

function handleFoodInteraction(buttonId) {
    if (state.progress.food) return false;

    const currentStep = state.gameplay.foodSequence.length;
    const expectedId = CONFIG.RULES.CORRECT_FOOD_ORDER[currentStep];

    if (buttonId === expectedId) {
        state.gameplay.foodSequence.push(buttonId);

        if (state.gameplay.foodSequence.length === CONFIG.RULES.CORRECT_FOOD_ORDER.length) {
            console.log('Food order is correct');
            state.progress.food = true;
            state.gameplay.foodSequence = [];

            // Call updateUI here to hide buttons before GIF starts
            updateUI();

            // Play Baking GIF
            playGif(CONFIG.ASSETS.PET_BAKING);
            showTemporaryText('COOKING', 'bot', CONFIG.GIF_DURATION_MS);
        }
        return true;
    } else {
        console.log(`Incorrect food item. Expected ${expectedId}, got ${buttonId}`);
        triggerArduino(); // Trigger Arduino on wrong choice
        return false;
    }
}

function handleDressInteraction(buttonId) {
    state.gameplay.chosenDressId = buttonId;
    state.progress.dress = true;

    // Update Pet Image
    const dressPattern = CONFIG.ASSETS.PET_DRESS.replace('{id}', buttonId);
    state.gameplay.currentPetImage = getAssetPath(dressPattern);

    if (state.gameplay.chosenDressId !== CONFIG.RULES.CORRECT_DRESS_ID) {
        console.log('Incorrect dress chosen');
        triggerArduino(); // Trigger Arduino on wrong choice
    }
    else {
        console.log('Correct dress chosen');
    }

    return true;
}

function playGif(assetPattern) {
    state.ui.isGifPlaying = true;
    const gifPath = getAssetPath(assetPattern);
    console.log(`Playing GIF: ${gifPath}`);
    dom.petImage.src = gifPath;

    setTimeout(() => {
        state.ui.isGifPlaying = false;
        updateUI(); // Restore the correct image
    }, CONFIG.GIF_DURATION_MS);
}

function handleButtonPress(buttonId, pageId) {
    console.log(`Button pressed: ${buttonId} on page: ${pageId}`);

    let isAccepted = false;

    switch (pageId) {
        case 'food':
            isAccepted = handleFoodInteraction(buttonId);
            break;
        case 'dress':
            isAccepted = handleDressInteraction(buttonId);
            break;
    }

    if (isAccepted && !state.ui.isGifPlaying) {
        updateUI();
    }

    return isAccepted;
}

function triggerRitual() {
    if (state.progress.ritual) return;
    
    state.progress.ritual = true;
    playGif(CONFIG.ASSETS.PET_RITUAL);
    updateUI();
}

/**
 * Updates the content zones (Top and Bot) based on the current state.
 */
function updateContentZones() {
    // 1. Clear Zones
    dom.contentZoneTop.innerHTML = '';
    dom.contentZoneBot.innerHTML = '';

    // 2. Determine Content for Top Zone
    const topContent = determineTopZoneContent();
    if (topContent) {
        renderZoneContent(dom.contentZoneTop, topContent);
    }

    // 3. Determine Content for Bot Zone
    const botContent = determineBotZoneContent();
    if (botContent) {
        renderZoneContent(dom.contentZoneBot, botContent);
    }
}

function determineTopZoneContent() {
    // Priority 1: Temporary Content
    if (state.ui.tempContent.top) {
        return state.ui.tempContent.top;
    }

    // Priority 2: Loading Phase
    if (state.appPhase === 'loading' && (state.loadingStep === 'welcome' || state.loadingStep === 'instructions')) {
        return {
            type: 'text',
            value: getText('WELCOME'),
            className: 'welcome-text'
        };
    }

    // Priority 3: Gameplay
    const isDressCorrect = state.gameplay.chosenDressId === CONFIG.RULES.CORRECT_DRESS_ID;
    const isRitualDone = state.progress.ritual;
    const isOnDressPage = state.currentPageIndex === 2; // Index for 'dress' page
    
    if (isDressCorrect && !isRitualDone && !state.ui.isGifPlaying && isOnDressPage) {
        return {
            type: 'button',
            image: CONFIG.ASSETS.RITUAL_BUTTON_ICON || 'assets/defaults/ritual.png',
            className: 'ritual-btn',
            action: triggerRitual
        };
    }

    return null;
}

function determineBotZoneContent() {
    // Priority 1: Temporary Content
    if (state.ui.tempContent.bot) {
        return state.ui.tempContent.bot;
    }

    // Priority 2: Loading Phase
    if (state.appPhase === 'loading' && state.loadingStep === 'instructions') {
        return {
            type: 'text',
            value: getText('INTRO'),
            className: 'instructions-text'
        };
    }

    return null;
}

/**
 * Renders a content definition into a specific container.
 * @param {HTMLElement} container 
 * @param {Object} contentDef { type, value/image, action, className, style }
 */
function renderZoneContent(container, contentDef) {
    if (!contentDef) return;

    if (contentDef.type === 'button') {
        const btn = document.createElement('div');
        btn.className = contentDef.className || 'round-button';
        if (contentDef.style) Object.assign(btn.style, contentDef.style);
        
        const img = document.createElement('img');
        img.src = contentDef.image;
        btn.appendChild(img);

        if (contentDef.action) {
            btn.addEventListener('click', contentDef.action);
            btn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                contentDef.action();
            }, { passive: true });
        }

        container.appendChild(btn);
    } else if (contentDef.type === 'text') {
        const span = document.createElement('span');
        span.textContent = contentDef.value;
        if (contentDef.className) span.className = contentDef.className;
        if (contentDef.style) Object.assign(span.style, contentDef.style);
        container.appendChild(span);
    } else if (contentDef.type === 'image') {
        const img = document.createElement('img');
        img.src = contentDef.image;
        if (contentDef.className) img.className = contentDef.className;
        if (contentDef.style) Object.assign(img.style, contentDef.style);
        container.appendChild(img);
    }
}

/* ==========================================================================
   UI RENDERING & UPDATES
   ========================================================================== */

function getAssetPath(pattern) {
    return pattern.replace('{culture}', state.currentCulture);
}

function updateUI() {
    updateProgressBar();
    updatePetImage();
    updateContentZones(); // Updated to generic function
    renderSection3();

    // Update Navigation Arrows
    if (state.appPhase === 'loading') {
        dom.navContainerLeft.style.display = 'none';
        dom.navContainerRight.style.display = 'none';
    } else {
        dom.navContainerLeft.style.display = state.currentPageIndex > 0 ? 'block' : 'none';
        dom.navContainerRight.style.display = state.currentPageIndex < PAGES.length - 1 ? 'block' : 'none';
    }
}
function updateProgressBar() {
    if (state.appPhase === 'loading') {
        dom.progressBarImage.style.display = 'none';
        return;
    }
    dom.progressBarImage.style.display = 'block';

    let score = 0;
    if (state.progress.food) score++;
    if (state.progress.dress) score++;
    if (state.progress.ritual) score++;

    dom.progressBarImage.src = `${CONFIG.ASSETS.PROGRESS_BAR_PREFIX}${score}.png`;
}

function updatePetImage() {
    // If a GIF is playing, do not override it
    if (state.ui.isGifPlaying) return;

    let newImagePath;

    if (state.appPhase === 'loading') {
        if (state.loadingStep === 'static') {
            newImagePath = CONFIG.ASSETS.LOADING_STATIC;
        } else if (state.loadingStep === 'animation') {
            newImagePath = CONFIG.ASSETS.LOADING_ANIMATION;
        } else {
            // 'welcome' or 'instructions'
            newImagePath = CONFIG.ASSETS.PET_DEFAULT;
        }
    } else if (state.currentPageIndex === 1 && !state.progress.food) { // Food Page
        const count = state.gameplay.foodSequence.length;
        if (count === 0) newImagePath = CONFIG.ASSETS.BOWL_EMPTY;
        else if (count === 1) newImagePath = CONFIG.ASSETS.BOWL_STATE_1;
        else if (count === 2) newImagePath = CONFIG.ASSETS.BOWL_STATE_2;
        else newImagePath = CONFIG.ASSETS.BOWL_STATE_3; // fallback or 3
    } else {
        // All other pages show the current pet state (default or dressed)
        newImagePath = state.gameplay.currentPetImage;
    }

    // Ensure we have a valid path (getAssetPath handles {culture} if present in string)
    // Note: Bowl assets don't have {culture} but getAssetPath is safe to call.
    const finalPath = getAssetPath(newImagePath);

    if (dom.petImage.getAttribute('src') !== finalPath) {
        console.log(`Changing pet image to: ${finalPath}`);
        dom.petImage.src = finalPath;
    }
}

function renderSection3() {
    dom.section3.innerHTML = '';

    if (state.appPhase === 'loading') return;

    renderInfoButton();

    const page = PAGES[state.currentPageIndex];
    const content = page.content;

    if (content.type === 'empty') return;
    if (shouldHideControls(page.id)) return;

    if (content.type === 'curved-buttons') {
        renderCurvedButtons(content, page.id);
    }
}

function renderInfoButton() {
    const size = 30;
    const btn = document.createElement('div');
    btn.className = 'round-button';
    
    Object.assign(btn.style, {
        width: `${size}px`,
        height: `${size}px`,
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10
    });

    const img = document.createElement('img');
    img.src = 'assets/defaults/info.png';
    btn.appendChild(img);

    btn.onclick = () => {
        // Placeholder for info button logic
        console.log("Info button clicked");
    };

    dom.section3.appendChild(btn);
}

function shouldHideControls(pageId) {
    if (pageId === 'food' && state.progress.food) return true;
    if (pageId === 'dress' && state.progress.ritual) return true;
    if (pageId === 'ritual' && state.progress.ritual) return true;
    return false;
}

function shouldButtonBeVisible(pageId, buttonId) {
    if (pageId === 'food') {
        return !state.gameplay.foodSequence.includes(buttonId);
    }
    if (pageId === 'dress') {
        return state.gameplay.chosenDressId !== buttonId;
    }
    return true;
}

function renderCurvedButtons(content, pageId) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    dom.section3.appendChild(buttonContainer);

    // Note: Drop zone visual is hidden/removed in this version 
    // as we drop into Section 2.

    const numButtons = content.count;
    const buttonSize = 40 + 40 / numButtons;

    const radius = CONFIG.UI.BUTTON_RADIUS;
    const startAngle = 180;
    const endAngle = 0;
    const angleStep = (startAngle - endAngle) / (numButtons + 1);

    content.ids.forEach((id, index) => {
        const button = createButtonElement(id, pageId, buttonSize);

        if (!shouldButtonBeVisible(pageId, id)) {
            button.style.display = 'none';
        }

        const angle = startAngle - (index + 1) * angleStep;
        const rad = angle * Math.PI / 180;
        const x = radius * Math.cos(rad);
        const y = radius * Math.sin(rad);

        const initialLeft = `calc(50% + ${x}px - ${buttonSize / 2}px)`;
        const initialTop = `calc(-50% + ${y}px - ${buttonSize / 2}px)`;

        button.style.left = initialLeft;
        button.style.top = initialTop;

        if (numButtons === 1) {
            button.onclick = (e) => {
                handleButtonPress(id, pageId);
                e.currentTarget.style.display = 'none';
            };
        } else {
            setupDragAndDrop(button, buttonContainer, initialLeft, initialTop, () => {
                return handleButtonPress(id, pageId);
            });
        }

        buttonContainer.appendChild(button);
    });
    /*
    Blocco di test COMMENTATO:
    - ascolta il tasto "F"
    - avvia una GIF
    - invia un comando seriale ad Arduino
    (usato solo per debug / prototipazione hardware)
    */
}

function createButtonElement(id, pageId, size) {
    const button = document.createElement('div');
    button.className = 'round-button';
    button.style.width = `${size}px`;
    button.style.height = `${size}px`;

    const img = document.createElement('img');

    // Construct Path: assets/{culture}/buttons/{pageId}{id}.png
    const pathPrefix = getAssetPath(CONFIG.ASSETS.BUTTON_PREFIX);
    const imgName = `${pageId}${id}.png`;
    img.src = pathPrefix + imgName;

    // Error handling for missing assets (optional but helpful during dev)
    img.onerror = () => {
        console.warn(`Missing asset: ${img.src}`);
    };

    button.appendChild(img);
    return button;
}

/* ==========================================================================
   DRAG & DROP LOGIC
   ========================================================================== */

function setupDragAndDrop(button, container, resetLeft, resetTop, onSuccess) {

    const startDrag = (e) => {
        if (state.ui.isAnyButtonDragging) return;
        e.stopPropagation();

        state.ui.isAnyButtonDragging = true;
        let isDraggingThis = true;

        const rect = button.getBoundingClientRect();

        // Fixed positioning to allow dragging outside Section 3
        button.style.position = 'fixed';
        button.style.left = `${rect.left}px`;
        button.style.top = `${rect.top}px`;
        button.style.zIndex = 1000;
        button.style.width = `${rect.width}px`;
        button.style.height = `${rect.height}px`;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;

        const moveDrag = (e) => {
            if (!isDraggingThis) return;
            e.preventDefault();

            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;

            const newX = cx - offsetX;
            const newY = cy - offsetY;

            button.style.left = `${newX}px`;
            button.style.top = `${newY}px`;
        };

        const endDrag = () => {
            if (!isDraggingThis) return;
            isDraggingThis = false;
            state.ui.isAnyButtonDragging = false;

            cleanupListeners();

            // Target is Section 2
            const section2 = document.getElementById('section2');

            let droppedSuccessfully = false;

            if (checkDropZoneCollision(button, section2)) {
                droppedSuccessfully = onSuccess();
            }

            if (!droppedSuccessfully) {
                // Revert to absolute
                button.style.position = 'absolute';
                button.style.zIndex = 'auto';
                button.style.userSelect = 'auto';
                button.style.left = resetLeft;
                button.style.top = resetTop;
                button.style.transition = 'left 0.3s, top 0.3s';
                setTimeout(() => { button.style.transition = ''; }, 300);
            }
        };

        const cleanupListeners = () => {
            document.removeEventListener('mousemove', moveDrag);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', moveDrag);
            document.removeEventListener('touchend', endDrag);
        };

        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', moveDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
    };

    button.addEventListener('mousedown', startDrag);
    button.addEventListener('touchstart', startDrag, { passive: true });
}

function checkDropZoneCollision(button, targetElement) {
    const btnRect = button.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    return !(
        btnRect.right < targetRect.left ||
        btnRect.left > targetRect.right ||
        btnRect.bottom < targetRect.top ||
        btnRect.top > targetRect.bottom
    );
}

/* ==========================================================================
   INPUT & EVENTS
   ========================================================================== */

function setupEventListeners() {
    dom.ovalContainer.addEventListener('touchstart', (e) => {
        state.ui.touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

        dom.ovalContainer.addEventListener('touchend', (e) => {
            state.ui.touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });
    
        // Nav Arrows Listeners
        dom.navArrowLeft.addEventListener('click', () => handleNavClick('prev'));
        dom.navArrowLeft.addEventListener('touchstart', (e) => {
            e.stopPropagation(); 
            handleNavClick('prev');
        }, { passive: true });
    dom.navArrowRight.addEventListener('click', () => handleNavClick('next'));
    dom.navArrowRight.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        handleNavClick('next');
    }, { passive: true });

    setupMouseNavigation();
    window.addEventListener('devicemotion', handleShake);

    // Pet Undress Listeners
    dom.petImage.addEventListener('mousedown', startUndressDrag);
    dom.petImage.addEventListener('touchstart', startUndressDrag, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (e.key === 's' || e.key === 'S') wakeUp();
        // Debug: press 'R' to randomize culture
        if (e.key === 'r' || e.key === 'R') resetGame('kurd');
    });
}

function startUndressDrag(e) {
    // Only allow undress if:
    // 1. We are on the 'dress' page (id='dress')
    // 2. A dress is currently chosen
    const dressPageIndex = PAGES.findIndex(p => p.id === 'dress');
    if (state.currentPageIndex !== dressPageIndex || !state.gameplay.chosenDressId) {
        return;
    }

    e.preventDefault();
    e.stopPropagation(); // Prevent page swipe

    const touch = e.touches ? e.touches[0] : e;
    const startX = touch.clientX;
    const startY = touch.clientY;

    // Create Ghost Element (The dress button icon)
    const ghost = document.createElement('img');
    const pathPrefix = getAssetPath(CONFIG.ASSETS.BUTTON_PREFIX);
    const imgName = `dress${state.gameplay.chosenDressId}.png`;
    ghost.src = pathPrefix + imgName;
    
    ghost.style.position = 'fixed';
    ghost.style.width = '60px'; // Approximate button size
    ghost.style.height = '60px';
    ghost.style.zIndex = 1000;
    ghost.style.pointerEvents = 'none';
    ghost.style.left = `${startX - 30}px`;
    ghost.style.top = `${startY - 30}px`;
    
    document.body.appendChild(ghost);

    // Temporarily show default pet (undressed)
    const defaultPetPath = getAssetPath(CONFIG.ASSETS.PET_DEFAULT);
    dom.petImage.src = defaultPetPath;

    let isDragging = true;

    const moveUndressDrag = (ev) => {
        if (!isDragging) return;
        ev.preventDefault(); // Prevent scrolling
        const t = ev.touches ? ev.touches[0] : ev;
        ghost.style.left = `${t.clientX - 30}px`;
        ghost.style.top = `${t.clientY - 30}px`;
    };

    const endUndressDrag = (ev) => {
        if (!isDragging) return;
        isDragging = false;
        
        // Remove listeners
        document.removeEventListener('mousemove', moveUndressDrag);
        document.removeEventListener('mouseup', endUndressDrag);
        document.removeEventListener('touchmove', moveUndressDrag);
        document.removeEventListener('touchend', endUndressDrag);

        // Check drop position relative to Pet Image
        // If dropped OUTSIDE the pet image rect, we confirm undress.
        const t = ev.changedTouches ? ev.changedTouches[0] : ev;
        const dropX = t.clientX;
        const dropY = t.clientY;

        const petRect = dom.petImage.getBoundingClientRect();
        console.log('Pet Rect:', petRect);
        
        // Define "Outside" as not colliding with the pet rect
        const isInsidePet = (
            dropX >= petRect.left + 80 &&
            dropX <= petRect.right - 80 &&
            dropY >= petRect.top + 150 &&
            dropY <= petRect.bottom - 150
        );

        document.body.removeChild(ghost);

        if (!isInsidePet) {
            // Confirm Undress
            console.log("Undressed!");
            state.gameplay.chosenDressId = null;
            state.progress.dress = false;
            state.gameplay.currentPetImage = getAssetPath(CONFIG.ASSETS.PET_DEFAULT);
            updateUI(); // This will show buttons again and keep pet default
        } else {
            // Cancel Undress (restore dressed image)
            console.log("Undress cancelled");
            updatePetImage(); // Will restore the dressed image from state
        }
    };

    document.addEventListener('mousemove', moveUndressDrag);
    document.addEventListener('mouseup', endUndressDrag);
    document.addEventListener('touchmove', moveUndressDrag, { passive: false });
    document.addEventListener('touchend', endUndressDrag);
}

function setupMouseNavigation() {
    dom.ovalContainer.style.cursor = 'grab';

    dom.ovalContainer.addEventListener('mousedown', (e) => {
        state.ui.isMouseDragging = true;
        state.ui.touchStartX = e.screenX;
        dom.ovalContainer.style.cursor = 'grabbing';
    });

    dom.ovalContainer.addEventListener('mouseup', (e) => {
        if (state.ui.isMouseDragging) {
            state.ui.touchEndX = e.screenX;
            handleSwipe();
            state.ui.isMouseDragging = false;
            dom.ovalContainer.style.cursor = 'grab';
        }
    });

    dom.ovalContainer.addEventListener('mouseleave', () => {
        if (state.ui.isMouseDragging) {
            state.ui.isMouseDragging = false;
            dom.ovalContainer.style.cursor = 'grab';
        }
    });
}

function handleNavClick(direction) {
    if (direction === 'prev') {
        if (state.currentPageIndex > 0) state.currentPageIndex--;
    } else if (direction === 'next') {
        if (state.currentPageIndex < PAGES.length - 1) state.currentPageIndex++;
    }
    updateUI();
    resetInactivityTimer();
}

function handleSwipe() {
    const diff = state.ui.touchEndX - state.ui.touchStartX;
    if (Math.abs(diff) > CONFIG.UI.SWIPE_THRESHOLD) {
        if (diff < 0) {
            if (state.currentPageIndex < PAGES.length - 1) state.currentPageIndex++;
        } else {
            if (state.currentPageIndex > 0) state.currentPageIndex--;
        }
        updateUI();
        resetInactivityTimer();
    }
}

function handleShake(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;
    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;
    const totalAcc = Math.sqrt(x ** 2 + y ** 2 + z ** 2);

    const threshold = (!event.accelerationIncludingGravity && event.acceleration)
        ? CONFIG.UI.SHAKE_THRESHOLD / 2
        : CONFIG.UI.SHAKE_THRESHOLD;

    if (totalAcc > threshold) wakeUp();
}

function showBlackScreen() {
    dom.blackScreenOverlay.style.display = 'block';
}

function wakeUp() {
    if (dom.blackScreenOverlay.style.display !== 'none') {
        dom.blackScreenOverlay.style.display = 'none';
        
        if (!state.hasStarted) {
            state.hasStarted = true;
            handleStartupSequence();
        }
        
        resetInactivityTimer();
    }
}

function resetInactivityTimer() {
    if (state.ui.inactivityTimer) clearTimeout(state.ui.inactivityTimer);
    state.ui.inactivityTimer = setTimeout(showBlackScreen, CONFIG.TIMEOUT_MS);
}

function triggerArduino() {
    fetch("http://192.168.1.118/servo")
        .then(res => res.text())
        .then(text => console.log("Risposta ESP32:", text))
        .catch(err => console.error("Errore:", err));
}

async function init() {
    // Load Configuration
    await loadConfiguration();

    // Initialize game state (select culture) immediately
    resetGame();

    // Start loading sequence
    // handleStartupSequence(); // Moved to wakeUp()
    setupEventListeners();
}

async function handleStartupSequence() {
    console.log('Starting App Sequence...');

    // Phase 1: Static Loading Image
    state.appPhase = 'loading';
    state.loadingStep = 'static';
    updateUI();

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Phase 2: Animation
    state.loadingStep = 'animation';
    updateUI();
    triggerArduino(); // Send command to Arduino

    // Wait for animation (using GIF_DURATION_MS or default 3s)
    const animDuration = CONFIG.GIF_DURATION_MS || 3000;
    await new Promise(resolve => setTimeout(resolve, animDuration));

    // Phase 3: Welcome Text
    state.loadingStep = 'welcome';
    updateUI();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Phase 4: Instructions Text
    state.loadingStep = 'instructions';
    updateUI();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Phase 4: Gameplay
    state.appPhase = 'gameplay';
    updateUI(); // Reveal game UI
}

document.addEventListener('DOMContentLoaded', init);
document.getElementById("test").addEventListener("click", () => triggerArduino());