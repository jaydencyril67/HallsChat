import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, ShieldCheck, Copy, Trash2, RefreshCw, MoreHorizontal, Check } from "lucide-react";
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
  const [twoFactorMenuOpen, setTwoFactorMenuOpen] = useState(false);
  const [biometricMenuOpen, setBiometricMenuOpen] = useState(false);
  const twoFactorMenuRef = useRef<HTMLDivElement>(null);
  const biometricMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!twoFactorMenuOpen) return;
    const outside = (event: PointerEvent) => { if (twoFactorMenuRef.current && !twoFactorMenuRef.current.contains(event.target as Node)) setTwoFactorMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setTwoFactorMenuOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [twoFactorMenuOpen]);

  useEffect(() => {
    if (!biometricMenuOpen) return;
    const outside = (event: PointerEvent) => { if (biometricMenuRef.current && !biometricMenuRef.current.contains(event.target as Node)) setBiometricMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setBiometricMenuOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [biometricMenuOpen]);

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

  useEffect(() => {
    if (!error && !message) return;
    const timeout = window.setTimeout(() => { setError(""); setMessage(""); }, 4500);
    return () => window.clearTimeout(timeout);
  }, [error, message]);

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

  return <section aria-label="Account security" style={{ display: "grid", gap: 8, minWidth: 0 }}>
    <section className="settings-theme-card settings-security-card" aria-label="Two-factor authentication">
      <span className="settings-theme-title">Authenticator app (2FA)</span>
      <span className="settings-theme-current" aria-live="polite">{loading ? "Checking status…" : twoFactorEnabled ? "Enabled for sign-in" : twoFactorConfigured ? "Setup started · not enabled yet" : "Not configured"}</span>
      <div className="settings-theme-menu-anchor" ref={twoFactorMenuRef}>
        <button type="button" className="settings-theme-menu-trigger" aria-label="Authenticator app security options" aria-haspopup="menu" aria-expanded={twoFactorMenuOpen} disabled={loading || busy} onClick={() => setTwoFactorMenuOpen(open => !open)}><MoreHorizontal size={21} /></button>
        {twoFactorMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Authenticator app options">
          {!twoFactorEnabled && <button type="button" role="menuitem" className="settings-theme-menu-option" disabled={busy} onClick={() => { setTwoFactorMenuOpen(false); void startTwoFactorSetup(); }}><span>{twoFactorConfigured ? "Resume setup" : "Set up 2FA"}</span>{twoFactorConfigured ? <RefreshCw size={15} /> : <KeyRound size={15} />}</button>}
          {twoFactorEnabled && <button type="button" role="menuitem" className="settings-theme-menu-option" disabled={busy} onClick={() => { setTwoFactorMenuOpen(false); setTwoFactorCode(""); }}><span>Enter code to disable</span><KeyRound size={15} /></button>}
          {twoFactorConfigured && !twoFactorEnabled && <button type="button" role="menuitem" className="settings-theme-menu-option" disabled={busy} onClick={() => { setTwoFactorMenuOpen(false); void cancelSetup(); }}><span>Cancel setup</span><Trash2 size={15} /></button>}
        </div>}
      </div>
      {setupSecret && setupUri && <div className="settings-security-details">
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>Scan this QR code with an authenticator app, or copy the setup key. Then enter the current six-digit code to confirm.</p>
        <div style={{ padding: 10, background: "#fff", borderRadius: 12, maxWidth: "100%", width: "fit-content" }}><QRCodeSVG value={setupUri} size={176} level="M" includeMargin /></div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 8, width: "100%" }}>
          <code style={{ display: "block", minWidth: 0, overflowWrap: "anywhere", fontSize: 12 }}>{setupSecret}</code>
          <button type="button" className="settings-theme-menu-trigger" aria-label="Copy authenticator setup key" onClick={() => void copyText(setupSecret, "Setup key")}><Copy size={17} /></button>
        </div>
        <div style={{ display: "grid", gap: 8, width: "100%" }}>
          <input aria-label="Authenticator code" style={inputStyle} type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Six-digit code" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button type="button" className="settings-theme-menu-option is-selected" style={{ flex: 1, minWidth: 0 }} disabled={busy || twoFactorCode.length !== 6} onClick={() => void verifyTwoFactor(true)}><span>Verify and enable</span><Check size={15} /></button>
            <button type="button" className="settings-theme-menu-option" style={{ flex: 1, minWidth: 0 }} disabled={busy} onClick={() => void cancelSetup()}><span>Cancel setup</span></button>
          </div>
        </div>
      </div>}
      {twoFactorEnabled && <div className="settings-security-details">
        <label htmlFor="hallschat-disable-2fa" style={{ fontSize: 13 }}>Enter an authenticator code to disable 2FA</label>
        <input id="hallschat-disable-2fa" style={inputStyle} type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Six-digit code" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        <button type="button" className="settings-theme-menu-option" disabled={busy || twoFactorCode.length !== 6} onClick={() => void verifyTwoFactor(false)}><span>Verify and disable 2FA</span><ShieldCheck size={15} /></button>
      </div>}
    </section>
    <section className="settings-theme-card settings-security-card" aria-label="Biometric security">
      <span className="settings-theme-title">Biometric security / passkey</span>
      <span className="settings-theme-current" aria-live="polite">{loading ? "Checking status…" : biometricEnabled ? "Enabled for sign-in" : credentials.length ? "Passkey bound · not enabled" : "No passkey bound"}</span>
      <div className="settings-theme-menu-anchor" ref={biometricMenuRef}>
        <button type="button" className="settings-theme-menu-trigger" aria-label="Biometric security options" aria-haspopup="menu" aria-expanded={biometricMenuOpen} disabled={loading || busy} onClick={() => setBiometricMenuOpen(open => !open)}><MoreHorizontal size={21} /></button>
        {biometricMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Biometric security options">
          {credentials.length === 0 && <button type="button" role="menuitem" className="settings-theme-menu-option" disabled={busy} onClick={() => { setBiometricMenuOpen(false); void registerBiometric(); }}><span>Bind passkey</span><Fingerprint size={15} /></button>}
          {credentials.length > 0 && <button type="button" role="menuitemcheckbox" aria-checked={biometricEnabled} className={"settings-theme-menu-option" + (biometricEnabled ? " is-selected" : "")} disabled={busy} onClick={() => { setBiometricMenuOpen(false); void toggleBiometric(!biometricEnabled); }}><span>{biometricEnabled ? "Disable" : "Enable"} biometric security</span>{biometricEnabled && <Check size={15} />}</button>}
          {credentials.map((credential, index) => <button key={credential.id} type="button" role="menuitem" className="settings-theme-menu-option" disabled={busy} onClick={() => { setBiometricMenuOpen(false); void removeCredential(credential); }}><span>Remove passkey {index + 1}</span><Trash2 size={15} /></button>)}
        </div>}
      </div>
    </section>
    {error && <div className="halls-toast halls-toast-error" role="alert" aria-live="assertive"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss notification">×</button></div>}
    {!error && message && <div className="halls-toast halls-toast-success" role="status" aria-live="polite"><span>{message}</span><button type="button" onClick={() => setMessage("")} aria-label="Dismiss notification">×</button></div>}
  </section>;
}
