import * as THREE from "three";
import { buildBoat, buildScullingOar, buildWake } from "./boat-mesh";
import { buildShip } from "./ship-mesh";
import { buildCharacter, type Character, type CharacterVariant, type FootStep, type GearId, type LanternLighting } from "./character";

export interface PlayerMesh {
  readonly group: THREE.Group;
  readonly hull: THREE.Group;
  /** Swap the traveller's body (the rest of the pose and gear carry over). */
  setCharacter(variant: CharacterVariant): void;
  /** What the traveller wears or carries right now, or null for plain boots. */
  setGear(gear: GearId | null): void;
  /** Advance the walk cycle: `walking` is whether the player is moving this frame. Returns the feet that landed. */
  /** Draw the walking sticks from the pack: progress 0 to 1, or null. */
  setDraw(progress: number | null): void;
  setLanternLighting(lighting: LanternLighting | undefined): void;
  /** Crouch to strap on gear (see `Character.setCrouch`). */
  setCrouch(amount: number, fuss: number): void;
  animate(dt: number, walking: boolean): readonly FootStep[];
  setPose(seated: number, lift: number): void;
  setBoat(visible: boolean, wake: number, seconds: number): void;
  /** Show the ship in place of the boat; `gangway` is how far its boarding plank is out, 0 to 1. */
  setShip(visible: boolean, wake: number, seconds: number, gangway: number): void;
}

/** A small low-poly traveller, with a boat that appears on water. */
export function buildPlayer(initial: CharacterVariant = "female"): PlayerMesh {
  const group = new THREE.Group();
  const rider = new THREE.Group();
  group.add(rider);

  let variant = initial;
  let character: Character = buildCharacter(variant);
  rider.add(character.root);
  let gear: GearId | null = null;
  let seated = 0;
  let crouch = 0;
  let draw: number | null = null;
  let lighting: LanternLighting | undefined;
  let fuss = 0;

  const hull = new THREE.Group();
  const boat = buildBoat();
  const oar = buildScullingOar();
  const wake = buildWake();
  boat.add(oar);
  const ship = buildShip();
  const shipWake = buildWake();
  // The ship is about twice as long, so its wake starts at the transom and is wider.
  shipWake.group.scale.setScalar(1.7);
  shipWake.group.position.z = -1.3;
  ship.group.visible = false;
  shipWake.group.visible = false;
  hull.add(boat, wake.group, ship.group, shipWake.group);
  hull.visible = false;
  let boatShown = false;
  let shipShown = false;

  return {
    group,
    hull,
    setCharacter(next) {
      if (next === variant) return;
      variant = next;
      rider.remove(character.root);
      character.dispose();
      character = buildCharacter(variant);
      character.setGear(gear);
      character.setCrouch(crouch, fuss);
      character.setDraw(draw);
      character.setLanternLighting(lighting);
      rider.add(character.root);
    },
    setGear(next) {
      if (next === gear) return;
      gear = next;
      character.setGear(gear);
    },
    setDraw(progress) {
      draw = progress;
      character.setDraw(progress);
    },
    setLanternLighting(next) {
      lighting = next;
      character.setLanternLighting(next);
    },
    setCrouch(amount, fussing) {
      crouch = amount;
      fuss = fussing;
      character.setCrouch(amount, fussing);
    },
    animate(dt, walking) {
      return character.update(dt, walking ? 1 : 0, seated);
    },
    setPose(next, lift) {
      seated = next;
      rider.position.y = lift + 0.1 * next;
    },
    setBoat(visible, strength, seconds) {
      boatShown = visible;
      hull.visible = boatShown || shipShown;
      boat.visible = visible;
      if (!visible) {
        wake.group.visible = false;
        return;
      }
      boat.rotation.z = Math.sin(seconds * 2.7) * 0.035;
      oar.position.set(0.23, 0.445, -0.82);
      oar.rotation.set(-0.27, -0.18 + Math.sin(seconds * 5.2) * strength * 0.32, -0.12);
      wake.update(strength, seconds);
    },
    setShip(visible, strength, seconds, gangway) {
      shipShown = visible;
      hull.visible = boatShown || shipShown;
      ship.group.visible = visible;
      if (!visible) {
        shipWake.group.visible = false;
        return;
      }
      ship.update(seconds, gangway);
      shipWake.update(strength, seconds);
    },
  };
}
