# 0005: Monuments carry a finite collection of texts

Status: accepted

**Context.** The game needs a second kind of exploration beside shrines: finding things worth reading. The source is a collection of 1,000 Japanese texts (50 haiku, 740 proverbs, 120 four-character sayings, 90 idioms).

**Decision.**
- Every text appears exactly once, on a standing stone. The world is infinite but the set is finite, so `planMonuments` lays the stones out in rings around the start region, 0 to 2 per region (20% / 55% / 25%), far from shrines and region edges. A plan is a pure function of seed and text list (ADR 0002 holds: only what the player has read is saved, as `collected` in save v3).
- A stone's inscription is legible only once its region is restored; until then the stone is worn smooth. Restored, unread stones glimmer, but only while on screen: no compass, no map marker.
- Haiku carry a scenery tag (biome now; season and scene recorded for later) and are placed in regions of that biome. Other texts are placed at random.
- Japanese mode shows the Japanese text alone, no English and no readings. English mode adds the translation.
- The texts live outside the layers in `content/` (source, hand-written tags) and `src/content/` (generated JSON, built by `npm run content`; a test fails if they drift). The placement index ships in the main bundle; the texts themselves load on first read.
- English glosses are lightly cleaned (`ENGLISH_OVERRIDES`): spelling variants and slot-fillers are dropped, explanatory asides kept.
- Code is Apache-2.0. The texts are CC BY-SA 4.0 (JMdict/EDICT derived; the haiku are public domain), kept apart in `content/LICENSE.md` and credited in settings.

**Consequences.** Ids in the source file are the permanent key: renaming one orphans saves. Adding texts shifts the layout of later rings and so moves existing monuments for current players; append only after the world has shipped. Changing the count weights or placement rules does the same.
