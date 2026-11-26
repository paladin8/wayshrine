import { packager } from "@electron/packager";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const targets = new Map(Object.entries({
  windows: { platform: "win32", arch: "x64" },
  mac: { platform: "darwin", arch: "universal" },
}));
const defaultTarget = { win32: "windows", darwin: "mac" }[process.platform];
const target = targets.get(process.argv[2] ?? defaultTarget);
if (!target) throw new Error("Choose a desktop target: windows or mac");

const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const dist = join(root, "dist");
const mac = target.platform === "darwin";
const icon = join(root, "desktop", "icons", mac ? "wayshrine.icns" : "wayshrine.ico");
await Promise.all([access(join(dist, "index.html")), access(icon)]);

const staging = await mkdtemp(join(tmpdir(), "wayshrine-package-"));
try {
  const appDirectory = join(staging, "app");
  const licenses = join(staging, "notices");
  await Promise.all([mkdir(appDirectory), mkdir(licenses)]);
  await Promise.all([
    copyFile(join(root, "desktop", "main.cjs"), join(appDirectory, "main.cjs")),
    copyFile(join(root, "desktop", "preload.cjs"), join(appDirectory, "preload.cjs")),
    writeFile(join(appDirectory, "package.json"), JSON.stringify({
      name: manifest.name,
      productName: "Wayshrine",
      version: manifest.version,
      main: "main.cjs",
      license: manifest.license,
    })),
    copyFile(join(root, "LICENSE"), join(licenses, "LICENSE")),
    copyFile(join(root, "NOTICE"), join(licenses, "NOTICE")),
    copyFile(join(root, "content", "LICENSE.md"), join(licenses, "content-LICENSE.md")),
  ]);

  const identity = process.env.WAYSHRINE_MAC_SIGN_IDENTITY;
  const notaryProfile = process.env.WAYSHRINE_MAC_NOTARY_PROFILE;
  if (mac && notaryProfile && !identity) {
    throw new Error("Notarization requires a Developer ID signing identity");
  }

  const bundles = await packager({
    dir: appDirectory,
    tmpdir: staging,
    out: join(root, "release"),
    name: "Wayshrine",
    appBundleId: "io.github.paladin8.wayshrine",
    electronVersion: manifest.devDependencies.electron,
    ...target,
    icon,
    asar: true,
    extraResource: [dist, licenses],
    overwrite: true,
    ...(mac && { osxSign: {
      identity: identity || "-",
      identityValidation: Boolean(identity),
      ignore: /\/Contents\/Resources\/(?:dist|notices)\//.source,
      // Test builds have no team ID for hardened runtime library validation.
      ...(!identity && { optionsForFile: () => ({ hardenedRuntime: false, timestamp: "none" }) }),
      continueOnError: false,
    } }),
    ...(mac && notaryProfile && { osxNotarize: { keychainProfile: notaryProfile } }),
  });
  for (const bundle of bundles) {
    const appBundle = join(bundle, "Wayshrine.app", "Contents");
    const resources = mac ? join(appBundle, "Resources") : join(bundle, "resources");
    await Promise.all([
      access(mac ? join(appBundle, "MacOS", "Wayshrine") : join(bundle, "Wayshrine.exe")),
      access(join(resources, "app.asar")),
      access(join(resources, "dist", "index.html")),
      access(join(resources, "notices", "content-LICENSE.md")),
    ]);
    console.log(`Packaged ${bundle}`);
  }
} finally {
  await rm(staging, { recursive: true, force: true });
}
