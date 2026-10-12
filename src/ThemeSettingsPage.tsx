import { Check, Moon, Sun, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";

type ThemeChoice = "dark" | "light" | "system";
const STORAGE_KEY = "hallschat-theme";
function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "system" || saved === "dark" ? saved : "dark";
  } catch { return "dark"; }
}
function applyChoice(choice: ThemeChoice) {
  const resolved = choice === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : choice;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "light" ? "#f8f3f1" : "#19070b");
}
export default function ThemeSettingsPage() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  useEffect(() => {
    applyChoice(choice);
    try { localStorage.setItem(STORAGE_KEY, choice); } catch {}
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => applyChoice("system");
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [choice]);
  const options: { value: ThemeChoice; title: string; detail: string; icon: typeof Sun }[] = [
    { value: "light", title: "Light", detail: "Warm ivory surfaces and burgundy accents", icon: Sun },
    { value: "dark", title: "Dark", detail: "The original HallsChat dark burgundy theme", icon: Moon },
    { value: "system", title: "System default", detail: "Follow your device appearance preference", icon: Smartphone },
  ];
  return <main className="home-page social-home settings-page">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell settings-shell">
      <div className="settings-heading">
        <span className="settings-eyebrow">YOUR EXPERIENCE</span>
        <h1>Settings</h1>
        <p>Make HallsChat feel right for you.</p>
      </div>
      <section className="settings-card" aria-labelledby="appearance-heading">
        <div className="settings-card-heading">
          <span className="settings-section-icon"><Sun size={18}/></span>
          <div><h2 id="appearance-heading">Appearance</h2><p>Choose how HallsChat looks on this device.</p></div>
        </div>
        <div className="settings-theme-options" role="radiogroup" aria-label="Appearance theme">
          {options.map(({value,title,detail,icon:Icon}) => {
            const selected = choice === value;
            return <button key={value} type="button" role="radio" aria-checked={selected}
              className={`settings-theme-option${selected ? " is-selected" : ""}`}
              onClick={() => setChoice(value)}>
              <span className="settings-theme-icon"><Icon size={19}/></span>
              <span className="settings-theme-copy"><strong>{title}</strong><small>{detail}</small></span>
              <span className="settings-theme-check" aria-hidden="true">{selected && <Check size={15}/>}</span>
            </button>;
          })}
        </div>
        <p className="settings-note">Your choice is saved on this device and stays selected after refresh.</p>
      </section>
    </section>
    <NowBar />
  </main>;
}
