# Design Specifications: Siftarr

This document establishes the UI/UX design specifications, visual styles, and page layouts for Siftarr. The design uses premium glassmorphic elements, smooth physics, and clear visual feedback.

---

## 1. Global Visual Tokens

### 1.1. Color System & OLED Fatigue Prevention
To prevent visual fatigue caused by extreme high-contrast pitch-black blocks, Siftarr uses layered dark glass panels.
*   **Base Canvas Background**: Deep charcoal black `#0a0a0a`.
*   **Card Fill / Panels**: Soft translucent dark glass `rgba(15, 15, 15, 0.7)`.
*   **Default Card Borders**: Muted translucent white border `1px solid rgba(255, 255, 255, 0.05)`.
*   **Dynamic Drag Glows**: Border glows and neon accents activate and scale intensity dynamically only when a card drag is active or a keyboard shortcut is triggered:
    *   **Like / Right Swipe / BluRay**: Neon Green `#00e676` (active glow: `0 0 16px rgba(0, 230, 118, 0.4)`).
    *   **Skip / Left Swipe / WebDL**: Electric Blue `#00b0ff` (active glow: `0 0 16px rgba(0, 176, 255, 0.4)`).
    *   **God Tier / Up Swipe / Remux**: Neon Gold `#ffd600` (active glow: `0 0 16px rgba(255, 214, 0, 0.4)`).
    *   **Delete / Down Swipe**: Crimson Red `#ff1744` (active glow: `0 0 16px rgba(255, 23, 68, 0.4)`).

### 1.2. Typography & Glassmorphism
*   **Fonts**: 'Outfit' for headers and status tags (bold, modern) and 'Inter' for UI labels and metadata.
*   **Glass Panel Effects**:
    *   `backdrop-filter: blur(16px) saturate(130%)`
    *   `box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5)`

---

## 2. Component Specifications & Layouts

### 2.1. Card Stack Component & Tap Actions
The card feed is optimized for both gesture swiping and button tapping.
*   **Tap Buttons Layout**: Positioned directly underneath the card stack, Siftarr displays a horizontal row of five glassmorphic buttons for quick curation:
    *   **Electric Blue Button**: Label `WEBDL`, triggers Standard/WebDL downgrade.
    *   **Neon Green Button**: Label `BLURAY`, triggers BluRay upgrade.
    *   **Neon Gold Button**: Label `REMUX`, triggers Remux upgrade.
    *   **Crimson Red Button**: Icon `Trash`, triggers Deletion queue staging.
    *   **Slate Grey Button**: Icon `Check` (or label `SKIP`), advances the card with no profile changes.
*   **Dynamic Tag overlays**: Badges on the cards show file details (resolution, folder size, source format) and Tautulli watch stats (e.g. `▶ 12 plays`, `🕒 2d ago`). 
*   **Series Scope Safety warning (Sonarr Mode)**: TV show cards show a desaturated yellow safety badge at the top: `⚠️ Affects Series: X Seasons, Y Episodes` to prevent accidental bulk updates.

### 2.2. Safety Undo Toast Banner
When a curation action is triggered, a toast emerges from the bottom of the viewport:
*   **Layout**: A horizontal floating banner styled with a thin, glowing border matching the action color.
*   **Countdown Indicator**: Displays text (e.g., `Queued for deletion... 7s`) with a circular, shrinking SVG countdown ring.
*   **Action Button**: A prominent glassmorphic `[ UNDO ]` button. Clicking this triggers the undo scheduler and returns the card to the stack immediately.

### 2.3. Desktop Hotkey Isolation
To support rapid keyboard navigation without accidental triggers:
*   **Hotkey Events**: `A`/`Left Arrow` (WebDL), `D`/`Right Arrow` (BluRay), `W`/`Up Arrow` (Remux), `S`/`Down Arrow` (Delete), `Spacebar`/`K` (Keep/Skip).
*   **Input Isolation**: Event listeners intercept and ignore hotkey bindings when document focus is inside any text fields (`<input>`, `<textarea>`), dropdown selectors, or settings dialog modals.

### 2.4. Deletion Queue & Progress Indicators
*   **Queue Layout**: Rows display Cover Art, Title, Size, and Reclaimed Space stats.
*   **Serialized Progress Bar**: Confirming deletions displays a glassmorphic modal containing:
    *   A progress bar that fills dynamically.
    *   A status text string indicating current step (e.g., `Deleting "Inception" (4 of 12)...`).
    *   A cancel button that halts the sequential queue after the current active deletion finishes.

### 2.5. Settings Layout & Profiles Manager
*   **Settings Fields**: Input fields for Radarr, Sonarr, TMDB, and Tautulli credentials, accompanied by checkboxes for behavior flags:
    *   "Delete old file when upgrading" (checkbox)
    *   "Delete old file when downgrading" (checkbox)
*   **Library Profiles Manager**:
    *   Displays configured library segments (e.g. "Movies", "Kids Movies") in a list with reordering drag handles.
    *   "Add Library" modal features type selector (Movies/TV), root folder path dropdown, and Tautulli Plex section dropdown.
