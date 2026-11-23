import * as THREE from "three";
import { railPoint, type FujiRailway } from "../world";
import { disposeObject } from "./dispose";

const horizon = new THREE.Color(0xc0dded);
const zenith = new THREE.Color(0x4994da);

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

interface AerialTint {
  readonly source: THREE.MeshStandardMaterial;
  readonly material: THREE.MeshStandardMaterial;
  readonly haze: number;
}

/** Reuse the landmark's authored mountain, at a distance that gives it believable parallax from the seat. */
export function createFujiVista(line: FujiRailway) {
  const root = new THREE.Group();
  root.name = "Fuji railway panorama";
  root.visible = false;
  const sky = clearSky();
  const fog = new THREE.Fog(horizon, 43, 83);
  const mountainPosition = railPoint(line, 0, -105);
  let source: THREE.Object3D | undefined;
  let panorama: THREE.Object3D | undefined;
  const tints: AerialTint[] = [];

  function copyMaterial(source: THREE.Material): THREE.Material {
    const material = source.clone();
    if (source instanceof THREE.MeshStandardMaterial && material instanceof THREE.MeshStandardMaterial) {
      const snow = material.name.startsWith("mountain_snow");
      material.fog = false;
      material.emissiveIntensity = snow ? 0.19 : 0.05;
      tints.push({ source, material, haze: snow ? 0.08 : 0.24 });
    }
    return material;
  }

  function replaceMountain(mountain: THREE.Object3D): void {
    tints.length = 0;
    if (panorama) {
      root.remove(panorama);
      disposeObject(panorama);
    }
    source = mountain;
    panorama = mountain.clone();
    panorama.position.set(mountainPosition.x, 0.5, mountainPosition.z);
    panorama.scale.set(3.7, 3.55, 3.7);
    panorama.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      part.geometry = part.geometry.clone();
      part.material = Array.isArray(part.material) ? part.material.map(copyMaterial) : copyMaterial(part.material);
      part.castShadow = false;
      part.receiveShadow = false;
    });
    root.add(panorama);
  }

  function prepare(mountain: THREE.Object3D): void {
    if (source !== mountain) replaceMountain(mountain);
    for (const { source, material, haze } of tints) {
      material.color.copy(source.color).lerp(horizon, haze);
      material.emissive.copy(material.color);
    }
  }

  return { root, sky, fog, prepare };
}
