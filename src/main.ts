import * as THREE from "three";
import { createRng } from "./core/rng";
import { buildIsland } from "./world/island";
import { palette } from "./world/palette";

// ?seed=anything selects the world; the same seed always builds the same island.
const seed = new URLSearchParams(location.search).get("seed") ?? "wayshrine";
console.info(`wayshrine seed: ${seed}`);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(palette.background);

// Isometric view: orthographic camera looking down the (1,1,1) diagonal (35.26 degrees elevation).
const VIEW_SIZE = 16; // world units visible vertically
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
const camTarget = new THREE.Vector3(0, 1, 0);
const camOffset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(80);

function placeCamera(): void {
  camera.position.copy(camTarget).add(camOffset);
  camera.lookAt(camTarget);
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  renderer.setSize(w, h);
  camera.left = (-VIEW_SIZE * aspect) / 2;
  camera.right = (VIEW_SIZE * aspect) / 2;
  camera.top = VIEW_SIZE / 2;
  camera.bottom = -VIEW_SIZE / 2;
  camera.updateProjectionMatrix();
}

// Lighting: soft sky/ground fill plus one sun with a shadow map.
scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc4a8, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -16;
sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16;
sun.shadow.camera.bottom = -16;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
scene.add(sun);

scene.add(buildIsland(createRng(seed)));

// Drag to pan. Screen-right and screen-up are fixed ground directions in this view.
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
const SIN_ELEVATION = Math.sin(Math.atan(1 / Math.SQRT2));
let dragging = false;
window.addEventListener("pointerdown", () => (dragging = true));
window.addEventListener("pointerup", () => (dragging = false));
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const unitsPerPixel = VIEW_SIZE / window.innerHeight;
  camTarget.addScaledVector(RIGHT, -e.movementX * unitsPerPixel);
  camTarget.addScaledVector(FORWARD, (e.movementY * unitsPerPixel) / SIN_ELEVATION);
});

window.addEventListener("resize", resize);
resize();

function frame(): void {
  placeCamera();
  sun.target.position.set(camTarget.x, 0, camTarget.z);
  sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
