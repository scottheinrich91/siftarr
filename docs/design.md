# Design Specifications: Siftarr

This document establishes the UI/UX design specifications, visual styles, and page layouts for Siftarr. The design uses premium glassmorphic elements, smooth physics, and clear visual feedback.

---

## 1. Global Visual Tokens

### 1.1. Color System & OLED Fatigue Prevention
To prevent visual fatigue or "halation" (glowing text bleed) caused by high-contrast neon elements floating over absolute black, Siftarr uses a layered background gradient and dynamic elevation states.
*   **Base Canvas Background**: Deep radial gradient: `radial-gradient(circle at center, #0e0720 0%, #000000 100%)`. This maintains a very dark, violet-tinted center to showcase glassmorphism blurs while fading into pure OLED black `#000000` at the screen edges for energy efficiency.
*   **Card Fill / Panels**: Soft translucent dark glass `rgba(15, 15, 15, 0.75)` (Default) with `backdrop-filter: blur(24px)`.
*   **Tactile Active Elevation**: When a card is active, dragged, or focused, its background slightly elevates to `rgba(25, 25, 25, 0.85)` with a white border highlight `1px solid rgba(255, 255, 255, 0.12)`, easing visual strain and halation.
*   **Proportional Drag Glows**: Border glows and neon accents scale intensity and opacity **proportionally to the swipe/drag distance** (0% to 100% glow spread based on drag coordinates) to provide subtle physics-based feedback before flinging:
    *   **Swipe Right / Primary Upgrades**: Neon Green `#00e676` (max glow: `0 0 20px rgba(0, 230, 118, 0.5)`).
    *   **Swipe Left / Primary Downgrades**: Electric Blue `#00b0ff` (max glow: `0 0 20px rgba(0, 176, 255, 0.5)`).
    *   **Swipe Up / God Tier Upgrades**: Neon Gold `#ffd600` (max glow: `0 0 20px rgba(255, 214, 0, 0.5)`).
    *   **Active Selection Accent**: Royal Violet `#7c4dff` (max glow: `0 0 20px rgba(124, 77, 255, 0.5)`).

### 1.2. Typography & Glassmorphism
*   **Fonts**: 'Outfit' for headers and status tags (bold, modern) and 'Inter' for UI labels and metadata.
*   **Glass Panel Effects**:
    *   `backdrop-filter: blur(16px) saturate(130%)`
    *   `box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5)`

---

## 2. Component Specifications & Layouts

### 2.1. Card Stack Component
The card feed is optimized for gesture swiping and desktop hotkeys.
*   **Card Info Overlay**: Shows Cover Art, Title, Year, File Size, Resolution, Source format, and TRaSH custom format tags (e.g. `DV`, `HDR10`, `Atmos`). 
*   **Series Scope Safety Warning (Sonarr Mode)**: TV show cards show a desaturated yellow safety badge at the top: `⚠️ Affects Series: X Seasons, Y Episodes` to prevent accidental bulk updates.
*   **Swipe/Hotkey Curation**: Curation actions are triggered using swipe gestures (Left/Right/Up/Down) or keyboard hotkeys. There are no curation action buttons below the card stack.
*   **Deletion Queueing**: Swipe Down stages the active item for deletion. There is no added friction (long-press, double-tap) needed for deletion gestures since files are merely routed to a Deletion Queue for subsequent review.

### 2.2. Safety Undo Toast Banner
If the 7-second undo buffer is enabled in Settings > General (disabled by default), triggering a curation action displays a toast emerging from the bottom of the viewport:
*   **Layout**: A horizontal floating banner styled with a thin, glowing border matching the action color.
*   **Toast Nav Offset**: Positioned with `bottom: calc(88px + env(safe-area-inset-bottom))` to clear the bottom navigation bar and avoid overlapping elements.
*   **Countdown Indicator**: Displays text (e.g., `Profile changed... 7s`) with a circular, shrinking SVG countdown ring.
*   **Action Button**: A prominent glassmorphic `[ UNDO ]` button. Clicking this triggers the undo scheduler and returns the card to the stack immediately.
If the undo buffer is disabled, actions are executed immediately without showing this toast.

### 2.3. Desktop Hotkey Isolation
To support rapid keyboard navigation without accidental triggers:
*   **Hotkey Events**: `A`/`Left Arrow` (Swipe Left Profile), `D`/`Right Arrow` (Swipe Right Profile), `W`/`Up Arrow` (Swipe Up Profile), `Spacebar`/`K` (Keep/Skip), `U` (Unmonitor).
*   **Input Isolation**: Event listeners intercept and ignore hotkey bindings when document focus is inside any text fields (`<input>`, `<textarea>`), dropdown selectors, or settings dialog modals.

### 2.4. Dashboard Filtering, Sorting, and Progress Controls
*   **Library Selector Dropdown**: Top bar picker to switch active library profiles (e.g., Movies, Kids Movies, TV Shows).
*   **Curation Progress Bar**: A thin, glowing glassmorphic progress bar below the library picker showing reviewed status (e.g., `45 / 120 completed`) with session streak stats.
*   **Sort / Filter Bar**: Below the progress bar, a collapsible filter drawer containing:
    *   **Sort Dropdown**: Sort stack by Disk Size (Largest first), Tautulli Plays (Least played first), Custom Format Score, or Date Added.
    *   **Filter Toggles**: Filter by missing Tautulli data, low custom format scores, or specific folders.

### 2.5. Settings Layout & Profiles Manager
*   **Settings Fields**: Input fields for Radarr, Sonarr, TMDB, and Tautulli credentials, and API connection status checkers.
*   **Profile Mapping Panel**:
    *   Dropdown fields mapping Left Swipe, Right Swipe, and Up Swipe actions to fetched quality profiles dynamically.
*   **Library Profiles Manager**:
    *   List of configured library segments (e.g. "Movies", "Kids Movies") with reordering drag handles.
    *   "Add Library" modal features type selector (Movies/TV), root folder path dropdown, and Tautulli Plex section dropdown.
