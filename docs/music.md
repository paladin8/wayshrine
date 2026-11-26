# Music

## How it works
- One track plays at a time. Changing the wanted track crossfades (3 s) from the old one to the new one.
- Background tracks use the browser’s built-in loop and retain the fades in their recordings.
- Browsers block audio before a user gesture, so nothing plays until the first key press or click. If the browser still refuses, the next gesture retries.
- Music plays at half the slider level (`DEFAULT_GAIN` 0.5 in `music.ts`) because the tracks are mastered loud. `setDuck(level)` eases the music down and back, used under stingers.
- Music volume, sound-effects volume and mute are player settings (`wayshrine:settings` in localStorage), set in the settings dialog (gear button or `Esc`). `N` mutes all sound. Music uses the music slider; all cues use the sound-effects slider.
- `?debug` exposes `window.wayshrine.music.status()`.

## Cues
`src/audio/cues.ts` is the registry and `src/audio/cue-player.ts` plays them (players are created up front, reused, and follow the same volume and mute). The awakening swells fade the music out completely (0.8 s), then it comes back over 8 s once the swell ends. Gear first uses have no cue; the background themes crossfade into each other instead.

| Cue id | File | Notes |
| --- | --- | --- |
| `dawn-reverence` | `public/audio/cues/dawn-reverence.mp3` | Awakening swell made with ElevenLabs. Original was 16.0 s with its peak at 13.7 s; the first 5.7 s were trimmed (0.4 s fade-in) so the peak lands at 8.0 s, just as the wave finishes lighting a typical region edge. Now about 10.3 s; it fades out by about 9.8 s, so it ends before the 1.5 s shrine hold does. Plays for ordinary shrines. |
| `radiant-arrival` | `public/audio/cues/radiant-arrival.mp3` | Landmark awakening swell made with ElevenLabs (`Radiant_Arrival_2026-11-22T013035`). 14.0 s, quiet build with the peak at about 10.0 s and a tail that is silent by about 13.5 s; -3 dB so it sits near `dawn-reverence` in loudness (about -21.9 LUFS against -23.4). Plays instead of `dawn-reverence` when a landmark is restored. |
| `winter-light-restored` | `public/audio/cues/winter-light-restored.mp3` | Shrine awakening swell for the snow theme (`Winter_Light_Restored_2026-11-23T000719`). Original 14.0 s with its main peak at 10.5 s; the first 2.5 s were trimmed (0.4 s fade-in, 1 s fade-out) so the peak lands at 8.0 s like `dawn-reverence`; now 10.4 s, about -23.3 LUFS. Plays for ordinary shrines while Snowline, Marshwalk, or Lantern Trail is the background, with a 2.4 s playback fade-in. Landmarks still use `radiant-arrival`. |
| `basalt-restoration` | `public/audio/cues/basalt-restoration.mp3` | Shrine awakening swell for the volcanic theme (`Restoration_of_the_Shrine_2026-11-24T043608`, after `Light_Returns` was tried and dropped). Original 14.0 s, a slow build with its peak at 9.0 s; the first 1.04 s (silent) were trimmed so the peak lands at 8.0 s like `dawn-reverence`, +3.1 dB (about -23.3 LUFS), cut to 11.0 s with a 1 s fade-out. Plays for ordinary shrines while Basalt Crossing is the background. Landmarks still use `radiant-arrival`. |
| `awakening-burst` | `public/audio/cues/awakening-burst.mp3` | Activation and burst effect made with ElevenLabs (option 2 of two takes; the file has no charge-up, just a burst with a bright bloom and a short tail). 1.25 s of silence is padded at the start so the peak lands at 1.7 s with the onset at about 1.5 s. The wave launches at 1.2 s, but its front is tiny and barely visible for the first half second, so a peak at 1.2 s felt early. +3 dB, peak about -5.5 dBFS. 4.25 s. |
| `monument-read` | `public/audio/cues/monument-read.mp3` | Soft struck-glass chime made with ElevenLabs (option 2 of two takes: darker, with a lower partial a fifth below the main tone at about 1.32 kHz). Trimmed to 2.0 s with a 0.5 s fade-out, peak about -9 dBFS. Plays when a monument is read for the first press of E, not when reopened from the book. It does not duck the music; only the awakening cues do. |

Sync rule: cues are all started when the awakening starts (the burst is padded to peak at 1.7 s, just as the front becomes visible), so the swell's peak is at `SWELL_CREST` (8.0 s in the file, in `game/awakening.ts`), but by ear it is heard about `SWELL_LAG` (1 s) later, so the energy is timed to finish just before 9.0 s: a typical far edge (47 tiles out) is lit at about 8.8 s, the last stragglers at about 9.5 s, and the wave's own progress reaches 1 at `zoomOut + wave` = 10.0 s. The cause of the lag is unknown (audio start-up is a candidate); if it is ever found and fixed, lower `SWELL_LAG` and the wave together. `awakening.test.ts` enforces this, so retiming either side fails a test; if the timeline changes, re-trim the swell. Skipping with E fades the swell over 1.5 s.

## Movement sounds

Meadow steps, snow footsteps, and lake rowing loop while the player moves on the corresponding terrain. The loops play at about one-third gain, fade in over 0.65 s, and fade out over 0.85 s on stop or when changing surfaces. They stay quiet during the first-voyage ceremony. They use the sound-effects slider and mute setting. Mountain and marsh footsteps exist too.

The clips use the supplied recordings `walking_on_grass_#2-1795380631967.mp3`, `footsteps_in_snow_#1-1795389766172.mp3`, and `sound_of_water_light_#1-1795381169811.mp3`. The game assets are trimmed, gain-matched WAVs with short edge fades in `public/audio/cues/`.

Walking in Ginzan Onsen’s thawed stream and baths loops the supplied splash recording (`three_light_water_sp_#4-1795574894159.mp3`, stored as `public/audio/cues/walk-water.mp3`). Snow footsteps still play on the banks and on frozen stream and bath tiles.

## Music sets

**Breeze**, **Waves**, and **Ridgewalk** use **Dawn Reverence** for ordinary shrines. **Snowline** and **Marshwalk** use **Winter Light Restored**. Every set uses **Radiant Arrival** for landmarks and the same awakening burst.

The **music button** at the top right (two eighth notes and a number) cycles the background through the themes the traveller has unlocked. The number is the playing theme's place among them. Breeze is always unlocked; Waves, Snowline, Ridgewalk, Marshwalk, Lantern, Basalt, and Open sea unlock with the first use of the matching gear (boat, snowshoes, climbing gear, geta, lantern, ash sandals, ship), and Sunlit fields with Pilgrim’s Wake. A click moves to the next unlocked theme and wraps; after the newest one it returns to following progression. A pick applies to normal travel and shrine restorations and persists across reloads. Each first-use animation plays the matching theme and lets its crossfade finish, even if higher-tier gear was used first. Then the saved choice or automatic progression resumes. In a world where the saved theme is still locked, the soundtrack follows progression until that theme is earned.

## Boat prototype

The score stays on **Homeward Breeze** after earning the boat. At the first boarding the background crossfades to **Waves Beyond the Headlands** over 5 s as the skiff pushes off; there is no cue or duck (the earlier *Crossing at Dawn* cue was dropped, its file is unused). The second theme persists in the save once the launch finishes. Click **…** in the debug box to open **Gear acquisition**. Choosing a preview closes the dialog before it starts.

## First snowshoe use

The first moving step on snow after earning snowshoes starts the strap-on moment and crossfades the background from the sea theme to **Snowline Walk** over 5 s, with no cue or duck (*Trail Through Fresh Snow* was dropped, its file is unused). The first step is saved immediately, and Snowline remains the background theme on reload or after leaving snow.

In **Gear acquisition**, **Preview snowshoe use** plays the strap-on moment and the crossfade without updating the save, fading back to the sea theme first if the save is already further along. Choose **Snowline** in the music selector to keep auditioning the background track.

## First climb

The first moving step onto a mountain after earning the walking sticks crossfades the background from **Snowline Walk** to **Ridgewalk in E Major** over 5 s, with no cue or duck (*Ridge Within Reach* was dropped, its file is unused). The first climb is saved immediately and Ridgewalk remains the background on reload.

In **Gear acquisition**, **Preview climbing use** plays the moment from the snow theme (fading back to it first if the save is already on Ridgewalk) without updating the save.

## First geta use

The first moving step into marsh after earning geta crouches the traveller to slip them on, then crossfades the background from **Ridgewalk in E Major** to **Marshwalk** over 5 s. There is no cue. The first step is saved immediately and Marshwalk remains the background on reload. The track is `marshwalk` (`public/audio/music/marshwalk.mp3`, **Still Water Reeds**, supplied by the project owner, three minutes, about -16.7 LUFS). The marsh footstep loop is `walk-marsh` (`public/audio/cues/walk-marsh.wav`, from the supplied `footsteps_in_a_marsh_#2` recording, 2 s, gain-matched with short edge fades).

In **Gear acquisition**, **Preview geta unlock** and **Preview geta use** play the reveal and the slip-on moment without updating the save, fading back to Ridgewalk first if the save is already on Marshwalk.

## First lantern use

The first moving step into dark forest after earning the lantern starts the lighting animation. When the flame catches, the background crossfades to **Lantern Trail** over 5 s. The lantern’s first use is saved immediately. **Preview lantern use** in the debug panel plays the same animation and transition without recording first use.

## First ash sandals use

The first moving step onto volcanic ground after earning ash sandals crouches the traveller to bind them on, then kicks up a small puff of ash as she steps off, and crossfades the background from **Lantern Trail** to **Basalt Crossing** over 5 s. There is no cue. The first step is saved immediately and Basalt Crossing remains the background on reload. The track is `basalt-crossing` (`public/audio/music/basalt-crossing.mp3`, supplied by the project owner, three minutes, about -18.6 LUFS, so it carries a track gain of 1.25 like Lantern Trail). Shrine restorations on this theme play `basalt-restoration` instead of the winter swell, and volcanic ground uses the mountain footstep loop.

The unlock reveal reads "Ash sandals unlocked" (English and Japanese). In **Gear acquisition**, **Preview ash sandals unlock** and **Preview ash sandals use** play the reveal and the bind-on moment without updating the save, fading back to the lantern theme first if the save is already on the basalt one.

## First sailing

Earning the ship (48 landmarks) shows "Ship unlocked" (English and Japanese). The first time the traveller walks from the bank onto open sea (`sea` biome, from land or from a lake) the ship comes into play: it glides in along the bank while she waits, she crosses its gangway to the deck, and it casts off, swinging bow-out. The background crossfades from **Basalt Crossing** to **Open sea** over 5 s as the ship casts off (`SHIP_PUSH_OFF_SECONDS`), with no cue or duck. The first sailing is saved when it finishes (`shipLaunched`) and Open sea remains the background on reload. Open water is crossed in the ship; lakes still take the skiff.

In **Gear acquisition**, **Preview ship unlock** and **Preview first sailing** play the reveal and the departure without updating the save (the preview finds a clear bank beside a sea landmark), fading back to the basalt theme first if the save is already on Open sea.

Under way the ship uses the same rowing loop as the skiff (`MOVEMENT_CUES.sea`); there is no sound yet for the gangway or casting off.

## Pilgrim’s Wake

Restoring the 58th landmark unlocks Pilgrim’s Wake. Its landmark swell hands off directly to **Road Through Sunlit Fields**, which stays selected in Auto after reload. Later passive restorations leave the background alone and play no restoration swell.

In **Gear acquisition**, **Preview Pilgrim’s Wake unlock** shows the unlock message and previews the handoff to the final theme.

## Journey finale

The star map plays **Starbound Farewell** once after the last landmark’s restoration ceremony. Stars spread outward during the track’s opening phrases, and the last landmark lights at 20.54 s. Dismissing the chart returns to the current exploration theme.

## Code
- `src/audio/tracks.ts`: `TRACK_IDS`, the `TRACKS` registry (id to URL), and `musicSetFor(launched, snowshoesUsed, climbingUsed, getaUsed, lanternUsed, ashSandalsUsed, shipLaunched, pilgrimsWake)`, the set selection for each stage.
- `src/audio/music.ts`: the player (gain, ducking). Pure logic over an injected player interface, so it is tested without a browser.
- `src/app/settings.ts`, `src/app/settings-panel.ts`: persisted settings and the dialog that edits them.

## Assets
Files live in `public/audio/music/` and are served as `/audio/music/<name>.mp3`. Use lowercase kebab-case names that match the track id.

| Track id | File | Notes |
| --- | --- | --- |
| `homeward-breeze` | `homeward-breeze.mp3` | Pastoral background track made by the project owner with ElevenLabs Music (the project owner's plan allows commercial use; see the Project doc `music-generation-plan`). 3:00, 192 kbps stereo MP3, about -15 LUFS integrated, true peak -1.1 dBFS. Starts with about 1.5 s near-silence and ends on a roughly 6 s fade-out. Used before the first voyage. |
| `waves-beyond-the-headlands` | `waves-beyond-the-headlands.mp3` | Supplied by the project owner. Three minutes, stereo MP3. Plays after the first departure. |
| `snowline-walk` | `snowline-walk.mp3` | Supplied by the project owner. Three minutes, stereo MP3. Becomes the background after the first use of snowshoes. |
| `ridgewalk` | `ridgewalk.mp3` | Supplied by the project owner (`Ridgewalk_In_E_Major`). Three minutes, stereo MP3, about -16.2 LUFS. Becomes the background after the first climb. |
| `marshwalk` | `marshwalk.mp3` | Supplied by the project owner (`Still_Water_Reeds`). Three minutes, stereo MP3, about -16.7 LUFS. Becomes the background after the first geta step. |
| `lantern-trail` | `lantern-trail.mp3` | Dark forest background supplied by the project owner (`Pale_Shafts_in_the_Trees_2026-11-25T022808`). Three minutes, stereo MP3. Plays after the first lantern use. |
| `open-sea` | `open-sea.mp3` | Supplied by the project owner (`Beyond_The_Headland`). Three minutes, stereo MP3, about -12 LUFS, so it plays at gain 0.65 to sit level with the others. Becomes the background after the first sailing. |

| `road-through-sunlit-fields` | `road-through-sunlit-fields.mp3` | Supplied by the project owner (`Road_Through_Sunlit_Fields`). Three minutes, stereo MP3. Final background after Pilgrim’s Wake. |

| `starbound-farewell` | `starbound-farewell.mp3` | Supplied by the project owner. 30 s, stereo MP3. Plays once on the final star map. |

Record the origin and licence of each track here when it is added.

## Adding a track
1. Put the file in `public/audio/music/`.
2. Add its id to `TRACK_IDS` and its URL to `TRACKS`.
3. For a selectable background theme, add a `MUSIC_SETS` entry and choose when to use it in `musicSetFor`.
4. Note it in the table above.

## Plan
Pre-rendered tracks per biome and phase in a shared tonal palette, not generative synthesis. The production plan, tool research and prompts live in the Wayshrine Project doc `music-generation-plan`. Planned post-processing: loudness normalisation, silence trimming, loop crossfades and ogg/mp3 encoding.

Landmarks have their own timeline (`AWAKENING_LANDMARK` in `game/awakening.ts`), timed to `radiant-arrival` by the same rule: its crest is at `SWELL_CRESTS.landmark` (10.0 s in the file, heard about `SWELL_LAG` later), so the wave takes 10.8 s and ends at 12.0 s. The closer landmark framing settles over the first 3.2 s, overlapping the beginning of the wave. A typical far edge is lit at about 10.5 s, and the hold is 3.5 s (to 15.5 s). The landmark name starts fading in at 10.3 s, `CAPTION_LEAD` (1.7 s) before the wave ends, and fades out as the camera returns. Ordinary shrines keep the 8.8 s wave and now hold for 1.5 s (it was 3 s); only landmarks keep the long pause. `awakening.test.ts` checks both timelines against their crests.
