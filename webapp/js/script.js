// CONFIG & STATE
let CONFIG = {};
let CULTURE_CONFIGS = {};

const PAGES = [
    { id: 'home', content: { type: 'empty' } },
    { id: 'food', content: { type: 'curved-buttons', count: 3, ids: ['1', '2', '3'] } },
    { id: 'dress', content: { type: 'curved-buttons', count: 3, ids: ['1', '2', '3'] } },
];

const state = {
    appPhase: 'black_screen', // black_screen -> waiting_for_click -> sequence_running -> gameplay
    loadingStep: null, 
    hasStarted: false,
    currentCulture: 'kurd',
    currentPageIndex: 0,
    progress: { food: false, dress: false, ritual: false },
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
        tempContent: { top: null, bot: null },
        tempTimers: { top: null, bot: null }
    }
};

const dom = {}; // Populated in init

const CLICK_SOUND = new Audio('assets/audio/click_sound.mp3');
CLICK_SOUND.volume = 0.5;

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

async function init() {
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
    resetGame();
    
    // 5. Preload Culture Specifics
    const cultureAssets = collectCultureAssets(state.currentCulture);
    await preloadImages(cultureAssets);
    
    // 6. Start
    setupEventListeners();
    
    // Initial State: Black Screen
    dom.overlayBlack.style.display = 'block';
    updateUI();
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

    state.progress = { food: false, dress: false, ritual: false };
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
    state.ui.tempContent = { top: null, bot: null };

    resetInactivityTimer();
}

/* ==========================================================================
   RENDERING & LAYOUT
   ========================================================================== */

function updateUI() {
    applyLayoutPositions();
    updateImages();
    updateControls();
    updateContentZones();
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
        dom.progressBarImage.src = `${CONFIG.ASSETS.PROGRESS_BAR_PREFIX}${score}.png`;
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
                }, 1500);
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
    const isBaking = state.gameplay.bakingState !== 'none';
    const isFeeding = state.gameplay.feedingState !== 'idle' && state.gameplay.feedingState !== 'done';
    const hideArrows = state.appPhase !== 'gameplay' || isBaking || isFeeding;

    if (hideArrows) {
        dom.navLeft.style.display = 'none';
        dom.navRight.style.display = 'none';
    } else {
        dom.navLeft.style.display = state.currentPageIndex > 0 ? 'block' : 'none';
        dom.navRight.style.display = state.currentPageIndex < PAGES.length - 1 ? 'block' : 'none';
    }

    // 2. Info Button
    dom.infoContainer.innerHTML = ''; // clear
    if (state.appPhase === 'gameplay' && !isBaking && !isFeeding) {
        const infoBtn = document.createElement('img');
        infoBtn.src = 'assets/defaults/info.png';
        infoBtn.onclick = () => {
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
        const radius = CONFIG.UI.BUTTON_RADIUS; 
        
        content.ids.forEach((id, index) => {
            if (!shouldButtonBeVisible(page.id, id)) return;

            // Simple distribution along an arc below the center
            const span = 60; // +/- 60 degrees
            const step = span * 2 / (count - 1 || 1);
            const currentDeg = -span + (step * index); 
            
            const rad = (currentDeg + 90) * (Math.PI / 180);
            
            // Layout Y serves as anchor
            const layoutY = CONFIG.LAYOUT.BUTTONS_Y; 
            
            const x = radius * Math.cos(rad);
            const y = radius * Math.sin(rad);

            const btn = document.createElement('div');
            btn.className = 'round-button';
            const size = 70; 
            btn.style.width = `${size}px`;
            btn.style.height = `${size}px`;
            
            // Position relative to Center + Layout Offset
            // Note: Since we use radius * sin(rad) where rad starts at 0 for right, 90 for down...
            // If we want the arc to bow UP, we need slightly different math, 
            // but standard "radius around a point" works well enough.
            
            btn.style.left = `calc(50% + ${x}px - ${size/2}px)`;
            // We shift the entire arc DOWN by the Layout Y %
            // And we subtract radius because usually (0,0) is center of circle, so we need to offset
            // so the TOP of the arc touches our desired Y? Or center?
            // Let's just place the center of the imaginary circle at (50%, LayoutY - Radius).
            // Then the buttons at the bottom of the circle will be at LayoutY.
            
            // Actually, let's keep it simple. Center of arc = (50%, BUTTONS_Y).
            // Buttons are placed on the lower half.
            btn.style.top = `calc(50% + ${layoutY}% + ${y}px - ${radius}px - ${size/2}px)`;
            
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

function updateContentZones() {
    dom.zoneTop.innerHTML = '';
    dom.zoneBot.innerHTML = '';

    // Logic for what to show
    let topContent = null;
    let botContent = null;

    if (state.ui.tempContent.top) topContent = state.ui.tempContent.top;
    else if (state.appPhase === 'sequence_running' && state.loadingStep === 'welcome') topContent = { type:'text', value: getText('WELCOME') };
    else if (state.gameplay.bakingState === 'baked') topContent = { type:'text', value: getText('FOOD_NAME') };
    
    // Ritual Button Logic
    if (state.currentPageIndex === 2 
        && state.gameplay.chosenDressId === CONFIG.RULES.CORRECT_DRESS_ID 
        && !state.progress.ritual
        && !state.ui.isGifPlaying) {
        
        topContent = { 
            type: 'button', 
            image: CONFIG.ASSETS.RITUAL_BUTTON_ICON,
            action: () => triggerRitual()
        };
    }

    if (state.ui.tempContent.bot) botContent = state.ui.tempContent.bot;
    else if (state.gameplay.bakingState === 'baked') botContent = { type:'text', value: getText('FOOD_DESCRIPTION') };
    else if (state.appPhase === 'sequence_running' && state.loadingStep === 'instructions') botContent = { type:'text', value: getText('INTRO') };

    renderZone(dom.zoneTop, topContent);
    renderZone(dom.zoneBot, botContent);
}

function renderZone(container, content) {
    if (!content) return;
    if (content.type === 'text') {
        const s = document.createElement('span');
        s.textContent = content.value;
        container.appendChild(s);
    } else if (content.type === 'button') {
        const b = document.createElement('div');
        b.className = 'ritual-btn';
        const i = document.createElement('img');
        i.src = content.image;
        b.appendChild(i);
        b.onclick = (e) => { 
            animateButtonPress(b); 
            content.action(); 
        };
        container.appendChild(b);
    }
}

/* ==========================================================================
   INTERACTIONS
   ========================================================================== */

function setupDragAndDrop(element, resetLeft, resetTop, onDropCallback) {
    let startX, startY;
    let initialLeft, initialTop;

    const onStart = (e) => {
        if(state.ui.isAnyButtonDragging) return;
        e.preventDefault(); 
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        document.body.appendChild(element);
        element.style.position = 'fixed';
        element.style.left = initialLeft + 'px';
        element.style.top = initialTop + 'px';
        element.style.transform = 'none'; // Clear translate
        element.style.zIndex = 1000;
        
        animateButtonPress(element);

        state.ui.isAnyButtonDragging = true;
        
        const onMove = (mv) => {
            mv.preventDefault();
            const dx = mv.clientX - startX;
            const dy = mv.clientY - startY;
            element.style.transform = `translate(${dx}px, ${dy}px)`;
        };
        
        const onEnd = (endEvent) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            state.ui.isAnyButtonDragging = false;
            
            const btnRect = element.getBoundingClientRect();
            const btnCx = btnRect.left + btnRect.width / 2;
            const btnCy = btnRect.top + btnRect.height / 2;
            
            const screenCx = window.innerWidth / 2;
            const screenCy = window.innerHeight / 2;
            
            const dist = Math.hypot(btnCx - screenCx, btnCy - screenCy);
            const DROP_THRESHOLD = 150; // px
            
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
        
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onEnd);
    };

    element.addEventListener('pointerdown', onStart);
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
        state.progress.dress = true;
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
    
    setTimeout(() => {
        state.ui.isGifPlaying = false;
        state.gameplay.bakingState = 'baked';
        updateUI();
    }, CONFIG.GIF_DURATION_MS);
}

function triggerRitual() {
    state.progress.ritual = true;
    state.ui.isGifPlaying = true;
    dom.petImage.src = getAssetPath(CONFIG.ASSETS.PET_RITUAL);
    updateUI();
    setTimeout(() => {
        state.ui.isGifPlaying = false;
        updateUI();
    }, CONFIG.GIF_DURATION_MS);
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
    const ip = CONFIG.HARDWARE?.ESP_IP;
    if(ip) fetch(`${ip}/servo`).catch(e => console.warn("Hardware err", e));
}

function resetInactivityTimer() {
    if (state.ui.inactivityTimer) clearTimeout(state.ui.inactivityTimer);
    state.ui.inactivityTimer = setTimeout(() => {
        // Only show black screen overlay if we are already in gameplay
        if (state.appPhase === 'gameplay') {
            dom.overlayBlack.style.display = 'block';
            state.appPhase = 'black_screen'; // Effectively go back to sleep
        }
    }, CONFIG.TIMEOUT_MS);
}

function setupEventListeners() {
    // Navigation
    const nav = (dir) => {
        if(dir==='prev' && state.currentPageIndex > 0) state.currentPageIndex--;
        if(dir==='next' && state.currentPageIndex < PAGES.length-1) state.currentPageIndex++;
        updateUI();
        resetInactivityTimer();
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

    // Global Click State Machine
    document.body.addEventListener('click', () => {
        resetInactivityTimer();

        if (state.appPhase === 'black_screen') {
            // Wake up usually handled by Shake/S, but clicking might also wake from sleep timeout?
            // Requirement 3: "click... only when screen is not black" for startup sequence.
            // But Requirement 2 says Shake/S wakes it up.
            // Requirement 11/12/13: Clicks drive eating sequence.
        } else if (state.appPhase === 'waiting_for_click') {
            handleStartupSequence();
        } else if (state.appPhase === 'gameplay') {
            
            // Food/Feeding Logic
            if (state.currentPageIndex === 1) { // Food Page
                const s = state.gameplay;
                
                if (s.bakingState === 'baked') {
                    // 11. Click on baked -> Ready to eat (Full bowl)
                    s.bakingState = 'none';
                    s.feedingState = 'ready_to_eat';
                    updateUI();
                } else if (s.feedingState === 'ready_to_eat') {
                    // 12. Click -> Eat Anim + Progress
                    s.feedingState = 'eating';
                    state.progress.food = true;
                    updateUI();
                } else if (s.feedingState === 'eating') {
                    // 13. Click -> Share Anim
                    s.feedingState = 'sharing';
                    updateUI();
                    
                    // 14. After share -> Done (Arrows appear). 
                    // Let's use a timeout or next click? Requirement 14: "after the eat and share animation arrows appears"
                    // Animation usually takes ~1-2s? Let's use a timeout for flow or require another click.
                    // Given the flow, auto-transition to done after animation is safer so user sees arrows.
                    setTimeout(() => {
                        s.feedingState = 'done';
                        updateUI();
                    }, 2000); 
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
        state.appPhase = 'waiting_for_click';
        updateUI(); // Shows static loading image
        resetInactivityTimer();
    }
}

async function handleStartupSequence() {
    state.appPhase = 'sequence_running';
    state.loadingStep = 'static';
    // Transition: Fade out static image? 
    // Logic: 'sequence_running' + 'static' shows LOADING_STATIC.
    // We want to move to 'welcome' (Animation)
    
    // Immediate or slight delay?
    state.loadingStep = 'welcome';
    updateUI();
    await new Promise(r => setTimeout(r, 3000));
    
    state.loadingStep = 'instructions';
    updateUI();
    await new Promise(r => setTimeout(r, 3000));
    
    state.appPhase = 'gameplay';
    updateUI();
}

document.addEventListener('DOMContentLoaded', init);

