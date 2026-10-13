import { registerPlugin } from "@capacitor/core";

export type NativeAppInfo = {
  versionName: string;
  versionCode: number;
};

export type NativeAppUpdateEvent = {
  message?: string;
  stage?: string;
  timestamp?: number;
  [key: string]: unknown;
};

export type NativeAppUpdatePlugin = {
  getAppInfo(): Promise<NativeAppInfo>;
  downloadAndInstall(options: { url: string }): Promise<{
    status?: string;
    downloadId?: number;
    requiresPermission?: boolean;
    url?: string;
    queuedAt?: number;
  }>;
  addListener?(
    eventName: "downloadError",
    listener: (event: NativeAppUpdateEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

export const NativeAppUpdate = registerPlugin<NativeAppUpdatePlugin>("NativeAppUpdate");
