import type { SteamSaveBootstrap } from "./steam";

declare global {
  interface Window {
    readonly wayshrineDesktop?: {
      getFullscreen(): Promise<boolean>;
      setFullscreen(fullscreen: boolean): void;
      onFullscreenChanged(listener: (fullscreen: boolean) => void): () => void;
      quit(): void;
      loadSteamSaves(): Promise<SteamSaveBootstrap | null>;
      writeSteamSaves(snapshot: string): Promise<boolean>;
      reportSteamAchievements(ids: readonly string[]): void;
    };
  }
}
