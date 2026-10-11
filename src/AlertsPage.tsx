import { ArrowLeft, Bell, CheckCheck, CircleAlert, Inbox } from "lucide-react";
import { useState } from "react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import { navigate } from "./utils/navigate";

type AlertFilter = "all" | "unread";

export default function AlertsPage() {
  const [filter, setFilter] = useState<AlertFilter>("all");

  return (
    <main className="home-page social-home halls-alerts-page">
      <AppHeader homeHref="/home" />
      <section className="home-shell social-shell halls-alerts-shell">
        <button type="button" className="halls-alerts-back" onClick={() => navigate("/home")}>
          <ArrowLeft size={16} /> Home
        </button>

        <div className="halls-alerts-heading">
          <div className="halls-alerts-heading-icon"><Bell size={22} /></div>
          <div>
            <p className="halls-alerts-eyebrow">YOUR UPDATES</p>
            <h1>Alerts</h1>
            <p className="halls-alerts-description">Important activity and updates will appear here.</p>
          </div>
        </div>

        <div className="halls-alerts-toolbar" role="tablist" aria-label="Alert filter">
          <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            <Inbox size={15} /> All alerts
          </button>
          <button type="button" role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>
            <CircleAlert size={15} /> Unread
          </button>
        </div>

        <section className="halls-alerts-empty" aria-live="polite">
          <div className="halls-alerts-empty-icon">{filter === "unread" ? <CheckCheck size={26} /> : <Inbox size={27} />}</div>
          <h2>{filter === "unread" ? "You're all caught up" : "No alerts yet"}</h2>
          <p>{filter === "unread" ? "There are no unread alerts to show." : "When alerts are available for your account, you'll find them here."}</p>
        </section>
      </section>
      <NowBar />
    </main>
  );
}
