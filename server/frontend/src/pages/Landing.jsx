import { Link } from 'react-router-dom';
import '../styles/landing.css';

const CHECK_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" className="icon" strokeWidth="2.4"><path d="M4 12l5 5L20 6" /></svg>
);

const services = [
  {
    id: 'svc-email',
    icon: <svg className="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>,
    title: 'Email',
    desc: "A business inbox that looks like a business, not a Gmail account. Get a real @yourcompany address with full send and receive — check it in our own webmail, or set it up in Outlook, Apple Mail, or your phone.",
    status: 'Send & receive live'
  },
  {
    id: 'svc-voice',
    icon: <svg className="icon" viewBox="0 0 24 24"><path d="M4 4h4l2 5-2.5 1.5a12 12 0 006 6L15 14l5 2v4a2 2 0 01-2.2 2A18 18 0 013 6.2 2 2 0 015 4z" /></svg>,
    title: 'Voice',
    desc: 'A business phone number, answerable from anywhere. Pick a local number in the US, Canada, UK, South Africa, or Zambia, and take calls on any phone or softphone — no landline required.',
    status: '5 countries live'
  },
  {
    id: 'svc-callcentre',
    icon: <svg className="icon" viewBox="0 0 24 24"><path d="M4 13a8 8 0 0116 0v5a2 2 0 01-2 2h-1v-7h3M4 18h1v-7H2" /><path d="M9 20a2 2 0 004 0" /></svg>,
    title: 'Call Centre',
    desc: '"Press 1 for sales" — without hiring an IT team to build it. Set up a menu, route callers to the right department, and have calls ring your team\'s real phones.',
    status: 'Built on Voice'
  },
  {
    id: 'svc-network',
    icon: <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.2" /><circle cx="5" cy="17" r="2.2" /><circle cx="19" cy="17" r="2.2" /><path d="M12 7.2V13M12 13L6.5 15.5M12 13l5.5 2.5" /></svg>,
    title: 'Private Network',
    desc: 'Free calling between your own team, anywhere. If your team already has IP phones or softphones, connect them directly — no per-minute charges for calls that never leave your company.',
    status: 'Deploy-your-own'
  },
  {
    id: 'svc-domains',
    icon: <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18" /></svg>,
    title: 'Domains',
    desc: "Your business name, as a website address. Search, see the real price upfront, and register — with DNS management included once it's live.",
    status: 'Search & register live'
  },
  {
    id: 'svc-development',
    icon: <svg className="icon" viewBox="0 0 24 24"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12" /></svg>,
    title: 'Development',
    desc: "Need a website or a piece of custom software? Tell us what, we'll build it. Submit your request and track it from Requested through Delivered — real people, not a chatbot guessing at your needs.",
    status: 'Request tracker live'
  },
  {
    id: 'svc-internet',
    icon: <svg className="icon" viewBox="0 0 24 24"><path d="M12 20a2 2 0 100-4 2 2 0 000 4z" /><path d="M8.5 14.5a5 5 0 017 0M5.5 11.5a9 9 0 0113 0M2.5 8.5a13 13 0 0119 0" /></svg>,
    title: 'Internet Service',
    desc: 'Need connectivity at your business address? Tell us the address and your preferred provider — Rain, fibre, or fixed wireless — and we\'ll get it sorted with a real ISP partner.',
    status: 'Request tracker live'
  }
];

const whyPoints = [
  { strong: "You always know who's texting your customers", text: 'Every message and call is logged against your account — nothing disappears into a shared system.' },
  { strong: "Losing a password doesn't mean losing your business email", text: 'Every credential can be reset in seconds, the same way a real bank or a real email provider handles it.' },
  { strong: "Registering a domain won't surprise-charge your card", text: 'You see the exact price and confirm before anything is charged — every time.' }
];

const countries = [
  { flag: '🇺🇸', name: 'United States' },
  { flag: '🇨🇦', name: 'Canada' },
  { flag: '🇬🇧', name: 'United Kingdom' },
  { flag: '🇿🇦', name: 'South Africa' },
  { flag: '🇿🇲', name: 'Zambia' },
  { flag: '🇨🇳', name: 'China', note: 'Requires local licensing, not yet available.' }
];

const pricingTiers = [
  { tier: 'Starter', price: 99, features: ['5 mailboxes', '2 phone numbers', '1 domain', 'Email support'] },
  { tier: 'Growing Business', price: 199, featured: true, features: ['25 mailboxes', '10 phone numbers', 'Call centre included', '5 domains', 'Priority support'] },
  { tier: 'Established Business', price: 299, features: ['Unlimited mailboxes', 'Unlimited numbers', 'Private SIP network', 'Unlimited domains', 'Dedicated support'] }
];

const team = [
  { role: 'Founder & Lead', desc: 'Platform & infrastructure' },
  { role: 'Support Engineer', desc: 'Customer onboarding' },
  { role: 'Developer', desc: 'Website & software requests' },
  { role: 'Operations', desc: 'Billing & accounts' }
];

const footerServices = services.map((s) => ({ id: s.id, title: s.title, icon: s.icon }));

export default function Landing() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <div className="brand">
            <img src="/logo-full.png" alt="Altegic Solutions" style={{ height: 52, width: 'auto' }} />
          </div>
          <nav className="links">
            <a href="#home">HOME</a>
            <a href="#about">ABOUT</a>
            <a href="#services">SERVICES</a>
            <a href="#pricing">PRICING</a>
            <a href="#team">TEAM</a>
          </nav>
          <div className="nav-actions">
            <Link to="/login" className="btn btn-outline">Log in</Link>
            <Link to="/login" className="btn btn-grad">Create an account</Link>
          </div>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow-label"><span className="bar"></span> EMAIL · PHONE · DOMAINS · WEBSITE</div>
            <h1 className="hero-title">Business email, phone, and a website<br />— set up <em>today</em>, not next quarter</h1>
            <p className="lede">Most small businesses juggle five different logins to get online — one for email, one for phone, one for their domain, one for a developer. Altegic puts all of it behind one login, so setting up how your business communicates takes an afternoon, not a month of vendor calls.</p>
            <div className="hero-cta">
              <Link to="/login" className="btn btn-grad btn-lg">
                Create an account
                <svg width="16" height="16" viewBox="0 0 24 24" className="icon" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <a href="#services" className="btn btn-outline btn-lg">See what's included</a>
            </div>
          </div>

          <div className="radar-wrap">
            <div className="radar">
              <div className="radar-ring r1"></div><div className="radar-ring r2"></div><div className="radar-ring r3"></div><div className="radar-ring r4"></div>
              <div className="radar-crosshair"></div>
              <div className="radar-sweep"></div>
              <div className="radar-core"></div>
              <div className="blip" style={{ top: '26%', left: '64%', animationDelay: '.2s' }}></div>
              <div className="blip-label" style={{ top: '21%', left: '67%', animationDelay: '.2s' }}>MAIL_OK</div>
              <div className="blip" style={{ top: '66%', left: '28%', animationDelay: '1.4s' }}></div>
              <div className="blip-label" style={{ top: '69%', left: '31%', animationDelay: '1.4s' }}>SIP_OK</div>
              <div className="blip" style={{ top: '42%', left: '16%', animationDelay: '2.4s' }}></div>
              <div className="blip-label" style={{ top: '37%', left: '10%', animationDelay: '2.4s' }}>DNS_OK</div>
            </div>
          </div>
        </div>

        <div className="wrap">
          <div className="stat-strip">
            <div className="stat-cell hud"><div className="stat-num">7</div><div className="stat-lbl">Things your business needs, one login</div></div>
            <div className="stat-cell hud"><div className="stat-num">5</div><div className="stat-lbl">Countries for a business number</div></div>
            <div className="stat-cell hud"><div className="stat-num">24/7</div><div className="stat-lbl">Monitored and kept online</div></div>
            <div className="stat-cell hud"><div className="stat-num">Minutes</div><div className="stat-lbl">From signup to your first mailbox</div></div>
          </div>
        </div>
      </section>

      <section className="section" id="about">
        <div className="wrap about-grid">
          <div className="about-art">
            <svg className="icon-lg" viewBox="0 0 24 24"><path d="M12 2.5l7.5 3.2v5.1c0 4.6-3.2 8.4-7.5 9.7-4.3-1.3-7.5-5.1-7.5-9.7V5.7L12 2.5z" /><circle cx="12" cy="11" r="2.6" /><path d="M12 13.6v3" /></svg>
          </div>
          <div>
            <div className="eyebrow-label"><span className="bar"></span> BUILT ON REAL INFRASTRUCTURE</div>
            <h2 className="h2">Real infrastructure — not a startup's approximation of it.</h2>
            <div className="check-card">
              <div className="check-ic"><svg className="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg></div>
              <div className="check-body"><h4>Your inbox actually works</h4><p>Your email doesn't route through a home-grown mail server — it runs on infrastructure that already delivers billions of emails a day, so it doesn't land in spam because a new provider hasn't earned a reputation yet.</p></div>
            </div>
            <div className="check-card">
              <div className="check-ic"><svg className="icon" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg></div>
              <div className="check-body"><h4>Your data stays yours</h4><p>Your phone number connects through an actual telecom carrier, not an experiment — and everything you connect is isolated to your account alone, never visible to anyone else on the platform.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="wrap">
          <div className="section-head-row">
            <div>
              <div className="eyebrow-label"><span className="bar"></span> THE SEVEN SERVICES</div>
              <h2 className="h2">Everything your business needs<br />to communicate, professionally</h2>
            </div>
          </div>
          <div className="grid-3">
            {services.map((s) => (
              <div className="svc-card hud" id={s.id} key={s.id}>
                <div className="svc-ic">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <span className="svc-status"><span className="dot"></span> {s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap why-grid">
          <div>
            <div className="eyebrow-label"><span className="bar"></span> WHY IT HOLDS UP</div>
            <h2 className="h2">The boring stuff, done right, so you don't have to think about it.</h2>
            <div className="why-list">
              {whyPoints.map((w) => (
                <div className="why-row" key={w.strong}>
                  {CHECK_ICON}
                  <div><strong>{w.strong}</strong><span>{w.text}</span></div>
                </div>
              ))}
            </div>
            <Link to="/login" className="btn btn-grad btn-lg">
              Get started
              <svg width="16" height="16" viewBox="0 0 24 24" className="icon" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </div>
          <div className="why-art">
            <svg className="icon-lg" viewBox="0 0 24 24" style={{ width: 96, height: 96 }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
          </div>
        </div>
      </section>

      <section className="coverage" id="coverage">
        <div className="wrap coverage-row">
          <div className="coverage-lead">
            <div className="ic"><svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18" /></svg></div>
            <div><strong>Coverage</strong><p>Number availability depends on local carrier and regulatory relationships in each market.</p></div>
          </div>
          <div className="coverage-flags">
            {countries.map((c) => (
              <div className="flag-item" key={c.name}>
                <span className="flag">{c.flag}</span>
                <div><strong>{c.name}</strong>{c.note && <span className="note">{c.note}</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="wrap">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="eyebrow-label" style={{ justifyContent: 'center' }}><span className="bar"></span> PRICING PLAN</div>
            <h2 className="h2">Our best pricing plan for your solution</h2>
          </div>
          <div className="grid-pricing">
            {pricingTiers.map((p) => (
              <div className={`price-card hud ${p.featured ? 'featured' : ''}`} key={p.tier}>
                {p.featured && <div className="price-featured-tag">MOST POPULAR</div>}
                <div className="price-tier">{p.tier}</div>
                <div className="price-num">${p.price}<span>/mo</span></div>
                <ul className="price-feat">
                  {p.features.map((f) => (
                    <li key={f}>{CHECK_ICON} {f}</li>
                  ))}
                </ul>
                <Link to="/login" className="buy-btn">GET STARTED</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="team">
        <div className="wrap">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="eyebrow-label" style={{ justifyContent: 'center' }}><span className="bar"></span> OUR TEAM MEMBERS</div>
            <h2 className="h2">Experts behind your solution</h2>
            <p style={{ color: 'var(--text-lo)', maxWidth: 440, margin: '0 auto', fontSize: 14 }}>
              A bench of engineers and support staff — the same people you'll actually talk to when it matters.
            </p>
          </div>
          <div className="team-grid">
            {team.map((t) => (
              <div className="team-card hud" key={t.role}>
                <div className="team-photo"><svg viewBox="0 0 24 24" className="icon"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3.1-6.2 7-6.2s7 2.2 7 6.2" /></svg></div>
                <div className="team-meta"><strong>{t.role}</strong><span>{t.desc}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta-box">
            <div className="eyebrow-label" style={{ justifyContent: 'center' }}><span className="bar"></span> READY WHEN YOU ARE</div>
            <h2 className="h2">Your business email and phone number, live by this afternoon.</h2>
            <p>No sales call, no contract to sign first. Create an account, add what you need, and you're set up — cancel anytime if it's not the right fit.</p>
            <Link to="/login" className="btn btn-grad btn-lg">
              Create an account
              <svg width="16" height="16" viewBox="0 0 24 24" className="icon" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot-grid">
          <div className="foot-about">
            <div className="brand">
              <img src="/logo-icon.png" alt="Altegic" style={{ height: 20, width: 'auto' }} />
              Altegic
            </div>
            <p className="foot-tagline">Powering Communication, Simplifying Business.</p>
            <p>Business email, phone, domains, and website help — everything your business needs to communicate, in one account.</p>
            <div className="foot-follow">
              <span className="lbl">Follow Us</span>
              <div className="foot-social">
                <a href="#" aria-label="LinkedIn"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 11-.02 5.001A2.5 2.5 0 014.98 3.5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.77V21h-4v-5.7c0-1.36-.02-3.1-1.9-3.1-1.9 0-2.2 1.47-2.2 3v5.8H9z"/></svg></a>
                <a href="#" aria-label="YouTube"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12s0-3.2-.4-4.7c-.24-.87-.93-1.55-1.8-1.79C18.2 5 12 5 12 5s-6.2 0-7.8.5c-.87.24-1.56.92-1.8 1.8C2 9.8 2 12 2 12s0 3.2.4 4.7c.24.87.93 1.55 1.8 1.79C5.8 19 12 19 12 19s6.2 0 7.8-.5c.87-.24 1.56-.92 1.8-1.8.4-1.5.4-4.7.4-4.7zM10 15.5v-7l6 3.5z"/></svg></a>
                <a href="#" aria-label="X"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23.3 22H16.6l-5.2-6.8L5.4 22H2.3l8.1-9.3L1.4 2h6.9l4.7 6.2zm-1.2 18h1.7L7.4 4h-1.8z"/></svg></a>
                <a href="#" aria-label="Facebook"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H17V3.7C16.7 3.65 15.7 3.5 14.5 3.5c-2.4 0-4 1.47-4 4.15V10H7.8v3.1h2.7v8z"/></svg></a>
                <a href="#" aria-label="Instagram"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg></a>
              </div>
            </div>
          </div>
          <div>
            <h5>About Altegic</h5>
            <hr className="foot-heading-rule" />
            <ul>
              <li><FootLink href="#about">About</FootLink></li>
              <li><FootLink href="#pricing">Pricing</FootLink></li>
              <li><FootLink href="#team">Team</FootLink></li>
              <li><FootLink href="#coverage">Coverage</FootLink></li>
            </ul>
          </div>
          <div>
            <h5>Services</h5>
            <hr className="foot-heading-rule" />
            <ul>
              {footerServices.map((s) => (
                <li key={s.id}><FootLink href={`#${s.id}`}>{s.title}</FootLink></li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Account</h5>
            <hr className="foot-heading-rule" />
            <ul>
              <li><FootLinkTo to="/login">Log in</FootLinkTo></li>
              <li><FootLinkTo to="/login">Create an account</FootLinkTo></li>
              <li><FootLinkTo to="/webmail-login">Webmail</FootLinkTo></li>
            </ul>
          </div>
        </div>

        <div className="wrap foot-trust">
          <div className="foot-trust-item">
            <div className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>
            <div className="txt"><strong>24/7</strong>Monitored and kept online</div>
          </div>
          <div className="foot-trust-item">
            <div className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18"/></svg></div>
            <div className="txt"><strong>5 Countries</strong>For a business number</div>
          </div>
          <div className="foot-trust-item">
            <div className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div>
            <div className="txt"><strong>Real infrastructure</strong>Not a startup's approximation</div>
          </div>
        </div>

        <div className="wrap foot-bottom">
          <div>© 2026 Altegic. All rights reserved.</div>
          <div className="legal">
            <a href="#">Privacy Policy</a>
            <span>|</span>
            <a href="#">Terms of Use</a>
            <span>|</span>
            <a href="#">Cookie Settings</a>
          </div>
        </div>
      </footer>
    </>
  );
}

function FootLink({ href, children }) {
  return (
    <a href={href}>
      {children}
      <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
    </a>
  );
}

function FootLinkTo({ to, children }) {
  return (
    <Link to={to}>
      {children}
      <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
    </Link>
  );
}
