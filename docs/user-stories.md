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

### User Story 1.2: Dynamic Library Picker Dropdown
*   **As a** user with multiple libraries (e.g. Movies, Kids Movies, Documentaries, TV Shows),
*   **I want** a dropdown selector in the header to switch between my configured libraries,
*   **So that** I can curate separate collections independently.
*   **Acceptance Criteria**:
    *   Renders as a glassmorphic dropdown listing all active Library Profiles.
    *   If only a single Library Profile is configured, the dropdown displays as a static, non-interactive badge.
    *   Selecting a profile (e.g. "Kids Movies") filters card feeds to its specific media type and root folder path.
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
        *   Movies: resolution, folder size, dominant source (e.g. REMUX, BluRay, WEBDL, HDTV), and TRaSH Guides Custom Format Tags (e.g. x265, HEVC, Atmos, HDR10, DV).
        *   TV Shows: number of episodes downloaded vs. total episodes, total folder size, dominant source, and current quality profile.
        *   Displays the active Custom Format Score calculated by Radarr/Sonarr to easily verify TRaSH Guides alignment.

### User Story 3.2: Mapping Quality via Swiping
*   **As a** user,
*   **I want to** swipe a library card standard WebDL (Left), BluRay (Right), or Remux (Up),
*   **So that** Siftarr updates the quality profile (which has custom format cutoff scores configured via Recyclarr or manually) in Radarr/Sonarr and triggers an automatic search.
*   **Acceptance Criteria**:
    *   Swipe Left (WebDL) maps the item to the WebDL quality profile (saving space if it was a larger BluRay/REMUX) and triggers search.
    *   Swipe Right (BluRay) maps the profile to the BluRay quality profile and triggers search.
    *   Swipe Up (Remux) upgrades the profile directly to the premium/highest Remux profile and triggers search.
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
    *   Pressing `Right Arrow` or `D` triggers "BluRay" quality profile mapping.
    *   Pressing `Left Arrow` or `A` triggers "WebDL" quality profile mapping.
    *   Pressing `Up Arrow` or `W` triggers "Remux" quality profile mapping.
    *   Pressing `Down Arrow` or `S` triggers "Queue for Deletion" (Swipe Down).
    *   Triggers the same card animation physics as the respective drag gesture.

### User Story 3.5: Tautulli Curation Metrics on Card
*   **As a** user,
*   **I want to** see how many times and how recently a movie or TV show has been watched in my Plex library via Tautulli,
*   **So that** I can make informed decisions to delete unused media, keep popular media, or upgrade active content.
*   **Acceptance Criteria**:
    *   Cards in Management Mode display play counts, last played timestamps, and watch time when Tautulli is enabled.
    *   If an item has 0 plays and was added more than 30 days ago, a desaturated red warning indicator highlights it.
    *   If Tautulli is not configured or disabled, the metrics overlay is hidden gracefully, and the card layout collapses nicely without any empty space.

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

### User Story 5.3: Tautulli Integration Configuration
*   **As a** user,
*   **I want to** enter my Tautulli URL and API Key in the Settings tab,
*   **So that** Siftarr can fetch and display Plex watch statistics for my media.
*   **Acceptance Criteria**:
    *   Tautulli URL and API Key input fields exist in Settings.
    *   A toggle switch allows enabling/disabling the Tautulli integration.
    *   A "Test Connection" button performs a handshake with Tautulli and shows a visual validation response.

### User Story 5.4: Independent *arr Instance Configuration
*   **As a** user,
*   **I want to** configure only Radarr or only Sonarr in Settings,
*   **So that** I can use Siftarr for just movies or just TV shows without configuring both.
*   **Acceptance Criteria**:
    *   Saving settings succeeds even if one of the URL/API Key pairs for Radarr or Sonarr is omitted or cleared.
    *   The unconfigured service's tabs/features are disabled in the UI.
    *   The header picker hides or locks to the single active service.
    *   The backend runs normally and does not crash or log constant connection errors for the missing service.

### User Story 5.5: Managing Custom Library Profiles
*   **As a** user,
*   **I want to** add, edit, toggle, or delete library profiles in my Settings,
*   **So that** I can customize Siftarr's library segments and map them to Plex/Tautulli and *arr subdirectories.
*   **Acceptance Criteria**:
    *   A "Library Profiles Manager" section is visible in the Settings tab.
    *   An "Add Library" button opens a modal allowing input of Name, Media Type (Movies/TV), Root Folder Path, and Tautulli Section ID.
    *   Fields like Root Folder Path and Tautulli Section ID display dropdowns populated dynamically from active service API queries.
    *   Users can toggle a library profile off/on (inactive profiles are hidden from the header picker).
    *   Profiles can be reordered by dragging, and deleted by clicking a delete icon.
