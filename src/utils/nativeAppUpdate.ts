import { registerPlugin } from "@capacitor/core";

export type NativeAppInfo = {
  versionName: string;
  versionCode: number;
};

export type NativeAppUpdatePlugin = {
  // Used only to compare installed versions for update notifications.
  // APK delivery and installation are centralized in CrownStore.
  getAppInfo(): Promise<NativeAppInfo>;
};

export const NativeAppUpdate = registerPlugin<NativeAppUpdatePlugin>("NativeAppUpdate");
