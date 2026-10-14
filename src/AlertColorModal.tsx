import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ArrowLeft, Check, X } from "lucide-react";

const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const hexToRgb = (hex: string) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
const hsvToHex = (hue: number, saturation: number, value: number) => {
  const chroma = value * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0] : segment < 2 ? [secondary, chroma, 0] : segment < 3 ? [0, chroma, secondary] : segment < 4 ? [0, secondary, chroma] : segment < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  const match = value - chroma;
  return rgbToHex(Math.round((red + match) * 255), Math.round((green + match) * 255), Math.round((blue + match) * 255));
};
const hueFromHex = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255, green = g / 255, blue = b / 255;
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min;
  if (delta === 0) return 0;
  if (max === red) return (60 * ((green - blue) / delta) + 360) % 360;
  if (max === green) return 60 * ((blue - red) / delta + 2);
  return 60 * ((red - green) / delta + 4);
};

export default function AlertColorModal({ color, onChange, onClose }: { color: string; onChange: (color: string) => void; onClose: () => void }) {
  const [customColor, setCustomColor] = useState(color);
  const [rgb, setRgb] = useState(() => hexToRgb(color));
  const [hue, setHue] = useState(() => hueFromHex(color));
  const [saturation, setSaturation] = useState(() => {
    const values = hexToRgb(color); const max = Math.max(values.r, values.g, values.b) / 255; const min = Math.min(values.r, values.g, values.b) / 255;
    return max === 0 ? 0 : (max - min) / max;
  });
  const [value, setValue] = useState(() => Math.max(...Object.values(hexToRgb(color))) / 255);
  const [error, setError] = useState("");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const selectColor = (next: string) => {
    if (!isHexColor(next)) return;
    const normalized = next.toLowerCase();
    const nextRgb = hexToRgb(normalized);
    const max = Math.max(nextRgb.r, nextRgb.g, nextRgb.b) / 255;
    const min = Math.min(nextRgb.r, nextRgb.g, nextRgb.b) / 255;
    setCustomColor(normalized); setRgb(nextRgb); setHue(hueFromHex(normalized)); setValue(max); setSaturation(max === 0 ? 0 : (max - min) / max); setError("");
    onChange(normalized);
  };
  const selectHueAtPoint = (clientX: number, clientY: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2), dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy), outerRadius = Math.min(rect.width, rect.height) / 2;
    if (distance < outerRadius - 24 || distance > outerRadius) return;
    const nextHue = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    setHue(nextHue); selectColor(hsvToHex(nextHue, saturation, value));
  };
  const updateField = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextSaturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextValue = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
    setSaturation(nextSaturation); setValue(nextValue); selectColor(hsvToHex(hue, nextSaturation, nextValue));
  };
  const updateRgb = (channel: "r" | "g" | "b", raw: string) => {
    const next = { ...rgb, [channel]: Math.max(0, Math.min(255, Number(raw) || 0)) };
    setRgb(next); selectColor(rgbToHex(next.r, next.g, next.b));
  };
  const surface = "var(--theme-surface, #21191d)";
  const raised = "var(--theme-surface-raised, #2a2025)";
  const line = "var(--theme-line, rgba(255,255,255,.14))";
  const text = "var(--theme-text, #fff4f0)";
  const muted = "var(--theme-muted, #c0afb5)";
  const buttonStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 38, padding: "0 13px", border: `1px solid ${line}`, borderRadius: 10, background: raised, color: text, fontSize: 12, fontWeight: 750, cursor: "pointer" } as const;
  return <div className="alert-color-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="alert-color-modal theme-token-scope" role="dialog" aria-modal="true" aria-label="Choose alert color" onClick={event => event.stopPropagation()}>
      <header className="alert-color-modal-header">
        <button type="button" className="alert-color-modal-back" onClick={onClose}><ArrowLeft size={17}/> Settings</button>
        <strong>Alert Color</strong>
        <button type="button" className="alert-color-modal-close" onClick={onClose} aria-label="Close color picker"><X size={18}/></button>
      </header>
      <div className="alert-color-modal-content">
        <p className="alert-color-modal-intro">Choose the color used to highlight the app header while alerts are unread or an upload is active. Your choice saves immediately.</p>
        <section className="alert-color-preview">
          <span style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: color, boxShadow: `0 0 24px ${color}` }}/>
          <strong>Selected color</strong><code>{color.toUpperCase()}</code>
        </section>
        <section className="alert-color-picker-card">
          <h2>Color wheel</h2>
          <div className="alert-color-picker" role="group" aria-label="Color wheel">
            <div className="alert-color-hue-ring" onClick={event => selectHueAtPoint(event.clientX, event.clientY, event.currentTarget)}>
              <span className="alert-color-hue-track" style={{ transform: `rotate(${hue}deg)` }}><span/></span>
              <div className="alert-color-field" style={{ "--picker-hue": hsvToHex(hue, 1, 1) } as React.CSSProperties} onClick={event => { event.stopPropagation(); updateField(event); }}>
                <span style={{ left: `${saturation * 100}%`, top: `${(1 - value) * 100}%` }}/>
              </div>
            </div>
          </div>
          <div className="alert-color-hex-row">
            <input aria-label="HEX color" value={customColor} onChange={event => setCustomColor(event.target.value)} placeholder="#38bdf8" />
            <button type="button" style={buttonStyle} onClick={() => { const next = customColor.startsWith("#") ? customColor : `#${customColor}`; if (!isHexColor(next)) { setError("Enter a valid six-digit hex color, for example #38bdf8."); return; } selectColor(next); }}><Check size={16}/> Apply</button>
          </div>
          <div className="alert-color-rgb-row">
            {(["r", "g", "b"] as const).map(channel => <label key={channel}>{channel.toUpperCase()}<input aria-label={`${channel.toUpperCase()} color value`} type="number" min="0" max="255" value={rgb[channel]} onChange={event => updateRgb(channel, event.target.value)}/></label>)}
          </div>
          {error && <p className="alert-color-error" role="alert">{error}</p>}
        </section>
        <button type="button" className="alert-color-done" onClick={onClose}>Done</button>
      </div>
    </section>
  </div>;
}
