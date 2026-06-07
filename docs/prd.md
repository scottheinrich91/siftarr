# Product Requirements Document (PRD): Siftarr

## 1. Product Vision & Overview
Siftarr is a gamified, self-hosted web application for the *arr suite (specifically starting with Radarr and Sonarr). It solves the problem of tedious library curation and discovery by bringing a Tinder-style swipe interface to media management. Users can quickly upgrade their library quality, prune unwanted content, and discover new movies or TV shows that adapt to their taste over time.

---

## 2. Core Features

### 2.0. Library Picker
* **Objective**: Define the active media library type (Movies vs. TV Shows).
* **Functionality**:
  * A prominent, global toggle or dropdown (e.g., in the header/navbar) accessible from both the Discovery and Management tabs.
  * Switching the Library Picker alters the data source:
    * **Movies Mode**: Configures feeds, swipes, settings, and deletion queues to point to Radarr and TMDB Movie endpoints.
    * **TV Shows Mode**: Configures feeds, swipes, settings, and deletion queues to point to Sonarr and TMDB TV Show endpoints.

### 2.1. Discovery Mode (Tab 1 - Default)
* **Objective**: Browse media not in the user's library and add them to Radarr or Sonarr.
* **Card Feed**:
  * **Movies**: Pulled from TMDB (trending, popular, similar, genres). Filters out movies already present in the Radarr library.
  * **TV Shows**: Pulled from TMDB (popular/trending TV shows, genre lists). Filters out TV shows already in the Sonarr library.
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
  * **Movies**: Displays movies currently in the Radarr library. Cards show active file metadata: Resolution, File Size, and Source (e.g. WEBDL, BluRay, REMUX, HDTV).
  * **TV Shows**: Displays TV series currently in the Sonarr library. Cards show series-level metadata: Number of Seasons/Episodes Downloaded vs. Total, Total Folder Size, current Quality Profile, and dominant file source (e.g., WEBDL, BluRay, HDTV).
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
  * **Radarr URL** & **Radarr API Key**
  * **Sonarr URL** & **Sonarr API Key**
  * **TMDB API Key** (for fetching discovery lists)
  * **Profile Mappings**: Match Siftarr's swipe directions (Standard, Really Good, God Tier) to actual Quality Profiles fetched dynamically from Radarr and Sonarr.
  * **Default Discovery Profiles**: The Radarr/Sonarr profile used when swiping right in Discovery Mode.
  * **Reset Data**: Option to wipe recommendation weights, skipped lists, and database.

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
