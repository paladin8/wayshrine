const { app, BrowserWindow, net, protocol } = require("electron");
const { createReadStream } = require("node:fs");
const { stat } = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pathToFileURL } = require("node:url");

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

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#18171a",
    autoHideMenuBar: true,
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, destination) => {
    const url = new URL(destination);
    if (url.protocol !== `${SCHEME}:` || url.host !== HOST) event.preventDefault();
  });
  void window.loadURL(`${SCHEME}://${HOST}/`).catch((error) => {
    console.error(error);
    app.exit(1);
  });
}

void app.whenReady().then(() => {
  protocol.handle(SCHEME, handleGameFiles);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
