# UI Design Specifications: Siftarr

This document establishes the design system, styling guidelines, and animation configurations for the Siftarr user interface. Siftarr uses a premium glassmorphic dark theme with vibrant neon highlights representing different swipe directions.

---

## 1. Visual Theme & Style Tokens

### 1.1. Color Palette

*   **Primary Background**: Deep, dark charcoal `#0a0b0d` to pitch black `#020203` (gradient recommended).
*   **Card Background**: Semitransparent slate `#14161d80` with a fine border `#ffffff10`.
*   **Text Colors**:
    *   Primary: White `#ffffff` (opacity `0.95` for body).
    *   Secondary: Soft gray `#94a3b8` (metadata, tags).
    *   Muted: Darker gray `#64748b` (labels, settings instructions).
*   **Action Glow Colors**:
    *   **Like / Swipe Right**: Neon Green (`#00e676` / `rgba(0, 230, 118, 0.2)` glow).
    *   **Dislike / Swipe Left**: Muted Slate (`#475569` / `rgba(71, 85, 105, 0.2)` glow).
    *   **God Tier / Swipe Up**: Neon Gold (`#ffd600` / `rgba(255, 214, 0, 0.25)` glow).
    *   **Delete / Swipe Down**: Crimson Red (`#ff1744` / `rgba(255, 23, 68, 0.25)` glow).
    *   **Standard Quality / Management Swipe Left**: Electric Blue (`#00b0ff` / `rgba(0, 176, 255, 0.2)` glow).
    *   **Really Good Quality / Management Swipe Right**: Royal Violet (`#d500f9` / `rgba(213, 0, 249, 0.2)` glow).

### 1.2. Glassmorphism Styling (CSS)
Apply the following rules for cards, header, and modals to look modern and integrated:
```css
.glass-panel {
  background: rgba(20, 22, 29, 0.65);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}
```

### 1.3. Typography
Use modern, geometric fonts loaded from Google Fonts (e.g. Outfit or Inter):
*   **Headers**: `font-family: 'Outfit', sans-serif; font-weight: 700;`
*   **Body & Buttons**: `font-family: 'Inter', sans-serif; font-weight: 400 | 500 | 600;`

---

## 2. Layout Structure & Components

```
+-------------------------------------------------------------+
|  SIFTARR  [Movies | TV Shows]    (Discovery) (Manage) (Settings)|
+-------------------------------------------------------------+
|                                                             |
|                         [ CARD FEED ]                       |
|                       +---------------+                     |
|                       |   GOD TIER    |                     |
|                       |  +---------+  |                     |
|                       |  |  POSTER |  |                     |
|                       |  |  IMAGE  |  |                     |
|                       |  +---------+  |                     |
|                       |               |                     |
|                       | Movie Title   |                     |
|                       | Year • Rating |                     |
|                       +---------------+                     |
|                                                             |
+-------------------------------------------------------------+
```

### 2.1. Global Header
*   **Application Title**: Neon logo glowing text (`text-shadow: 0 0 10px rgba(0, 230, 118, 0.5)`).
*   **Library Picker**: A stylized segment picker:
    *   Left side: "Movies" (uses Radarr database / TMDB Movies).
    *   Right side: "TV Shows" (uses Sonarr database / TMDB TV).
    *   A smooth sliding background highlight between selection changes.
*   **Navigation Tabs**: Discovery, Management, Deletion Queue (with numeric badge for item count), Settings.

### 2.2. Media Card Component
*   **Dimensions**: Standard mobile viewport width/height constraint (e.g. `width: 350px; height: 500px;` on desktop, scaled on mobile).
*   **Poster**: High-resolution image filling the card background, covered by a bottom gradient fade.
*   **Details Overlay (Bottom)**: Glassmorphic panel containing:
    *   Title and Release Year.
    *   Metadata tags (Genre, TMDB Rating, Duration).
    *   *Management Stats Badge*:
        *   **Movies**: Shows file size, container resolution (e.g. `1080p WebDL`), and bitrate.
        *   **TV Shows**: Shows progress bar of episodes acquired/total (e.g., `8/10 Eps`), total size, and current quality profile label.

---

## 3. Gestures & Animation Rules (Framer Motion)

Siftarr uses physical simulation for card swipes.

### 3.1. Motion Values & Physics Configuration
Cards track `x` and `y` drag offsets.
*   **Rotation**: Interpolated from `x` offset.
    *   `rotate = useTransform(x, [-200, 200], [-30, 30])`
*   **Swipe Threshold**: `150px` in any coordinate.
*   **Spring Physics Config**:
    ```javascript
    const transition = { type: "spring", stiffness: 300, damping: 20 };
    ```

### 3.2. Overlay Labels
Vibrant text badges centered on the card fade in based on drag coordinates:
*   **Drag Right**: "LIKE" / "REALLY GOOD" (Green/Violet)
*   **Drag Left**: "SKIP" / "STANDARD" (Gray/Blue)
*   **Drag Up**: "GOD TIER" (Gold)
*   **Drag Down**: "DELETE" (Red)
*   *Opacity Mapping*:
    *   `opacity = useTransform(Math.abs(offset), [0, 100], [0, 0.9])`
