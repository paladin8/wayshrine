import * as THREE from "three";

/** A drawable chunk of the world whose colours follow region vitality. */
export interface VitalityMesh {
  readonly object: THREE.Object3D;
  readonly regionIds: ReadonlySet<string>;
  /** Recolours: 0 is dead and grey, 1 is fully alive. */
  applyVitality(vitalityOf: (regionId: string) => number): void;
  dispose(): void;
}

/** A dead colour: the same hue drained of saturation and darkened. */
export function deadOf(c: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.12, hsl.l * 0.62);
}

/**
 * Accumulates flat-coloured triangles belonging to regions, then builds one
 * mesh. Both the alive and dead colour of every vertex are kept, so a region
 * can be recoloured without rebuilding geometry.
 */
export class VitalityBuilder {
  private readonly positions: number[] = [];
  private readonly alive: number[] = [];
  private readonly dead: number[] = [];
  private readonly vertexRegion: number[] = [];
  private readonly regionList: string[] = [];
  private readonly regionIndex = new Map<string, number>();

  /** Adds non-indexed triangles: `positions` holds x,y,z per vertex, three vertices per triangle. */
  addTriangles(positions: ArrayLike<number>, color: THREE.Color, regionId: string): void {
    let region = this.regionIndex.get(regionId);
    if (region === undefined) {
      region = this.regionList.length;
      this.regionList.push(regionId);
      this.regionIndex.set(regionId, region);
    }
    const dc = deadOf(color);
    for (let i = 0; i < positions.length; i += 3) {
      this.positions.push(positions[i]!, positions[i + 1]!, positions[i + 2]!);
      this.alive.push(color.r, color.g, color.b);
      this.dead.push(dc.r, dc.g, dc.b);
      this.vertexRegion.push(region);
    }
  }

  get isEmpty(): boolean {
    return this.positions.length === 0;
  }

  build(vitalityOf: (regionId: string) => number): VitalityMesh {
    const { alive, dead, vertexRegion, regionList } = this;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    const colors = new Float32Array(alive);
    const colorAttr = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute("color", colorAttr);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const applyVitality = (v: (regionId: string) => number): void => {
      const perRegion = regionList.map((id) => Math.min(1, Math.max(0, v(id))));
      for (let i = 0; i < vertexRegion.length; i++) {
        const t = perRegion[vertexRegion[i]!]!;
        for (let k = 0; k < 3; k++) {
          const j = i * 3 + k;
          colors[j] = dead[j]! + (alive[j]! - dead[j]!) * t;
        }
      }
      colorAttr.needsUpdate = true;
    };
    applyVitality(vitalityOf);

    return {
      object: mesh,
      regionIds: new Set(regionList),
      applyVitality,
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    };
  }
}

/** Combines several meshes into one object that is recoloured and freed together. */
export function combine(parts: readonly VitalityMesh[]): VitalityMesh {
  const object = new THREE.Group();
  const ids = new Set<string>();
  for (const p of parts) {
    object.add(p.object);
    p.regionIds.forEach((id) => ids.add(id));
  }
  return {
    object,
    regionIds: ids,
    applyVitality: (v) => parts.forEach((p) => p.applyVitality(v)),
    dispose: () => parts.forEach((p) => p.dispose()),
  };
}
