import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { HOKORA_SETBACK } from "../world";
import { buildCharacter, type Character, type CharacterVariant } from "./character";
import { buildHokora } from "./shrine-mesh";
import { browserTraits, createFrameGovernor, renderQuality, startingPixelRatio } from "./quality";

/**
 * The title screen's backdrop: the Blender scene in public/models/title/title.glb (made by content/title/title.py),
 * drawn live. A wayshrine on an island in a lake at sunset with the traveller resting beside it, the peak and the
 * ranges behind, lanterns afloat. The sun breathes, the water ripples and mirrors the scene, lanterns bob, petals
 * fall, mist drifts, the trees stir and the view drifts very slowly.
 */
export interface TitleScene {
  readonly canvas: HTMLCanvasElement;
  /** Resolves true once the scene is drawn (the canvas has faded in), false if it couldn't load. */
  readonly ready: Promise<boolean>;
  /** Swaps the resting traveller's body (the player's setting) without reloading the scene. */
  setCharacter(variant: CharacterVariant): void;
  destroy(): void;
}

export interface TitleSceneOptions {
  /** Draw a still scene: no drift, no ripples, no falling petals. */
  readonly reducedMotion: boolean;
  /** Which traveller sits by the shrine. */
  readonly character: CharacterVariant;
}

const MODEL_URL = `${import.meta.env.BASE_URL}models/title/title.glb`;

const SKY_TOP = new THREE.Color("#e9b9aa");
const SKY_MID = new THREE.Color("#f7d9c2");
const SKY_HORIZON = new THREE.Color("#f8e9d6");
const SUN_GLOW = new THREE.Color("#f6b49a");
const HAZE = new THREE.Color("#f2dccb");
const WATER_NEAR = new THREE.Color("#4f8691");
const WATER_FAR = new THREE.Color("#a9c3c3");
const LANTERN_GLOW = new THREE.Color("#ffcf7a");

/** The authored framing is 16:9; narrower screens widen the vertical view so nothing at the sides is lost. */
const AUTHORED_ASPECT = 16 / 9;
const MAX_FOV = 58;

/** Floating lanterns: resting place on the water (game x, z) and how far each wanders. */
const LANTERNS: ReadonlyArray<readonly [number, number, number]> = [
  [-1.2, 1.6, 0.6], [0.4, 4.4, 0.8], [2.6, 7.2, 0.9], [4.8, 2.4, 1.0], [6.6, -1.8, 1.2],
  [2.0, -6.2, 1.4], [8.8, -8.0, 1.5], [3.6, -2.6, 1.1], [10.6, 1.8, 0.9],
];
const PETALS = 70;

export function createTitleScene(container: HTMLElement, { reducedMotion, character }: TitleSceneOptions): TitleScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  const device = browserTraits();
  const quality = renderQuality(device);
  renderer.setPixelRatio(startingPixelRatio(quality, device));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = "ts-scene ts-3d";
  canvas.style.opacity = "0";
  canvas.style.transition = "opacity 1.4s ease";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 70, 640);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 1200);
  const disposables: Array<{ dispose(): void }> = [];
  let raf = 0;
  let last = 0;
  let clock = 0;
  let destroyed = false;
  let loaded = false;
  let portraitTurn = 0;

  // ---- light: a warm evening key from the sun's side, the left and a soft sky fill
  const fill = new THREE.HemisphereLight(0xfff0e4, 0xc4b49c, 1.35);
  const key = new THREE.DirectionalLight(0xffd6b4, 2.2);
  key.position.set(-5.6 - 22, 30, -4.4 + 26);
  key.target.position.set(-5.6, 0, -4.4);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 5, far: 90 });
  scene.add(fill, key, key.target);

  // ---- sky: a gradient dome that follows the camera, warmer round the sun
  const sunDir = new THREE.Vector3(0.2, 0.22, -1).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: SKY_TOP }, uMid: { value: SKY_MID }, uHorizon: { value: SKY_HORIZON },
      uGlow: { value: SUN_GLOW }, uSun: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.16, h));
        c = mix(c, uTop, smoothstep(0.14, 0.62, h));
        float g = max(dot(d, uSun), 0.0);
        c = mix(c, uGlow, 0.55 * pow(g, 14.0) + 0.18 * pow(g, 3.0));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);
  disposables.push(sky.geometry, skyMat);

  // ---- the lake: a mirror of everything above it, rippled, tinted deeper close by, with the sun's path on it
  const water = new Reflector(new THREE.PlaneGeometry(2400, 2400), {
    textureWidth: 512,
    textureHeight: 512,
    clipBias: 0.002,
    multisample: 0,
    shader: {
      name: "TitleWater",
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
          uTime: { value: 0 }, uNear: { value: WATER_NEAR }, uFar: { value: WATER_FAR },
          uSun: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() },
        },
      ]),
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vUv;
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float uTime; uniform vec3 uNear; uniform vec3 uFar;
        uniform vec3 uSun; uniform vec3 uCam;
        varying vec4 vUv;
        varying vec3 vWorld;
        #include <fog_pars_fragment>
        void main() {
          vec2 rel = vWorld.xz - uCam.xz;
          float dist = length(rel);
          float near = 1.0 / (1.0 + dist * 0.035);
          // a few travelling ripples break the reflection up, more strongly close by
          float w1 = sin(vWorld.x * 0.7 + vWorld.z * 0.25 + uTime * 0.7);
          float w2 = sin(vWorld.z * 1.9 - uTime * 1.05 + sin(vWorld.x * 0.35 + uTime * 0.2) * 1.6);
          float w3 = sin(vWorld.x * 2.6 - vWorld.z * 1.4 + uTime * 1.7);
          vec4 uv = vUv;
          uv.xy += vec2(w1 * 0.006 + w3 * 0.003, w2 * 0.009 + w3 * 0.002) * (0.35 + near) * uv.w;
          vec3 refl = texture2DProj(tDiffuse, uv).rgb;
          float far = smoothstep(4.0, 170.0, dist);
          vec3 c = mix(mix(uNear, uFar, far), refl, mix(0.42, 0.8, far));
          // long pale glints drifting across the water
          float glint = smoothstep(0.93, 1.0, sin(vWorld.z * 2.4 + w1 * 1.2 + uTime * 0.35) * sin(vWorld.x * 0.21 - uTime * 0.18 + vWorld.z * 0.05));
          c += vec3(1.0, 0.97, 0.92) * glint * 0.22 * (1.0 - far * 0.7);
          // the sun's path: a column of sparkle running out toward it
          vec2 toSun = normalize(uSun.xz - uCam.xz);
          float along = dot(rel, toSun);
          float across = abs(rel.x * toSun.y - rel.y * toSun.x);
          float width = 0.6 + along * 0.075;
          float path = along > 0.0 ? exp(-pow(across / width, 2.0)) : 0.0;
          float sparkle = smoothstep(0.55, 1.0, sin(vWorld.x * 3.1 + uTime * 1.9 + w2) * sin(vWorld.z * 5.3 - uTime * 1.2));
          c += vec3(1.0, 0.72, 0.56) * path * (0.08 + 0.55 * sparkle) * smoothstep(6.0, 60.0, along);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    },
  });
  water.rotation.x = -Math.PI / 2;
  // The sun's disc isn't mirrored (its reflection would be a hard red blot); the water draws its path instead.
  const mirror = water.onBeforeRender.bind(water);
  water.onBeforeRender = (...args) => {
    sun.visible = false;
    mirror(...args);
    sun.visible = true;
  };
  const waterMat = water.material as THREE.ShaderMaterial;
  waterMat.fog = true;
  scene.add(water);
  disposables.push(water.geometry, water);
  const waterUniforms = waterMat.uniforms;

  // ---- soft round sprites: the sun's disc and halo, the lanterns' glow
  const roundTexture = (soft: number): THREE.CanvasTexture => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(Math.max(0, 1 - soft), "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    disposables.push(t);
    return t;
  };
  const discTex = roundTexture(0.04);
  const haloTex = roundTexture(1);
  const sprite = (tex: THREE.Texture, color: THREE.ColorRepresentation, opacity: number, additive = false): THREE.Sprite => {
    const m = new THREE.SpriteMaterial({
      map: tex, color, opacity, transparent: true, depthWrite: false, fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    disposables.push(m);
    return new THREE.Sprite(m);
  };
  const sun = new THREE.Group();
  const sunHalo = [sprite(haloTex, "#f4a084", 0.4), sprite(haloTex, "#ee8a72", 0.5)];
  const sunDisc = sprite(discTex, "#e0574a", 1);
  sun.add(...sunHalo, sunDisc);
  scene.add(sun);

  // ---- mist: long soft bands low over the far water, drifting
  const mistTex = (() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 32;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, "rgba(255,250,240,0)");
    grad.addColorStop(0.2, "rgba(255,250,240,1)");
    grad.addColorStop(0.8, "rgba(255,250,240,1)");
    grad.addColorStop(1, "rgba(255,250,240,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 32);
    g.globalCompositeOperation = "destination-in";
    const v = g.createLinearGradient(0, 0, 0, 32);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(0.5, "rgba(0,0,0,1)");
    v.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = v;
    g.fillRect(0, 0, 256, 32);
    const t = new THREE.CanvasTexture(c);
    disposables.push(t);
    return t;
  })();
  const mistGeo = new THREE.PlaneGeometry(1, 1);
  disposables.push(mistGeo);
  const mists = [
    { x: -30, y: 5.5, z: -150, w: 420, h: 9, o: 0.55, amp: 40 },
    { x: 60, y: 3.2, z: -105, w: 330, h: 5, o: 0.45, amp: 34 },
    { x: -80, y: 9, z: -230, w: 520, h: 14, o: 0.4, amp: 50 },
  ].map((m, i) => {
    const mat = new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: m.o, depthWrite: false, fog: false });
    disposables.push(mat);
    const mesh = new THREE.Mesh(mistGeo, mat);
    mesh.scale.set(m.w, m.h, 1);
    mesh.position.set(m.x, m.y, m.z);
    scene.add(mesh);
    return { mesh, ...m, phase: i * 2.1 };
  });

  // ---- petals: pink flakes drifting down across the view from the island's cherry
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, -0.05);
  petalShape.quadraticCurveTo(0.055, -0.01, 0.035, 0.045);
  petalShape.lineTo(0, 0.03);
  petalShape.lineTo(-0.035, 0.045);
  petalShape.quadraticCurveTo(-0.055, -0.01, 0, -0.05);
  const petalGeo = new THREE.ShapeGeometry(petalShape, 2);
  const petalMat = new THREE.MeshStandardMaterial({ color: "#f4b9c0", side: THREE.DoubleSide, flatShading: true, roughness: 1 });
  disposables.push(petalGeo, petalMat);
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, PETALS);
  petals.frustumCulled = false;
  scene.add(petals);
  const petalState = Array.from({ length: PETALS }, () => spawnPetal(true));
  function spawnPetal(anywhere: boolean) {
    return {
      x: -16 + Math.random() * 30,
      y: anywhere ? Math.random() * 11 : 10 + Math.random() * 3,
      z: -6 + Math.random() * 22,
      fall: 0.35 + Math.random() * 0.35,
      drift: -0.25 - Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
      spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(),
      rate: 0.8 + Math.random() * 1.6,
      size: 0.8 + Math.random() * 0.6,
    };
  }
  const petalMatrix = new THREE.Matrix4();
  const petalQuat = new THREE.Quaternion();
  const petalPos = new THREE.Vector3();
  const petalScale = new THREE.Vector3();

  // ---- the model
  const baseCamPos = new THREE.Vector3(0, 3.6, 24.5);
  const baseCamQuat = new THREE.Quaternion();
  const baseForward = new THREE.Vector3(0, 0, -1);
  let authoredFov = 34;
  let variant = character;
  let traveller: Character | null = null;
  let travellerSpot: THREE.Object3D | null = null;
  let rock: THREE.Mesh | null = null;
  const sway: Array<{ node: THREE.Object3D; phase: number; amount: number }> = [];
  const lanterns: Array<{ node: THREE.Object3D; glow: THREE.Sprite; x: number; z: number; wander: number; phase: number }> = [];
  const glows: THREE.MeshStandardMaterial[] = [];
  const ishidoroGlow = sprite(haloTex, LANTERN_GLOW, 0.26, true);

  const prepare = (root: THREE.Object3D): void => {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const m = o.material as THREE.MeshStandardMaterial;
      m.flatShading = true;
      m.roughness = 1;
      m.metalness = 0;
      if (o.name.startsWith("glow_") || m.name.startsWith("glow_")) {
        m.emissive = m.color.clone();
        m.emissiveIntensity = 1.1;
        if (!glows.includes(m)) glows.push(m);
      }
      m.needsUpdate = true;
    });
  };
  const near = (o: THREE.Object3D): boolean => !/^(mtn_|shore)/.test(o.name);

  /** A low faceted boulder, flat on top, for her to sit on. */
  const buildRock = (): THREE.Mesh => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = 1 + 0.13 * Math.sin(x * 4.1 + z * 2.3 + y * 1.7) + 0.08 * Math.sin(z * 5.3 - x * 1.9);
      pos.setXYZ(i, x * k, Math.min(y * k, 0.82), z * k);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: "#a39e98", flatShading: true, roughness: 1 });
    disposables.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  /** Puts the traveller (the current body) on her rock: feet on the ground, hands in her lap. */
  const seatTraveller = (): void => {
    const spot = travellerSpot;
    if (!spot) return;
    if (traveller) {
      spot.remove(traveller.root);
      traveller.dispose();
    }
    traveller = buildCharacter(variant);
    traveller.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    traveller.setLapRest(1);
    spot.add(traveller.root);
    traveller.update(1, 0, 1);
    traveller.update(1, 0, 1);
    // Sat on a seat she has no seat for: drop her until her feet reach the ground, and set the rock under her hips.
    spot.updateWorldMatrix(true, true);
    const ground = spot.getWorldPosition(new THREE.Vector3()).y;
    const drop = new THREE.Box3().setFromObject(traveller.root).min.y - ground;
    traveller.root.position.y = -drop;
    spot.updateWorldMatrix(true, true);
    const pelvis = traveller.root.getObjectByName("pelvis");
    const hips = (pelvis ? pelvis.getWorldPosition(new THREE.Vector3()).y : ground + 0.5) - ground;
    if (!rock) {
      rock = buildRock();
      spot.add(rock);
    }
    // The seat stops under her hips and short of her knees, so thighs and shins clear it.
    const height = Math.max(0.2, hips - 0.12);
    rock.scale.set(0.4, (height + 0.12) / 0.82, 0.27);
    rock.position.set(0, height - 0.82 * rock.scale.y, -0.13);
    if (reducedMotion && loaded) draw(0);
  };

  const ready = new GLTFLoader()
    .loadAsync(MODEL_URL)
    .then((gltf) => {
      if (destroyed) return false;
      const root = gltf.scene;
      prepare(root);
      root.updateMatrixWorld(true);
      // shadows only among the near things: the island, its trees, the traveller and the lanterns
      for (const child of root.children) {
        const casts = near(child);
        child.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = casts;
            o.receiveShadow = casts;
          }
        });
      }
      const cam = gltf.cameras[0];
      if (cam instanceof THREE.PerspectiveCamera) {
        cam.getWorldPosition(baseCamPos);
        cam.getWorldQuaternion(baseCamQuat);
        authoredFov = cam.fov;
      }
      baseForward.set(0, 0, -1).applyQuaternion(baseCamQuat);
      const spotSun = root.getObjectByName("spot_sun");
      if (spotSun) {
        spotSun.getWorldPosition(sun.position);
        sunDir.copy(sun.position).sub(baseCamPos).normalize();
        waterUniforms.uSun!.value.copy(sun.position);
        // sized against its distance, as the drawn sun was: a disc about a ninth of the view's height
        const d = sun.position.distanceTo(baseCamPos);
        const r = d * Math.tan(THREE.MathUtils.degToRad(authoredFov / 2)) * 0.24;
        sunDisc.scale.setScalar(r * 2);
        sunHalo[1]!.scale.setScalar(r * 3.1);
        sunHalo[0]!.scale.setScalar(r * 4.4);
      }
      const orb = root.getObjectByName("orb");
      if (orb) orb.visible = false;
      const ishidoro = root.getObjectByName("glow_ishidoro");
      if (ishidoro instanceof THREE.Mesh) {
        ishidoro.geometry.computeBoundingBox();
        ishidoro.geometry.boundingBox!.getCenter(ishidoroGlow.position);
        ishidoroGlow.scale.setScalar(0.95);
        ishidoro.add(ishidoroGlow);
      }
      root.traverse((o) => {
        if (o.name.startsWith("sway_")) sway.push({ node: o, phase: Math.random() * 6.28, amount: o.name.includes("island") || o.name.includes("cherry") ? 0.012 : 0.008 });
      });
      // Declutter the island: the bonsai goes, and the cherry takes its place by the traveller.
      const bonsai = root.getObjectByName("sway_pine_island");
      const cherry = root.getObjectByName("sway_cherry");
      if (bonsai && cherry) {
        bonsai.visible = false;
        cherry.position.set(bonsai.position.x, bonsai.position.y, bonsai.position.z);
      }
      // A hokora behind the gate, as at every shrine in the game: the game's own model, set on the island.
      const gate = root.getObjectByName("shrine");
      const island = root.getObjectByName("island");
      if (gate && island) {
        const centre = new THREE.Box3().setFromObject(gate).getCenter(new THREE.Vector3());
        const above = new THREE.Vector3(centre.x, centre.y + 20, centre.z - HOKORA_SETBACK);
        const hit = new THREE.Raycaster(above, new THREE.Vector3(0, -1, 0)).intersectObject(island, true)[0];
        if (hit) {
          const hokora = buildHokora("meadow");
          disposables.push(hokora.geometry, hokora.material as THREE.Material);
          // Sunk a little so the stone base meets the grass all round on the island's gentle slope.
          hokora.position.copy(root.worldToLocal(hit.point.clone().setY(hit.point.y - 0.06)));
          root.add(hokora);
        }
      }
      travellerSpot = root.getObjectByName("spot_traveller") ?? null;
      if (travellerSpot) seatTraveller();
      const toro = root.getObjectByName("toro");
      if (toro) {
        toro.visible = false;
        LANTERNS.forEach(([x, z, wander], i) => {
          const node = toro.clone();
          node.visible = true;
          node.rotation.y = Math.random() * Math.PI;
          const glow = sprite(haloTex, LANTERN_GLOW, 0.32, true);
          glow.scale.setScalar(1.5);
          glow.position.y = 0.25;
          node.add(glow);
          root.add(node);
          lanterns.push({ node, glow, x, z, wander, phase: i * 1.37 });
        });
      }
      scene.add(root);
      loaded = true;
      resize();
      frame(performance.now());
      canvas.style.opacity = "1";
      return true;
    })
    .catch(() => false);

  // ---- size: fill the container, keep the authored width of view on narrow screens
  const resize = (): void => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const halfH = THREE.MathUtils.degToRad(authoredFov / 2);
    const halfW = Math.atan(Math.tan(halfH) * AUTHORED_ASPECT);
    const wanted = camera.aspect < AUTHORED_ASPECT ? 2 * Math.atan(Math.tan(halfW) / camera.aspect) : 2 * halfH;
    camera.fov = Math.min(MAX_FOV, THREE.MathUtils.radToDeg(wanted));
    // On a tall screen the sides are lost anyway: turn a little toward the island so it stays in view.
    portraitTurn = 80 * Math.tan(THREE.MathUtils.degToRad(6)) * THREE.MathUtils.clamp((1.1 - camera.aspect) / 0.6, 0, 1);
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    water.getRenderTarget().setSize(Math.round(w * pr * 0.5), Math.round(h * pr * 0.5));
    if (reducedMotion && loaded) draw(0);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // ---- animation
  const lookTarget = new THREE.Vector3();
  const draw = (t: number): void => {
    // the view drifts, slowly enough that it reads only as depth
    camera.position.set(
      baseCamPos.x + Math.sin((t * Math.PI * 2) / 41) * 0.3,
      baseCamPos.y + Math.sin((t * Math.PI * 2) / 57 + 1) * 0.1,
      baseCamPos.z + Math.sin((t * Math.PI * 2) / 49 + 2) * 0.3,
    );
    lookTarget.copy(baseCamPos).addScaledVector(baseForward, 80);
    lookTarget.x -= portraitTurn;
    camera.lookAt(lookTarget);
    sky.position.copy(camera.position);
    waterUniforms.uTime!.value = t;
    waterUniforms.uCam!.value.copy(camera.position);

    const breathe = 1 + 0.035 * (0.5 - 0.5 * Math.cos((t * Math.PI * 2) / 9));
    for (const h of sunHalo) h.material.opacity = h === sunHalo[0] ? 0.4 * breathe : 0.5 * breathe;
    sun.scale.setScalar(breathe);

    for (const m of mists) m.mesh.position.x = m.x + Math.sin((t * Math.PI * 2) / 52 + m.phase) * m.amp;

    for (const s of sway) {
      s.node.rotation.z = Math.sin(t * 0.55 + s.phase) * s.amount;
      s.node.rotation.x = Math.sin(t * 0.37 + s.phase * 1.7) * s.amount * 0.6;
    }
    for (const l of lanterns) {
      l.node.position.set(l.x + Math.sin(t * 0.045 + l.phase) * l.wander, Math.sin(t * 1.1 + l.phase) * 0.035, l.z + Math.cos(t * 0.031 + l.phase) * l.wander * 0.4);
      l.node.rotation.x = Math.sin(t * 0.9 + l.phase) * 0.05;
      l.node.rotation.z = Math.cos(t * 0.8 + l.phase * 1.3) * 0.05;
      l.glow.material.opacity = 0.3 + 0.05 * Math.sin(t * 7 + l.phase * 5) + 0.03 * Math.sin(t * 13 + l.phase);
    }
    const flicker = 1.1 + 0.08 * Math.sin(t * 6.3) + 0.05 * Math.sin(t * 11.7);
    for (const g of glows) g.emissiveIntensity = flicker;

    for (let i = 0; i < PETALS; i++) {
      const p = petalState[i]!;
      if (reducedMotion) petalPos.set(p.x, p.y, p.z);
      else petalPos.set(p.x + Math.sin(t * 0.9 + p.phase) * 0.25, p.y, p.z);
      petalQuat.setFromAxisAngle(p.spin, t * p.rate + p.phase);
      petalScale.setScalar(p.size);
      petalMatrix.compose(petalPos, petalQuat, petalScale);
      petals.setMatrixAt(i, petalMatrix);
    }
    petals.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  };

  // The lake reflection's target follows the pixel ratio, so a step down re-sizes everything.
  const governor = createFrameGovernor(renderer.getPixelRatio(), quality.minPixelRatio, (ratio) => {
    renderer.setPixelRatio(ratio);
    resize();
  });
  const frame = (now: number): void => {
    governor.frame(now);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!reducedMotion) {
      clock += dt;
      traveller?.update(dt, 0, 1);
      for (let i = 0; i < PETALS; i++) {
        const p = petalState[i]!;
        p.y -= p.fall * dt;
        p.x += p.drift * dt;
        if (p.y < 0) petalState[i] = spawnPetal(false);
      }
    }
    draw(clock);
    if (!reducedMotion && !destroyed) raf = requestAnimationFrame(frame);
  };
  const onVisibility = (): void => {
    if (reducedMotion || destroyed) return;
    cancelAnimationFrame(raf);
    last = 0;
    if (!document.hidden && loaded) raf = requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    canvas,
    ready,
    setCharacter(next) {
      if (next === variant) return;
      variant = next;
      seatTraveller();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      traveller?.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        }
      });
      for (const d of disposables) d.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
