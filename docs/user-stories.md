# User Story Backlog: Siftarr

This backlog lists the user stories and acceptance criteria required to build Siftarr. The backlog is divided into Epics representing core modules of the application.

---

## Epic 1: Global Navigation & Media Picker

### User Story 1.1: Multi-Tab Layout
*   **As a** user,
*   **I want to** navigate between Discovery, Management, Deletion Queue, and Settings tabs,
*   **So that** I can easily access all functions of the application in a single view.
*   **Acceptance Criteria**:
    *   Responsive, glowing tab bar visible on both desktop and mobile layouts.
    *   Active tab is visually highlighted.
    *   State is preserved where appropriate when switching tabs (e.g., current settings form input or deletion queue selections).

### User Story 1.2: Overall Library Picker
*   **As a** user,
*   **I want** a global selector to switch between Movies and TV Shows,
*   **So that** all discovery feeds, management lists, queue items, and settings are filtered to my active media context.
*   **Acceptance Criteria**:
    *   Rendered as a slide-selected segmented button or dropdown in the header.
    *   Switching to "Movies" shifts active endpoints to Radarr/TMDB Movies.
    *   Switching to "TV Shows" shifts active endpoints to Sonarr/TMDB TV.
    *   The selector immediately updates the card deck of the active tab without requiring a page refresh.

---

## Epic 2: Discovery Feed & Swiping

### User Story 2.1: Recommendation-Curation Card Stack
*   **As a** user,
*   **I want** a stack of cards representing movies or TV shows not currently in my library,
*   **So that** I can explore new media to add.
*   **Acceptance Criteria**:
    *   Shows cover poster, title, year, rating, and genres.
    *   Items already existing in Radarr/Sonarr are automatically omitted.
    *   Items previously skipped (Left-swiped) are omitted.
    *   Feed is sorted by local recommendation taste weights (highest match first).

### User Story 2.2: Swiping Right to Add Media (Like)
*   **As a** user,
*   **I want to** swipe right (or tap a "Like" button) on a card,
*   **So that** it gets added to my Radarr or Sonarr download queue using my default configuration.
*   **Acceptance Criteria**:
    *   Visual badge overlay "LIKE" appears and increases opacity as the card is dragged right.
    *   Triggers backend API call to add the movie or TV show to Radarr/Sonarr.
    *   Adds +1.0 weight to the item's genres and creators in the local taste profile.

### User Story 2.3: Swiping Left to Skip (Dislike)
*   **As a** user,
*   **I want to** swipe left (or tap "Skip") on a card,
*   **So that** it is bypassed and never shown to me again.
*   **Acceptance Criteria**:
    *   Visual badge overlay "SKIP" appears as the card is dragged left.
    *   Logs the TMDB ID and media type into the `skipped_items` database table.
    *   Applies a -0.5 weight to corresponding genres and creators.

### User Story 2.5: Keyboard Curation (Discovery Mode)
*   **As a** desktop user,
*   **I want to** control swiping actions using my keyboard,
*   **So that** I can rapidly curate media without using touch or mouse drag gestures.
*   **Acceptance Criteria**:
    *   Pressing `Right Arrow` or `D` triggers "Like" (Swipe Right).
    *   Pressing `Left Arrow` or `A` triggers "Skip" (Swipe Left).
    *   Pressing `Up Arrow` or `W` triggers "God Tier" (Swipe Up).
    *   Triggers card tilt-and-fly animations in the corresponding direction.

---

## Epic 3: Library Curation (Management Mode)

### User Story 3.1: Library Curation Feed
*   **As a** user,
*   **I want to** browse a stack of cards representing my existing media library,
*   **So that** I can inspect files and decide to upgrade, downgrade, or delete them.
*   **Acceptance Criteria**:
    *   Renders existing Radarr movies or Sonarr TV series.
    *   Shows a badge overlay indicating file details:
        *   Movies: resolution, folder size, dominant source (e.g. REMUX, Bluray, WEBDL, HDTV), and TRaSH Guides Custom Format Tags (e.g. x265, HEVC, Atmos, HDR10, DV).
        *   TV Shows: number of episodes downloaded vs. total episodes, total folder size, dominant source, and current quality profile.
        *   Displays the active Custom Format Score calculated by Radarr/Sonarr to easily verify TRaSH Guides alignment.

### User Story 3.2: Upgrading and Downgrading Quality via Swiping
*   **As a** user,
*   **I want to** swipe a library card standard (Left) or good (Right),
*   **So that** I can either downgrade/keep the file to save disk space or upgrade it to a higher resolution.
*   **Acceptance Criteria**:
    *   Swipe Left (Downgrade/Keep) changes the quality profile to a lower-tier profile (e.g. from REMUX to WEBDL) to save space, and triggers a search (or keeps standard).
    *   Swipe Right (Upgrade) changes the profile to a higher-tier profile (e.g. from WEBDL to Bluray/REMUX) and triggers an automatic search.
    *   Swipe Up (God Tier Upgrade) upgrades the profile directly to the premium/highest Remux profile and triggers search.
    *   Triggers search commands in Radarr (`MoviesSearch`) or Sonarr (`SeriesSearch`).

### User Story 3.3: Swiping Down to Queue for Deletion
*   **As a** user,
*   **I want to** swipe down on a library card,
*   **So that** the item is added to the Deletion Review Queue instead of being deleted instantly.
*   **Acceptance Criteria**:
    *   Visual badge overlay "DELETE" appears on downward drag.
    *   The item is stored in the local `deletion_queue` table.
    *   The card is removed from the active Management stack.

### User Story 3.4: Keyboard Curation (Management Mode)
*   **As a** desktop user,
*   **I want to** trigger library curation swipes using my keyboard,
*   **So that** I can manage my existing collection with high speed.
*   **Acceptance Criteria**:
    *   Pressing `Right Arrow` or `D` triggers "Upgrade" quality action.
    *   Pressing `Left Arrow` or `A` triggers "Downgrade/Keep" quality action.
    *   Pressing `Up Arrow` or `W` triggers "God Tier Upgrade" quality action.
    *   Pressing `Down Arrow` or `S` triggers "Queue for Deletion" (Swipe Down).
    *   Triggers the same card animation physics as the respective drag gesture.

---

## Epic 4: Deletion Safety Queue

### User Story 4.1: Queue Table Interface
*   **As a** user,
*   **I want** to see a list of all items queued for deletion with metadata,
*   **So that** I can verify what is going to be deleted before executing it.
*   **Acceptance Criteria**:
    *   Lists titles, years, media types, disk space occupied, and folder paths.
    *   Displays a total reclaimed disk space calculation at the top.

### User Story 4.2: Confirming and Cancelling Deletions
*   **As a** user,
*   **I want** options to confirm deletion or keep items in my library,
*   **So that** I can resolve the list safely.
*   **Acceptance Criteria**:
    *   "Keep" button removes the item from the queue and restores it to the pool.
    *   "Delete" button calls the Radarr/Sonarr API with `deleteFiles=true`, then deletes the database entry.
    *   "Confirm All" button performs deletions in batch with status bars.

---

## Epic 5: System Settings

### User Story 5.1: API Integrations Setup
*   **As a** user,
*   **I want to** enter my Radarr, Sonarr, and TMDB credentials,
*   **So that** Siftarr can connect to my self-hosted services.
*   **Acceptance Criteria**:
    *   Fields: Radarr URL/Key, Sonarr URL/Key, TMDB API Key.
    *   "Test Connection" buttons verify validity and retrieve dynamic Quality Profiles.
    *   Settings are read/written to a standard configuration file (`config.yml`).

### User Story 5.2: Profile Mappings Selection
*   **As a** user,
*   **I want to** map Siftarr's actions (Standard, Really Good, God Tier) to actual Quality Profiles,
*   **So that** swipes trigger the correct settings on my servers.
*   **Acceptance Criteria**:
    *   Dropdown pickers populated dynamically from Radarr/Sonarr APIs.
    *   Separate profile mapping configurations for Movies and TV Shows.
    *   Easily maps to custom profiles synchronized by Recyclarr.
