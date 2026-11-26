# 0009: One action layer for keyboard, gamepad and touch
Status: accepted.

**Context.** Input was raw `KeyboardEvent.code` checks spread across `app.ts` and every panel, and prompts named keys ("Press E"). A controller (needed for Steam Deck) and touch (phones and tablets on the web) could not be added without touching every listener.

**Decision.**
- `src/app/input/` owns the devices and exposes verbs (`Action`) and a movement vector. Game code never sees a key, button or touch. Keyboard handling stays in `app.ts` for now; gamepad and touch verbs go through the same handlers.
- Panels keep their own Escape and arrow-key listeners. Gamepad Back, Menu and page buttons dispatch those keys to `window`, so panels behave as with a keyboard. Focus moves between a dialog's real buttons by direction (`nextFocus`), and A clicks the focused one. A full overlay stack to replace the per-panel listeners was left for later.
- Walking takes the stronger of keys and stick and scales by the push (`walkScale`, 0.35 to 1); keys are full speed. The expanded map freezes walking and is steered with the stick.
- Prompts carry an `{act}` placeholder, filled for the device used last ("E", "A", "the button"); a test checks every prompt has it.
- Touch uses a floating joystick and one contextual act button, not tap-to-move, which would need pathfinding around obstacles and gear-gated terrain.

**Consequences.**
- Adding a device means one adapter plus its glyphs, not edits to every panel.
- Escape stays overloaded (close, open Options, skip the train ride); the controller maps Back and Menu separately.
- Not done: rebinding, layout-aware key labels, controller glyph sets, pinch zoom on the touch map.
