# Cryocare — How the Application Works

## What is Cryocare?

Cryocare is an interactive web application designed for a physical installation. It presents the user with a digital "Cultural Guardian" — a character representing an endangered or persecuted culture — and guides them through a sequence of caregiving activities: cooking a traditional dish, dressing the guardian in ceremonial attire, and performing a cultural ritual. Each activity builds trust and unlocks memories — short narrative moments where the guardian explains why its culture had to be preserved.

The application currently supports six cultures: Kurdish, Amazigh, Maori, Palestinian, Uyghur, and Guarani. Each has its own character name, traditional food, clothing, ritual animation, music, and narrative text.

---

## Architecture

The entire application is a single-page web app. There is one HTML file that defines the visual structure, one CSS file for styling and animations, one JavaScript file containing all the logic (roughly 1,400 lines), and two JSON configuration files.

The HTML is organised into visual layers stacked on top of each other inside an oval-shaped container. From back to front: the guardian character, then props like the table and bowl, then text zones for messages, then interactive controls like buttons and the progress bar, and finally full-screen overlays for things like the info panel and memory viewer. Each layer has a fixed z-index so that elements always appear in the correct order.

### Configuration

The application loads two configuration files at startup. The first is a global defaults file that contains all the asset paths, layout positions, text templates, timing values, and interaction thresholds. The second is a per-culture file that provides culture-specific overrides: the guardian's name, the name and description of the traditional dish, the correct order of ingredients, the correct ceremonial dress, and the narrative messages shown at the end.

When a culture is selected, its specific rules are merged on top of the global defaults. This means adding a new culture does not require changing any code — only providing a new set of assets (images, GIFs, audio) and adding a new entry to the culture configuration file.

### Asset System

Asset paths in the configuration use placeholders like `{culture}` and `{id}` that get replaced at runtime with the active culture name and the relevant item identifier. For example, a pattern like `assets/{culture}/pet/dress{id}.png` becomes `assets/amazigh/pet/dress2.png` when the Amazigh culture is active and dress number 2 is selected. Text templates work the same way — placeholders like `{petName}` and `{foodName}` are replaced with culture-specific values.

To avoid visible loading delays during gameplay, all the images needed for the selected culture are preloaded during initialisation. The system collects every asset path that could be needed — all pet images, all button icons, all dress variants — and loads them in the background before the experience begins.

### Firebase and Hardware

The application connects to a Firebase Realtime Database, which serves as the communication bridge between the web app and external physical devices.

In one direction, the app **listens** for culture changes. When an external device (such as a physical selector at the installation) writes a new culture name to the database, the app detects the change, fully resets itself, and restarts the experience for that culture. This is the application's entry point — everything begins from this listener.

In the other direction, the app **writes** trigger signals to the database at key moments: when the user makes a wrong choice, when the ritual begins, when the guardian says goodbye. A connected Arduino reads these signals and produces physical feedback — vibrations, light effects, or other sensory responses that make the experience more immersive.

---

## The State Machine

The application's behaviour is governed by a central state machine. At any given moment, the app is in one of five phases, and it moves through them in a strict linear order:

**Black screen → Waiting for click → Intro sequence → Gameplay → Ending sequence**

### Black Screen

The app starts with a completely black screen. The guardian is "asleep". To wake it, the user must shake the device (the app reads the device's accelerometer) or, for testing, press the S key. If the experience has already been completed once and the user is returning from a timeout, the shake takes them straight back into gameplay instead of replaying the introduction.

### Waiting for Click

After waking, a static image is displayed — the guardian in its dormant state. A single tap anywhere on the screen starts the introduction.

### Intro Sequence

This is an automated, timed sequence of four steps. First, the static image fades out. Then a brief instructional animation shows the user how to interact (tapping on clouds). Next, a wave animation plays while the guardian's welcome message appears: "Hello! Thank you for adopting me!" Finally, the guardian introduces itself by name and culture. Each step lasts about three seconds. The whole sequence includes a safety mechanism: if a new culture is selected mid-sequence (from the physical selector), the current sequence is aborted and a new one begins cleanly.

### Gameplay

This is the main interactive phase, described in detail below.

### Ending Sequence

After all activities are completed, the app enters a multi-step ending. First, a special bouncing button appears. When tapped, the guardian zooms in and two culture-specific narrative messages are shown, each for five seconds. These are emotionally heavy — they explain in the guardian's own words why it entered cryoconservation (referencing real-world events like the banning of languages or the destruction of sacred sites). After the messages, a farewell animation plays, the hardware is triggered one last time, and the screen transitions to a QR code that links to further content. The QR code has four variants depending on whether the user viewed a particular memory and whether they undressed the guardian during gameplay.

---

## Gameplay

Gameplay is structured around three pages and three activities, completed in a fixed order. The user cannot skip ahead — each activity must be finished before the next one becomes available.

### Pages

The app has three pages. The first is the home page, which shows just the guardian. The second is the food page, where ingredient buttons appear. The third is the dress page, where outfit buttons appear. The user does not navigate between pages manually — instead, when an activity is ready, a cloud-shaped button appears at the top of the screen. Tapping it takes the user to the correct page automatically.

The original design included left/right navigation arrows and swipe gestures, and the underlying code for these still exists, but they are currently disabled. All navigation happens through the cloud buttons.

### Gating and Cloud Buttons

The cloud button system controls the flow of the experience. At any given time, the app determines what the next logical step is: food, dress, ritual, or a memory to view. It then shows the appropriate cloud on the current page. Clouds appear with a short delay (either a fixed three seconds for the first interaction or a random one-to-three seconds for subsequent ones) and are accompanied by a sound effect.

Importantly, clouds only appear after the previous milestone has been acknowledged. The food cloud only appears after the user has viewed the home memory. The dress cloud only appears after the food memory. This ensures the user cannot rush through without engaging with the narrative content.

### Act 1 — Food

Three ingredient buttons are arranged in a curved arc at the bottom of the screen. The user must drag each one to the center (onto the bowl) in the correct order, which varies by culture. If the order is wrong, the device vibrates and the ingredient snaps back to its original position.

Once all three ingredients are placed correctly, a cooking animation plays for about four seconds while a "Cooking..." message appears. After the animation, the name and description of the traditional dish are displayed, and after a short pause, the bowl fills with the prepared food.

From here, the user clicks through a feeding sequence: the bowl shakes slightly as the guardian eats, then the bowl moves toward the user as the guardian shares the food, and finally the guardian does a small jump animation to express happiness. This whole feeding sequence involves several internal states (ready to eat → eating → sharing → done) that control the bowl's animation and appearance.

Once the food activity is complete, the food memory cloud appears.

### Act 2 — Dress

Three outfit buttons appear in the same arc layout. The user drags one onto the guardian, and the guardian's image changes to show that outfit. Any outfit can be placed, but only one is the correct ceremonial dress for the upcoming ritual. Wrong choices trigger the hardware feedback.

There is also an undress mechanic: if the user taps on the center of the guardian while it is wearing an outfit, a reverse drag begins. If the user drags the outfit far enough from the center, the guardian is undressed. This resets the dress and ritual progress and is tracked as a flag that affects the ending QR code variant.

Once the correct dress is selected, the ritual cloud appears.

### Act 3 — Ritual

The ritual does not have its own page — it is triggered by a cloud button that can appear on any page. When tapped, the app navigates to the dress page (if not already there) and plays a culture-specific ritual animation with accompanying music. The music file is unique to each culture. After the animation finishes (about four seconds), the audio is stopped and the dress memory cloud appears.

### Progress Bar

A visual progress bar at the top of the screen tracks completion of the three activities. Each time an activity is finished, the bar advances one step with a brief animation and a sound effect. The bar is only visible during gameplay and is hidden during the intro and ending sequences.

### Memories

Memories are reward images unlocked at three milestones: after entering gameplay (home memory), after completing the food activity (food memory), and after the ritual (dress memory). Each appears as a cloud button. When tapped, a full-screen overlay opens with a brief opening animation followed by the actual memory image. Tapping anywhere closes the overlay and marks that memory as viewed.

Viewing the final memory (on the dress page, after the ritual) is what triggers the ending sequence.

---

## Interaction System

The application uses a drag-and-drop system for the food and dress interactions. When the user touches a button and starts dragging, the button is visually detached from its position and follows the user's finger across the screen. If the user releases it close enough to the center of the screen (within a threshold distance), the drop is considered successful and the corresponding game action fires. If the drop is too far from center, or if the action is rejected (wrong ingredient order), the button animates smoothly back to its original position.

The drag system supports both pointer events (for desktop and modern mobile) and touch events (specifically for compatibility with older iOS versions). A global flag prevents multiple buttons from being dragged simultaneously.

All interactive buttons play a click sound when pressed, and dragging plays a swipe sound at the start. These audio cues, combined with the hardware vibrations, create a multi-sensory feedback loop that makes the interactions feel responsive and tangible.

---

## Sound Design

The application uses eight distinct sound effects, seven of which are pre-loaded when the app starts:

- A **click** sound for general button interactions
- An **info** sound when opening the information panel
- A **bowl** sound for each step of the feeding sequence
- A **trust** sound when the progress bar advances
- A **memory opening** sound when a memory cloud is tapped
- A **bubble** sound when any cloud button appears on screen
- A **swipe** sound when a drag interaction begins
- A **ritual** sound that is loaded dynamically based on the active culture, playing traditional music during the ritual animation

The ritual sound is the only one created on the fly rather than pre-loaded, because it changes depending on which culture is active. It is explicitly stopped when the ritual animation ends to prevent audio from bleeding into subsequent interactions.

---

## Design Principles

**Sequential gating** ensures the user cannot skip content. Each activity and each memory must be completed and acknowledged before the next becomes available.

**Physical gestures** — shaking, dragging, tapping — make every interaction feel like an act of care rather than a menu selection.

**Cultural specificity** is baked into the architecture. Nothing is hardcoded for a particular culture. The entire system is driven by configuration files and templated asset paths, so adding a new culture means providing new images, audio, and a configuration entry — no code changes required.

**Emotional pacing** structures the experience as a narrative arc. Light, playful interactions (cooking, dressing) come first. The heavier content (why the culture was endangered) is only revealed at the end, after trust has been established through play.
