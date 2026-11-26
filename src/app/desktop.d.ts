export {};

declare global {
  interface Window {
    readonly wayshrineDesktop?: {
      getFullscreen(): Promise<boolean>;
      setFullscreen(fullscreen: boolean): void;
      onFullscreenChanged(listener: (fullscreen: boolean) => void): () => void;
      quit(): void;
    };
  }
}
