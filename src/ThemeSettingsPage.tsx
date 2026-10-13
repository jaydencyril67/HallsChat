import { Check, MoreHorizontal } from "lucide-react";
import { navigate } from "./utils/navigate";
import { useEffect, useRef, useState } from "react";
import { useAppTheme } from "./components/AppTheme";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";

export default function ThemeSettingsPage() {
  const { themePreference, setThemePreference } = useAppTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const [activeStatusVisible, setActiveStatusVisible] = useState(true);
  const [activeStatusLoaded, setActiveStatusLoaded] = useState(false);
  const [activeStatusMenuOpen, setActiveStatusMenuOpen] = useState(false);
  const [activeStatusSaving, setActiveStatusSaving] = useState(false);
  const [activeStatusError, setActiveStatusError] = useState("");
  const activeStatusMenuRef = useRef<HTMLDivElement>(null);
  const [callsPrivacy, setCallsPrivacy] = useState<"audio" | "video" | "both" | "none">("both");
  const [callsPrivacyLoaded, setCallsPrivacyLoaded] = useState(false);
  const [callsPrivacyMenuOpen, setCallsPrivacyMenuOpen] = useState(false);
  const [callsPrivacySaving, setCallsPrivacySaving] = useState(false);
  const [callsPrivacyError, setCallsPrivacyError] = useState("");
  const callsPrivacyMenuRef = useRef<HTMLDivElement>(null);
  const [profileDiscoverable, setProfileDiscoverable] = useState(true);
  const [visibilityLoaded, setVisibilityLoaded] = useState(false);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const visibilityMenuRef = useRef<HTMLDivElement>(null);
  const [readReceiptsVisible, setReadReceiptsVisible] = useState(true);
  const [readReceiptsLoaded, setReadReceiptsLoaded] = useState(false);
  const [readReceiptsMenuOpen, setReadReceiptsMenuOpen] = useState(false);
  const [readReceiptsSaving, setReadReceiptsSaving] = useState(false);
  const [readReceiptsError, setReadReceiptsError] = useState("");
  const readReceiptsMenuRef = useRef<HTMLDivElement>(null);
  const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
  const currentThemeLabel = themePreference === "system"
    ? "System"
    : themePreference === "light"
      ? "Light"
      : "Dark";

  useEffect(() => {
    if (!themeMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setThemeMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [themeMenuOpen]);


  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/active-status", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load active status settings.");
        if (!cancelled) setActiveStatusVisible(payload.activeStatusVisible !== false);
      })
      .catch(error => { if (!cancelled) setActiveStatusError(error instanceof Error ? error.message : "Unable to load active status settings."); })
      .finally(() => { if (!cancelled) setActiveStatusLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/calls-privacy", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load calls privacy settings.");
        const value = payload.callsPrivacy;
        if (!cancelled) setCallsPrivacy(value === "audio" || value === "video" || value === "none" ? value : "both");
      })
      .catch(error => { if (!cancelled) setCallsPrivacyError(error instanceof Error ? error.message : "Unable to load calls privacy settings."); })
      .finally(() => { if (!cancelled) setCallsPrivacyLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/visibility", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load visibility settings.");
        if (!cancelled) setProfileDiscoverable(payload.profileDiscoverable !== false);
      })
      .catch(error => { if (!cancelled) setVisibilityError(error instanceof Error ? error.message : "Unable to load visibility settings."); })
      .finally(() => { if (!cancelled) setVisibilityLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!visibilityMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (visibilityMenuRef.current && !visibilityMenuRef.current.contains(event.target as Node)) setVisibilityMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setVisibilityMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [visibilityMenuOpen]);

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/read-receipts", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load read receipt settings.");
        if (!cancelled) setReadReceiptsVisible(payload.readReceiptsVisible !== false);
      })
      .catch(error => { if (!cancelled) setReadReceiptsError(error instanceof Error ? error.message : "Unable to load read receipt settings."); })
      .finally(() => { if (!cancelled) setReadReceiptsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!readReceiptsMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (readReceiptsMenuRef.current && !readReceiptsMenuRef.current.contains(event.target as Node)) setReadReceiptsMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setReadReceiptsMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [readReceiptsMenuOpen]);

  useEffect(() => {
    if (!callsPrivacyMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (callsPrivacyMenuRef.current && !callsPrivacyMenuRef.current.contains(event.target as Node)) setCallsPrivacyMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setCallsPrivacyMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [callsPrivacyMenuOpen]);

  useEffect(() => {
    if (!activeStatusMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (activeStatusMenuRef.current && !activeStatusMenuRef.current.contains(event.target as Node)) setActiveStatusMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveStatusMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeStatusMenuOpen]);

  const chooseActiveStatus = async (visible: boolean) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || activeStatusSaving || !activeStatusLoaded) return;
    setActiveStatusSaving(true);
    setActiveStatusError("");
    try {
      const response = await fetch(apiBase + "/api/settings/active-status", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + savedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ activeStatusVisible: visible })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update active status.");
      setActiveStatusVisible(payload.activeStatusVisible !== false);
      setActiveStatusMenuOpen(false);
    } catch (error) {
      setActiveStatusError(error instanceof Error ? error.message : "Unable to update active status.");
    } finally {
      setActiveStatusSaving(false);
    }
  };

  const chooseCallsPrivacy = async (value: "audio" | "video" | "both" | "none") => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || callsPrivacySaving || !callsPrivacyLoaded) return;
    setCallsPrivacySaving(true);
    setCallsPrivacyError("");
    try {
      const response = await fetch(apiBase + "/api/settings/calls-privacy", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + savedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ callsPrivacy: value })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update calls privacy.");
      const savedValue = payload.callsPrivacy;
      setCallsPrivacy(savedValue === "audio" || savedValue === "video" || savedValue === "none" ? savedValue : "both");
      setCallsPrivacyMenuOpen(false);
    } catch (error) {
      setCallsPrivacyError(error instanceof Error ? error.message : "Unable to update calls privacy.");
    } finally {
      setCallsPrivacySaving(false);
    }
  };

  const chooseVisibility = async (visible: boolean) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || visibilitySaving || !visibilityLoaded) return;
    setVisibilitySaving(true);
    setVisibilityError("");
    try {
      const response = await fetch(apiBase + "/api/settings/visibility", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + savedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ profileDiscoverable: visible })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update visibility.");
      setProfileDiscoverable(payload.profileDiscoverable !== false);
      setVisibilityMenuOpen(false);
    } catch (error) {
      setVisibilityError(error instanceof Error ? error.message : "Unable to update visibility.");
    } finally {
      setVisibilitySaving(false);
    }
  };

  const chooseReadReceipts = async (visible: boolean) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || readReceiptsSaving || !readReceiptsLoaded) return;
    setReadReceiptsSaving(true);
    setReadReceiptsError("");
    try {
      const response = await fetch(apiBase + "/api/settings/read-receipts", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + savedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ readReceiptsVisible: visible })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update read receipt settings.");
      setReadReceiptsVisible(payload.readReceiptsVisible !== false);
      setReadReceiptsMenuOpen(false);
    } catch (error) {
      setReadReceiptsError(error instanceof Error ? error.message : "Unable to update read receipt settings.");
    } finally {
      setReadReceiptsSaving(false);
    }
  };

  const callsPrivacyLabel = callsPrivacy === "audio" ? "Only Audio" : callsPrivacy === "video" ? "Only Video" : callsPrivacy === "none" ? "Allow None" : "Allow Both";

  const chooseTheme = (preference: "dark" | "light" | "system") => {
    setThemePreference(preference);
    setThemeMenuOpen(false);
  };

  return <main className="home-page social-home settings-page theme-token-scope">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell settings-shell">
      <section className="settings-theme-card" aria-label="App theme">
        <span className="settings-theme-title">App theme</span>
        <span className="settings-theme-current" aria-live="polite">{currentThemeLabel}</span>
        <div className="settings-theme-menu-anchor" ref={themeMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Choose app theme"
            aria-haspopup="menu"
            aria-expanded={themeMenuOpen}
            onClick={() => setThemeMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {themeMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="App theme options">
            {([
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ] as const).map(option => <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={themePreference === option.value}
              className={`settings-theme-menu-option${themePreference === option.value ? " is-selected" : ""}`}
              onClick={() => chooseTheme(option.value)}
            >
              <span>{option.label}</span>
              {themePreference === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Active status">
        <span className="settings-theme-title">Active Status</span>
        <span className="settings-theme-current" aria-live="polite">{!activeStatusLoaded ? "Loading…" : activeStatusVisible ? "Shown" : "Hidden"}</span>
        <div className="settings-theme-menu-anchor" ref={activeStatusMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Active status options"
            aria-haspopup="menu"
            aria-expanded={activeStatusMenuOpen}
            disabled={!activeStatusLoaded || activeStatusSaving}
            onClick={() => setActiveStatusMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {activeStatusMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Active status options">
            {([
              { value: true, label: "Show active status" },
              { value: false, label: "Hide active status" },
            ] as const).map(option => <button
              key={String(option.value)}
              type="button"
              role="menuitemradio"
              aria-checked={activeStatusVisible === option.value}
              className={"settings-theme-menu-option" + (activeStatusVisible === option.value ? " is-selected" : "")}
              disabled={activeStatusSaving}
              onClick={() => void chooseActiveStatus(option.value)}
            >
              <span>{option.label}</span>
              {activeStatusVisible === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Calls privacy">
        <span className="settings-theme-title">Calls privacy</span>
        <span className="settings-theme-current" aria-live="polite">{!callsPrivacyLoaded ? "Loading…" : callsPrivacyLabel}</span>
        <div className="settings-theme-menu-anchor" ref={callsPrivacyMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Calls privacy options"
            aria-haspopup="menu"
            aria-expanded={callsPrivacyMenuOpen}
            disabled={!callsPrivacyLoaded || callsPrivacySaving}
            onClick={() => setCallsPrivacyMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {callsPrivacyMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Calls privacy options">
            {([
              { value: "audio", label: "Only Audio" },
              { value: "video", label: "Only Video" },
              { value: "both", label: "Allow Both" },
              { value: "none", label: "Allow None" },
            ] as const).map(option => <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={callsPrivacy === option.value}
              className={"settings-theme-menu-option" + (callsPrivacy === option.value ? " is-selected" : "")}
              disabled={callsPrivacySaving}
              onClick={() => void chooseCallsPrivacy(option.value)}
            >
              <span>{option.label}</span>
              {callsPrivacy === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Visibility">
        <span className="settings-theme-title">Visibility</span>
        <span className="settings-theme-current" aria-live="polite">{!visibilityLoaded ? "Loading…" : profileDiscoverable ? "Profile shown" : "Profile hidden"}</span>
        <div className="settings-theme-menu-anchor" ref={visibilityMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Visibility options"
            aria-haspopup="menu"
            aria-expanded={visibilityMenuOpen}
            disabled={!visibilityLoaded || visibilitySaving}
            onClick={() => setVisibilityMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {visibilityMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Visibility options">
            {([
              { value: false, label: "Hide Profile" },
              { value: true, label: "Show Profile" },
            ] as const).map(option => <button
              key={String(option.value)}
              type="button"
              role="menuitemradio"
              aria-checked={profileDiscoverable === option.value}
              className={"settings-theme-menu-option" + (profileDiscoverable === option.value ? " is-selected" : "")}
              disabled={visibilitySaving}
              onClick={() => void chooseVisibility(option.value)}
            >
              <span>{option.label}</span>
              {profileDiscoverable === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Read Receipt">
        <span className="settings-theme-title">Read Receipt</span>
        <span className="settings-theme-current" aria-live="polite">{!readReceiptsLoaded ? "Loading…" : readReceiptsVisible ? "Shown" : "Hidden"}</span>
        <div className="settings-theme-menu-anchor" ref={readReceiptsMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Read receipt options"
            aria-haspopup="menu"
            aria-expanded={readReceiptsMenuOpen}
            disabled={!readReceiptsLoaded || readReceiptsSaving}
            onClick={() => setReadReceiptsMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {readReceiptsMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Read receipt options">
            {([
              { value: false, label: "Hide" },
              { value: true, label: "Show" },
            ] as const).map(option => <button
              key={String(option.value)}
              type="button"
              role="menuitemradio"
              aria-checked={readReceiptsVisible === option.value}
              className={"settings-theme-menu-option" + (readReceiptsVisible === option.value ? " is-selected" : "")}
              disabled={readReceiptsSaving}
              onClick={() => void chooseReadReceipts(option.value)}
            >
              <span>{option.label}</span>
              {readReceiptsVisible === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      {readReceiptsError && <p className="settings-theme-current" role="status">{readReceiptsError}</p>}
      {visibilityError && <p className="settings-theme-current" role="status">{visibilityError}</p>}
      {callsPrivacyError && <p className="settings-theme-current" role="status">{callsPrivacyError}</p>}
      {activeStatusError && <p className="settings-theme-current" role="status">{activeStatusError}</p>}
    </section>
    <NowBar />
  </main>;
}
