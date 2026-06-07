# Design Specifications: Siftarr

This document establishes the UI/UX design specifications, colors, and page layouts for Siftarr. These rules define the look and feel, glassmorphic layout properties, and swipe gestures to generate the design system.

---

## 1. Global Visual Tokens

### 1.1. Color System
*   **Base Background**: True OLED Black `#000000` (pure black).
*   **Card Fill**: Semi-transparent charcoal `rgba(10, 10, 10, 0.6)`.
*   **Borders**: Soft translucent white border `1px solid rgba(255, 255, 255, 0.08)`.
*   **Neon Highlight Accents**:
    *   **Like / Right Swipe**: Neon Green `#00e676` (shadow: `0 0 12px rgba(0, 230, 118, 0.4)`).
    *   **Skip / Left Swipe**: Soft Slate `#475569`.
    *   **God Tier / Up Swipe**: Neon Gold `#ffd600` (shadow: `0 0 12px rgba(255, 214, 0, 0.4)`).
    *   **Delete / Down Swipe**: Crimson Red `#ff1744` (shadow: `0 0 12px rgba(255, 23, 68, 0.4)`).
    *   **Standard Quality**: Electric Blue `#00b0ff` (shadow: `0 0 12px rgba(0, 176, 255, 0.4)`).
    *   **Really Good Quality**: Royal Violet `#d500f9` (shadow: `0 0 12px rgba(213, 0, 249, 0.4)`).

### 1.2. Typography & Glassmorphism
*   **Fonts**: 'Outfit' for headers (bold, futuristic) and 'Inter' for UI labels and metadata.
*   **Glass Panel Effects**:
    *   `backdrop-filter: blur(12px) saturate(140%)`
    *   `box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37)`

---

## 2. Page Layout & Component Specifications

### 2.0. Mobile-First Layout
*   **Viewport Wrapper**: Siftarr is designed primarily as a mobile application. On desktop screens, the app is rendered inside a centered mobile viewport container (`max-width: 480px; height: 100vh; border-left: 1px solid rgba(255, 255, 255, 0.08); border-right: 1px solid rgba(255, 255, 255, 0.08);`).
*   **Touch Gestures**: Full mobile touch gesture support (drag to swipe) with tactile vibrations and spring-back mechanics.

### 2.1. Header & Navigation Component
*   **Logo/Title**: "SIFTARR" styled with text-shadow neon green glow.
*   **Global Library Picker**:
    *   Segmented selector: "Movies" vs. "TV Shows".
    *   Has a smooth background sliding transition to highlight the selected library context.
*   **Navigation Tabs**: Text links for:
    *   **Discovery**: Active by default.
    *   **Management**: For library curation.
    *   **Deletion Queue**: Displays a circular red counter badge showing item count.
    *   **Settings**: To configure URLs and API keys.

### 2.2. Card Stack Component (Discovery & Management Feed)
*   **Container**: Vertical stack centered in the mobile viewport.
*   **Media Card**:
    *   Aspect ratio: Fits neatly inside the mobile wrapper (typically `340px` width by `480px` height).
    *   Poster image: Fills the entire background of the card.
    *   **Glass Detail Panel (Bottom)**: Layered on top of the poster containing:
        *   Media Title & Release Year.
        *   Metadata tags (Genre badges, Rating, Runtime).
        *   *Management Status overlays*: Displays active quality details: Resolution (e.g., `2160p`), Folder Size (e.g., `45.8 GB`), and Source (e.g., `REMUX`, `Bluray`, `WEBDL`, `HDTV`).
    *   **Swipe Overlay Badges**: Text overlays centered on the card that fade in relative to drag direction and offset distance:
        *   Discovery Mode: Dragging Right is "LIKE" (Neon Green), Dragging Left is "SKIP" (Slate), Dragging Up is "GOD TIER" (Gold).
        *   Management Mode: Dragging Right is "UPGRADE" (Royal Violet), Dragging Left is "DOWNGRADE" (Electric Blue), Dragging Up is "GOD TIER" (Gold), Dragging Down is "DELETE" (Crimson Red).

### 2.3. Keyboard Controls (Desktop Mode)
To support high-speed curation on desktop viewports, Siftarr intercepts keydown events on the card stack:
*   **Swipe Right / Like (Discovery) / Upgrade (Management)**: `Right Arrow` or `D` key.
*   **Swipe Left / Skip (Discovery) / Downgrade (Management)**: `Left Arrow` or `A` key.
*   **Swipe Up / Super Like (Discovery) / God Tier Upgrade (Management)**: `Up Arrow` or `W` key.
*   **Swipe Down / Delete (Management only)**: `Down Arrow` or `S` key.
*   *Keypress Feedback*: Pressing a key triggers a visual card animation (tilting and flying off-screen in the corresponding direction) mimicking the mouse/touch swipe gesture.

### 2.4. Deletion Safety Queue Layout
*   **Header Stats**: Displays total count of items and estimated reclaimed disk space (e.g., "Total Space Reclaimed: 154.2 GB") in neon red.
*   **Queue Table**: Rows with glassmorphic background:
    *   Cover Thumbnail.
    *   Title, Year, Media Type, Folder Size, and Path.
    *   Action Buttons: "Keep" (neutral slate) and "Delete" (crimson outline).
*   **Action Bar**: "Cancel All" and "Confirm All Deletions" (glowing solid red button).

### 2.5. Settings Layout
*   **API Configuration Form**: Input fields for Radarr, Sonarr, and TMDB credentials with individual "Test Connection" indicators.
*   **Profile Mapping Section**:
    *   Movies (Radarr) column and TV Shows (Sonarr) column.
    *   Action mapping dropdowns (Standard, Really Good, God Tier) linked to fetched quality profiles.
    *   Default profiles configuration for new items.
