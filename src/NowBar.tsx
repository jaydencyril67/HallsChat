import { useState } from "react";
import { ChevronDown, ChevronUp, ContactRound, MessageCircle, Phone, Settings, UsersRound } from "lucide-react";

const items = [
  { label: "Chats", icon: MessageCircle },
  { label: "Contacts", icon: ContactRound },
  { label: "Calls", icon: Phone },
  { label: "Groups", icon: UsersRound },
  { label: "Settings", icon: Settings },
];

export default function NowBar() {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState("Chats");

  return (
    <nav className={`nowbar ${expanded ? "nowbar-expanded" : "nowbar-compact"}`} aria-label="HallsChat navigation">
      <div className="nowbar-items">
        {items.map(({ label, icon: Icon }) => (
          <button
            className={`nowbar-item ${active === label ? "nowbar-item-active" : ""}`}
            key={label}
            type="button"
            aria-current={active === label ? "page" : undefined}
            onClick={() => setActive(label)}
          >
            <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <button
        className="nowbar-toggle"
        type="button"
        aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
      >
        {expanded ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
      </button>
    </nav>
  );
}
