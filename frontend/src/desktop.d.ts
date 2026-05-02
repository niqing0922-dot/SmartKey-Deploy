export {}

declare global {
  interface Window {
    smartKeyDesktop?: {
      runtimeConfig?: {
        mode?: string
        apiBaseUrl?: string
      }
      getRuntimeInfo?: () => Promise<{ platform: string; appVersion: string; runtimeDirs?: Record<string, string>; mode?: string; apiBaseUrl?: string }>
      openPath?: (targetPath: string) => Promise<{ status: string; path?: string; message?: string }>
      checkForUpdates?: () => Promise<{ status: string; version?: string; message?: string }>
      getUpdateState?: () => Promise<{ status: string; version?: string; message?: string }>
      installUpdate?: () => Promise<{ status: string; message?: string }>
      quitApp?: () => Promise<{ status: string }>
    }
  }
}
