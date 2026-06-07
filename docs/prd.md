# Product Requirements Document (PRD): Siftarr

## 1. Product Vision & Overview
Siftarr is a gamified, self-hosted web application for the *arr suite (specifically starting with Radarr and Sonarr). It solves the problem of tedious library curation and discovery by bringing a Tinder-style swipe interface to media management. Users can quickly upgrade their library quality, prune unwanted content, and discover new movies or TV shows that adapt to their taste over time.

---

## 2. Core Features

### 2.0. Library Picker
* **Objective**: Define the active media library (e.g. Movies, Kids Movies, Documentaries, TV Shows).
* **Functionality**:
  * An expandable, glassmorphic dropdown selector accessible in the header/navbar on both the Discovery and Management tabs.
  * Displays user-defined **Library Profiles** configured in Settings.
  * Switching the active library updates all feeds, card decks, recommendation filters, and deletion queues:
    * **Movie-type Library Profiles**: Points to Radarr (optionally filtered by a specific root folder path) and TMDB Movie endpoints.
    * **TV-type Library Profiles**: Points to Sonarr (optionally filtered by a specific root folder path) and TMDB TV Show endpoints.
  * **Dynamic Visibility**:
    * If only a single Library Profile is defined and enabled in Settings, the Library Picker is hidden from the header to maximize screen space.
    * If multiple Library Profiles are enabled, the picker is shown, allowing rapid switching between collections (even if all libraries map to the same backend service, e.g. multiple distinct Movie folders in a single Radarr instance).

### 2.1. Discovery Mode (Tab 1 - Default)
* **Objective**: Browse media not in the user's library and add them to Radarr or Sonarr.
* **Card Feed**:
  * **Source Resolution**: The discovery feed adapts dynamically to the active Library Profile type:
    * For **Movie-type Library Profiles** (e.g. "Kids Movies", "Documentaries"), Siftarr pulls recommendations from TMDB Movie endpoints (popular, trending, genre lists). It filters out movies already present in the Radarr library (matching the configured root folder path for that library).
    * For **TV-type Library Profiles** (e.g. "TV Shows"), Siftarr pulls recommendations from TMDB TV Show endpoints. It filters out series already present in the Sonarr library.
* **Swipe Actions**:
  * **Swipe Right (Like)**: Sends the item to Radarr/Sonarr to add and start downloading. Uses the default Discovery profile configured in Settings.
  * **Swipe Left (Skip/Dislike)**: Skips the item. The item ID is logged to a local database skip list so it won't appear again.
  * **Swipe Up (Super Like)**: Sends the item to Radarr/Sonarr with the "God Tier" quality profile and starts downloading.
* **Smart Recommendations**:
  * Records metadata (genres, creators/directors, cast, release decade) of swiped items.
  * Adjusts weights in a local taste profile (likes increase weights, dislikes decrease them), stored separately for Movies and TV Shows.
  * Sorts and curates the card feed using this profile so higher-matching items appear first.

### 2.2. Management Mode (Tab 2)
* **Objective**: Curate existing library items, upgrading or downgrading files by mapping swipes directly to quality tiers.
* **Card Feed**:
  * **Movies**: Displays movies currently in the Radarr library. Cards show active file metadata (Resolution, File Size, Source like REMUX, BluRay, WEBDL, HDTV) and Tautulli usage stats (Play Count, Last Played, and Cumulative Watch Time) if Tautulli is configured. These stats drive user decisions (e.g. deleting unwatched movies, keeping highly played ones, or upgrading/downgrading quality profiles).
  * **TV Shows**: Displays TV series currently in the Sonarr library. Cards show series-level metadata (Episodes Downloaded vs. Total, Total Folder Size, Current Quality Profile, dominant file source) and Tautulli usage stats (Total series play count, last played date of any episode, and cumulative series watch time) if configured.
* **Swipe Actions**:
  * **Swipe Left (Standard / WebDL)**: Maps the item's Radarr/Sonarr profile to a standard WEB-DL/WebDL quality profile (saving space if it was a larger BluRay/REMUX) and triggers search.
  * **Swipe Right (High Quality / BluRay)**: Maps the profile to a BluRay quality profile (upgrading if it was WEBDL/HDTV) and triggers search.
  * **Swipe Up (God Tier / Remux)**: Maps the profile to the highest quality Remux profile and triggers search.
  * **Swipe Down (Queue for Deletion)**: Adds the item to the local Deletion Review Queue. Does *not* delete files immediately.

### 2.3. Deletion Review Queue (Tab 3)
* **Objective**: Safeguard against accidental file deletion from swipe gestures.
* **Functionality**:
  * Lists all items (Movies and TV Shows) swiped down in Management Mode.
  * Shows title, media type, release year, size, and library location.
  * Option to **Confirm Deletion** (calls Radarr/Sonarr API to delete the media and its files).
  * Option to **Cancel / Keep** (removes the item from the review queue and puts it back in the pool).
  * Option to **Confirm All**.

### 2.4. Settings (Tab 4)
* **Objective**: Configure credentials and app behavior.
* **Settings Fields**:
  * **Radarr URL** & **Radarr API Key** (optional if Sonarr is configured)
  * **Sonarr URL** & **Sonarr API Key** (optional if Radarr is configured)
  * **Tautulli URL** & **Tautulli API Key** (optional, for viewing usage statistics to drive curation)
  * **TMDB API Key** (for fetching discovery lists)
  * **Profile Mappings**: Match Siftarr's swipe directions (Standard, Really Good, God Tier) to actual Quality Profiles fetched dynamically from Radarr and Sonarr.
  * **Default Discovery Profiles**: The Radarr/Sonarr profile used when swiping right in Discovery Mode.
  * **Reset Data**: Option to wipe recommendation weights, skipped lists, and database.
  * **Library Profiles Management**: Section to define custom Library Profiles. Users can add, edit, or delete libraries, naming them (e.g. "Kids Movies") and specifying their Type (Radarr/Sonarr), root folder filter, and associated Tautulli Plex Library Section ID.
  * **Independent Service Verification**: Individual "Test Connection" buttons for Radarr, Sonarr, and Tautulli. The app validates only the configured services and handles unconfigured services gracefully.

---

## 3. UI/UX Design Goals

* **Aesthetics**: Modern, glassmorphic dark mode. Deep charcoal/black background with glowing neon accents (green for likes, gold for god-tier, red for delete, blue for standard).
* **Gestures**: Smooth card dragging with realistic physics, rotation, and spring-back if released. Touch-gesture support for mobile devices.
* **Visual Cues**: Clear, colored overlay text/badges (e.g., "GOD TIER" on swipe up, "DELETE" on swipe down) that fade in as the card is dragged in that direction.
* **Card Layout**: A large high-res poster taking up most of the card, with title, year, genres, rating, and runtime at the bottom. In Management Mode, file stats (Size, Resolution, or Episode progress) will be highlighted in a sleek badge overlay.

---

## 4. Technical Architecture & Stack

### 4.1. Tech Stack
* **Frontend**: React, Vite, TypeScript, Vanilla CSS, Framer Motion (for physics-based swiping).
* **Backend**: Node.js, Express, TypeScript, SQLite (via `better-sqlite3` for local settings, history, and recommendation profile storage).
* **APIs**:
  * **Radarr API v3**: For movie sync, profile updates, search triggers, commands, and deletion.
  * **Sonarr API v3**: For TV show sync, profile updates, search triggers, commands, and deletion.
  * **TMDB API v3**: For discovery lists, genre details, and cast/crew metadata.

### 4.2. Containerization
* **Dockerfile**: Multi-stage build compiling React into static assets and starting the Express server.
* **Volume Mounts**: A `/config` folder in the container mapped to the host to store the SQLite database (`siftarr.db`) and a configuration file (`config.json`), ensuring persistence across container updates.

---

## 5. Success Criteria & Verification
1. Successful fetching of Radarr/Sonarr media and profiles.
2. Smooth card dragging physics working on both desktop (mouse) and mobile (touch).
3. Accurate weight adjustment and list curation based on swiping behavior.
4. Correct Radarr/Sonarr API commands triggered on swipe: profile update, search trigger, and deletion upon queue confirmation.
5. Library Picker seamlessly switches all states between Movies and TV Shows.
