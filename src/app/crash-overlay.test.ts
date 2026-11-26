import { describe, expect, it } from "vitest";
import { isOurError } from "./crash-overlay";

describe("isOurError", () => {
  it("accepts the game's own scripts and errors without a file", () => {
    expect(isOurError("https://wayshrine.app/assets/index.js", "https://wayshrine.app")).toBe(true);
    expect(isOurError("", "https://wayshrine.app")).toBe(true);
    expect(isOurError(undefined, "https://wayshrine.app")).toBe(true);
  });
  it("ignores scripts from other origins, such as extensions", () => {
    expect(isOurError("chrome-extension://abc/content.js", "https://wayshrine.app")).toBe(false);
  });
});
