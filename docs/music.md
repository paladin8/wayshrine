# Music

## How it works
- One track plays at a time. Changing the wanted track crossfades (3 s) from the old one to the new one.
- A track that finishes pauses for 4 s and starts over. This suits tracks that end with their own fade-out; it is not a sample-accurate loop.
- Browsers block audio before a user gesture, so nothing plays until the first key press or click. If the browser still refuses, the next gesture retries.
- Master volume and mute are player settings (`wayshrine:settings` in localStorage). Keys: `N` mutes; the HUD has a mute button and slider.
- `?debug` exposes `window.wayshrine.music.status()`.

## Code
- `src/audio/tracks.ts`: `TRACK_IDS`, the `TRACKS` registry (id to URL), and `trackFor(biome)`, the one place that decides what plays where.
- `src/audio/music.ts`: the player. Pure logic over an injected player interface, so it is tested without a browser.
- `src/app/audio-controls.ts`, `src/app/settings.ts`: the UI and persisted settings.

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
