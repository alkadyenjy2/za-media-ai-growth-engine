import { ArrowUpRight, Check, ChevronRight, Layers3, Menu, X, Zap } from "lucide-react";
import { useState } from "react";

const services = [
  { number: "01", title: "Lead Operations", body: "Turn every inquiry into a structured, trackable opportunity with clean intake, routing, and CRM ownership." },
  { number: "02", title: "AI Qualification", body: "Give your team an intelligent first layer that summarizes context, scores fit, and surfaces priority leads." },
  { number: "03", title: "Follow-up Systems", body: "Build timely follow-up sequences that keep good opportunities moving without adding operational headcount." },
  { number: "04", title: "Growth Intelligence", body: "Replace scattered updates with a clear operating view of pipeline, bottlenecks, and next actions." },
];

const proof = ["Identity-aware workflows", "Server-owned business logic", "Documented acceptance tests", "Clear production-readiness gates"];

export default function App() {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <nav className="nav shell">
        <a href="#top" className="brand"><span className="brand-mark">Z</span><span>ZA<span className="muted">/</span>MEDIA</span></a>
        <div className={open ? "nav-links open" : "nav-links"}>
          <a href="#services" onClick={() => setOpen(false)}>Services</a>
          <a href="#work" onClick={() => setOpen(false)}>Selected work</a>
          <a href="#process" onClick={() => setOpen(false)}>Process</a>
          <a href="#contact" className="nav-cta" onClick={() => setOpen(false)}>Start a conversation <ArrowUpRight size={15} /></a>
        </div>
        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
      </nav>

      <section id="top" className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse" /> AI growth systems for serious operators</div>
          <h1>Make growth feel <em>organized.</em></h1>
          <p className="hero-lead">ZA Media builds the systems behind better growth: capture, qualify, follow up, and learn from every opportunity.</p>
          <div className="hero-actions"><a className="button primary" href="#contact">Build your growth system <ArrowUpRight size={17} /></a><a className="text-link" href="#work">See the work <ChevronRight size={17} /></a></div>
        </div>
        <div className="hero-visual" aria-label="Growth system flow diagram">
          <div className="orb orb-one" /><div className="orb orb-two" />
          <div className="flow-card main-card"><div className="card-top"><span className="icon-box"><Zap size={17} /></span><span className="tiny-label">ZA GROWTH ENGINE</span><span className="live-dot">LIVE</span></div><div className="flow-title">One system.<br /><strong>Every signal connected.</strong></div><div className="flow-lines"><span>Capture</span><i /><span>Qualify</span><i /><span>Follow up</span><i /><span>Learn</span></div></div>
          <div className="float-tag tag-one">01 <strong>Signal in</strong></div><div className="float-tag tag-two">04 <strong>Insight out</strong></div>
        </div>
      </section>

      <section className="trust-strip"><div className="shell trust-inner"><span>BUILT FOR FOUNDERS WHO ARE DONE LOSING GOOD LEADS</span><span className="trust-rule" /><span className="trust-note">Practical systems. Measurable operations.</span></div></section>

      <section id="services" className="section shell"><div className="section-heading"><div><div className="eyebrow">What we build</div><h2>The layer between<br /><em>attention and revenue.</em></h2></div><p>Most businesses do not need more disconnected tools. They need the right operating system connecting the tools they already have.</p></div><div className="service-grid">{services.map((service) => <article className="service-card" key={service.number}><span className="service-number">{service.number}</span><h3>{service.title}</h3><p>{service.body}</p><ArrowUpRight className="service-arrow" size={21} /></article>)}</div></section>

      <section id="work" className="case-section"><div className="shell case-grid"><div className="case-meta"><div className="eyebrow">Flagship case study / 001</div><div className="case-logo"><span className="case-flower">✳</span> RIZKAHA</div><p className="case-kicker">A working product, made safer to scale.</p><a className="text-link" href="#contact">Discuss your system <ArrowUpRight size={17} /></a></div><div className="case-content"><div className="case-label">Rizkaha · Digital ecosystem for mothers</div><h2>From a functional MVP to a disciplined path toward production.</h2><p>We helped shape the next operating layer for Rizkaha: authenticated identity binding, owner-scoped Habits data, server-owned mutations, and an acceptance-test track designed to protect user trust.</p><div className="proof-grid">{proof.map((item) => <div key={item}><Check size={16} />{item}</div>)}</div><div className="case-footer"><span>STATUS</span><strong>MVP complete · Hardening in progress</strong><span className="case-line" /><span>ROLE</span><strong>AI operations & systems architecture</strong></div></div></div></section>

      <section id="process" className="section shell process-section"><div className="eyebrow">How we work</div><div className="process-head"><h2>Audit first.<br /><em>Build what matters.</em></h2><p>Every engagement follows a simple loop. We find the constraint, design the operating logic, build the system, then verify it with evidence.</p></div><div className="process-line">{["Audit", "Architect", "Build", "Verify", "Improve"].map((step, i) => <div className="process-step" key={step}><span>0{i + 1}</span><strong>{step}</strong><small>{["Find the real leak", "Map the right system", "Connect the moving parts", "Prove the critical paths", "Keep the engine useful"][i]}</small></div>)}</div></section>

      <section id="contact" className="cta-section"><div className="shell cta-inner"><div className="eyebrow">Have a growth system to fix?</div><h2>Let’s make your next<br /><em>good lead count.</em></h2><a className="button light" href="mailto:hello@zamedia.co">Start a conversation <ArrowUpRight size={17} /></a><div className="cta-caption">ZA Media / AI growth & operations</div></div></section>
      <footer className="footer shell"><span>© 2026 ZA Media</span><span>AI growth systems for modern service businesses</span><a href="mailto:hello@zamedia.co">hello@zamedia.co</a></footer>
    </main>
  );
}
