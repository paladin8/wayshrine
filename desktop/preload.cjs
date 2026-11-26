const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wayshrineDesktop", {
  getFullscreen: () => ipcRenderer.invoke("wayshrine:get-fullscreen"),
  setFullscreen: (fullscreen) => ipcRenderer.send("wayshrine:set-fullscreen", fullscreen),
  onFullscreenChanged: (listener) => {
    const receive = (_event, fullscreen) => listener(fullscreen);
    ipcRenderer.on("wayshrine:fullscreen-changed", receive);
    return () => {
      ipcRenderer.removeListener("wayshrine:fullscreen-changed", receive);
    };
  },
  quit: () => ipcRenderer.send("wayshrine:quit"),
});
