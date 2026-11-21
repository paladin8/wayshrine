import * as THREE from "three";
import { createRng } from "../core";
import { buildIsland, disposeGroup } from "./island-mesh";
import { palette } from "./palette";

/** World units visible vertically. */
const VIEW_SIZE = 16;

// Isometric view: the camera looks down the (1,1,1) diagonal, 35.26 degrees above
// the ground. Screen-right and screen-up are therefore fixed ground directions.
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
const SIN_ELEVATION = Math.sin(Math.atan(1 / Math.SQRT2));

/**
 * The renderer, isometric camera and lighting. The rest of the app talks to this
 * interface, so three.js stays inside this layer.
 */
export interface Stage {
  /** Replaces the demo island with one built from `seed`. */
  setDemoIsland(seed: string): void;
  /** Pans the camera by a screen-space drag, in pixels. */
  panBy(dxPixels: number, dyPixels: number): void;
  resize(widthPixels: number, heightPixels: number): void;
  render(): void;
}

export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.background);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  const target = new THREE.Vector3(0, 1, 0);
  const offset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(80);

  // Soft sky/ground fill plus one sun with a shadow map.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc4a8, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-10, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  scene.add(sun);

  let demo: THREE.Group | null = null;
  let heightPixels = 1;

  return {
    setDemoIsland(seed) {
      if (demo) {
        scene.remove(demo);
        disposeGroup(demo);
      }
      demo = buildIsland(createRng(seed));
      scene.add(demo);
    },
    panBy(dxPixels, dyPixels) {
      const unitsPerPixel = VIEW_SIZE / heightPixels;
      target.addScaledVector(RIGHT, -dxPixels * unitsPerPixel);
      target.addScaledVector(FORWARD, (dyPixels * unitsPerPixel) / SIN_ELEVATION);
    },
    resize(widthPixels, heightPx) {
      heightPixels = heightPx;
      const aspect = widthPixels / heightPx;
      renderer.setSize(widthPixels, heightPx);
      camera.left = (-VIEW_SIZE * aspect) / 2;
      camera.right = (VIEW_SIZE * aspect) / 2;
      camera.top = VIEW_SIZE / 2;
      camera.bottom = -VIEW_SIZE / 2;
      camera.updateProjectionMatrix();
    },
    render() {
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      sun.target.position.set(target.x, 0, target.z);
      sun.target.updateMatrixWorld();
      renderer.render(scene, camera);
    },
  };
}
