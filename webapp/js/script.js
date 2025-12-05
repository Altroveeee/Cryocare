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
let isAnyButtonDragging = false;
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

        // Add visible drop zone if numButtons > 1
        if (numButtons > 1) {
            const dropZone = document.createElement('div');
            const dropZoneRadius = 30; // Matches the logic in dragEnd
            dropZone.className = 'drop-zone';
            dropZone.style.width = `${dropZoneRadius * 2}px`;
            dropZone.style.height = `${dropZoneRadius * 2}px`;
            dropZone.style.borderRadius = '50%';
            dropZone.style.background = 'rgba(0, 255, 0, 0.2)'; // Semi-transparent green
            dropZone.style.position = 'absolute';
            dropZone.style.left = `calc(50% - ${dropZoneRadius}px)`;
            dropZone.style.top = `${0 - dropZoneRadius}px`; // Centered vertically at 0
            dropZone.style.pointerEvents = 'none'; // Don't block mouse events for buttons
            buttonContainer.appendChild(dropZone);
        }

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

            const initialLeft = `calc(50% + ${x}px - ${buttonSize / 2}px)`;
            const initialTop = `calc(0% + ${y}px - ${buttonSize / 2}px)`;

            button.style.left = initialLeft;
            button.style.top = initialTop;

            if (numButtons === 1) {
                button.onclick = (event) => {
                    buttonPressed(pageContent.ids[i], pageContent.name);
                    event.currentTarget.style.display = 'none'; // Hide the clicked button
                };
            } else {
                // Drag and drop logic for multiple buttons
                const makeDraggable = (btn, buttonId, pageName) => {
                    let isDraggingThis = false;

                    const dragStart = (e) => {
                        if (isAnyButtonDragging) return;
                        e.stopPropagation();
                        isAnyButtonDragging = true;
                        isDraggingThis = true;

                        btn.style.zIndex = 1000;
                        btn.style.userSelect = 'none';

                        const event = e.touches ? e.touches[0] : e;
                        const rect = btn.getBoundingClientRect();
                        let offsetX = event.clientX - rect.left;
                        let offsetY = event.clientY - rect.top;

                        const dragMove = (e) => {
                            if (!isDraggingThis) return;
                            e.preventDefault();

                            const event = e.touches ? e.touches[0] : e;
                            const containerRect = buttonContainer.getBoundingClientRect();

                            let newX = event.clientX - containerRect.left - offsetX;
                            let newY = event.clientY - containerRect.top - offsetY;

                            btn.style.left = `${newX}px`;
                            btn.style.top = `${newY}px`;
                        };

                        const dragEnd = (e) => {
                            if (!isDraggingThis) return;
                            isAnyButtonDragging = false;
                            isDraggingThis = false;

                            btn.style.zIndex = 'auto';
                            btn.style.userSelect = 'auto';

                            document.removeEventListener('mousemove', dragMove);
                            document.removeEventListener('mouseup', dragEnd);
                            document.removeEventListener('touchmove', dragMove);
                            document.removeEventListener('touchend', dragEnd);

                            const rect = btn.getBoundingClientRect();
                            const containerRect = buttonContainer.getBoundingClientRect();

                            const buttonCenterX = rect.left - containerRect.left + rect.width / 2;
                            const buttonCenterY = rect.top - containerRect.top + rect.height / 2;

                            const dropZoneRadius = 30;

                            const dropZoneCenterX = buttonContainer.offsetWidth / 2;
                            const dropZoneCenterY = 0;

                            const distance = Math.sqrt(
                                Math.pow(buttonCenterX - dropZoneCenterX, 2) +
                                Math.pow(buttonCenterY - dropZoneCenterY, 2)
                            );

                            if (distance < dropZoneRadius) {
                                buttonPressed(buttonId, pageName);
                                btn.style.display = 'none';
                            } else {
                                btn.style.left = initialLeft;
                                btn.style.top = initialTop;
                                btn.style.transition = 'left 0.3s, top 0.3s';
                                setTimeout(() => {
                                    btn.style.transition = '';
                                }, 300);
                            }
                        };

                        document.addEventListener('mousemove', dragMove);
                        document.addEventListener('mouseup', dragEnd);
                        document.addEventListener('touchmove', dragMove, { passive: false });
                        document.addEventListener('touchend', dragEnd);
                    };

                    btn.addEventListener('mousedown', dragStart);
                    btn.addEventListener('touchstart', dragStart, { passive: true });
                };

                makeDraggable(button, pageContent.ids[i], pageContent.name);
            }

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
        changePetImage('assets/pet/default.jpg');
    } else if (currentPageIndex === 1) {
        changePetImage('assets/pet/food.png');
    } else if (currentPageIndex === 2) {
        changePetImage('assets/pet/default.jpg');
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