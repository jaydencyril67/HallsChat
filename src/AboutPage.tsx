import { useState } from "react";
import { BookOpen, CheckCircle2, ShieldCheck } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";

type AboutTab = "about" | "standards";

const aboutSections = [
  {
    title: "A place for people, not just profiles",
    paragraphs: [
      "HallsChat is a social-first space for keeping up with people, sharing moments, joining conversations and building communities. The experience brings a social feed and stories together with private conversations, voice and video calls, profiles, and Halls — community spaces where people can gather around shared interests.",
      "The aim is to make the everyday things people do online feel connected instead of scattered across separate tools: discover a conversation, see what your people are sharing, reply naturally, and return to the communities that matter to you."
    ]
  },
  {
    title: "Your feed and stories",
    paragraphs: [
      "The feed is where posts from the community can be read and discussed. Text posts can use background colours to help a short thought stand out, while image posts let people share visual moments. Posts support conversation through comments and reactions where those controls are available.",
      "Stories are designed for quick, expressive updates. You can compose text over images, style text sections, position them, and share a moment without turning it into a full feed post. Always review the final preview before publishing, especially when an image contains faces, documents, locations or other personal details.",
      "Feed posts are public on HallsChat. Do not publish anything to the feed that you only intend a specific person or a small private group to see. Check the available story and profile controls before sharing sensitive material."
    ]
  },
  {
    title: "Conversations, calls and communities",
    paragraphs: [
      "Rooms bring your direct conversations together, with tools for sharing messages and media and keeping a conversation organised. Depending on the feature and version you are using, conversations may include replies, reactions, editing or deleting your own messages, voice notes, typing indicators and conversation controls.",
      "Voice and video calling are intended to make it easier to talk in real time. Call quality depends on your device, permissions, network, browser or Android WebView, and the connection of the other participant. Do not assume a call is private from everyone nearby: people around either participant may hear audio or see the screen.",
      "Halls are community spaces for people to meet around a topic or shared interest. Be considerate of members, follow each Hall's rules, and avoid flooding a community with repetitive posts or unsolicited promotions."
    ]
  },
  {
    title: "Profiles and finding people",
    paragraphs: [
      "Your profile helps other people recognise you and understand what you choose to share. Keep your profile information accurate enough to avoid misleading people, and remember that profile details and public interactions may be visible beyond your immediate connections.",
      "Only connect or start conversations with people you are comfortable interacting with. If someone pressures you, impersonates another person, sends unwanted material or repeatedly ignores your boundaries, use the controls available in the app and report the concern."
    ]
  },
  {
    title: "Designed to keep improving",
    paragraphs: [
      "HallsChat is actively developed. Interfaces, supported media, moderation tools, notifications and other features can change as the app improves. The website, PWA and installed Android APK may not always show the same release at the same moment; an APK can require a new build and installation before it includes the newest bundled interface.",
      "A feature being visible does not mean it is suitable for every situation or guaranteed to be available without interruption. Keep the app updated, check important actions before confirming them, and contact support through the available in-app route when something behaves unexpectedly."
    ]
  },
  {
    title: "A few good habits",
    paragraphs: [
      "Use a unique password and secure the email account connected to your HallsChat account. Keep your device updated, lock it when unattended, and do not share verification codes or account recovery details. HallsChat support should never need your password or one-time authentication code.",
      "Pause before posting. Get consent before sharing another person's private messages, intimate images, personal documents or identifying details. A post can be copied, captured or shared by others even if you later remove it.",
      "Be kind, be curious, and give people room to disagree respectfully. A healthy social space depends on the everyday choices of the people using it."
    ]
  }
];

const standardsSections = [
  {
    title: "1. Purpose and scope",
    paragraphs: [
      "These Standards and Policies describe the baseline expected of people who use HallsChat, including account holders, visitors, community participants and people who represent the service. They apply to profiles, posts, stories, comments, messages, calls, Halls, and other features offered by the app.",
      "These rules are a practical guide to responsible use, not a promise that every harmful act can be prevented or that every report will lead to a visible action. They operate alongside applicable law and any additional notices or terms shown for a particular feature."
    ]
  },
  {
    title: "2. Respect and personal safety",
    paragraphs: [
      "Treat other people with dignity. Do not threaten, harass, bully, stalk, blackmail, intimidate or repeatedly target someone. Disagreement, criticism and debate are allowed when they focus on ideas or conduct rather than becoming targeted abuse.",
      "Do not encourage real-world violence, celebrate harm against a person or group, or use HallsChat to organise intimidation. If there is an immediate threat to someone's safety, contact the appropriate local emergency service rather than relying on an in-app report alone."
    ]
  },
  {
    title: "3. Hate, exploitation and prohibited material",
    paragraphs: [
      "Do not post or distribute hateful attacks, dehumanising material or threats targeting people because of protected characteristics. Content that exploits, sexualises or endangers minors is prohibited. Non-consensual intimate imagery, sexual coercion, extortion and targeted sexual harassment are not acceptable.",
      "Do not use HallsChat to promote terrorism, recruit people into violent extremism, facilitate serious criminal conduct, distribute malicious software, or solicit illegal goods or services. Context matters, but humour or a claim that something is a joke does not excuse serious harm."
    ]
  },
  {
    title: "4. Honest identity and authentic participation",
    paragraphs: [
      "Do not impersonate another person, brand, public body, HallsChat team member or support agent in a way that deceives people. Do not use fake accounts, coordinated activity, fabricated engagement or misleading claims to manipulate conversations or community trust.",
      "Do not misrepresent a personal opinion as an official HallsChat announcement. If you promote a product, service, fundraiser or campaign, make material relationships and important conditions clear, and comply with applicable rules."
    ]
  },
  {
    title: "5. Spam, scams and financial deception",
    paragraphs: [
      "Do not send unsolicited bulk messages, flood rooms or Halls, repeatedly post the same material, abuse invitations, or use automation to disrupt normal participation. Promotions must not overwhelm a conversation or mislead people about what is being offered.",
      "Phishing, fake giveaways, romance scams, impersonated support, advance-fee schemes, fraudulent fundraising, credential theft and promises of guaranteed financial returns are prohibited. Never ask another user for their password, verification code, recovery phrase or remote access to their device. Verify unusual requests through a separate trusted channel."
    ]
  },
  {
    title: "6. Privacy and consent",
    paragraphs: [
      "Do not expose another person's home address, live location, phone number, private contact details, identity documents, financial information or private communications without an appropriate lawful basis and consent. Do not use public posts to organise doxxing or encourage others to target someone.",
      "Feed posts are public. Treat anything shared publicly as information that may be seen, copied, captured or redistributed by people you do not know. Before posting a photo, video, screenshot or conversation, consider who appears in it and whether you have permission to share it.",
      "Use the minimum personal information needed when reporting a problem. Redact passwords, verification codes, private keys, payment credentials and unrelated sensitive details from screenshots or evidence."
    ]
  },
  {
    title: "7. Account security and access",
    paragraphs: [
      "You are responsible for protecting your account, device, email access and authentication methods. Use a strong, unique password, keep recovery methods current, and sign out on devices you no longer control. Do not share account access or attempt to access another person's account, private messages or data without permission.",
      "Do not bypass access controls, exploit vulnerabilities, interfere with the service, scrape restricted information, distribute malware or deliberately disrupt availability. If you discover a security weakness, report it privately through the support route available in the app and avoid accessing or changing anyone else's data."
    ]
  },
  {
    title: "8. Content ownership and lawful use",
    paragraphs: [
      "Only share content you created, have permission to use, or are otherwise legally entitled to share. Respect copyright, trademarks, privacy, publicity rights and other people's creative work. Do not upload stolen material or use another person's image or identity to mislead or harm them.",
      "You remain responsible for the material you submit and for making sure it is suitable to share. Removing a post from HallsChat may not remove copies, screenshots or onward shares made by other people."
    ]
  },
  {
    title: "9. Messages, rooms and calls",
    paragraphs: [
      "Respect boundaries in direct conversations. Do not send threats, repeated unwanted contact, scams, unsolicited sexual material or abusive content. Do not record, publish or redistribute another person's private conversation or call without appropriate consent and regard for applicable law.",
      "A message, call or online indicator should not be treated as proof of someone's identity, intentions or availability. Do not share sensitive information with someone solely because their profile looks familiar. Call and message availability, delivery and quality can be affected by devices, permissions, networks and service interruptions."
    ]
  },
  {
    title: "10. Community Halls",
    paragraphs: [
      "Participate constructively, stay reasonably on topic and respect any additional rules set for a Hall. Do not flood a community, brigade members, manipulate polls or engagement, or use a Hall to coordinate harassment or unlawful activity.",
      "Community owners and moderators should apply local rules consistently and avoid using moderation powers to threaten, extort or expose members. Report serious abuse through the available app controls."
    ]
  },
  {
    title: "11. Reporting and moderation",
    paragraphs: [
      "If you see a suspected violation, use the reporting or support controls available in HallsChat. Where possible, include the relevant account, post or conversation reference, approximate time and a concise description. Keep evidence safely and remove unnecessary personal information.",
      "Reports may be assessed using context, severity, apparent intent, potential harm, available evidence, repeated behaviour and legal obligations. Depending on the situation, action may include a warning, content removal, limits on messaging or other features, account restrictions, suspension or closure, or referral to an appropriate authority where required or permitted.",
      "We may act quickly without advance notice when needed to protect people, accounts or the service. We may not be able to disclose confidential details about another person's account or every step taken in response to a report. Deliberately false or retaliatory reports can themselves be subject to action."
    ]
  },
  {
    title: "12. Appeals and mistakes",
    paragraphs: [
      "If a moderation decision appears incorrect, contact support through the route shown in the app and explain the decision, relevant context and any new evidence. An appeal does not automatically restore content or account access while a review is pending.",
      "Good-faith mistakes can happen. Correct misleading information, remove content you no longer have permission to share, and cooperate reasonably with requests intended to resolve a safety or security issue."
    ]
  },
  {
    title: "13. Data and privacy transparency",
    paragraphs: [
      "HallsChat uses information needed to operate accounts and features, deliver conversations, maintain security, provide support, prevent abuse and improve reliability. The information involved can vary by feature and the permissions you grant to your device or browser.",
      "Do not assume that a message is end-to-end encrypted, that deleted material disappears from every system or recipient device immediately, or that all information is visible only to the person you sent it to unless the app explicitly explains that protection. Review the privacy information made available by HallsChat and your device permission settings before sharing sensitive information.",
      "This page is a plain-language policy overview. It does not state a fixed data-retention period or replace any separate privacy notice or terms presented by the service."
    ]
  },
  {
    title: "14. Availability and changes",
    paragraphs: [
      "HallsChat may be updated, interrupted or changed because of maintenance, security work, network conditions, device limitations or third-party service availability. Features may differ between the website, PWA and Android app until each version is updated.",
      "We may revise these standards as the service develops, new risks emerge or legal requirements change. The latest version shown in the app should be treated as the current overview. Where a separate notice or agreement applies to a feature, read that notice as well."
    ]
  },
  {
    title: "15. Enforcement and limitations",
    paragraphs: [
      "HallsChat may take reasonable steps to protect members, content, accounts and service integrity. No social platform can guarantee that every user is genuine, every post is accurate, every harmful item is detected or every service interruption is avoided.",
      "You are responsible for your choices and for assessing the information, requests and content you encounter. Use available safety tools, verify unusual claims independently, and do not treat posts or messages as professional legal, medical or financial advice."
    ]
  },
  {
    title: "16. The standard we want to share",
    paragraphs: [
      "Be honest about who you are, respect consent, protect private information, make room for different views, and report serious concerns in good faith. Use the service in a lawful way and help make HallsChat a place where people can participate without fear of deception, harassment or unnecessary exposure.",
      "By using HallsChat, you are expected to follow these standards and any additional applicable terms or notices. If a rule or feature is unclear, pause before sharing sensitive content and ask through the available support channel."
    ]
  }
];

export default function AboutPage() {
  const [tab, setTab] = useState<AboutTab>("about");
  const sections = tab === "about" ? aboutSections : standardsSections;

  return (
    <main className="home-page social-home halls-about-page">
      <AppHeader homeHref="/home" />
      <section className="home-shell social-shell halls-about-shell">
        <div className="halls-about-tabs halls-list-tabs" role="tablist" aria-label="About and standards">
          <button type="button" role="tab" id="halls-about-tab" aria-controls="halls-about-panel" aria-selected={tab === "about"} className={tab === "about" ? "is-active" : ""} onClick={() => setTab("about")}>
            <BookOpen size={16} /> About
          </button>
          <button type="button" role="tab" id="halls-standards-tab" aria-controls="halls-about-panel" aria-selected={tab === "standards"} className={tab === "standards" ? "is-active" : ""} onClick={() => setTab("standards")}>
            <ShieldCheck size={16} /> Standards
          </button>
        </div>

        <section id="halls-about-panel" className="halls-about-panel" role="tabpanel" aria-labelledby={tab === "about" ? "halls-about-tab" : "halls-standards-tab"}>
          <div className="halls-about-sections">
            {sections.map((section, index) => (
              <article className="halls-about-section" key={section.title}>
                <div className="halls-about-section-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
                <div className="halls-about-section-copy">
                  <h2>{section.title}</h2>
                  {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
                </div>
              </article>
            ))}
          </div>

          <footer className="halls-about-footer">
            <CheckCircle2 size={17} />
            <p>{tab === "about"
              ? "Thanks for being part of HallsChat. Share thoughtfully, stay curious, and help make the community better for everyone."
              : "If you encounter abuse, a security concern or a policy issue, use the reporting or support options available in the app. For urgent danger, contact local emergency services."}</p>
          </footer>
        </section>
      </section>
      <NowBar />
    </main>
  );
}
