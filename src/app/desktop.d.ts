import type { SteamSaveBootstrap } from "./steam";

declare global {
  interface Window {
    readonly wayshrineDesktop?: {
      getFullscreen(): Promise<boolean>;
      setFullscreen(fullscreen: boolean): void;
      onFullscreenChanged(listener: (fullscreen: boolean) => void): () => void;
      enterSeed?(label: string, text: string): Promise<string | null>;
      quit(): void;
      saveBeforeClose?(save: () => Promise<{ message: string; stay: string; discard: string } | null>): void;
      loadSteamSaves(): Promise<SteamSaveBootstrap | null>;
      writeSteamSaves(snapshot: string): Promise<boolean>;
      reportSteamAchievements(ids: readonly string[]): void;
    };
  }
}
