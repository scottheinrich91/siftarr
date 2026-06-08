# User Story Backlog: Siftarr

This backlog organizes Siftarr's features and acceptance criteria into the three distinct execution phases of the roadmap.

---

## Phase 1: Core Curation Utility (Radarr & Tautulli MVP)

### Epic 1: Inbox Dashboard & Media Cards

#### User Story 1.1: Management Feed Card Stack
*   **As a** user,
*   **I want** a stack of cards representing movies in my Radarr library,
*   **So that** I can review their quality profiles and file details.
*   **Acceptance Criteria**:
    *   Cards show title, year, size, active resolution, source format, and Tautulli watch stats.
    *   Cards use soft dark glass panels (`rgba(15, 15, 15, 0.7)`) to prevent visual fatigue.
    *   Reordering and layout transitions are fluid.

#### User Story 1.2: Tautulli Stats Integration
*   **As a** user,
*   **I want to** see Plex play count and watch history details on movie cards,
*   **So that** I can easily spot unwatched content or high-usage items.
*   **Acceptance Criteria**:
    *   Displays play count (e.g. `▶ 12 plays`), last played time (e.g. `🕒 3 weeks ago`), and cumulative watch time.
    *   Plex icon is visible adjacent to the stats.
    *   Tautulli data is cached locally to ensure instant load times.

#### User Story 1.3: Curation Swipes
*   **As a** user,
*   **I want** swipe gestures on the media cards,
*   **So that** I can select standard WebDL (Left/Blue), BluRay (Right/Green), Remux (Up/Gold), or Delete (Down/Red).
*   **Acceptance Criteria**:
    *   No curation action buttons are displayed below the card stack; interactions are purely swipe gesture-based or keyboard hotkeys.
    *   Card borders scale and glow with the action's corresponding color dynamically during card drag.
    *   Action triggers staging of the curation update or deletion queue addition.

#### User Story 1.4: Keep / Skip Action
*   **As a** user,
*   **I want** to press Spacebar or K,
*   **So that** I can advance to the next card without changing any quality profiles or queueing deletions.
*   **Acceptance Criteria**:
    *   Pressing Spacebar or K bypasses the active card instantly.
    *   Logs the skipped action in the `activity_log` SQLite table.
    *   The card stack animates and advances immediately without triggering the 7-second undo buffer or calling *arr APIs.

---

### Epic 2: Safety & Undo Actions

#### User Story 2.1: Configurable 7-Second Undo Buffer
*   **As a** user,
*   **I want** the option to enable a 7-second window to reverse my curation decisions,
*   **So that** I can undo accidental swipes or hotkey presses if I choose to enable this protection.
*   **Acceptance Criteria**:
    *   An option to enable the 7-second undo buffer is available in `Settings > General` (disabled by default).
    *   When enabled, performing a swipe or hotkey action displays a floating bottom toast with a 7-second countdown.
    *   Toast has a countdown ring and an `[ UNDO ]` button.
    *   Clicking undo halts the operation and returns the card back to the stack.
    *   If the timer expires, or if the buffer is disabled, the action commits immediately.

#### User Story 2.2: Desktop Hotkey Isolation
*   **As a** desktop user,
*   **I want** arrow keys and W/A/S/D key bindings disabled when entering text,
*   **So that** typing API credentials doesn't trigger card swipe actions.
*   **Acceptance Criteria**:
    *   Pressing A/D/W/S curates cards normally.
    *   Focusing inside input fields or Settings panels disables hotkey listeners.

---

### Epic 3: Deletion Review & Settings

#### User Story 3.1: Sequential Deletion execution
*   **As a** user,
*   **I want** staged deletions to execute sequentially with a progress indicator,
*   **So that** I do not overload my Radarr container.
*   **Acceptance Criteria**:
    *   A progress bar shows execution steps (e.g. `Deleting 4 of 12`).
    *   Deletions are processed one by one.
    *   User can hit "Cancel" to stop processing remaining queue items.

#### User Story 3.2: SQLite Settings Store
*   **As a** user,
*   **I want** settings and profiles stored in a local SQLite database,
*   **So that** I can configure my app through the UI without editing text files.
*   **Acceptance Criteria**:
    *   API configuration form saves/loads credentials directly to SQLite.
    *   A "Test Connection" button gives immediate visual status checks.

#### User Story 3.3: File Deletion Settings Behavior
*   **As a** self-hosted user,
*   **I want** settings to configure if Siftarr deletes the old file when upgrading or downgrading,
*   **So that** I can choose between additive searches or fully replacing existing media immediately.
*   **Acceptance Criteria**:
    *   Checkboxes for "Delete old file when upgrading" and "Delete old file when downgrading" exist in Settings.
    *   Settings are stored in the SQLite `settings` table.
    *   If active, Siftarr calls Radarr/Sonarr file deletion APIs before updating profiles and initiating searches.

---

## Phase 2: Sonarr, Quality Explainability & Custom Libraries

### Epic 4: TV Show Support & Safety Warnings

#### User Story 4.1: TV Show Cards & Series Warning Badge
*   **As a** user,
*   **I want** TV show cards in Sonarr to display a series-level safety warning,
*   **So that** I don't accidentally update profiles or delete entire series unknowingly.
*   **Acceptance Criteria**:
    *   TV card displays a clear badge: `⚠️ Affects Series: X Seasons, Y Episodes`.

#### User Story 4.2: TRaSH Quality Explainability
*   **As a** user,
*   **I want** to see current custom formats and TRaSH scores on card overlays,
*   **So that** I understand the score gains before upgrading or downgrading.
*   **Acceptance Criteria**:
    *   Queries `customFormatScore` directly from Radarr/Sonarr file metadata.
    *   Displays current score and tags, and shows expected score changes on drag.

#### User Story 4.3: Custom Library Profiles Manager
*   **As a** user,
*   **I want to** configure custom libraries with root folder and Tautulli Section mappings,
*   **So that** I can filter curation lists (e.g., Kids Movies vs. Stand-up).
*   **Acceptance Criteria**:
    *   Settings tab displays a profiles list.
    *   Header displays picker dropdown listing all enabled profiles.

---

## Phase 3: Personalized Discovery

### Epic 5: Discovery Mode & Recommendations

#### User Story 5.1: Discovery Feed Curation
*   **As a** user,
*   **I want** recommendations of new media not present in my library,
*   **So that** I can add them to Radarr or Sonarr.
*   **Acceptance Criteria**:
    *   Fetches movies/TV shows from TMDB matching the active library type.
    *   Filters out existing titles in *arr.

#### User Story 5.2: Recommendation weights
*   **As a** user,
*   **I want** Siftarr to learn my preferences from my library history and Plex playback frequency,
*   **So that** the discovery feed matches my tastes.
*   **Acceptance Criteria**:
    *   Swipes adjust weight factors in SQLite.
    *   Plex play counts from Tautulli boost weight metrics for similar genres.
