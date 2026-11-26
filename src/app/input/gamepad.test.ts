import { describe, expect, it } from "vitest";
import { createGamepadReader, isPlaystation, type PadLike } from "./gamepad";

const pad = (over: Partial<{ axes: number[]; down: number[]; id: string }> = {}): PadLike => ({
  id: over.id ?? "Xbox Controller (STANDARD GAMEPAD)",
  connected: true,
  axes: over.axes ?? [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: (over.down ?? []).includes(i), value: (over.down ?? []).includes(i) ? 1 : 0 })),
});

describe("gamepad reader", () => {
  it("reports nothing without a pad", () => {
    const r = createGamepadReader(() => []);
    expect(r.poll(0).active).toBe(false);
  });
  it("fires a button once per press", () => {
    let current = pad();
    const r = createGamepadReader(() => [current]);
    r.poll(0);
    current = pad({ down: [0] });
    expect(r.poll(0.1).pressed).toEqual(["act"]);
    expect(r.poll(0.2).pressed).toEqual([]);
    current = pad();
    r.poll(0.3);
    current = pad({ down: [0] });
    expect(r.poll(0.4).pressed).toEqual(["act"]);
  });
  it("maps the face and menu buttons", () => {
    const r = createGamepadReader(() => [pad({ down: [1, 2, 3, 8, 9, 4, 5, 7] })]);
    expect(new Set(r.poll(0).pressed)).toEqual(new Set(["back", "backpack", "journal", "map", "menu", "pagePrev", "pageNext", "box"]));
  });
  it("moves with the stick and the D-pad", () => {
    const stick = createGamepadReader(() => [pad({ axes: [0, -1, 0, 0] })]).poll(0);
    expect(stick.move.up).toBeCloseTo(1);
    const dpad = createGamepadReader(() => [pad({ down: [15] })]).poll(0);
    expect(dpad.move.right).toBe(1);
  });
  it("repeats navigation while held, after a delay", () => {
    const r = createGamepadReader(() => [pad({ down: [13] })]);
    expect(r.poll(0).nav).toBe("down");
    expect(r.poll(0.2).nav).toBeNull();
    expect(r.poll(0.45).nav).toBe("down");
    expect(r.poll(0.5).nav).toBeNull();
    expect(r.poll(0.6).nav).toBe("down");
  });
  it("recognises PlayStation pads", () => {
    expect(isPlaystation("054c-0ce6-DualSense Wireless Controller")).toBe(true);
    expect(isPlaystation("Xbox 360 Controller (STANDARD GAMEPAD)")).toBe(false);
  });
});
