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
const steamAppId = process.env.WAYSHRINE_STEAM_APP_ID || undefined;
if (steamAppId && (!/^[1-9]\d*$/.test(steamAppId) || Number(steamAppId) > 0xffffffff)) {
  throw new Error("WAYSHRINE_STEAM_APP_ID must be a Steam App ID");
}
await Promise.all([access(join(dist, "index.html")), access(icon)]);

const staging = await mkdtemp(join(tmpdir(), "wayshrine-package-"));
try {
  const appDirectory = join(staging, "app");
  const licenses = join(staging, "notices");
  const steamPackage = join(root, "node_modules", "steamworks.js");
  const steamResource = join(staging, "steamworks.js");
  const steamPlatform = mac ? "osx" : "win64";
  const steamBinaries = mac
    ? ["steamworksjs.darwin-x64.node", "steamworksjs.darwin-arm64.node", "libsteam_api.dylib"]
    : ["steamworksjs.win32-x64-msvc.node", "steam_api64.dll"];
  const steamNative = join(steamResource, "dist", steamPlatform);
  await Promise.all([mkdir(appDirectory), mkdir(licenses), mkdir(steamNative, { recursive: true })]);
  await Promise.all([
    copyFile(join(root, "desktop", "main.cjs"), join(appDirectory, "main.cjs")),
    copyFile(join(root, "desktop", "preload.cjs"), join(appDirectory, "preload.cjs")),
    copyFile(join(root, "desktop", "steam.cjs"), join(appDirectory, "steam.cjs")),
    copyFile(join(root, "desktop", "steam-achievements.json"), join(appDirectory, "steam-achievements.json")),
    copyFile(join(steamPackage, "index.js"), join(steamResource, "index.js")),
    copyFile(join(steamPackage, "package.json"), join(steamResource, "package.json")),
    copyFile(join(steamPackage, "LICENSE"), join(steamResource, "LICENSE")),
    ...steamBinaries.map((name) => copyFile(join(steamPackage, "dist", steamPlatform, name), join(steamNative, name))),
    writeFile(join(appDirectory, "package.json"), JSON.stringify({
      name: manifest.name,
      productName: "Wayshrine",
      version: manifest.version,
      main: "main.cjs",
      license: manifest.license,
      steamAppId,
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
    extraResource: [dist, licenses, steamResource],
    // The upstream loader picks the matching native addon at runtime in a universal app.
    ...(mac && { osxUniversal: { x64ArchFiles: "**/steamworks.js/dist/osx/*.node" } }),
    overwrite: true,
    ...(mac && { osxSign: {
      identity: identity || "-",
      identityValidation: Boolean(identity),
      ignore: /\/Contents\/Resources\/(?:dist|notices)\//.source,
      // Test builds have no team ID for hardened runtime library validation.
      optionsForFile: (file) => {
        if (!identity) return { hardenedRuntime: false, timestamp: "none" };
        // The main process loads the Steam client's Valve-signed library.
        return file.endsWith("/Wayshrine.app") ? {
          entitlements: ["com.apple.security.cs.allow-jit", "com.apple.security.cs.disable-library-validation"],
        } : {};
      },
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
      ...steamBinaries.map((name) => access(join(resources, "steamworks.js", "dist", steamPlatform, name))),
    ]);
    console.log(`Packaged ${bundle}`);
  }
} finally {
  await rm(staging, { recursive: true, force: true });
}
