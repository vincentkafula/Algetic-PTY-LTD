
import React from 'react';

const AoutUsAreaHomeOne = () => {
  return (
    <>
      <section className="ab_one section-padding">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0">
              <div className="feature-showcase">
                <div className="feature-showcase-item">
                  <div className="service-icon-badge"><i className="ti-comments"></i></div>
                  <div><h4>Every message, logged</h4><p>Nothing disappears into a shared system</p></div>
                </div>
                <div className="feature-showcase-item">
                  <div className="service-icon-badge"><i className="ti-reload"></i></div>
                  <div><h4>Reset in seconds</h4><p>The same way a real bank handles it</p></div>
                </div>
                <div className="feature-showcase-item">
                  <div className="service-icon-badge"><i className="ti-tag"></i></div>
                  <div><h4>Real prices, confirmed upfront</h4><p>Nothing charged without you seeing it first</p></div>
                </div>
              </div>
            </div> 
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.1s" data-wow-offset="0">
              <div className="ab_content">
                <span>Why it holds up</span>
                <h2>The boring stuff, done right, so you don't have to think about it.</h2>
              </div>
              <div className="abmv">
                <h4><img src="assets/img/check.png" alt="" /> Every message and call is on record</h4>
                <p>Sent, received, and logged against your account — nothing disappears into a shared system.</p>
              </div>
              <div className="abmv">
                <h4><img src="assets/img/check.png" alt="" /> Losing a password doesn't mean losing your business email</h4>
                <p>Every credential can be reset in seconds, the same way a real bank or a real email provider handles it.</p>
              </div>
              <div className="abmv">
                <h4><img src="assets/img/check.png" alt="" /> Registering a domain won't surprise-charge your card</h4>
                <p>You see the exact price and confirm before anything is charged — every time.</p>
              </div>
            </div> 
          </div> 
        </div> 
      </section>
    </>
  );
};

export default AoutUsAreaHomeOne;