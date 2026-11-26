import { describe, expect, it } from "vitest";
import { DEAD_ZONE, MIN_WALK_SCALE, formatPrompt, nextFocus, stickMove, strongest, walkScale } from "./actions";

describe("stickMove", () => {
  it("ignores the dead zone", () => {
    expect(stickMove(0.1, 0.1)).toEqual({ right: 0, up: 0 });
    expect(stickMove(DEAD_ZONE, 0)).toEqual({ right: 0, up: 0 });
  });
  it("points up for a negative y axis and caps at 1", () => {
    const m = stickMove(0, -1);
    expect(m.right).toBeCloseTo(0);
    expect(m.up).toBeCloseTo(1);
    expect(Math.hypot(...Object.values(stickMove(1, 1)))).toBeLessThanOrEqual(1.0001);
  });
  it("ramps from zero at the edge of the dead zone", () => {
    expect(Math.hypot(stickMove(0.25, 0).right, 0)).toBeLessThan(0.1);
  });
});

describe("walkScale", () => {
  it("is constant for digital input and slower for a light push", () => {
    expect(walkScale({ right: 1, up: 0 })).toBe(1);
    expect(walkScale({ right: 0, up: 0 })).toBe(0);
    const light = walkScale({ right: 0.1, up: 0 });
    expect(light).toBeGreaterThanOrEqual(MIN_WALK_SCALE);
    expect(light).toBeLessThan(0.6);
  });
});

describe("strongest", () => {
  it("picks the larger move", () => {
    expect(strongest({ right: 0, up: 0 }, { right: 0.5, up: 0 }).right).toBe(0.5);
    expect(strongest({ right: 1, up: 0 }, { right: 0.5, up: 0 }).right).toBe(1);
  });
});

describe("nextFocus", () => {
  const grid = [
    { x: 0, y: 0, w: 10, h: 10 },
    { x: 20, y: 0, w: 10, h: 10 },
    { x: 0, y: 20, w: 10, h: 10 },
    { x: 20, y: 20, w: 10, h: 10 },
  ];
  it("moves in each direction on a grid", () => {
    expect(nextFocus(grid, 0, "right")).toBe(1);
    expect(nextFocus(grid, 0, "down")).toBe(2);
    expect(nextFocus(grid, 3, "left")).toBe(2);
    expect(nextFocus(grid, 3, "up")).toBe(1);
  });
  it("stays put at an edge and starts at the first control", () => {
    expect(nextFocus(grid, 0, "left")).toBeNull();
    expect(nextFocus(grid, -1, "down")).toBe(0);
    expect(nextFocus([], 0, "down")).toBeNull();
  });
});

describe("formatPrompt", () => {
  it("names the act control for each device", () => {
    expect(formatPrompt("Press {act} to go", "keyboard", "en")).toBe("Press E to go");
    expect(formatPrompt("Press {act} to go", "gamepad", "en")).toBe("Press A to go");
    expect(formatPrompt("Press {act} to go", "touch", "en")).toBe("Press the button to go");
    expect(formatPrompt("{act}で進む", "gamepad", "ja")).toBe("Aボタンで進む");
  });
});
