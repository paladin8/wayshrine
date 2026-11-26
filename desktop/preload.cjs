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
  enterSeed: (label, text) => ipcRenderer.invoke("wayshrine:steam-seed-keyboard", label, text),
  quit: () => ipcRenderer.send("wayshrine:quit"),
  loadSteamSaves: () => ipcRenderer.invoke("wayshrine:steam-saves"),
  writeSteamSaves: (snapshot) => ipcRenderer.invoke("wayshrine:steam-save", snapshot),
  reportSteamAchievements: (ids) => ipcRenderer.send("wayshrine:steam-achievements", ids),
});
