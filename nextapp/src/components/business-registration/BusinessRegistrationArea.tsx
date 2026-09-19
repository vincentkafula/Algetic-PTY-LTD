import Link from 'next/link';

// ---------------------------------------------------------------------------
// Dedicated landing page for Business Registration, structured after a
// design reference the user provided (a "Shelf Companies" mockup) but
// rebuilt with Altegic's own branding and real pricing, per direct
// confirmation - the mockup's pricing cards mixed unrelated services
// (website dev, email, phone) rather than actual registration pricing,
// so those were replaced with the real business-services pricing already
// researched and shown on the main Pricing page (see
// BusinessServicesPricing.tsx for the sourcing notes on these figures).
//
// No stock hero photo — deliberately avoided after the mismatched
// cybersecurity-photo problem found and fixed earlier in this project.
// Uses the same icon-badge/feature-showcase visual language already
// established across the rest of the site instead, which carries zero
// risk of a mismatched or low-quality image.
// ---------------------------------------------------------------------------

const includedItems = [
  { icon: 'ti-id-badge', title: 'CIPC Name Reservation', desc: 'Your chosen company name, reserved and confirmed available.' },
  { icon: 'ti-files', title: 'Registration Certificate', desc: 'Your official CIPC company registration, filed and issued.' },
  { icon: 'ti-receipt', title: 'SARS Tax Number', desc: 'Your company income tax number, registered with SARS.' },
  { icon: 'ti-clipboard', title: 'Share Certificates', desc: 'Official share certificates for your company\'s founding members.' },
];

const whyChooseUs = [
  { icon: 'ti-shield', title: '100% Compliant', desc: 'Registered correctly with CIPC and SARS, from the start.' },
  { icon: 'ti-bolt', title: 'Fast Process', desc: 'Most registrations complete within 3-5 working days.' },
  { icon: 'ti-lock', title: 'Secure & Confidential', desc: 'Your information is handled securely throughout.' },
  { icon: 'ti-world', title: 'Available Online', desc: 'Apply from anywhere — no office visit required.' },
];

const packages = [
  { icon: 'ti-briefcase', title: 'Business Registration', price: 'R1,499', unit: 'once-off', desc: 'CIPC name reservation, company registration, and SARS tax number.', featured: true },
  { icon: 'ti-write', title: 'Company Amendment', price: 'R499', unit: 'once-off', desc: 'Name, director, or registered address changes with CIPC.' },
  { icon: 'ti-receipt', title: 'Individual Tax Return', price: 'R499', unit: 'per return', desc: 'IRP5, medical aid, and retirement annuity declarations.' },
  { icon: 'ti-receipt', title: 'Business Tax Return', price: 'R999', unit: 'per return', desc: 'Company income tax and provisional tax filing.' },
];

export default function BusinessRegistrationArea() {
  return (
    <>
      {/* Hero */}
      <section className="home_bg" style={{ padding: '90px 0', height: 'auto' }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="row align-items-center">
            <div className="col-lg-7 col-sm-12 col-xs-12">
              <div className="hero-text">
                <span style={{ display: 'inline-block', color: '#18fef5', fontWeight: 600, letterSpacing: '0.03em', marginBottom: 10, fontSize: 14, textTransform: 'uppercase' }}>Business Registration</span>
                <h1>Register your business, done for you</h1>
                <p>
                  A fully registered company — name reservation, CIPC registration certificate,
                  and your SARS tax number — handled from start to finish, so you can focus on
                  actually running your business.
                </p>
              </div>
              <div className="home_btns" style={{ display: 'flex' }}>
                <a href="#packages" className="btn_one">View pricing</a>
                <Link href="/contact" className="btn_two">Get a quote</Link>
              </div>
            </div>
            <div className="col-lg-5 col-sm-12 col-xs-12">
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28 }}>
                <h4 style={{ color: '#fff', marginBottom: 18 }}>Why register with Altegic</h4>
                {whyChooseUs.map((item) => (
                  <div key={item.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                    <i className={item.icon} style={{ color: '#18fef5', fontSize: 20, marginTop: 3 }}></i>
                    <div>
                      <strong style={{ color: '#fff', display: 'block', fontSize: 15 }}>{item.title}</strong>
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's included strip */}
      <section className="service_area section-padding" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <div className="container">
          <div className="row">
            {includedItems.map((item) => (
              <div className="col-lg-3 col-sm-6 col-xs-12" key={item.title}>
                <div style={{ textAlign: 'center', padding: '0 10px' }}>
                  <div className="service-icon-badge" style={{ margin: '0 auto 14px' }}><i className={item.icon}></i></div>
                  <h4 style={{ fontSize: 16, marginBottom: 6 }}>{item.title}</h4>
                  <p style={{ fontSize: 13, color: '#5B6180' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing packages */}
      <section className="service_area section-padding" id="packages" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-title text-center" style={{ marginBottom: 40 }}>
            <span>Our Packages</span>
            <h2>Choose the right package</h2>
            <p style={{ maxWidth: 560, margin: '12px auto 0' }}>One-time and per-return pricing — no monthly commitment.</p>
          </div>
          <div className="row">
            {packages.map((item) => (
              <div className="col-lg-3 col-sm-6 col-xs-12" key={item.title}>
                <div
                  className="single_service"
                  style={{
                    textAlign: 'center',
                    border: item.featured ? '2px solid #0196E7' : undefined,
                    boxShadow: item.featured ? '0 20px 45px rgba(1, 150, 231, 0.18)' : undefined
                  }}
                >
                  {item.featured && (
                    <span style={{ display: 'inline-block', background: 'linear-gradient(to right, #0196E7, #4FD8D1)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: 14 }}>Most Popular</span>
                  )}
                  <div className="service-icon-badge" style={{ margin: '0 auto 16px' }}><i className={item.icon}></i></div>
                  <h4 style={{ fontSize: 17 }}>{item.title}</h4>
                  <div style={{ margin: '10px 0' }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: '#232C4D' }}>{item.price}</span>
                    <span style={{ fontSize: 13, color: '#5B6180', marginLeft: 4 }}>{item.unit}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#5B6180', marginBottom: 18 }}>{item.desc}</p>
                  <Link href="/contact" className="btn_one" style={{ width: '100%', textAlign: 'center', display: 'block' }}>Get started</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
