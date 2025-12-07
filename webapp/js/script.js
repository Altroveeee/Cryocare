/**
 * CONFIGURATION & CONSTANTS
 * Centralized configuration for easy adjustments.
 */
const CONFIG = {
    // Game Rules
    RULES: {
        CORRECT_FOOD_ORDER: ['2', '1', '4', '3'],
        CORRECT_DRESS_ID: '1',
    },
    // Timers
    TIMEOUT_MS: 30000,
    // UI Layout
    UI: {
        BUTTON_RADIUS: 100,
        DROP_ZONE_RADIUS: 30,
        SWIPE_THRESHOLD: 50,
        SHAKE_THRESHOLD: 20,
    },
    // Assets
    ASSETS: {
        PET_DEFAULT: 'assets/pet/default.jpg',
        PET_FOOD: 'assets/pet/food.png',
        PROGRESS_BAR_PREFIX: 'assets/progress-bar/bar',
        BUTTON_PREFIX: 'assets/buttons/',
    }
};

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
        content: { type: 'curved-buttons', count: 4, ids: ['1', '2', '3', '4'] }
    },
    {
        id: 'dress',
        content: { type: 'curved-buttons', count: 2, ids: ['1', '2'] }
    },
    {
        id: 'ritual',
        content: { type: 'curved-buttons', count: 1, ids: ['1'] }
    }
];

/**
 * STATE MANAGEMENT
 * Single source of truth for the application state.
 */
const state = {
    currentPageIndex: 0,
    progress: {
        food: false,
        dress: false,
        ritual: false,
    },
    gameplay: {
        foodSequence: [],
        chosenDressId: null,
    },
    ui: {
        isAnyButtonDragging: false,
        inactivityTimer: null,
        touchStartX: 0,
        touchEndX: 0,
        isMouseDragging: false,
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
};

/* ==========================================================================
   GAME LOGIC HANDLERS
   ========================================================================== */

function handleFoodInteraction(buttonId) {
    // Prevent interaction if already complete
    if (state.progress.food) return;

    state.gameplay.foodSequence.push(buttonId);

    // Check if sequence is complete
    if (state.gameplay.foodSequence.length === CONFIG.RULES.CORRECT_FOOD_ORDER.length) {
        const isCorrect = state.gameplay.foodSequence.every(
            (val, index) => val === CONFIG.RULES.CORRECT_FOOD_ORDER[index]
        );

        if (isCorrect) {
            console.log('Food order is correct');
            state.progress.food = true;
            state.gameplay.foodSequence = []; // Clear for cleanliness
        } else {
            console.log('Food order incorrect, resetting');
            state.gameplay.foodSequence = [];
        }
    }
}

function handleDressInteraction(buttonId) {
    state.gameplay.chosenDressId = buttonId;
    state.progress.dress = true;
}

function handleRitualInteraction(buttonId) {
    if (state.gameplay.chosenDressId === CONFIG.RULES.CORRECT_DRESS_ID) {
        state.progress.ritual = true;
    } else {
        // If wrong dress was chosen, reset choice (logic from original code)
        state.gameplay.chosenDressId = null;
    }
}

function handleButtonPress(buttonId, pageId) {
    console.log(`Button pressed: ${buttonId} on page: ${pageId}`);
    
    switch (pageId) {
        case 'food':
            handleFoodInteraction(buttonId);
            break;
        case 'dress':
            handleDressInteraction(buttonId);
            break;
        case 'ritual':
            handleRitualInteraction(buttonId);
            break;
    }

    // Trigger global UI update to reflect state changes
    updateUI();
}

/* ==========================================================================
   UI RENDERING & UPDATES
   ========================================================================== */

function updateUI() {
    updateProgressBar();
    updatePetImage();
    // We conditionally re-render controls only if needed, but for simplicity
    // and matching original behavior, we re-check the view state.
    // Note: Re-rendering section3 blindly stops ongoing animations, 
    // but usually updateUI is called after an interaction completes.
    
    // However, we shouldn't re-render Section 3 if we are just updating the bar/pet
    // unless the logical state of the current page changed (like buttons disappearing).
    // The original code re-renders Section 3 on every swipe and interaction.
    renderSection3(); 
}

function updateProgressBar() {
    let score = 0;
    if (state.progress.food) score++;
    if (state.progress.dress) score++;
    if (state.progress.ritual) score++;

    console.log(`Progress Score: ${score}`);
    dom.progressBarImage.src = `${CONFIG.ASSETS.PROGRESS_BAR_PREFIX}${score}.png`;
}

function updatePetImage() {
    let newImage = CONFIG.ASSETS.PET_DEFAULT;
    
    // Page 1 is index 1 (Food) in original array logic? 
    // Original: 
    // Index 0 (Home) -> default
    // Index 1 (Food) -> food.png
    // Index 2 (Dress) -> default
    // Index 3 (Ritual) -> implied default (was not explicitly handled in original else-if chain)
    
    if (state.currentPageIndex === 1) {
        newImage = CONFIG.ASSETS.PET_FOOD;
    }
    
    if (dom.petImage.getAttribute('src') !== newImage) {
        console.log(`Changing pet image to: ${newImage}`);
        dom.petImage.src = newImage;
    }
}

function renderSection3() {
    dom.section3.innerHTML = ''; // Clear content
    const page = PAGES[state.currentPageIndex];
    const content = page.content;

    if (content.type === 'empty') return;

    // Check if controls should be hidden based on completion state
    if (shouldHideControls(page.id)) return;

    if (content.type === 'curved-buttons') {
        renderCurvedButtons(content, page.id);
    }
}

function shouldHideControls(pageId) {
    if (pageId === 'food' && state.progress.food) return true;
    // Dress buttons hide only if RITUAL is complete (original logic)
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

    // Add drop zone if draggable (more than 1 button)
    if (content.count > 1) {
        createDropZone(buttonContainer);
    }

    const numButtons = content.count;
    // Inverse proportion for size
    const buttonSize = 40 + 40 / numButtons; 

    const radius = CONFIG.UI.BUTTON_RADIUS;
    const startAngle = 180;
    const endAngle = 0;
    const angleStep = (startAngle - endAngle) / (numButtons + 1);

    content.ids.forEach((id, index) => {
        const button = createButtonElement(id, pageId, buttonSize);

        // Visibility Check
        if (!shouldButtonBeVisible(pageId, id)) {
            button.style.display = 'none';
        }
        
        // Calculate Position
        const angle = startAngle - (index + 1) * angleStep;
        const rad = angle * Math.PI / 180;
        const x = radius * Math.cos(rad);
        const y = radius * Math.sin(rad);

        const initialLeft = `calc(50% + ${x}px - ${buttonSize / 2}px)`;
        const initialTop = `calc(0% + ${y}px - ${buttonSize / 2}px)`;

        button.style.left = initialLeft;
        button.style.top = initialTop;

        // Attach Interaction
        if (numButtons === 1) {
            button.onclick = (e) => {
                handleButtonPress(id, pageId);
                e.currentTarget.style.display = 'none';
            };
        } else {
            setupDragAndDrop(button, buttonContainer, initialLeft, initialTop, () => {
                handleButtonPress(id, pageId);
            });
        }

        buttonContainer.appendChild(button);
    });
}

function createButtonElement(id, pageId, size) {
    const button = document.createElement('div');
    button.className = 'round-button';
    button.style.width = `${size}px`;
    button.style.height = `${size}px`;

    const img = document.createElement('img');
    img.src = `${CONFIG.ASSETS.BUTTON_PREFIX}${pageId}${id}.png`;
    button.appendChild(img);

    return button;
}

function createDropZone(container) {
    // Drop zone is now Section 2, so we don't create a visual helper in Section 3 anymore.
    return; 
}

/* ==========================================================================
   DRAG & DROP LOGIC
   ========================================================================== */

function setupDragAndDrop(button, container, resetLeft, resetTop, onSuccess) {
    
    const startDrag = (e) => {
        if (state.ui.isAnyButtonDragging) return;
        e.stopPropagation(); // Prevent swiping while dragging
        
        state.ui.isAnyButtonDragging = true;
        let isDraggingThis = true;

        // Switch to Fixed Positioning to escape overflow:hidden
        const rect = button.getBoundingClientRect();
        button.style.position = 'fixed';
        button.style.left = `${rect.left}px`;
        button.style.top = `${rect.top}px`;
        button.style.zIndex = 1000;
        button.style.width = `${rect.width}px`; // Explicitly set size to prevent resizing
        button.style.height = `${rect.height}px`;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;

        const moveDrag = (e) => {
            if (!isDraggingThis) return;
            e.preventDefault(); // Prevent scrolling

            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            
            // Move relative to viewport (fixed)
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

            // Check Drop Condition (Target is Section 2)
            const section2 = document.getElementById('section2');
            if (checkDropZoneCollision(button, section2)) {
                onSuccess();
            } else {
                // Revert to Absolute Positioning inside Section 3
                button.style.position = 'absolute';
                button.style.zIndex = 'auto';
                button.style.userSelect = 'auto';
                
                // Animate back to original position
                // We set the position immediately then animate via CSS transition if desired,
                // but for simplicity/robustness we just snap back or use a small timeout.
                button.style.left = resetLeft;
                button.style.top = resetTop;
                
                // Add a transition class or inline style for smooth snap-back if desired
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

    // Check for Rectangle Intersection
    return !(
        btnRect.right < targetRect.left || 
        btnRect.left > targetRect.right || 
        btnRect.bottom < targetRect.top || 
        btnRect.top > targetRect.bottom
    );
}

/* ==========================================================================
   INPUT & EVENTS (Swipe, Shake, Sleep)
   ========================================================================== */

function setupEventListeners() {
    // Touch Navigation
    dom.ovalContainer.addEventListener('touchstart', (e) => {
        state.ui.touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    dom.ovalContainer.addEventListener('touchend', (e) => {
        state.ui.touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    // Mouse Navigation (for Desktop testing)
    setupMouseNavigation();

    // Shake Detection
    window.addEventListener('devicemotion', handleShake);

    // PC Shake Simulation
    document.addEventListener('keydown', (e) => {
        if (e.key === 's' || e.key === 'S') wakeUp();
    });
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

function handleSwipe() {
    const diff = state.ui.touchEndX - state.ui.touchStartX;
    const threshold = CONFIG.UI.SWIPE_THRESHOLD;

    if (Math.abs(diff) > threshold) {
        if (diff < 0) {
            // Swipe Left -> Next Page
            if (state.currentPageIndex < PAGES.length - 1) {
                state.currentPageIndex++;
                updateUI();
            }
        } else {
            // Swipe Right -> Prev Page
            if (state.currentPageIndex > 0) {
                state.currentPageIndex--;
                updateUI();
            }
        }
        resetInactivityTimer();
    }
}

function handleShake(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;

    // Use a simpler check if x/y/z not fully available
    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;
    
    const totalAcc = Math.sqrt(x**2 + y**2 + z**2);
    
    // Adjust threshold based on availability of gravity
    const threshold = (!event.accelerationIncludingGravity && event.acceleration) 
        ? CONFIG.UI.SHAKE_THRESHOLD / 2 
        : CONFIG.UI.SHAKE_THRESHOLD;

    if (totalAcc > threshold) {
        wakeUp();
    }
}

/* ==========================================================================
   SLEEP MODE
   ========================================================================== */

function showBlackScreen() {
    dom.blackScreenOverlay.style.display = 'block';
}

function wakeUp() {
    if (dom.blackScreenOverlay.style.display !== 'none') {
        dom.blackScreenOverlay.style.display = 'none';
        resetInactivityTimer();
    }
}

function resetInactivityTimer() {
    if (state.ui.inactivityTimer) clearTimeout(state.ui.inactivityTimer);
    state.ui.inactivityTimer = setTimeout(showBlackScreen, CONFIG.TIMEOUT_MS);
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

function init() {
    updateUI();
    setupEventListeners();
    resetInactivityTimer();
}

// Start
document.addEventListener('DOMContentLoaded', init);
