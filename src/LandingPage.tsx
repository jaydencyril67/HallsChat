import { ArrowDownRight, ArrowRight, Check, Heart, LockKeyhole, MessageCircle, Smartphone, Users, Video } from "lucide-react";

type LandingPageProps = { onExplore: () => void };

const features = [
  { icon: <MessageCircle size={20} />, number: "01", title: "Conversations that feel close", description: "A thoughtful space for everyday messages, little updates, and the people you want within reach." },
  { icon: <Users size={20} />, number: "02", title: "Your people, together", description: "Make room for family, friends, and shared circles without losing the feel of a personal conversation." },
  { icon: <Smartphone size={20} />, number: "03", title: "Made for your screen", description: "A clean experience that adapts from a wide desktop workspace to the phone in your hand." }
];

function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`landing-brand ${compact ? "landing-brand-compact" : ""}`}>
    <span className="landing-brand-mark"><MessageCircle size={compact ? 18 : 21} strokeWidth={2.5} /><i /></span>
    <span className="landing-brand-word">Halls<span>Chat</span></span>
  </span>;
}

export default function LandingPage({ onExplore }: LandingPageProps) {
  return <main className="landing-page">
    <div className="landing-glow landing-glow-one" aria-hidden="true" />
    <div className="landing-glow landing-glow-two" aria-hidden="true" />
    <header className="topbar landing-app-header" aria-label="HallsChat app header">
      <a className="header-artwork" href="#top" aria-label="HallsChat home"><span className="header-logo"><MessageCircle size={19} strokeWidth={2.4}/><i /></span></a>
      <div className="header-brand"><strong>HALLSCHAT</strong></div>
      <a className="header-artwork header-artwork-right" href="#top" aria-label="Back to top"><span className="header-logo"><MessageCircle size={19} strokeWidth={2.4}/><i /></span></a>
    </header>

    <section className="landing-hero" id="top">
      <div className="landing-hero-copy">
        <div className="landing-eyebrow"><span /> A LITTLE CLOSER, EVERY DAY</div>
        <h1>Your people.<br /><span>Your kind of</span><br /><em>connection.</em></h1>
        <p className="landing-hero-description">Life moves fast. Make room for the conversations that make it matter — in a space designed to bring your people closer.</p>
        <div className="landing-hero-actions">
          <button className="landing-cta" onClick={onExplore}>Explore HallsChat <ArrowRight size={17} /></button>
          <a className="landing-text-link" href="#why-hallschat">Get to know us <ArrowDownRight size={16} /></a>
        </div>
        <div className="landing-social-proof">
          <div className="landing-avatar-stack"><span>A</span><span>D</span><span>M</span><span><Heart size={12} fill="currentColor" /></span></div>
          <div><strong>For the people who matter</strong><small>Closer conversations. Stronger connections.</small></div>
        </div>
      </div>

      <div className="landing-visual" aria-label="Preview of the HallsChat conversation interface">
        <div className="landing-orbit landing-orbit-one" />
        <div className="landing-orbit landing-orbit-two" />
        <div className="landing-preview-window">
          <div className="landing-preview-top">
            <Brand compact />
            <span className="landing-preview-status"><i /> YOUR SPACE</span>
          </div>
          <div className="landing-preview-content">
            <div className="landing-preview-greeting"><small>MONDAY, 9:41 AM</small><h3>A good day to<br />check in. <span>♥</span></h3><p>Little moments make a big difference.</p></div>
            <div className="landing-preview-section-label">RECENT CONVERSATIONS <span>•••</span></div>
            <div className="landing-preview-chat"><div className="landing-person landing-person-rose">AO</div><div className="landing-preview-chat-copy"><strong>Amara Okafor</strong><span>That photo came out so good 😂</span></div><time>9:28</time><i className="landing-unread">2</i></div>
            <div className="landing-preview-chat"><div className="landing-person landing-person-blue">DM</div><div className="landing-preview-chat-copy"><strong>David Mensah</strong><span>Sent you a voice message</span></div><time>9:12</time></div>
            <div className="landing-preview-chat"><div className="landing-person landing-person-gold">M</div><div className="landing-preview-chat-copy"><strong>Mum ❤️</strong><span>Have you eaten, my dear?</span></div><time>Yesterday</time></div>
            <div className="landing-preview-message"><span>✦</span><p>Some messages are small.<br /><strong>The feeling isn't.</strong></p></div>
          </div>
          <div className="landing-preview-bottom"><span className="landing-preview-nav-active"><MessageCircle size={15} /> Chats</span><span><Users size={15} /> People</span><span><Video size={15} /> Calls</span></div>
        </div>
        <div className="landing-float-card landing-float-top"><span className="landing-float-icon"><Heart size={15} fill="currentColor" /></span><span><strong>Stay connected</strong><small>Even in the little moments</small></span></div>
        <div className="landing-float-card landing-float-bottom"><span className="landing-float-icon landing-float-icon-light"><LockKeyhole size={15} /></span><span><strong>Your space, your pace</strong><small>A calmer way to catch up</small></span><Check size={15} className="landing-float-check" /></div>
      </div>
      <a href="#why-hallschat" className="landing-scroll-hint"><span /> SCROLL TO EXPLORE</a>
    </section>

    <section className="landing-values" id="why-hallschat">
      <div className="landing-values-heading"><span>MADE FOR REAL LIFE</span><p>Not more noise.<br /><strong>More meaningful moments.</strong></p></div>
      <div className="landing-values-note"><span className="landing-values-mark">✳</span><p>HallsChat is being built around a simple idea: staying close should feel natural, not like another task on your list.</p></div>
    </section>

    <section className="landing-features" id="experience">
      <div className="landing-section-heading"><div><span>THE HALLSCHAT FEELING</span><h2>A little more <em>human.</em></h2></div><p>Thoughtful by design, with the people behind every message kept at the centre.</p></div>
      <div className="landing-feature-grid">{features.map(feature => <article className="landing-feature-card" key={feature.number}><div className="landing-feature-card-top"><span className="landing-feature-icon">{feature.icon}</span><span>{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.description}</p><span className="landing-feature-line" /></article>)}</div>
    </section>

    <section className="landing-final-cta">
      <div className="landing-final-symbol"><MessageCircle size={24} /><span>♥</span></div>
      <span className="landing-final-kicker">CLOSER CONVERSATIONS. STRONGER CONNECTIONS.</span>
      <h2>Your next good<br /><em>conversation starts here.</em></h2>
      <p>Take a first look around HallsChat and see the experience taking shape.</p>
      <button className="landing-cta" onClick={onExplore}>Open the interactive preview <ArrowRight size={17} /></button>
    </section>

    <footer className="landing-footer"><a className="landing-brand-link" href="#top"><Brand compact /></a><span>Made for meaningful moments.</span><a href="#top" className="landing-back-top">Back to top ↑</a><small>© {new Date().getFullYear()} HallsChat. Built with care.</small></footer>
    <div className="landing-preview-disclaimer">You’re viewing an early preview. Accounts and live message delivery are not available yet.</div>
  </main>;
}
