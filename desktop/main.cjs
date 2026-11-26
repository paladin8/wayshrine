const { app, BrowserWindow, net, protocol } = require("electron");
const { createReadStream } = require("node:fs");
const { stat } = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pathToFileURL } = require("node:url");
const { enableSteamOverlay, startSteam } = require("./steam.cjs");

const SCHEME = "app";
const HOST = "wayshrine";
const AUDIO_TYPES = new Map([[".mp3", "audio/mpeg"], [".wav", "audio/wav"]]);

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

// Chromium's file fetch does not expose byte ranges to the custom scheme.
async function serveAudio(file, request, mime) {
  const { size } = await stat(file);
  const headers = new Headers({ "Content-Type": mime, "Accept-Ranges": "bytes" });
  const range = request.headers.get("range");
  if (!range || request.method === "HEAD") {
    headers.set("Content-Length", String(size));
    const body = request.method === "HEAD" ? null : Readable.toWeb(createReadStream(file));
    return new Response(body, { headers });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2]));
  const end = match?.[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || start > end) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { headers, status: 416 });
  }

  headers.set("Content-Length", String(end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  const body = Readable.toWeb(createReadStream(file, { start, end }));
  return new Response(body, { headers, status: 206 });
}

function handleGameFiles(request) {
  const url = new URL(request.url);
  if (url.host !== HOST) return new Response(null, { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405 });
  }

  let requested;
  try {
    requested = decodeURIComponent(url.pathname.slice(1));
  } catch {
    return new Response(null, { status: 400 });
  }
  const root = path.join(process.resourcesPath, "dist");
  const file = path.resolve(root, requested || "index.html");
  const relative = path.relative(root, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || requested.includes("\0")) {
    return new Response(null, { status: 404 });
  }
  const audioType = AUDIO_TYPES.get(path.extname(file));
  const response = audioType
    ? serveAudio(file, request, audioType)
    : net.fetch(pathToFileURL(file).href, { method: request.method });
  return response.catch(() => new Response(null, { status: 404 }));
}

function isGameUrl(url) {
  const { protocol, host } = new URL(url);
  return protocol === `${SCHEME}:` && host === HOST;
}

function createWindow(steam) {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#18171a",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  const contents = window.webContents;
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, destination) => {
    if (!isGameUrl(destination)) event.preventDefault();
  });

  // Accept desktop commands only from this window's top-level game page.
  const fromGame = ({ senderFrame }) => senderFrame?.parent === null && isGameUrl(senderFrame.url);
  contents.ipc.handle("wayshrine:get-fullscreen", (event) => fromGame(event) && window.isFullScreen());
  contents.ipc.on("wayshrine:set-fullscreen", (event, fullscreen) => {
    if (fromGame(event) && typeof fullscreen === "boolean") window.setFullScreen(fullscreen);
  });
  contents.ipc.on("wayshrine:quit", (event) => {
    if (fromGame(event)) app.quit();
  });
  contents.ipc.handle("wayshrine:steam-saves", (event) => fromGame(event) ? steam?.save.read() ?? null : null);
  contents.ipc.handle("wayshrine:steam-save", (event, snapshot) => {
    if (!fromGame(event)) return false;
    return steam?.save.write(snapshot) ?? false;
  });
  contents.ipc.handle("wayshrine:steam-seed-keyboard", (event, label, text) => {
    if (!fromGame(event) || typeof label !== "string" || typeof text !== "string") return null;
    return steam?.enterText(label.slice(0, 160), text.slice(0, 64)) ?? null;
  });
  contents.ipc.on("wayshrine:steam-achievements", (event, ids) => {
    if (fromGame(event)) steam?.awards.report(ids);
  });
  const sendFullscreen = (fullscreen) => {
    if (!contents.isDestroyed()) contents.send("wayshrine:fullscreen-changed", fullscreen);
  };
  window.on("enter-full-screen", () => sendFullscreen(true));
  window.on("leave-full-screen", () => sendFullscreen(false));
  contents.on("before-input-event", (event, input) => {
    if (input.key !== "F11" || input.type !== "keyDown") return;
    event.preventDefault();
    if (!input.isAutoRepeat) window.setFullScreen(!window.isFullScreen());
  });
  let closing = false;
  window.on("close", () => { closing = true; });
  void window.loadURL(`${SCHEME}://${HOST}/`).catch((error) => {
    // Closing or replacing the startup page can cancel its load.
    if (closing || error.code === "ERR_ABORTED") return;
    console.error(error);
    app.exit(1);
  });
}

if (process.env.SteamAppId) enableSteamOverlay(process.resourcesPath);

void app.whenReady().then(() => {
  protocol.handle(SCHEME, handleGameFiles);
  const steam = startSteam(app.getPath("userData"), process.resourcesPath, require("./package.json").steamAppId);
  if (steam && !app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) createWindow(steam);
    else {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  createWindow(steam);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(steam);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
