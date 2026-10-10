import { useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import SignupPage from "./SignupPage";
import EmailVerificationPage from "./EmailVerificationPage";

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  const openSignup = () => {
    if (window.location.pathname !== "/signup") window.history.pushState({}, "", "/signup");
    setPath("/signup");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const openLanding = () => {
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    setPath("/");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const normalizedPath = path.replace(/\/$/, "") || "/";
  if (normalizedPath === "/verify-email") return <EmailVerificationPage />;
  if (normalizedPath === "/signup") return <SignupPage />;
  return <LandingPage onSignup={openSignup} />;
}
