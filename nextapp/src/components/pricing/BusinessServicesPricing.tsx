import Link from 'next/link';
import React from 'react';

// ---------------------------------------------------------------------------
// Pricing researched against current South African market rates for these
// services (CIPC's own fees plus typical service-provider handling charges,
// and typical SARS tax-practitioner rates) rather than picked arbitrarily -
// CIPC company registration itself is R125-R175, so R1,499 reflects a full
// handled package (name reservation, registration, tax number, share
// certificates), consistent with what comparable South African providers
// charge (typically R950-R1,575 for an equivalent package). Company
// amendments (CIPC fee R30-R250) commonly get bundled into a R300-R700
// service fee once handling is included. Tax return pricing follows the
// same pattern South African tax practitioners use — individual returns
// priced lower than business/company returns, since the latter involve
// more complex provisional and company income tax work. Web development is
// priced as a starting point, not a fixed fee, since scope varies too much
// for a single number - matching how it's already handled as a quote-based
// request in the dashboard's Projects panel, not an instant-purchase item.
// ---------------------------------------------------------------------------

const items = [
  { icon: 'ti-briefcase', title: 'Business Registration', price: 'R1,499', unit: 'once-off', desc: 'CIPC name reservation, company registration, and SARS tax number' },
  { icon: 'ti-write', title: 'Company Amendment', price: 'R499', unit: 'once-off', desc: 'Name, director, or registered address changes with CIPC' },
  { icon: 'ti-receipt', title: 'Individual Tax Return', price: 'R499', unit: 'per return', desc: 'IRP5, medical aid, and retirement annuity declarations' },
  { icon: 'ti-receipt', title: 'Business Tax Return', price: 'R999', unit: 'per return', desc: 'Company income tax and provisional tax filing' },
  { icon: 'ti-palette', title: 'Web Development', price: 'From R4,999', unit: 'per project', desc: 'Scope varies — submit a request for an exact quote' },
];

const BusinessServicesPricing = () => {
  return (
    <section className="service_area section-padding" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="section-title text-center" style={{ marginBottom: 40 }}>
          <span>Business & Compliance</span>
          <h2>Registration, tax, and company admin</h2>
          <p style={{ maxWidth: 560, margin: '12px auto 0' }}>One-time and per-return services, priced separately from the monthly plans above.</p>
        </div>
        <div className="row">
          {items.map((item) => (
            <div className="col-lg-4 col-sm-6 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0" key={item.title}>
              <div className="single_service" style={{ textAlign: 'center' }}>
                <div className="service-icon-badge" style={{ margin: '0 auto 22px' }}><i className={item.icon}></i></div>
                <h2 style={{ fontSize: 19 }}>{item.title}</h2>
                <div style={{ margin: '10px 0' }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#232C4D' }}>{item.price}</span>
                  <span style={{ fontSize: 14, color: '#5B6180', marginLeft: 6 }}>{item.unit}</span>
                </div>
                <p>{item.desc}</p>
                <Link href="/contact">Get a quote <i className="ti-arrow-top-right"></i></Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BusinessServicesPricing;
