import { useCallback, useEffect, useState } from "react";
import { Fingerprint, KeyRound, ShieldCheck, Copy, Trash2, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createPasskey, isWebAuthnAvailable } from "./utils/webauthn";

type FactorStatus = { configured?: boolean; enabled?: boolean; secret?: string; otpauthUrl?: string; message?: string };
type CredentialItem = { id: string; createdAt?: string };
type BiometricStatus = { enabled?: boolean; credentials?: CredentialItem[]; message?: string };

const apiBase = () => (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

async function securityRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = localStorage.getItem("hallschat_token");
  if (!token) throw new Error("Sign in again to change your account security settings.");
  const response = await fetch(apiBase() + path, {
    method,
    headers: { Authorization: "Bearer " + token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(data.message || "The security setting could not be updated.");
  return data;
}

const inputStyle: React.CSSProperties = {
  width: "100%", minHeight: 44, boxSizing: "border-box", borderRadius: 12,
  border: "1px solid var(--theme-line, rgba(255,255,255,.22))",
  background: "var(--theme-surface, rgba(255,255,255,.05))",
  color: "var(--theme-text, inherit)", padding: "10px 12px", fontSize: 15
};
const buttonStyle: React.CSSProperties = {
  minHeight: 42, borderRadius: 999, padding: "10px 15px", cursor: "pointer",
  border: "1px solid var(--theme-line, rgba(255,255,255,.22))",
  color: "var(--theme-text, inherit)", background: "var(--theme-surface, rgba(255,255,255,.07))",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  fontWeight: 750, fontSize: 13
};

export default function SecuritySettings() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [twoFactorConfigured, setTwoFactorConfigured] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [setupSecret, setSetupSecret] = useState("");
  const [setupUri, setSetupUri] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [twoFactor, biometric] = await Promise.all([
        securityRequest<FactorStatus>("/api/security/2fa"),
        securityRequest<BiometricStatus>("/api/security/biometric")
      ]);
      setTwoFactorConfigured(twoFactor.configured === true);
      setTwoFactorEnabled(twoFactor.enabled === true);
      setBiometricEnabled(biometric.enabled === true);
      setCredentials(Array.isArray(biometric.credentials) ? biometric.credentials : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load account security settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (action: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await action();
      setMessage(success);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The security change failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const startTwoFactorSetup = () => runAction(async () => {
    const data = await securityRequest<FactorStatus>("/api/security/2fa/setup", "POST", {});
    if (!data.secret || !data.otpauthUrl) throw new Error(data.message || "The authenticator setup could not be prepared.");
    setSetupSecret(data.secret);
    setSetupUri(data.otpauthUrl);
    setTwoFactorConfigured(true);
  }, "Authenticator setup is ready. Add it to your authenticator app, then verify the code.");

  const verifyTwoFactor = (enable: boolean) => runAction(async () => {
    if (!/^\d{6}$/.test(twoFactorCode)) throw new Error("Enter the six-digit code from your authenticator app.");
    await securityRequest<FactorStatus>(enable ? "/api/security/2fa/enable" : "/api/security/2fa/disable", "POST", { code: twoFactorCode });
    setTwoFactorCode(""); setSetupSecret(""); setSetupUri("");
  }, enable ? "Two-factor authentication is now enabled." : "Two-factor authentication is now disabled.");

  const cancelSetup = () => runAction(async () => {
    await securityRequest<FactorStatus>("/api/security/2fa/cancel-setup", "POST", {});
    setSetupSecret(""); setSetupUri(""); setTwoFactorCode("");
  }, "Authenticator setup was cancelled.");

  const registerBiometric = () => runAction(async () => {
    if (!isWebAuthnAvailable()) throw new Error("This browser or device does not support passkeys.");
    const options = await securityRequest<Record<string, any>>("/api/security/biometric/register/options", "POST", {});
    const credential = await createPasskey(options);
    const verified = await securityRequest<BiometricStatus>("/api/security/biometric/register/verify", "POST", credential);
    setCredentials(Array.isArray(verified.credentials) ? verified.credentials : []);
  }, "The device passkey was registered.");

  const toggleBiometric = (enabled: boolean) => runAction(async () => {
    await securityRequest<BiometricStatus>("/api/security/biometric", "PATCH", { enabled });
    setBiometricEnabled(enabled);
  }, enabled ? "Biometric security is now enabled." : "Biometric security is now disabled.");

  const removeCredential = (credential: CredentialItem) => runAction(async () => {
    const result = await securityRequest<BiometricStatus>("/api/security/biometric/credentials/" + encodeURIComponent(credential.id), "DELETE");
    setCredentials(Array.isArray(result.credentials) ? result.credentials : []);
    setBiometricEnabled(result.enabled === true);
  }, "The passkey was removed.");

  const copyText = async (value: string, label: string) => {
    setError(""); setMessage("");
    try {
      await navigator.clipboard.writeText(value);
      setMessage(label + " copied to clipboard.");
    } catch {
      setError("Clipboard access was blocked by this browser. Copy the displayed text manually.");
    }
  };

  const cardStyle: React.CSSProperties = {
    display: "grid", gap: 13, minWidth: 0, padding: 16, borderRadius: 20,
    border: "1px solid var(--theme-line, rgba(255,255,255,.2))",
    background: "var(--theme-surface, rgba(255,255,255,.05))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)", color: "var(--theme-text, inherit)"
  };

  return <section aria-label="Account security" style={{ display: "grid", gap: 12, marginBottom: 14, minWidth: 0 }}>
    <div style={{ display: "grid", gap: 4, padding: "4px 2px" }}>
      <h2 style={{ margin: 0, fontSize: "1.12rem", fontWeight: 850, color: "var(--theme-text, inherit)", display: "flex", gap: 9, alignItems: "center" }}><ShieldCheck size={20} /> Extra security</h2>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--theme-text-muted, rgba(255,255,255,.72))" }}>Protect HallsChat after KingsHall verifies your Access Code. Sign-in asks for an enabled authenticator or biometric passkey.</p>
    </div>
    <section style={cardStyle} aria-label="Two-factor authentication">
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <KeyRound size={20} />
          <div><strong style={{ display: "block" }}>Authenticator app (2FA)</strong><span style={{ fontSize: 12, color: "var(--theme-text-muted, rgba(255,255,255,.72))" }}>{loading ? "Checking status…" : twoFactorEnabled ? "Enabled for sign-in" : twoFactorConfigured ? "Setup started · not enabled yet" : "Not configured"}</span></div>
        </div>
        {!loading && !twoFactorEnabled && <button type="button" style={buttonStyle} disabled={busy} onClick={() => void startTwoFactorSetup()}>{twoFactorConfigured ? <RefreshCw size={15} /> : <KeyRound size={15} />}{twoFactorConfigured ? "Resume setup" : "Set up 2FA"}</button>}
      </div>
      {setupSecret && setupUri && <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>Scan this QR code with an authenticator app, or copy the setup key. Then enter the current six-digit code to confirm.</p>
        <div style={{ padding: 10, background: "#fff", borderRadius: 12, maxWidth: "100%" }}><QRCodeSVG value={setupUri} size={176} level="M" includeMargin /></div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 8, width: "100%" }}>
          <code style={{ display: "block", minWidth: 0, overflowWrap: "anywhere", fontSize: 12 }}>{setupSecret}</code>
          <button type="button" aria-label="Copy authenticator setup key" style={buttonStyle} onClick={() => void copyText(setupSecret, "Setup key")}><Copy size={15} /></button>
        </div>
        <div style={{ display: "grid", gap: 8, width: "100%" }}>
          <input aria-label="Authenticator code" style={inputStyle} type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Six-digit code" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" style={buttonStyle} disabled={busy || twoFactorCode.length !== 6} onClick={() => void verifyTwoFactor(true)}>Verify and enable</button>
            <button type="button" style={buttonStyle} disabled={busy} onClick={() => void cancelSetup()}>Cancel setup</button>
          </div>
        </div>
      </div>}
      {twoFactorEnabled && <div style={{ display: "grid", gap: 8 }}>
        <label htmlFor="hallschat-disable-2fa" style={{ fontSize: 13 }}>Enter an authenticator code to disable 2FA</label>
        <input id="hallschat-disable-2fa" style={inputStyle} type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Six-digit code" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        <button type="button" style={buttonStyle} disabled={busy || twoFactorCode.length !== 6} onClick={() => void verifyTwoFactor(false)}>Verify and disable 2FA</button>
      </div>}
    </section>
    <section style={cardStyle} aria-label="Biometric security">
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <Fingerprint size={21} />
          <div><strong style={{ display: "block" }}>Biometric security / passkey</strong><span style={{ fontSize: 12, color: "var(--theme-text-muted, rgba(255,255,255,.72))" }}>{loading ? "Checking status…" : biometricEnabled ? "Enabled for sign-in" : credentials.length ? "Passkey bound · not enabled" : "No passkey bound"}</span></div>
        </div>
        {!loading && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {credentials.length > 0 && <button type="button" style={buttonStyle} disabled={busy || (biometricEnabled && credentials.length === 0)} onClick={() => void toggleBiometric(!biometricEnabled)}>{biometricEnabled ? "Disable" : "Enable"}</button>}
          <button type="button" style={buttonStyle} disabled={busy} onClick={() => void registerBiometric()}><Fingerprint size={15} /> Bind passkey</button>
        </div>}
      </div>
      {credentials.length > 0 && <div style={{ display: "grid", gap: 8 }}>
        {credentials.map((credential, index) => <div key={credential.id} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", minWidth: 0, borderTop: "1px solid var(--theme-line, rgba(255,255,255,.12))", paddingTop: 10 }}>
          <div style={{ display: "grid", gap: 3, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 750 }}>Passkey {index + 1}</span><span style={{ fontSize: 11, overflowWrap: "anywhere", color: "var(--theme-text-muted, rgba(255,255,255,.7))" }}>Added {credential.createdAt ? new Date(credential.createdAt).toLocaleDateString() : "date unavailable"}</span></div>
          <button type="button" style={buttonStyle} aria-label={"Remove passkey " + (index + 1)} disabled={busy} onClick={() => void removeCredential(credential)}><Trash2 size={15} /> Remove</button>
        </div>)}
      </div>}
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--theme-text-muted, rgba(255,255,255,.72))" }}>Uses your device's passkey provider. Depending on device settings, it may confirm with fingerprint, face recognition, or your screen lock.</p>
    </section>
    {error && <div role="alert" style={{ border: "1px solid rgba(220,70,70,.35)", borderRadius: 12, padding: 11, fontSize: 13, color: "var(--theme-text, inherit)", background: "rgba(220,70,70,.08)" }}>{error}</div>}
    {message && <div role="status" style={{ border: "1px solid var(--theme-line, rgba(255,255,255,.18))", borderRadius: 12, padding: 11, fontSize: 13, color: "var(--theme-text, inherit)" }}>{message}</div>}
  </section>;
}
