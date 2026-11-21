import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Enforces the layering described in docs/ARCHITECTURE.md. If this test fails,
 * either fix the import or change the architecture on purpose (and update the doc).
 */

const LAYERS = ["core", "world", "game", "render", "audio", "app"] as const;
type Layer = (typeof LAYERS)[number];

/** Which layers each layer may import from. Dependencies point one way. */
const ALLOWED: Record<Layer, readonly Layer[]> = {
  core: [],
  world: ["core"],
  game: ["core", "world"],
  render: ["core", "world", "game"],
  audio: ["core", "world", "game"],
  app: ["core", "world", "game", "render", "audio"],
};

const SRC = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
  );
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function specifiers(code: string): string[] {
  return [...code.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
}

interface Source {
  file: string;
  layer: Layer;
  code: string;
}

const sources: Source[] = walk(SRC).flatMap((path) => {
  const file = relative(SRC, path);
  const parts = file.split(sep);
  const layer = parts[0] as Layer;
  if (parts.length < 2 || !LAYERS.includes(layer)) return [];
  return [{ file, layer, code: stripComments(readFileSync(path, "utf8")) }];
});

describe("architecture", () => {
  it("finds source files in every layer", () => {
    for (const layer of LAYERS) {
      expect(sources.filter((s) => s.layer === layer).length, layer).toBeGreaterThan(0);
    }
  });

  it("only imports downward through layer roots", () => {
    const violations: string[] = [];
    for (const s of sources) {
      for (const spec of specifiers(s.code)) {
        if (!spec.startsWith(".")) continue;
        const target = relative(SRC, resolve(SRC, dirname(s.file), spec)).split(sep);
        const targetLayer = target[0] as Layer;
        if (!LAYERS.includes(targetLayer) || targetLayer === s.layer) continue;
        if (!ALLOWED[s.layer].includes(targetLayer)) {
          violations.push(`${s.file}: ${s.layer} must not import ${targetLayer} (${spec})`);
        } else if (!(target.length === 1 || (target.length === 2 && target[1] === "index"))) {
          violations.push(`${s.file}: ${spec} reaches inside ${targetLayer}; import from its index`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps three.js inside render", () => {
    const violations = sources
      .filter((s) => s.layer !== "render")
      .filter((s) => specifiers(s.code).some((spec) => spec === "three" || spec.startsWith("three/")))
      .map((s) => s.file);
    expect(violations).toEqual([]);
  });

  it("keeps browser globals out of core, world and game", () => {
    const pattern = /\b(window|document|navigator|localStorage|requestAnimationFrame)\b/;
    const violations = sources
      .filter((s) => s.layer === "core" || s.layer === "world" || s.layer === "game")
      .filter((s) => pattern.test(s.code))
      .map((s) => s.file);
    expect(violations).toEqual([]);
  });

  it("uses only seeded randomness outside app", () => {
    const violations = sources
      .filter((s) => s.layer !== "app")
      .filter((s) => /Math\.random\b/.test(s.code))
      .map((s) => s.file);
    expect(violations).toEqual([]);
  });
});
