import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeWebAuthnPlugin {
  create(options: { options: string }): Promise<{ responseJson: string }>;
  get(options: { options: string }): Promise<{ responseJson: string }>;
}

const NativeWebAuthn = registerPlugin<NativeWebAuthnPlugin>("NativeWebAuthn");
const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

const base64UrlToBuffer = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = window.atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const bufferToBase64Url = (value: ArrayBuffer) => {
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const parseNativeCredential = (responseJson: string) => {
  try { return JSON.parse(responseJson) as Record<string, unknown>; }
  catch { throw new Error("Android returned an invalid passkey response."); }
};

export const isWebAuthnAvailable = () =>
  isNativeAndroid() || Boolean(window.PublicKeyCredential && navigator.credentials);

export const createPasskey = async (options: any) => {
  if (isNativeAndroid()) {
    if (!Capacitor.isPluginAvailable("NativeWebAuthn")) {
      throw new Error("This HallsChat APK needs an update to support Android passkeys.");
    }
    const result = await NativeWebAuthn.create({ options: JSON.stringify(options) });
    return parseNativeCredential(result.responseJson);
  }
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error("Passkeys are not supported by this browser.");
  }
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: { ...options.user, id: base64UrlToBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((credential: any) => ({
      ...credential, id: base64UrlToBuffer(credential.id)
    }))
  };
  const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey registration was cancelled.");
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      transports: response.getTransports?.() || []
    },
    clientExtensionResults: credential.getClientExtensionResults()
  };
};

export const authenticateWithPasskey = async (options: any) => {
  if (isNativeAndroid()) {
    if (!Capacitor.isPluginAvailable("NativeWebAuthn")) {
      throw new Error("This HallsChat APK needs an update to support Android passkeys.");
    }
    const result = await NativeWebAuthn.get({ options: JSON.stringify(options) });
    return parseNativeCredential(result.responseJson);
  }
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error("Passkeys are not supported by this browser.");
  }
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((credential: any) => ({
      ...credential, id: base64UrlToBuffer(credential.id)
    }))
  };
  const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey authentication was cancelled.");
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null
    },
    clientExtensionResults: credential.getClientExtensionResults()
  };
};
