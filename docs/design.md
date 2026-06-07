# Design Specifications: Siftarr

This document establishes the UI/UX design specifications, colors, and page layouts for Siftarr. These rules define the look and feel, glassmorphic layout properties, and swipe gestures to generate the design system.

---

## 1. Global Visual Tokens

### 1.1. Color System
*   **Base Background**: Pitch black `#020203` to dark charcoal `#0a0b0d`.
*   **Card Fill**: Semi-transparent charcoal `rgba(20, 22, 29, 0.65)`.
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
*   **Container**: Vertical stack centered in the viewport.
*   **Media Card**:
    *   Aspect ratio: `350px` width by `500px` height.
    *   Poster image: Fills the entire background of the card.
    *   **Glass Detail Panel (Bottom)**: Layered on top of the poster containing:
        *   Media Title & Release Year.
        *   Metadata tags (Genre badges, Rating, Runtime).
        *   *Management Status overlays*: Displays active resolution (e.g., `2160p Remux`), size (e.g., `45.8 GB`), or TV episode download progress bar.
    *   **Swipe Overlay Badges**: Text overlays centered on the card that fade in relative to drag direction and offset distance:
        *   Dragging Right: "LIKE" (Neon Green) or "REALLY GOOD" (Royal Violet)
        *   Dragging Left: "SKIP" (Slate) or "STANDARD" (Electric Blue)
        *   Dragging Up: "GOD TIER" (Neon Gold)
        *   Dragging Down: "DELETE" (Crimson Red)

### 2.3. Deletion Safety Queue Layout
*   **Header Stats**: Displays total count of items and estimated reclaimed disk space (e.g., "Total Space Reclaimed: 154.2 GB") in neon red.
*   **Queue Table**: Rows with glassmorphic background:
    *   Cover Thumbnail.
    *   Title, Year, Media Type, Folder Size, and Path.
    *   Action Buttons: "Keep" (neutral slate) and "Delete" (crimson outline).
*   **Action Bar**: "Cancel All" and "Confirm All Deletions" (glowing solid red button).

### 2.4. Settings Layout
*   **API Configuration Form**: Input fields for Radarr, Sonarr, and TMDB credentials with individual "Test Connection" indicators.
*   **Profile Mapping Section**:
    *   Movies (Radarr) column and TV Shows (Sonarr) column.
    *   Action mapping dropdowns (Standard, Really Good, God Tier) linked to fetched quality profiles.
    *   Default profiles configuration for new items.
