const pages = [
    {
        section3: { name: 'home', type: 'empty' }, // Page 1
    },
    {
        section3: { name: 'food', type: 'curved-buttons', count: 4, ids: ['1', '2', '3', '4'] }, // Page 2
    },
    {
        section3: { name: 'dress', type: 'curved-buttons', count: 2, ids: ['1', '2'] }, // Page 3
    },
    {
        section3: { name: 'ritual', type: 'curved-buttons', count: 1, ids: ['1'] }, // Page 4
    },
];

let currentPageIndex = 0;

const section3 = document.getElementById('section3');
const ovalContainer = document.getElementById('oval-container');
const blackScreenOverlay = document.getElementById('black-screen-overlay');
const petImage = document.getElementById('pet-image');
const progressBarImage = document.getElementById('progress-bar-image');
const correctButtonOrder = ['2', '1', '4', '3'] // UPDATE THIS TO CHANGE THE CORRECT BUTTON ORDER
const correctDress = '1' // UPDATE THIS TO CHANGE THE CORRECT DRESS

let progressBarValues = {
    food: 0,
    dress: 0,
    ritual: 0,
}
let inactivityTimer;
let pressedButtons = []
let choosenDress = null;

let touchStartX = 0;
let touchEndX = 0;
let isDragging = false;

function showBlackScreen() {
    blackScreenOverlay.style.display = 'block';
}

function hideBlackScreen() {
    if (blackScreenOverlay.style.display !== 'none') {
        blackScreenOverlay.style.display = 'none';
        resetInactivityTimer();
    }
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(showBlackScreen, 30000); // 5 seconds
}

function buttonPressed(buttonId, pageName) {
    console.log(`Button pressed called with parameters: ${buttonId} ${pageName}`)
    if (pageName == 'food') {
        // If pressedButtons is null the food part has already been done
        if (pressedButtons == null) {
            return
        }

        pressedButtons.push(buttonId);

        if (pressedButtons.length == correctButtonOrder.length) {
            correct = true;
            for (let i = 0; i < pressedButtons.length; i++) {
                if (pressedButtons[i] !== correctButtonOrder[i]) {
                    correct = false;
                }
            }
            if (correct) {
                console.log('Food order is correct')
                progressBarValues.food = 1;
                pressedButtons = null;
            }
            else {
                // Reset pressed buttons and rerender the section 3
                pressedButtons = [];
                renderSection3();
            }
        }
    } else if (pageName == 'dress') {
        choosenDress = buttonId;
        progressBarValues.dress = 1;
    } else if (pageName == 'ritual') {
        if (choosenDress == correctDress) {
            progressBarValues.ritual = 1;
        } else {
            choosenDress = null;
        }
    }
}

function getButtonImage(buttonId, pageName) {
    return pageName + buttonId + '.png'
}

function renderSection3() {
    section3.innerHTML = ''; // Clear previous content
    const pageContent = pages[currentPageIndex].section3;

    if (pageContent.type === 'empty') {
        // Do nothing
    } else if (pageContent.type === 'curved-buttons') {
        // If the food selection was correct you cannot do it anymore
        if ((pageContent.name == 'food' && progressBarValues.food === 1) ||
            (pageContent.name == 'dress' && progressBarValues.ritual === 1) ||
            (pageContent.name == 'ritual' && progressBarValues.ritual === 1)) {
            return
        }
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        section3.appendChild(buttonContainer);

        const numButtons = pageContent.count;
        const buttonSize = 40 + 40 / numButtons; // Inverse proportion

        const radius = 100;
        const startAngle = 180;
        const endAngle = 0;
        const angleStep = (startAngle - endAngle) / (numButtons + 1);

        for (let i = 0; i < numButtons; i++) {
            const button = document.createElement('div');
            button.className = 'round-button';
            button.style.width = `${buttonSize}px`;
            button.style.height = `${buttonSize}px`;

            const img = document.createElement('img');
            img.src = `assets/buttons/${getButtonImage(pageContent.ids[i], pageContent.name)}`;
            button.appendChild(img);

            const angle = startAngle - (i + 1) * angleStep;
            const x = radius * Math.cos(angle * Math.PI / 180);
            const y = radius * Math.sin(angle * Math.PI / 180);

            button.style.left = `calc(50% + ${x}px - ${buttonSize / 2}px)`;
            button.style.top = `calc(0% + ${y}px - ${buttonSize / 2}px)`;

            button.onclick = (event) => {
                buttonPressed(pageContent.ids[i], pageContent.name);
                event.currentTarget.style.display = 'none'; // Hide the clicked button
            };

            buttonContainer.appendChild(button);
        }
    }
}

function updatePageContent() {
    // Update status bar
    barValue = 0;
    for (k in progressBarValues) {
        barValue += progressBarValues[k];
    }
    console.log(`barValue: ${barValue}`);
    changeProgressBarImage(`assets/progress-bar/bar${barValue}.png`)

    // Update pet image
    if (currentPageIndex === 0) {
        changePetImage('assets/pet/default.png');
    } else if (currentPageIndex === 1) {
        changePetImage('assets/pet/food.png');
    } else if (currentPageIndex === 2) {
        changePetImage('assets/pet/default.png');
    }
    // Update button section
    renderSection3();
}

function changePetImage(newImagePath) {
    console.log(`Changing pet image: ${newImagePath}`)
    if (petImage) {
        petImage.src = newImagePath;
        console.log('Pet image changed')
    }
}

function changeProgressBarImage(newImagePath) {
    if (progressBarImage) {
        progressBarImage.src = newImagePath;
    }
}

function handleSwipe() {
    const swipeThreshold = 50; // To prevent accidental swipes
    if (touchEndX < touchStartX && touchStartX - touchEndX > swipeThreshold) {
        // Swiped left
        if (currentPageIndex < pages.length - 1) {
            currentPageIndex++;
            updatePageContent();
        }
        resetInactivityTimer();
    }

    if (touchEndX > touchStartX && touchEndX - touchStartX > swipeThreshold) {
        // Swiped right
        if (currentPageIndex > 0) {
            currentPageIndex--;
            updatePageContent();
        }
        resetInactivityTimer();
    }
}

// Touch events
ovalContainer.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].screenX;
}, { passive: true });

ovalContainer.addEventListener('touchend', (event) => {
    touchEndX = event.changedTouches[0].screenX;
    handleSwipe();
});

// Mouse events for PC testing
ovalContainer.addEventListener('mousedown', (event) => {
    isDragging = true;
    touchStartX = event.screenX;
    ovalContainer.style.cursor = 'grabbing';
});

ovalContainer.addEventListener('mouseup', (event) => {
    if (isDragging) {
        touchEndX = event.screenX;
        handleSwipe();
        isDragging = false;
        ovalContainer.style.cursor = 'grab';
    }
});

ovalContainer.addEventListener('mouseleave', () => {
    if (isDragging) {
        isDragging = false;
        ovalContainer.style.cursor = 'grab';
    }
});

// Shake detection for mobile
window.addEventListener('devicemotion', (event) => {
    const acceleration = event.accelerationIncludingGravity;
    const shakeThreshold = 20; // m/s^2
    if (!acceleration.x) {
        // On some devices, accelerationIncludingGravity is null
        // and acceleration is available instead.
        const acc = event.acceleration;
        const totalAcceleration = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
        if (totalAcceleration > shakeThreshold/2) { // lower threshold for this case
            hideBlackScreen();
        }
        return;
    }
    const totalAcceleration = Math.sqrt(acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2);

    if (totalAcceleration > shakeThreshold) {
        hideBlackScreen();
    }
});

// Shake simulation for PC
document.addEventListener('keydown', (event) => {
    if (event.key === 's' || event.key === 'S') {
        hideBlackScreen();
    }
});


// Initial page load
document.addEventListener('DOMContentLoaded', () => {
    updatePageContent();
    ovalContainer.style.cursor = 'grab';
    // The screen is black by default from CSS.
});