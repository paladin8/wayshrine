import { CAPABILITIES, type Capability } from "../world";

const LABEL: Readonly<Record<Capability, string>> = {
  boat: "Boat",
  snowshoes: "Snowshoes",
  climbing: "Climbing gear",
};

export interface HudModel {
  readonly capabilities: ReadonlySet<Capability>;
  readonly restoredCount: number;
  /** Interaction prompt at the bottom of the screen, or null. */
  readonly prompt: string | null;
  /** Transient hint, e.g. why the player is blocked, or null. */
  readonly hint: string | null;
}

export interface Hud {
  update(model: HudModel): void;
}

export function labelOf(capability: Capability): string {
  return LABEL[capability];
}

const CSS = `
.hud{position:fixed;inset:0;pointer-events:none;font:14px/1.3 system-ui,sans-serif;color:#2a2424}
.hud .chip{display:inline-block;margin-right:6px;padding:4px 10px;border-radius:999px;background:#fffaf0cc;border:1px solid #2a242422}
.hud .chip.off{opacity:.4}
.hud .tl{position:absolute;top:14px;left:14px}
.hud .tr{position:absolute;top:14px;right:14px}
.hud .bc{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);text-align:center}
.hud .msg{display:inline-block;padding:8px 16px;border-radius:10px;background:#2a2424dd;color:#f2ede0}
`;

export function createHud(container: HTMLElement): Hud {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "hud";
  const tl = document.createElement("div");
  tl.className = "tl";
  const tr = document.createElement("div");
  tr.className = "tr";
  const bc = document.createElement("div");
  bc.className = "bc";
  root.append(tl, tr, bc);
  container.appendChild(root);

  const chips = new Map<Capability, HTMLElement>();
  for (const cap of CAPABILITIES) {
    const chip = document.createElement("span");
    chip.className = "chip off";
    chip.textContent = LABEL[cap];
    tl.appendChild(chip);
    chips.set(cap, chip);
  }
  const count = document.createElement("span");
  count.className = "chip";
  tr.appendChild(count);
  const msg = document.createElement("span");
  msg.className = "msg";
  bc.appendChild(msg);

  return {
    update(m) {
      for (const [cap, chip] of chips) chip.classList.toggle("off", !m.capabilities.has(cap));
      count.textContent = `Shrines restored: ${m.restoredCount}`;
      const text = m.hint ?? m.prompt;
      msg.textContent = text ?? "";
      msg.style.display = text ? "inline-block" : "none";
    },
  };
}
