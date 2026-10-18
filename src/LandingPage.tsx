import { ArrowLeft, ArrowRight, Check, Heart, Home, LockKeyhole, MessageCircle, MoreHorizontal, Plus, Send, Smartphone, Users, Video, UsersRound, Sparkles } from "lucide-react";
import { useState } from "react";
import AppHeader from "./AppHeader";
import { navigate } from "./utils/navigate";


const features = [
  { icon: <MessageCircle size={20} />, number: "01", title: "Conversations that feel close", description: "A thoughtful space for everyday messages, little updates, and the people you want within reach." },
  { icon: <Users size={20} />, number: "02", title: "Your people, together", description: "Make room for family, friends, and shared circles without losing the feel of a personal conversation." },
  { icon: <Smartphone size={20} />, number: "03", title: "Made for your screen", description: "A clean experience that adapts from a wide desktop workspace to the phone in your hand." }
];

function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`landing-brand ${compact ? "landing-brand-compact" : ""}`}>
    <span className="landing-brand-mark"><img src="/crown-chat.svg?v=7" alt="" /></span>
    <span className="landing-brand-word">Halls<span>Chat</span></span>
  </span>;
}

export default function LandingPage() {
  const [demoTab, setDemoTab] = useState<"chats" | "feed" | "halls" | "profile">("chats");
  const [demoChat, setDemoChat] = useState<{ name: string; message: string } | null>(null);
  const [demoDraft, setDemoDraft] = useState("");
  const [demoSent, setDemoSent] = useState<string[]>([]);
  const [demoLiked, setDemoLiked] = useState(false);
  const [demoJoined, setDemoJoined] = useState(false);
  const [demoSaved, setDemoSaved] = useState(false);
  const [demoCommentsOpen, setDemoCommentsOpen] = useState(false);
  const [demoComment, setDemoComment] = useState("");
  const [demoNotice, setDemoNotice] = useState("");

  const handleLogin = async () => {
    const token = window.localStorage.getItem("hallschat_token");
    if (!token) {
      navigate("/signin");
      return;
    }

    // Confirm the saved token with the backend before opening the feeds.
    try {
      const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
      const response = await fetch(apiBase + "/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        navigate("/home");
        return;
      }
      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem("hallschat_token");
        window.localStorage.removeItem("hallschat_user");
        window.localStorage.removeItem("hallschat_last_activity_at");
      }
    } catch {
      // If the session cannot be confirmed, fall back to the sign-in screen.
    }
    navigate("/signin");
  };

  return <main className="landing-page theme-token-scope">
    <div className="landing-glow landing-glow-one" aria-hidden="true" />
    <div className="landing-glow landing-glow-two" aria-hidden="true" />
    <AppHeader />

    <section className="landing-hero" id="top">
      <div className="landing-hero-copy">
        
        <h1>Welcome to<br /><span>HallsChat.</span></h1>
        <p className="landing-hero-tagline">Your kind of connection.</p>
        <p className="landing-hero-description">Life moves fast. Make room for the conversations that make it matter — in a space designed to bring your people closer.</p>
        <div className="landing-hero-actions">
          <button className="button button-primary landing-cta" onClick={() => navigate("/signin")}>Continue with KingsHall <ArrowRight size={17} /></button>
          <div className="landing-hero-signin"><span>Already have an account?</span><a className="landing-signin-button" href="/signin" onClick={event => { event.preventDefault(); handleLogin(); }}>Access Feeds <ArrowRight size={16} /></a></div>
        </div>
        <div className="landing-social-proof">
          <div className="landing-avatar-stack"><span>A</span><span>D</span><span>M</span><span><Heart size={12} fill="currentColor" /></span></div>
          <div><strong>For the people who matter</strong><small>Closer conversations. Stronger connections.</small></div>
        </div>
      </div>

      <div className="landing-visual landing-demo-visual" aria-label="Interactive HallsChat demo phone">
        <div className="landing-orbit landing-orbit-one" />
        <div className="landing-orbit landing-orbit-two" />
        <div className="landing-demo-phone">
          <div className="landing-demo-hardware"><span /><i /></div>
          <div className="landing-demo-screen">
            <div className="landing-demo-status"><span>9:41</span><span>● ● ● <b>▰</b></span></div>
            <div className="landing-demo-appbar">
              {demoChat ? <button className="landing-demo-icon-btn" onClick={() => setDemoChat(null)} aria-label="Back to chats"><ArrowLeft size={17} /></button> : <span className="landing-demo-mini-mark"><img src="/crown-chat.svg?v=7" alt="" /></span>}
              <div className="landing-demo-app-title"><strong>{demoChat ? demoChat.name : "HallsChat"}</strong><small>{demoChat ? "demo conversation" : "Your people, closer."}</small></div>
              <button className="landing-demo-icon-btn" onClick={() => setDemoNotice("You're exploring a sample phone — nothing leaves this demo.")} aria-label="Demo information"><MoreHorizontal size={19} /></button>
            </div>
            <div className="landing-demo-body">
            {demoChat ? (
              <div className="landing-demo-conversation">
                <div className="landing-demo-date">TODAY · SAMPLE CHAT</div>
                <div className="landing-demo-bubble landing-demo-theirs">{demoChat.message}</div>
                <div className="landing-demo-bubble landing-demo-mine">This looks so good! 😊</div>
                {demoSent.map((message, index) => <div className="landing-demo-bubble landing-demo-mine" key={index}>{message}</div>)}
                <form className="landing-demo-composer" onSubmit={event => { event.preventDefault(); if (demoDraft.trim()) { setDemoSent(items => [...items, demoDraft.trim()]); setDemoDraft(""); setDemoNotice("Demo message sent locally ✨"); } }}>
                  <input value={demoDraft} onChange={event => setDemoDraft(event.target.value)} placeholder="Try a message…" aria-label="Type a demo message" />
                  <button type="submit" aria-label="Send demo message"><Send size={15} /></button>
                </form>
                <p className="landing-demo-local-note"><LockKeyhole size={10} /> Demo only · Messages aren't delivered</p>
              </div>
            ) : (
              <>
                <div className="landing-demo-welcome"><div><span>YOUR LITTLE CORNER OF THE WORLD</span><h3>Good morning,<br /><em>you.</em> ✨</h3><p>There's always someone to check in on.</p></div><div className="landing-demo-avatar landing-demo-avatar-you">Y</div></div>
                <div className="landing-demo-stories-label"><strong>People moments</strong><button onClick={() => setDemoNotice("Stories in this preview are just examples.")}>See all</button></div>
                <div className="landing-demo-stories">
                  <button className="landing-demo-story" onClick={() => setDemoNotice("Your story composer would open in the real app.")}><span className="landing-demo-story-ring landing-demo-story-add"><Plus size={16} /></span><small>Your story</small></button>
                  <button className="landing-demo-story" onClick={() => setDemoNotice("Emily's sample story ✨")}><span className="landing-demo-story-ring landing-demo-story-one">EC</span><small>Emily</small></button>
                  <button className="landing-demo-story" onClick={() => setDemoNotice("James's sample story 📸")}><span className="landing-demo-story-ring landing-demo-story-two">JW</span><small>James</small></button>
                  <button className="landing-demo-story" onClick={() => setDemoNotice("Olivia's sample story 💛")}><span className="landing-demo-story-ring landing-demo-story-three">OB</span><small>Olivia</small></button>
                </div>
                <div className="landing-demo-section-title"><strong>{demoTab === "chats" ? "Recent conversations" : demoTab === "feed" ? "Around your world" : demoTab === "halls" ? "Find your people" : "Your demo profile"}</strong><span>•••</span></div>
                {demoTab === "chats" && <div className="landing-demo-chat-list">
                  <button className="landing-demo-chat-row" onClick={() => { setDemoChat({name:"Emily Carter",message:"That photo came out so good 😂"}); setDemoSent([]); }}><span className="landing-demo-person landing-demo-person-rose">EC</span><span className="landing-demo-chat-copy"><strong>Emily Carter</strong><small>That photo came out so good 😂</small></span><time>9:28</time><i>2</i></button>
                  <button className="landing-demo-chat-row" onClick={() => { setDemoChat({name:"James Wilson",message:"You have to see this place we found."}); setDemoSent([]); }}><span className="landing-demo-person landing-demo-person-blue">JW</span><span className="landing-demo-chat-copy"><strong>James Wilson</strong><small><Video size={11} /> Voice message · 0:18</small></span><time>9:12</time></button>
                  <button className="landing-demo-chat-row" onClick={() => { setDemoChat({name:"Olivia Bennett",message:"Are we still on for this weekend? 😊"}); setDemoSent([]); }}><span className="landing-demo-person landing-demo-person-gold">OB</span><span className="landing-demo-chat-copy"><strong>Olivia Bennett</strong><small>Are we still on for this weekend? 😊</small></span><time>Yesterday</time></button>
                </div>}
                {demoTab === "feed" && <div className="landing-demo-feed">
                  <article><div className="landing-demo-feed-author"><span className="landing-demo-person landing-demo-person-rose">EC</span><span><strong>Emily Carter</strong><small>12 minutes ago · Everyone</small></span><button className={demoSaved ? "landing-demo-save is-saved" : "landing-demo-save"} onClick={() => { setDemoSaved(value => !value); setDemoNotice(demoSaved ? "Post removed from your saved demo items." : "Post saved in this demo ✨"); }} aria-label={demoSaved ? "Unsave post" : "Save post"}><Check size={13} /></button></div><p>Little things lately have been the big things. 🤎</p><div className="landing-demo-feed-photo">☀️<span>slow mornings, good coffee</span></div><div className="landing-demo-feed-actions"><button onClick={() => setDemoLiked(value => !value)} className={demoLiked ? "is-liked" : ""}><Heart size={14} fill={demoLiked ? "currentColor" : "none"} /> {demoLiked ? "You and 24 others" : "24"} · Like</button><button onClick={() => setDemoCommentsOpen(value => !value)}><MessageCircle size={14} /> 6 · Comment</button></div>{demoCommentsOpen && <div className="landing-demo-comments"><p><strong>James Wilson</strong> Needed this reminder today 🙌</p><form onSubmit={event => { event.preventDefault(); if (demoComment.trim()) { setDemoNotice("Your demo comment was added locally."); setDemoComment(""); } }}><input value={demoComment} onChange={event => setDemoComment(event.target.value)} placeholder="Write a pretend comment…" aria-label="Write a demo comment" /><button type="submit"><Send size={12} /></button></form></div>}</article>
                  <article><div className="landing-demo-feed-author"><span className="landing-demo-person landing-demo-person-blue">JW</span><span><strong>James Wilson</strong><small>38 minutes ago · The Cozy Corner</small></span></div><p>Found a new little spot for weekend coffee. Who's coming with me? ☕</p><div className="landing-demo-feed-photo landing-demo-feed-photo-cafe">☕<span>weekend plans, anyone?</span></div><div className="landing-demo-feed-actions"><button onClick={() => setDemoNotice("You liked James's sample post.")}><Heart size={14} /> 18 · Like</button><button onClick={() => setDemoNotice("Comments are only simulated in this preview.")}><MessageCircle size={14} /> 3 · Comment</button></div></article>
                  <div className="landing-demo-feed-tip"><Sparkles size={14} /> A feed for the moments worth sharing.</div>
                </div>}
                {demoTab === "halls" && <div className="landing-demo-halls">
                  <article><span className="landing-demo-hall-icon">✦</span><div><strong>The Cozy Corner</strong><small>Friends · 1.2k members</small></div><button onClick={() => setDemoJoined(value => !value)}>{demoJoined ? "Joined ✓" : "Join"}</button></article>
                  <article><span className="landing-demo-hall-icon landing-demo-hall-icon-warm">☕</span><div><strong>Daily Good Things</strong><small>Lifestyle · 860 members</small></div><button onClick={() => setDemoNotice("Welcome to Daily Good Things — demo only!")}>Explore</button></article>
                  <article><span className="landing-demo-hall-icon landing-demo-hall-icon-blue">🎮</span><div><strong>Game Night Crew</strong><small>Gaming · 540 members</small></div><button onClick={() => setDemoNotice("Game Night Crew opened in demo mode.")}>Explore</button></article>
                  <article><span className="landing-demo-hall-icon landing-demo-hall-icon-rose">🌱</span><div><strong>Small Wins Club</strong><small>Wellbeing · 2.4k members</small></div><button onClick={() => setDemoNotice("You're checking out Small Wins Club — demo only.")}>Explore</button></article>
                  <p>Shared interests. Familiar faces. Room to belong.</p>
                </div>}
                {demoTab === "profile" && <div className="landing-demo-profile"><div className="landing-demo-profile-cover"><span>✦</span></div><div className="landing-demo-profile-avatar">Y</div><strong>Your demo profile</strong><small>@yourcorner</small><p>Your people, your stories, your space.</p><div><span><b>18</b> posts</span><span><b>246</b> followers</span><span><b>180</b> following</span></div><button onClick={() => setDemoNotice("Profile editing is disabled in this interactive preview.")}>Edit profile</button></div>}
              </>
            )}
            </div>
            {!demoChat && <div className="landing-demo-bottom-nav">
              <button className={demoTab === "chats" ? "active" : ""} onClick={() => setDemoTab("chats")}><MessageCircle size={16} /><small>Chats</small></button>
              <button className={demoTab === "feed" ? "active" : ""} onClick={() => setDemoTab("feed")}><Home size={16} /><small>Feed</small></button>
              <button className={demoTab === "halls" ? "active" : ""} onClick={() => setDemoTab("halls")}><UsersRound size={16} /><small>Halls</small></button>
              <button className={demoTab === "profile" ? "active" : ""} onClick={() => setDemoTab("profile")}><Users size={16} /><small>You</small></button>
            </div>}
            {demoNotice && <button className="landing-demo-toast" onClick={() => setDemoNotice("")}>{demoNotice}<span>×</span></button>}
          </div>
          <div className="landing-demo-home-indicator" />
        </div>
        <div className="landing-float-card landing-float-top"><span className="landing-float-icon"><Heart size={15} fill="currentColor" /></span><span><strong>Made for your people</strong><small>Little moments, kept close</small></span></div>
        <div className="landing-float-card landing-float-bottom"><span className="landing-float-icon landing-float-icon-light"><LockKeyhole size={15} /></span><span><strong>Just a little preview</strong><small>Explore freely — it's all pretend</small></span><Check size={15} className="landing-float-check" /></div>
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
      <div className="landing-final-symbol"><img src="/crown-chat.svg?v=7" alt="HallsChat" /></div>
      <span className="landing-final-kicker">CLOSER CONVERSATIONS. STRONGER CONNECTIONS.</span>
      <h2>Your next good<br /><em>conversation starts here.</em></h2>
      <p>Continue with your KingsHall account and make room for the conversations that matter.</p>
      <button className="button button-primary landing-cta" onClick={onSignup}>Continue with KingsHall <ArrowRight size={17} /></button>
      <p className="landing-signin-note">Already have an account? <a href="/signin" onClick={event => { event.preventDefault(); handleLogin(); }}>Access Feeds</a></p>
    </section>

    <footer className="landing-footer"><a className="landing-brand-link" href="#top"><Brand compact /></a><span>Made for meaningful moments.</span><a href="#top" className="landing-back-top">Back to top ↑</a><small>© {new Date().getFullYear()} HallsChat. Built with care.</small></footer>
    <div className="landing-preview-disclaimer">Interactive preview · Sample activity only · Nothing is sent</div>
  </main>;
}
