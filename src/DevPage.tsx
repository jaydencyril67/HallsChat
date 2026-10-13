import AppHeader from "./AppHeader";
import NowBar from "./NowBar";

export default function DevPage() {
  return (
    <main className="home-page social-home">
      <AppHeader homeHref="/home" />
      <section className="home-shell social-shell" aria-label="Dev page" />
      <NowBar />
    </main>
  );
}
