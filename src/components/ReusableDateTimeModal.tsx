import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from "lucide-react";

export type ReusableDateTimeModalProps = {
  title: string;
  description?: string;
  value?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  min?: string;
  max?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  label?: string;
  mode?: "auto" | "date" | "datetime-local" | "time";
};

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseDate = (value: string) => {
  const parsed = new Date((value || dateKey(new Date())).split("T")[0] + "T12:00:00");
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export default function ReusableDateTimeModal({
  title, description = "Choose a date and time.", value = "", onConfirm, onCancel, min, max,
  confirmLabel = "Confirm", cancelLabel = "Cancel", label, mode = "auto",
}: ReusableDateTimeModalProps) {
  const resolvedMode = mode === "auto" ? (value.includes("T") ? "datetime-local" : "date") : mode;
  const initialDate = value.split("T")[0] || dateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [time, setTime] = useState(value.includes("T") ? value.split("T")[1]?.slice(0, 5) || "12:00" : resolvedMode === "time" ? value.slice(0, 5) || "12:00" : "12:00");
  const [month, setMonth] = useState(() => parseDate(initialDate));
  useEffect(() => {
    const nextDate = value.split("T")[0] || dateKey(new Date());
    setSelectedDate(nextDate);
    const nextTime = value.includes("T") ? value.split("T")[1]?.slice(0, 5) : resolvedMode === "time" ? value.slice(0, 5) : "";
    setTime(nextTime || "12:00");
    setMonth(parseDate(nextDate));
  }, [value, resolvedMode]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [onCancel]);

  const calendar = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return { leading: first.getDay(), days: Array.from({ length: count }, (_, index) => index + 1) };
  }, [month]);
  const allowed = (key: string) => (!min || key >= min.split("T")[0]) && (!max || key <= max.split("T")[0]);
  const currentYear = new Date().getFullYear();
  const minYear = min ? Number(min.slice(0, 4)) : currentYear - 120;
  const maxYear = max ? Number(max.slice(0, 4)) : currentYear + 20;
  const years = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, index) => minYear + index);
  const months = Array.from({ length: 12 }, (_, index) => new Date(2000, index, 1).toLocaleDateString(undefined, { month: "long" }));
  const [hour, minute] = time.split(":");
  const output = resolvedMode === "datetime-local" ? `${selectedDate}T${time}` : resolvedMode === "time" ? time : selectedDate;
  const valid = resolvedMode === "time" || allowed(selectedDate);

  const selectStyle: CSSProperties = {
    minWidth: 0, width: "100%", border: "1px solid var(--theme-line)", borderRadius: 12,
    padding: "12px 10px", background: "var(--theme-surface-raised)", color: "var(--theme-text)",
    font: "inherit", fontWeight: 750, outline: "none",
  };
  const buttonStyle: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 44, border: "1px solid var(--theme-line)", borderRadius: 12,
    padding: "10px 16px", background: "var(--theme-surface-raised)", color: "var(--theme-text)",
    font: "inherit", fontWeight: 750, cursor: "pointer",
  };
  const iconButton: CSSProperties = { ...buttonStyle, width: 44, minWidth: 44, padding: 0, borderRadius: 12 };
  const fieldLabel: CSSProperties = { display: "block", marginBottom: 8, color: "var(--theme-muted)", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" };
  const changeMonth = (offset: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  return <div role="dialog" aria-modal="true" aria-labelledby="reusable-date-time-title" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, width: "100%", height: "100dvh", minHeight: "100%", overflowY: "auto", overscrollBehavior: "contain", background: "var(--theme-bg)", color: "var(--theme-text)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", boxSizing: "border-box" }}>
    <div style={{ minHeight: "100%", maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", padding: "max(14px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 18px", borderBottom: "1px solid var(--theme-line)" }}>
        <div style={{ width: 42, height: 42, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 13, background: "var(--theme-surface-raised)", border: "1px solid var(--theme-line)" }}>{resolvedMode === "time" ? <Clock3 size={20} /> : <CalendarDays size={20} />}</div>
        <div style={{ flex: 1, minWidth: 0 }}><h1 id="reusable-date-time-title" style={{ margin: 0, fontSize: 19, fontWeight: 850 }}>{title}</h1>{description && <p style={{ margin: "4px 0 0", color: "var(--theme-muted)", fontSize: 13, lineHeight: 1.45 }}>{description}</p>}</div>
        <button type="button" aria-label="Close date and time picker" style={iconButton} onClick={onCancel}><X size={19} /></button>
      </header>
      <div style={{ flex: 1, paddingTop: 22 }}>
        {resolvedMode !== "time" && <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <button type="button" aria-label="Previous month" style={iconButton} onClick={() => changeMonth(-1)}><ChevronLeft size={19} /></button>
            <select aria-label="Choose month" style={selectStyle} value={month.getMonth()} onChange={e => setMonth(current => new Date(current.getFullYear(), Number(e.target.value), 1))}>{months.map((name, index) => <option key={name} value={index}>{name}</option>)}</select>
            <select aria-label="Choose year" style={{ ...selectStyle, maxWidth: 116 }} value={month.getFullYear()} onChange={e => setMonth(current => new Date(Number(e.target.value), current.getMonth(), 1))}>{years.map(year => <option key={year} value={year}>{year}</option>)}</select>
            <button type="button" aria-label="Next month" style={iconButton} onClick={() => changeMonth(1)}><ChevronRight size={19} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 5, marginBottom: 6 }}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day} style={{ textAlign: "center", color: "var(--theme-muted)", fontSize: 11, fontWeight: 800, padding: "7px 0" }}>{day}</span>)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 5 }}>
            {Array.from({ length: calendar.leading }, (_, index) => <span key={"empty-" + index} />)}
            {calendar.days.map(day => {
              const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
              const enabled = allowed(key);
              const selected = selectedDate === key;
              return <button key={key} type="button" disabled={!enabled} aria-pressed={selected} onClick={() => setSelectedDate(key)} style={{ aspectRatio: "1", minHeight: 38, borderRadius: 12, border: selected ? "1px solid var(--theme-accent-border)" : "1px solid var(--theme-line)", background: selected ? "var(--theme-primary)" : "var(--theme-surface)", color: selected ? "var(--theme-primary-contrast)" : "var(--theme-text)", opacity: enabled ? 1 : .3, font: "inherit", fontWeight: 800, cursor: enabled ? "pointer" : "not-allowed" }}>{day}</button>;
            })}
          </div>
        </>}
        {(resolvedMode === "datetime-local" || resolvedMode === "time") && <div style={{ marginTop: resolvedMode === "time" ? 0 : 26 }}>
          <span style={fieldLabel}>{label || "Time"}</span>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 10 }}>
            <select aria-label="Choose hour" style={{ ...selectStyle, fontSize: 18, textAlign: "center" }} value={hour} onChange={e => setTime(e.target.value + ":" + minute)}>{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(v => <option key={v}>{v}</option>)}</select>
            <span style={{ fontSize: 22, fontWeight: 850 }}>:</span>
            <select aria-label="Choose minute" style={{ ...selectStyle, fontSize: 18, textAlign: "center" }} value={minute} onChange={e => setTime(hour + ":" + e.target.value)}>{Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(v => <option key={v}>{v}</option>)}</select>
          </div>
        </div>}
        {label && resolvedMode === "date" && <p style={{ color: "var(--theme-muted)", fontSize: 12 }}>{label}</p>}
      </div>
      <footer style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10, paddingTop: 22, marginTop: "auto" }}>
        <button type="button" style={buttonStyle} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" disabled={!valid} style={{ ...buttonStyle, borderColor: "var(--theme-accent-border)", background: "var(--theme-primary)", color: "var(--theme-primary-contrast)", opacity: valid ? 1 : .45 }} onClick={() => onConfirm(output)}>{confirmLabel}</button>
      </footer>
    </div>
  </div>;
}
