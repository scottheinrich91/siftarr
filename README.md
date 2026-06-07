# Siftarr 🎬📱

Siftarr is a gamified, self-hosted web application for the **\*arr suite** (Radarr and Sonarr). It brings a Tinder-style swipe interface to media management, solving the problem of tedious library curation and discovery. 

With Siftarr, you can quickly upgrade your library quality, prune unwanted content, and discover new movies or TV shows that adapt to your taste over time.

---

## ✨ Features

*   **Tinder-Style Discovery**: Swipe right to add media to your download client, swipe left to skip and ignore forever, and swipe up to add at maximum quality.
*   **Active Curation (Management Mode)**: Swipe through your existing library to upgrade quality (standard/good/god-tier) or queue items for deletion.
*   **Dual-Library Support**: Built-in global **Library Picker** to switch seamlessly between Movie (Radarr) and TV Show (Sonarr) curation.
*   **TRaSH Guides & Custom Formats**: Displays dynamic tags (HEVC/x265, Atmos, Dolby Vision, HDR10+) and calculations for active Custom Format Scores, ensuring your upgrades match community quality recommendations.
*   **High-Speed Curation (Keyboard Controls)**: Full keyboard hotkey support (`W`/`A`/`S`/`D` or `Arrow Keys`) for lightning-fast swiping on desktop screens.
*   **Deletion Safety Queue**: Protects against accidental deletions. Swipe-to-delete items are held in a staging queue for final review and bulk execution.

---

## 🎨 Visual Identity: Apple-Glass & OLED Black

Siftarr is styled as a premium, mobile-first visual experience:
*   **True OLED Black Background (`#000000`)**: Deepest contrast and energy-saving pixel-off states for mobile OLED displays.
*   **Apple-Glassmorphism**: UI components use high background blurs (`blur(24px)`), thin translucent borders (`0.5px solid`), rounded corners (`24px` / `16px`), and top-border highlights to simulate light-reflecting glass surfaces floating over the pitch-black canvas.
*   **Glowing Accents**: Glowing color-coded accents highlight your actions:
    *   🟢 **Green**: Like / Upgrades (Discovery)
    *   🔵 **Electric Blue**: Standard Quality upgrades
    *   🟣 **Royal Violet**: High Quality upgrades
    *   🟡 **Neon Gold**: God-Tier Quality (Super Like)
    *   🔴 **Crimson**: Deletion Queue

---

## 📂 Repository Directory Layout

*   **`docs/`**: Main specifications folder.
    *   [`prd.md`](docs/prd.md): Product Requirements Document and features overview.
    *   [`technical-specs.md`](docs/technical-specs.md): Architecture layer patterns, SQLite database schema migrations, dynamic Custom Format proxy handlers, and recommendation scoring formulas.
    *   [`user-stories.md`](docs/user-stories.md): Agile product backlog containing user stories and acceptance criteria.
    *   **`mockups/`**: Static design UI layouts.
        *   [`discovery-mobile.html`](docs/mockups/discovery-mobile.html): The interactive HTML mockup of the mobile-first Discovery swipe deck.
        *   [`siftarr-logo.svg`](docs/mockups/siftarr-logo.svg): Siftarr's glowing neon green brand logo.

---

## 🛠 Technical Stack (Planned)

*   **Frontend**: React, Vite, TypeScript, Vanilla CSS, Framer Motion (for physics-based swipe gestures).
*   **Backend**: Node.js, Express, TypeScript, structured Winston log rotation, YAML-based settings (`config.yml`).
*   **Database**: SQLite (`better-sqlite3` with an automated startup SQL migration engine).
*   **Containerization**: Docker multi-stage builds supporting PUID/PGID non-root privilege dropping.
