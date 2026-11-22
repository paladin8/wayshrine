# Music

## How it works
- One track plays at a time. Changing the wanted track crossfades (3 s) from the old one to the new one.
- A track that finishes pauses for 4 s and starts over. This suits tracks that end with their own fade-out; it is not a sample-accurate loop.
- Browsers block audio before a user gesture, so nothing plays until the first key press or click. If the browser still refuses, the next gesture retries.
- Music plays at half the slider level (`DEFAULT_GAIN` 0.5 in `music.ts`) because the tracks are mastered loud. `setDuck(level)` eases the music down and back, used under stingers.
- Music volume, sound-effects volume and mute are player settings (`wayshrine:settings` in localStorage), set in the settings dialog (gear button or `Esc`). `N` mutes all sound. Music uses the music slider; all cues use the sound-effects slider.
- `?debug` exposes `window.wayshrine.music.status()`.

## Cues
`src/audio/cues.ts` is the registry and `src/audio/cue-player.ts` plays them (players are created up front, reused, and follow the same volume and mute). The awakening swells duck the music to 4%, and gear first-use cues duck it to 16%.

| Cue id | File | Notes |
| --- | --- | --- |
| `dawn-reverence` | `public/audio/cues/dawn-reverence.mp3` | Awakening swell made with ElevenLabs. Original was 16.0 s with its peak at 13.7 s; the first 5.7 s were trimmed (0.4 s fade-in) so the peak lands at 8.0 s, just as the wave finishes lighting a typical region edge. Now about 10.3 s; it fades out by about 9.8 s, so it ends before the 1.5 s shrine hold does. Plays for ordinary shrines. |
| `radiant-arrival` | `public/audio/cues/radiant-arrival.mp3` | Landmark awakening swell made with ElevenLabs (`Radiant_Arrival_2026-11-22T013035`). 14.0 s, quiet build with the peak at about 10.0 s and a tail that is silent by about 13.5 s; -3 dB so it sits near `dawn-reverence` in loudness (about -21.9 LUFS against -23.4). Plays instead of `dawn-reverence` when a landmark is restored. |
| `awakening-burst` | `public/audio/cues/awakening-burst.mp3` | Activation and burst effect made with ElevenLabs (option 2 of two takes; the file has no charge-up, just a burst with a bright bloom and a short tail). 1.25 s of silence is padded at the start so the peak lands at 1.7 s with the onset at about 1.5 s. The wave launches at 1.2 s, but its front is tiny and barely visible for the first half second, so a peak at 1.2 s felt early. +3 dB, peak about -5.5 dBFS. 4.25 s. |
| `monument-read` | `public/audio/cues/monument-read.mp3` | Soft struck-glass chime made with ElevenLabs (option 2 of two takes: darker, with a lower partial a fifth below the main tone at about 1.32 kHz). Trimmed to 2.0 s with a 0.5 s fade-out, peak about -9 dBFS. Plays when a monument is read for the first press of E, not when reopened from the book. It does not duck the music; only the awakening cues do. |

Sync rule: cues are all started when the awakening starts (the burst is padded to peak at 1.7 s, just as the front becomes visible), so the swell's peak is at `SWELL_CREST` (8.0 s in the file, in `game/awakening.ts`), but by ear it is heard about `SWELL_LAG` (1 s) later, so the energy is timed to finish just before 9.0 s: a typical far edge (47 tiles out) is lit at about 8.8 s, the last stragglers at about 9.5 s, and the wave's own progress reaches 1 at `zoomOut + wave` = 10.0 s. The cause of the lag is unknown (audio start-up is a candidate); if it is ever found and fixed, lower `SWELL_LAG` and the wave together. `awakening.test.ts` enforces this, so retiming either side fails a test; if the timeline changes, re-trim the swell. Skipping with E fades the swell over 1.5 s.

## Movement sounds

Meadow steps, snow footsteps, and lake rowing loop while the player moves on the corresponding terrain. The loops play at about one-third gain, fade in over 0.65 s, and fade out over 0.85 s on stop or when changing surfaces. They stay quiet during the first-voyage ceremony. They use the sound-effects slider and mute setting. Other biomes have no movement clips yet.

The clips use the supplied recordings `walking_on_grass_#2-1795380631967.mp3`, `footsteps_in_snow_#1-1795389766172.mp3`, and `sound_of_water_light_#1-1795381169811.mp3`. The game assets are trimmed, gain-matched WAVs with short edge fades in `public/audio/cues/`.

## Music sets

All background tracks use **Dawn Reverence** for shrines and **Radiant Arrival** for landmarks, with the same awakening burst.

In `?debug`, **Music set** cycles through **Auto**, **Breeze** (Homeward Breeze), **Waves** (Waves Beyond the Headlands), and **Snowline** (Snowline Walk). The manual choice applies to the next restoration and stays in effect until you select **Auto** or reload. Auto follows saved gear first uses.

## Boat prototype

The score stays on **Homeward Breeze** after earning the boat. The first boarding plays **Crossing at Dawn** (`public/audio/cues/crossing-at-dawn.mp3`, supplied by the project owner, 10 s). As the skiff pushes off, the background crossfades to **Waves Beyond the Headlands** under the cue. The second theme comes up during the quiet tail, from 3.3 to 6.5 s, and persists in the save once the launch finishes. Click **…** in the debug box to open **Gear acquisition**. Choosing a preview closes the dialog before it starts.

## First snowshoe use

The first moving step on snow after earning snowshoes plays **Trail Through Fresh Snow** (`public/audio/cues/trail-through-fresh-snow.mp3`, supplied by the project owner, 10 s). **Snowline Walk** starts crossfading underneath it. The duck releases from 4.0 to 7.2 s of cue playback, as the cue tails off. The first step is saved immediately, and Snowline remains the background theme on reload or after leaving snow.

In **Gear acquisition**, **Preview snowshoe music** auditions the transition without updating the save. In Auto, the normal score returns when the preview cue ends. Choose **Snowline** in the music selector to keep auditioning the background track.

## Code
- `src/audio/tracks.ts`: `TRACK_IDS`, the `TRACKS` registry (id to URL), and `musicSetFor(launched, snowshoesUsed)`, the set selection for each stage.
- `src/audio/music.ts`: the player (gain, ducking). Pure logic over an injected player interface, so it is tested without a browser.
- `src/app/settings.ts`, `src/app/settings-panel.ts`: persisted settings and the dialog that edits them.

## Assets
Files live in `public/audio/music/` and are served as `/audio/music/<name>.mp3`. Use lowercase kebab-case names that match the track id.

| Track id | File | Notes |
| --- | --- | --- |
| `homeward-breeze` | `homeward-breeze.mp3` | Pastoral background track made by the project owner with ElevenLabs Music (plan tier and licence terms to be confirmed before release; see the Project doc `music-generation-plan`). 3:00, 192 kbps stereo MP3, about -15 LUFS integrated, true peak -1.1 dBFS. Starts with about 1.5 s near-silence and ends on a roughly 6 s fade-out. Used before the first voyage. |
| `waves-beyond-the-headlands` | `waves-beyond-the-headlands.mp3` | Supplied by the project owner. Three minutes, stereo MP3. Plays after the first departure. |
| `snowline-walk` | `snowline-walk.mp3` | Supplied by the project owner. Three minutes, stereo MP3. Becomes the background after the first use of snowshoes. |

Record the origin and licence of each track here when it is added.

## Adding a track
1. Put the file in `public/audio/music/`.
2. Add its id to `TRACK_IDS` and its URL to `TRACKS`.
3. Add a `MUSIC_SETS` entry for the track, then choose when to use it in `musicSetFor`.
4. Note it in the table above.

## Plan
Pre-rendered tracks per biome and phase in a shared tonal palette, not generative synthesis. The production plan, tool research and prompts live in the Wayshrine Project doc `music-generation-plan`. Planned post-processing: loudness normalisation, silence trimming, loop crossfades and ogg/mp3 encoding.

Landmarks have their own timeline (`AWAKENING_LANDMARK` in `game/awakening.ts`), timed to `radiant-arrival` by the same rule: its crest is at `SWELL_CRESTS.landmark` (10.0 s in the file, heard about `SWELL_LAG` later), so the wave takes 10.8 s and ends at 12.0 s. The closer landmark framing settles over the first 3.2 s, overlapping the beginning of the wave. A typical far edge is lit at about 10.5 s, and the hold is 3.5 s (to 15.5 s). The landmark name starts fading in at 10.3 s, `CAPTION_LEAD` (1.7 s) before the wave ends, and fades out as the camera returns. Ordinary shrines keep the 8.8 s wave and now hold for 1.5 s (it was 3 s); only landmarks keep the long pause. `awakening.test.ts` checks both timelines against their crests.
