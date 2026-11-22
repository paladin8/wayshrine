# Music

## How it works
- One track plays at a time. Changing the wanted track crossfades (3 s) from the old one to the new one.
- A track that finishes pauses for 4 s and starts over. This suits tracks that end with their own fade-out; it is not a sample-accurate loop.
- Browsers block audio before a user gesture, so nothing plays until the first key press or click. If the browser still refuses, the next gesture retries.
- Music plays at half the slider level (`DEFAULT_GAIN` 0.5 in `music.ts`) because the tracks are mastered loud. `setDuck(level)` eases the music down and back, used under stingers.
- Music volume, sound-effects volume and mute are player settings (`wayshrine:settings` in localStorage), set in the settings dialog (gear button or `Esc`). `N` mutes all sound. Music uses the music slider; every one-shot cue uses the sound-effects slider.
- `?debug` exposes `window.wayshrine.music.status()`.

## Cues (one-shot sounds)
`src/audio/cues.ts` is the registry and `src/audio/cue-player.ts` plays them (players are created up front, reused, and follow the same volume and mute). While a cue plays the app ducks the music to 4% (almost silent).

| Cue id | File | Notes |
| --- | --- | --- |
| `dawn-reverence` | `public/audio/cues/dawn-reverence.mp3` | Awakening swell made with ElevenLabs. Original was 16.0 s with its peak at 13.7 s; the first 5.7 s were trimmed (0.4 s fade-in) so the peak lands at 8.0 s, just as the wave finishes lighting a typical region edge. Now about 10.3 s; it fades out by about 9.8 s, so it ends before the 1.5 s shrine hold does. Plays for ordinary shrines. |

| `radiant-arrival` | `public/audio/cues/radiant-arrival.mp3` | Landmark awakening swell made with ElevenLabs (`Radiant_Arrival_2026-11-22T013035`). 14.0 s, quiet build with the peak at about 10.0 s and a tail that is silent by about 13.5 s; -3 dB so it sits near `dawn-reverence` in loudness (about -21.9 LUFS against -23.4). Plays instead of `dawn-reverence` when a landmark is restored. |
| `awakening-burst` | `public/audio/cues/awakening-burst.mp3` | Activation and burst effect made with ElevenLabs (option 2 of two takes; the file has no charge-up, just a burst with a bright bloom and a short tail). 1.25 s of silence is padded at the start so the peak lands at 1.7 s with the onset at about 1.5 s. The wave launches at 1.2 s, but its front is tiny and barely visible for the first half second, so a peak at 1.2 s felt early. +3 dB, peak about -5.5 dBFS. 4.25 s. |
| `monument-read` | `public/audio/cues/monument-read.mp3` | Soft struck-glass chime made with ElevenLabs (option 2 of two takes: darker, with a lower partial a fifth below the main tone at about 1.32 kHz). Trimmed to 2.0 s with a 0.5 s fade-out, peak about -9 dBFS. Plays when a monument is read for the first press of E, not when reopened from the book. It does not duck the music; only the awakening cues do. |

Sync rule: cues are all started when the awakening starts (the burst is padded to peak at 1.7 s, just as the front becomes visible), so the swell's peak is at `SWELL_CREST` (8.0 s in the file, in `game/awakening.ts`), but by ear it is heard about `SWELL_LAG` (1 s) later, so the energy is timed to finish just before 9.0 s: a typical far edge (47 tiles out) is lit at about 8.8 s, the last stragglers at about 9.5 s, and the wave's own progress reaches 1 at `zoomOut + wave` = 10.0 s. The cause of the lag is unknown (audio start-up is a candidate); if it is ever found and fixed, lower `SWELL_LAG` and the wave together. `awakening.test.ts` enforces this, so retiming either side fails a test; if the timeline changes, re-trim the swell. Skipping with E fades the swell over 1.5 s.

## Code
- `src/audio/tracks.ts`: `TRACK_IDS`, the `TRACKS` registry (id to URL), and `trackFor(biome)`, the one place that decides what plays where.
- `src/audio/music.ts`: the player (gain, ducking). Pure logic over an injected player interface, so it is tested without a browser.
- `src/app/settings.ts`, `src/app/settings-panel.ts`: persisted settings and the dialog that edits them.

## Assets
Files live in `public/audio/music/` and are served as `/audio/music/<name>.mp3`. Use lowercase kebab-case names that match the track id.

| Track id | File | Notes |
| --- | --- | --- |
| `homeward-breeze` | `homeward-breeze.mp3` | Pastoral background track made by the project owner with ElevenLabs Music (plan tier and licence terms to be confirmed before release; see the Project doc `music-generation-plan`). 3:00, 192 kbps stereo MP3, about -15 LUFS integrated, true peak -1.1 dBFS. Starts with about 1.5 s near-silence and ends on a roughly 6 s fade-out. Used for every biome for now. |

Record the origin and licence of each track here when it is added.

## Adding a track
1. Put the file in `public/audio/music/`.
2. Add its id to `TRACK_IDS` and its URL to `TRACKS`.
3. Change `trackFor` to choose it (by biome now; later by phase or vitality).
4. Note it in the table above.

## Plan
Pre-rendered tracks per biome and phase in a shared tonal palette, not generative synthesis. The production plan, tool research and prompts live in the Wayshrine Project doc `music-generation-plan`. Planned post-processing: loudness normalisation, silence trimming, loop crossfades and ogg/mp3 encoding.

Landmarks have their own timeline (`AWAKENING_LANDMARK` in `game/awakening.ts`), timed to `radiant-arrival` by the same rule: its crest is at `SWELL_CRESTS.landmark` (10.0 s in the file, heard about `SWELL_LAG` later), so the wave takes 10.8 s and ends at 12.0 s, a typical far edge is lit at about 10.5 s, and the long 3 s hold runs to 15.0 s (the track ends at 14.0 s). Ordinary shrines keep the 8.8 s wave and now hold for 1.5 s (it was 3 s); only landmarks keep the long pause. `awakening.test.ts` checks both timelines against their crests.
