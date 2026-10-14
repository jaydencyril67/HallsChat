import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const [openPicker, setOpenPicker] = useState<"month" | "year" | "hour" | "minute" | null>(null);

  useEffect(() => {
    const nextDate = value.split("T")[0] || dateKey(new Date());
    setSelectedDate(nextDate);
    const nextTime = value.includes("T") ? value.split("T")[1]?.slice(0, 5) : resolvedMode === "time" ? value.slice(0, 5) : "";
    setTime(nextTime || "12:00");
    setMonth(parseDate(nextDate));
    setOpenPicker(null);
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
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
  const [hour, minute] = time.split(":");
  const output = resolvedMode === "datetime-local" ? `${selectedDate}T${time}` : resolvedMode === "time" ? time : selectedDate;
  const valid = resolvedMode === "time" || allowed(selectedDate);

  const pickerStyle: CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    width: "100%", minWidth: 0, boxSizing: "border-box", borderRadius: 12,
    border: "1px solid var(--theme-line)", background: "var(--theme-surface-raised)",
    color: "var(--theme-text)", padding: "10px 12px", font: "inherit",
    fontWeight: 800, cursor: "pointer", outline: "none", textAlign: "left",
  };
  const pickerWrapper: CSSProperties = { position: "relative", minWidth: 0, flex: 1 };
  const pickerMenu: CSSProperties = {
    position: "absolute", zIndex: 20, top: "calc(100% + 6px)", left: 0, right: 0,
    maxHeight: 240, overflowY: "auto", overscrollBehavior: "contain", padding: 6,
    borderRadius: 14, border: "1px solid var(--theme-line)",
    background: "var(--theme-surface)", color: "var(--theme-text)",
    boxShadow: "0 16px 36px rgba(0,0,0,.24)",
  };
  const pickerOption: CSSProperties = {
    display: "block", width: "100%", border: 0, borderRadius: 9,
    background: "transparent", color: "var(--theme-text)", padding: "9px 10px",
    font: "inherit", fontWeight: 700, textAlign: "left", cursor: "pointer",
  };
  const actionButton: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", minWidth: 0, minHeight: 38, border: "1px solid var(--theme-line)", borderRadius: 12,
    padding: "9px 12px", background: "var(--theme-surface-raised)",
    color: "var(--theme-text)", font: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer", boxSizing: "border-box",
  };
  const fieldLabel: CSSProperties = {
    display: "block", marginBottom: 8, color: "var(--theme-muted)",
    fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
  };
  const changeMonth = (offset: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const choose = (picker: "month" | "year" | "hour" | "minute", next: string) => {
    if (picker === "month") setMonth(current => new Date(current.getFullYear(), Number(next), 1));
    if (picker === "year") setMonth(current => new Date(Number(next), current.getMonth(), 1));
    if (picker === "hour") setTime(next + ":" + minute);
    if (picker === "minute") setTime(hour + ":" + next);
    setOpenPicker(null);
  };
  const selector = (kind: "month" | "year" | "hour" | "minute", current: string, options: string[], ariaLabel: string) => (
    <div style={pickerWrapper}>
      <button type="button" aria-haspopup="listbox" aria-expanded={openPicker === kind} aria-label={ariaLabel} style={pickerStyle} onClick={() => setOpenPicker(openPicker === kind ? null : kind)}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current}</span><span aria-hidden="true" style={{ marginLeft: "auto", paddingLeft: 8, flexShrink: 0 }}>⌄</span>
      </button>
      {openPicker === kind && <div role="listbox" aria-label={ariaLabel} style={pickerMenu}>
        {options.map(option => <button key={option} type="button" role="option" aria-selected={current === option} style={{ ...pickerOption, ...(current === option ? { background: "var(--theme-primary)", color: "var(--theme-primary-contrast)" } : {}) }} onClick={() => choose(kind, option)}>{kind === "month" ? months[Number(option)] : option}</button>)}
      </div>}
    </div>
  );

  return <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, width: "100%", height: "100dvh", minHeight: "100%", overflowY: "auto", overscrollBehavior: "contain", background: "var(--theme-bg)", color: "var(--theme-text)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", boxSizing: "border-box" }}>
    <div style={{ minHeight: "100%", maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", padding: "max(8px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
      <div style={{ flex: 1, paddingTop: 8 }}>
        {resolvedMode !== "time" && <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, border: "1px solid var(--theme-line)", background: "var(--theme-surface-raised)", color: "var(--theme-text)", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>‹</button>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flex: 1, minWidth: 0 }}>
              {selector("month", String(month.getMonth()), months.map((_, i) => String(i)), "Choose month")}
              {selector("year", String(month.getFullYear()), years.map(String), "Choose year")}
            </div>
            <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, border: "1px solid var(--theme-line)", background: "var(--theme-surface-raised)", color: "var(--theme-text)", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6, marginBottom: 6 }}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day} style={{ textAlign: "center", color: "var(--theme-muted)", fontSize: 11, fontWeight: 800, padding: "7px 0" }}>{day}</span>)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6 }}>
            {Array.from({ length: calendar.leading }, (_, index) => <span key={"empty-" + index} />)}
            {calendar.days.map(day => {
              const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
              const enabled = allowed(key);
              const selected = selectedDate === key;
              return <button key={key} type="button" disabled={!enabled} aria-pressed={selected} onClick={() => setSelectedDate(key)} style={{ aspectRatio: "1", minHeight: 38, borderRadius: 13, border: selected ? "1px solid var(--theme-accent-border)" : "1px solid transparent", background: selected ? "var(--theme-primary)" : "transparent", color: selected ? "var(--theme-primary-contrast)" : "var(--theme-text)", opacity: enabled ? 1 : .3, font: "inherit", fontWeight: 800, cursor: enabled ? "pointer" : "not-allowed" }}>{day}</button>;
            })}
          </div>
        </>}
        {(resolvedMode === "datetime-local" || resolvedMode === "time") && <div style={{ marginTop: resolvedMode === "time" ? 0 : 26 }}>
          <span style={fieldLabel}>{label || "Time"}</span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {selector("hour", hour, hours, "Choose hour")}
            <span style={{ fontSize: 20, fontWeight: 850 }}>:</span>
            {selector("minute", minute, minutes, "Choose minute")}
          </div>
        </div>}
        {label && resolvedMode === "date" && <p style={{ color: "var(--theme-muted)", fontSize: 12 }}>{label}</p>}
      </div>
      <footer style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, paddingTop: 24, marginTop: "auto", width: "100%" }}>
        <button type="button" style={actionButton} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" disabled={!valid} style={{ ...actionButton, borderColor: "var(--theme-accent-border)", background: "var(--theme-primary)", color: "var(--theme-primary-contrast)", opacity: valid ? 1 : .45 }} onClick={() => onConfirm(output)}>{confirmLabel}</button>
      </footer>
    </div>
  </div>;
}
