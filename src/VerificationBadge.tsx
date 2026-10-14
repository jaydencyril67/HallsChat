import type { CSSProperties } from "react";

type Props = { size?: number; title?: string; style?: CSSProperties };

export default function VerificationBadge({ size = 18, title = "Verified on HallsChat", style }: Props) {
  return <svg role="img" aria-label={title} title={title} width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", flex: "0 0 auto", verticalAlign: "-0.18em", ...style }} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 1.5 15 3.1 18.4 2.9 19.6 6.1 22.3 8.2 21.5 11.5 22.3 14.8 19.6 16.9 18.4 20.1 15 19.9 12 22.5 9 19.9 5.6 20.1 4.4 16.9 1.7 14.8 2.5 11.5 1.7 8.2 4.4 6.1 5.6 2.9 9 3.1Z" fill="currentColor" />
    <path d="m7.3 12.1 3.1 3.1 6.5-6.6" fill="none" stroke="var(--theme-text-inverse, #fff)" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
