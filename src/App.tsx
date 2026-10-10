import { useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import SignupPage from "./SignupPage";
import SigninPage from "./SigninPage";
import HomePage from "./HomePage";
import EmailVerificationPage from "./EmailVerificationPage";

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  const navigate = (nextPath: string) => {
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const normalizedPath = path.replace(/\/$/, "") || "/";
  if (normalizedPath === "/verify-email") return <EmailVerificationPage />;
  if (normalizedPath === "/signup") return <SignupPage />;
  if (normalizedPath === "/signin" || normalizedPath === "/sign-in") return <SigninPage />;
  if (normalizedPath === "/home") return <HomePage />;
  return <LandingPage onSignup={() => navigate("/signup")} />;
}
