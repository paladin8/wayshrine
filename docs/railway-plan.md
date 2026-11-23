# Scenic Railway Plan

Wayshrine's technology thread takes the form of five short rail lines. Each has two stations, an existing landmark at its heart, and a view designed for the window seat. The player discovers the stations through ordinary exploration and restores the shrines that power them. A ride is an optional reward and a chance to see a familiar place from a different angle.

The Mount Fuji prototype runs on the dedicated `fuji-rail` seed. The other lines and seeded route placement are future work.

## Station discovery and restoration

1. Spot a platform roof, signal, or stretch of track while exploring. The station and track are visible while dormant, so the player can recognize them on a return visit.
2. Restore the nearby shrine. The usual restoration wave lights the platform and its sign. The landmark supplies the station on its side of the line, and an ordinary shrine supplies the other.
3. Restore the other end in either order. When both stations have power, the signals and a quiet arrival cue show that the train is running. Board from either platform when ready.
4. Watch the landscape from the seat, then step onto the destination platform and resume normal exploration. A glimpse of a bridge, path, or courtyard can suggest somewhere to investigate after arrival.

Both ends are reachable with existing traversal gear before the line opens. The two shrine restorations determine service, and landmark restoration continues to unlock gear. Rubbings keep their role in reading and map discovery. Use the same station interaction on all five lines so the player knows what to look for after the first ride.

## Proposed lines and window views

| Landmark | Train and view |
| --- | --- |
| **Enoshima Sea Candle** | An Enoden-inspired local train slips between houses, then the shore opens and the restored lighthouse comes into view across the water. Introduces the station routine in the Shore act. [Enoshima Electric Railway](https://enoden.co.jp/en/) |
| **Mount Fuji** | A shinkansen passes rooftops and utility poles before the view opens over fields. Close scenery rushes past while the mountain holds in the window for several seconds. The real Tokaido Shinkansen has a preferred seat for the Fuji view. [JR Central's Shinkansen guide](https://global.jr-central.co.jp/en/goldenroute/shinkansen/) |
| **Tokyo Tower** | An elevated commuter train catches the tower in gaps between buildings. At a bend, the full tower comes into view above a small shrine courtyard. This is where the skyline belongs at its most concentrated. |
| **Naruto whirlpools** | Girders flick past on a bridge crossing. The window looks down long enough to see a whirlpool form in the strait. |
| **Ginzan Onsen** | A slow winter train rounds a wooded bend. Warm inn windows and lamps come into view one by one along the river. |

The five anchors come from the [existing landmark roster](landmarks.md).

## Seeded placement

Author each route around the landmark's position. Define both platforms and their walk-up approaches, the track and elevation profile, the window side in each direction, and the sightline that must stay clear through the main reveal. Keep their relative positions fixed so the same bend, landmark angle, and reveal work in every placement.

Use the seed to choose a suitable position and orientation near the landmark's existing act. Let the surrounding terrain and vegetation vary outside the space needed for the track and view. The current landmark system already blends an authored heightfield into generated terrain. A railway needs a larger reserved area and explicit fit checks for station access, track clearance, and the view from the seat. If suitable placements are too rare for a line intended to appear on every seed, reserve its corridor during world planning and shape only the terrain it needs. [Landmark footprints](landmarks.md) · [Seed determinism](decisions/0002-seed-plus-discoveries.md) · [Progression and reachability](decisions/0006-landmarks-and-progression.md)

Keep the placement stable for a given seed and derive service from the existing restored regions. Before extending the landmark planner, check how any change in landmark locations would affect existing saves.

## Mount Fuji prototype

Run `npm run dev` and open `/?seed=fuji-rail&debug`. Choose **Preview Mount Fuji ride** to try the roughly 18-second ride immediately. The preview returns you to your starting point. On `/?seed=fuji-rail`, restore Mount Fuji and the ordinary shrine by the far platform, then press **E** at either station to board. **E**, **Esc**, or **Skip ride** ends the sequence.

The stations and three-car shinkansen are simple Three.js models. The side camera uses the real world terrain in the foreground and frames the authored Fuji mountain at a larger scale across the valley. Train motion, doors, and the ride timing live in code so the models can be replaced independently during an art pass.

1. On one fixed seed, give the existing Fuji model a short track past its foothills, two temporary platforms, and a fixed mountain-side seat. Start with a 15–20 second ride. Tune speed and framing until the foreground conveys the speed and the summit holds comfortably in view.
2. Use a dedicated seat camera with a simple window frame and quiet rolling audio. Follow the boat launch pattern for timed control and return to the isometric view. Preload the route, visible terrain beside it, the Fuji model, and the arrival platform before departure. [Boat prototype](music.md#boat-prototype) · [Terrain streaming](ARCHITECTURE.md#terrain-and-streaming)
3. Connect boarding to restoration at both ends. Verify that either order works, both endpoints remain reachable through normal play, and arrival returns control on clear ground. Test the return trip from the mountain side too.
4. Try the route on several representative seeds before authoring the other lines. Check that the summit stays in frame, the terrain arrives before it enters view, and the stations are easy to recognize while exploring. Keep the authored view as the standard for deciding whether to adjust a placement or reserve more of the corridor.

The prototype succeeds when the station is worth following on foot and the Fuji view makes the ride worth taking again.
