

import Link from 'next/link';
import React from 'react';

const AboutArea = () => {
  return (
    <>
      <section className="ab_one section-padding">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.1s" data-wow-offset="0">
              <div className="ab_content">
                <span>About Altegic</span>
                <h2>We built the business tools we couldn't find in one place.</h2>
                <p style={{ marginTop: 16, color: 'var(--muted, #6b7280)' }}>
                  Most small businesses end up with five different logins just to
                  communicate — one for email, one for phone, one for the domain, one
                  for the website. Altegic puts all of it behind a single account, so
                  setting up how your business runs takes an afternoon, not a month of
                  vendor calls and support tickets.
                </p>
              </div>
              <div className="abmv_list">
                <ul>
                  <li><img src="assets/img/check.png" alt="" /> One login for email, phone, domains, and more.</li>
                  <li><img src="assets/img/check.png" alt="" /> Real infrastructure underneath — not a home-grown experiment.</li>
                  <li><img src="assets/img/check.png" alt="" /> Transparent pricing shown before you ever pay.</li>
                  <li><img src="assets/img/check.png" alt="" /> Cancel anytime — no long contracts to get out of.</li>
                </ul>
              </div>
              <div className="skill_btn">
                <Link href="/service" className="btn_one">Explore our services <i className="ti-arrow-top-right"></i></Link>
                <Link href="/contact" className="btn_two">Contact us <i className="ti-arrow-top-right"></i></Link>
              </div>
            </div>
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0">
              <div className="ab_img ai_top">
                <p>Founded to give small businesses the same professional communication
                  tools that larger companies take for granted — without the enterprise
                  price tag or the drawn-out setup.</p>
                <img src="assets/img/about3.png" className="img-fluid" alt="image" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default AboutArea;
