import type { Capability } from "../world";

/** A piece of gear: every capability, then Pilgrim’s Wake, which opens no terrain. */
export type GearId = Capability | "pilgrimsWake";

const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${body}</svg>`;

const WATER = `<path d="M2 54c5-3 9-3 14 0s9 3 14 0 9-3 14 0 9 3 14 0v10H2z" fill="#8fc7d9"/><path d="M2 54c5-3 9-3 14 0s9 3 14 0 9-3 14 0 9 3 14 0" fill="none" stroke="#e1f2e8" stroke-width="1.6"/>`;

const snowshoe = (transform: string): string => `<g transform="${transform}">
<ellipse rx="10" ry="24" fill="#d9c79a" stroke="#8a6540" stroke-width="2.8"/>
<path d="M-10 0H10M-9 -10H9M-9 10H9M-6 -18H6M-6 18H6M0 -24V24" stroke="#b59f6c" stroke-width="1"/>
<rect x="-8.5" y="-3.5" width="17" height="7" rx="2" fill="#b64e3d"/></g>`;

/**
 * One small colourful picture per piece of gear, in the colours of its in-game model (see the meshes in
 * `render/character.ts`, `boat-mesh.ts` and `ship-mesh.ts`). Static, trusted markup: safe for `innerHTML`.
 */
export const GEAR_ICONS: Readonly<Record<GearId, string>> = {
  boat: svg(`
<line x1="30" y1="34" x2="12" y2="10" stroke="#bd925f" stroke-width="2.8" stroke-linecap="round"/>
<polygon points="14.8,7.9 9.2,12.1 5,6.5 10.6,2.3" fill="#a87549"/>
<path d="M5 30H59L53 46Q52 49 48.500 49H15.500Q12 49 11 46Z" fill="#956747"/>
<path d="M5 30H59L57.600 34H6.400Z" fill="#bb8e62"/>
<rect x="8" y="27.500" width="48" height="3.500" rx="1.750" fill="#dab289"/>
<path d="M12 41H52M14 45.500H50" stroke="#775039" stroke-width="1.200"/>
${WATER}`),
  snowshoes: svg(`${snowshoe("translate(20 32) rotate(-10)")}${snowshoe("translate(44 32) rotate(10)")}`),
  climbing: svg(`
<line x1="15" y1="7" x2="46" y2="56" stroke="#b98d5c" stroke-width="5" stroke-linecap="round"/>
<line x1="49" y1="7" x2="18" y2="56" stroke="#a37647" stroke-width="5" stroke-linecap="round"/>
<circle cx="15" cy="7" r="3" fill="#b64e3d"/><circle cx="49" cy="7" r="3" fill="#b64e3d"/>
<circle cx="46.500" cy="56.500" r="3" fill="#9a9aa0"/><circle cx="17.500" cy="56.500" r="3" fill="#9a9aa0"/>
<circle cx="32" cy="31" r="10" fill="none" stroke="#d9c79a" stroke-width="5"/>
<circle cx="32" cy="31" r="10" fill="none" stroke="#a89466" stroke-width="1" stroke-dasharray="3 3"/>`),
  geta: svg(`
<ellipse cx="32" cy="55" rx="26" ry="3.500" fill="#2a242422"/>
<path d="M27 30C26 8 38 8 37 30" fill="none" stroke="#b64e3d" stroke-width="4.500" stroke-linecap="round"/>
<rect x="13" y="38" width="9" height="15" rx="1.500" fill="#8a6540"/>
<rect x="42" y="38" width="9" height="15" rx="1.500" fill="#8a6540"/>
<rect x="5" y="29" width="54" height="10" rx="4" fill="#b98d5c"/>
<rect x="7" y="30" width="50" height="3" rx="1.500" fill="#d9ae7b"/>`),
  lantern: svg(`
<path d="M26 12C26 1 38 1 38 12" fill="none" stroke="#4c3026" stroke-width="2.500"/>
<defs><radialGradient id="gear-lantern-glow" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#ffe3a0"/><stop offset="1" stop-color="#e5a357"/></radialGradient></defs>
<path d="M20 16C8 24 8 44 20 52H44C56 44 56 24 44 16Z" fill="url(#gear-lantern-glow)" stroke="#a77345" stroke-width="1.500"/>
<path d="M13 25Q32 29 51 25M10.500 34Q32 38.500 53.500 34M13 43Q32 47.500 51 43" fill="none" stroke="#a77345" stroke-width="1.800"/>
<rect x="21" y="11" width="22" height="6" rx="1.500" fill="#4c3026"/>
<rect x="21" y="50" width="22" height="6" rx="1.500" fill="#4c3026"/>
<path d="M32 56V62" stroke="#b64e3d" stroke-width="2.500" stroke-linecap="round"/>`),
  ashSandals: svg(`<g transform="translate(32 32) rotate(-8)">
<ellipse cx="2.500" cy="2.500" rx="13" ry="27" fill="#2f2b2c"/>
<ellipse rx="13" ry="27" fill="#8a7f7c"/>
<path d="M-11 -14H11M-12 -6H12M-12 2H12M-12 10H12M-10 18H10" stroke="#6e6462" stroke-width="1.400"/>
<path d="M-10 -22Q0 -34 10 -22" fill="none" stroke="#6e6462" stroke-width="4.500" stroke-linecap="round"/>
<path d="M-11 -4L8 16M11 -4L-8 16" stroke="#d0a647" stroke-width="3.200" stroke-linecap="round"/>
<rect x="-12" y="17" width="24" height="6" rx="2" fill="#e8c94d"/></g>`),
  ship: svg(`
<rect x="19.500" y="6" width="2.600" height="34" fill="#5b3d2a"/>
<path d="M20 5L9 7.500L20 10Z" fill="#284a74"/>
<rect x="22" y="9" width="14" height="25" fill="#f3ead2"/>
<path d="M22 15.500H36M22 22H36M22 28.500H36" stroke="#cfbf98" stroke-width="1.400"/>
<path d="M33 27L43 20L53 27Z" fill="#50575f"/>
<rect x="35" y="27" width="16" height="11" fill="#7b5638"/>
<rect x="40" y="30" width="6" height="4.500" fill="#f2c079"/>
<path d="M4 38H60L52 53H12Z" fill="#a8784f"/>
<path d="M10 47H54L52 53H12Z" fill="#4f3b2e"/>
<rect x="4" y="36.500" width="56" height="3.500" rx="1.500" fill="#cf9e68"/>
${WATER}`),
  pilgrimsWake: svg(`
<defs><radialGradient id="gear-wake-glow" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color="#ffe9a6"/><stop offset="1" stop-color="#ffe9a600"/></radialGradient></defs>
<circle cx="32" cy="36" r="30" fill="url(#gear-wake-glow)"/>
<rect x="17" y="18" width="5.500" height="38" fill="#b64e3d"/>
<rect x="41.500" y="18" width="5.500" height="38" fill="#b64e3d"/>
<rect x="14" y="27" width="36" height="4.500" fill="#c9604b"/>
<path d="M6 13Q32 7 58 13L55.500 20H8.500Z" fill="#2f2b2c"/>
<path d="M9 11.500Q32 6 55 11.500L56 14Q32 8.500 8 14Z" fill="#b64e3d"/>
<ellipse cx="29" cy="50" rx="2.800" ry="4.800" fill="#7a5538" transform="rotate(-12 29 50)"/>
<ellipse cx="36" cy="42" rx="2.800" ry="4.800" fill="#7a5538" transform="rotate(12 36 42)"/>
<path d="M50 40l1.400 3.600L55 45l-3.600 1.400L50 50l-1.400-3.600L45 45l3.600-1.400Z" fill="#f2c079"/>`),
};

/** The toolbar's backpack: a canvas pack with a flap, buckle and shoulder strap. */
export const BACKPACK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
<path d="M17 10C17 3 31 3 31 10" fill="none" stroke="#6e3f24" stroke-width="3" stroke-linecap="round"/>
<path d="M9 22C9 12 15 9 24 9S39 12 39 22V40Q39 44 35 44H13Q9 44 9 40Z" fill="#b9733f"/>
<path d="M9 22C9 12 15 9 24 9S39 12 39 22Q39 29 24 29T9 22Z" fill="#8f4f2b"/>
<rect x="14" y="31" width="20" height="10" rx="2.500" fill="#d08c52" stroke="#8f4f2b" stroke-width="1.500"/>
<rect x="20.500" y="25" width="7" height="6.500" rx="1.500" fill="#e8c94d" stroke="#8f4f2b" stroke-width="1.200"/>
<path d="M9 28Q4 31 5.500 40" fill="none" stroke="#6e3f24" stroke-width="3" stroke-linecap="round"/></svg>`;
