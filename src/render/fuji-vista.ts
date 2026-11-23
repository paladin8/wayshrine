import * as THREE from "three";
import type { TrainFrame } from "../game";
import { disposeObject } from "./dispose";
import { buildFujiCountryside } from "./fuji-countryside";
import { buildLandmark } from "./landmark-mesh";
import type { ShrineMesh } from "./shrine-mesh";

const horizon = new THREE.Color(0xc7dff0);
const zenith = new THREE.Color(0x408ed9);

function clearSky(): THREE.DataTexture {
  const rows = 128;
  const pixels = new Uint8Array(rows * 4);
  const sample = new THREE.Color();
  const rgb = { r: 0, g: 0, b: 0 };
  for (let i = 0; i < rows; i++) {
    const height = i / (rows - 1);
    const blend = THREE.MathUtils.smoothstep(height, 0.29, 0.98);
    sample.copy(horizon).lerp(zenith, blend).getRGB(rgb, THREE.SRGBColorSpace);
    pixels.set([Math.round(rgb.r * 255), Math.round(rgb.g * 255), Math.round(rgb.b * 255), 255], i * 4);
  }
  const texture = new THREE.DataTexture(pixels, 1, rows);
  texture.name = "Clear sky above Fuji";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** The seat travels through an authored scene in both directions on the same timeline as the map train. */
export function createFujiVista() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.3, 1960);
  const asset = new THREE.Group();
  let landmark: ShrineMesh | undefined;
  let updateCountryside: ((seconds: number, cameraX: number) => void) | undefined;

  function load(): void {
    if (landmark) return;
    scene.background = clearSky();
    scene.fog = new THREE.Fog(horizon, 148, 1040);
    scene.add(new THREE.HemisphereLight(0xe1eeff, 0xb4ab81, 1.69));
    const sun = new THREE.DirectionalLight(0xfff1d8, 2.25);
    sun.position.set(-73, 119, 61);
    scene.add(sun);
    updateCountryside = buildFujiCountryside(scene);
    landmark = buildLandmark("mount-fuji");
    asset.add(landmark.group);
    landmark.setVitality(1);
  }

  function installMountain(): boolean {
    if (!landmark) return false;
    if (!landmark.modelReady?.()) return false;
    const mountain = landmark.group.getObjectByName("fuji_mountain");
    if (!mountain) return false;
    scene.add(mountain);
    mountain.position.set(21, -38, -1090);
    mountain.scale.set(36, 33, 36);
    mountain.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      part.castShadow = false;
      part.receiveShadow = false;
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        const snow = material.name.startsWith("mountain_snow");
        material.color.lerp(horizon, snow ? 0.12 : 0.31);
        material.fog = false;
      }
    });
    disposeObject(landmark.group);
    asset.remove(landmark.group);
    landmark = undefined;
    return true;
  }

  let loaded = false;
  return {
    load() {
      if (!loaded) load();
    },
    ready() {
      loaded ||= installMountain();
      return loaded;
    },
    resize(aspect: number) {
      camera.aspect = aspect;
      camera.fov = Math.max(48, THREE.MathUtils.radToDeg(2 * Math.atan(0.49 / Math.max(0.76, aspect))));
      camera.updateProjectionMatrix();
    },
    render(renderer: THREE.WebGLRenderer, frame: TrainFrame, seconds: number) {
      const progress = frame.routeProgress;
      // Ease through the open field at the centre so the principal view has time to settle.
      const distance = progress + 0.047 * Math.sin(progress * Math.PI * 2);
      const x = THREE.MathUtils.lerp(-624, 624, distance);
      const y = 2.45 + Math.sin(progress * Math.PI) * 0.14;
      camera.position.set(x, y, 0);
      camera.lookAt(x + frame.direction * 5.5, y + 2.1, -125);
      updateCountryside?.(seconds, x);
      renderer.render(scene, camera);
    },
  };
}
