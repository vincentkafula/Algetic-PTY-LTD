import React from 'react';

const AboutAreaHomeOne = () => {
  return (
    <>
      <section className="ab_one section-padding">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0">
              <div className="feature-showcase">
                <div className="feature-showcase-item">
                  <div className="service-icon-badge"><i className="ti-email"></i></div>
                  <div><h4>Real mail infrastructure</h4><p>Not a home-grown server starting from zero reputation</p></div>
                </div>
                <div className="feature-showcase-item">
                  <div className="service-icon-badge"><i className="ti-mobile"></i></div>
                  <div><h4>Real telecom carrier</h4><p>Your number, on an actual network</p></div>
                </div>
                <div className="feature-showcase-item">
                  <div className="service-icon-badge"><i className="ti-lock"></i></div>
                  <div><h4>Isolated to your account</h4><p>Never visible to anyone else on the platform</p></div>
                </div>
              </div>
            </div> 
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.1s" data-wow-offset="0">
              <div className="ab_content">
                <span>Built on real infrastructure</span>
                <h2>Real infrastructure — not a startup's approximation of it.</h2>
              </div>
              <div className="abmv">
                <h4><img src="assets/img/check.png" alt="" /> Your inbox actually works</h4>
                <p>Your email runs on infrastructure that already delivers billions of messages a day — not a home-grown mail server still trying to earn a sender reputation. That's why it lands in the inbox, not spam.</p>
              </div>
              <div className="abmv">
                <h4><img src="assets/img/check.png" alt="" /> Your data stays yours</h4>
                <p>Your phone number connects through an actual telecom carrier, not an experiment — and everything you connect is isolated to your account alone, never visible to anyone else on the platform.</p>
              </div>
            </div> 
          </div> 
        </div> 
      </section>
    </>
  );
};

export default AboutAreaHomeOne;