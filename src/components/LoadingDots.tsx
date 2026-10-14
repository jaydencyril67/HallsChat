import React from "react";

const loaderStyle = `@keyframes worldscopeDotPulse { 0%, 80%, 100% { opacity: .55; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } } .worldscope-dot-loader { width: 5px; height: 5px; border-radius: 50%; background: var(--theme-primary-hover, currentColor); box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-primary-hover, currentColor) 18%, transparent); display: inline-block; animation: worldscopeDotPulse 1s infinite ease-in-out; } .worldscope-dot-loader:nth-child(2) { animation-delay: .15s; } .worldscope-dot-loader:nth-child(3) { animation-delay: .3s; }`;

const LoadingDots = () => (
  <>
    <style>{loaderStyle}</style>
    <span aria-label="Loading" role="status" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span className="worldscope-dot-loader" />
      <span className="worldscope-dot-loader" />
      <span className="worldscope-dot-loader" />
    </span>
  </>
);

export default LoadingDots;
