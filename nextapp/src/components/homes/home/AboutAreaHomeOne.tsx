import React from 'react';

const AboutAreaHomeOne = () => {
  return (
    <>
      <section className="ab_one section-padding">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0">
              <div className="ab_img">
                <img src="assets/img/about1.png" className="img-fluid" alt="image" />
              </div>
            </div> 
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.1s" data-wow-offset="0">
              <div className="ab_content">
                <span>Built on real infrastructure</span>
                <h2>Real infrastructure — not a startup's approximation of it.</h2>
              </div>
              <div className="abmv">
                <h4><img src="assets/img/check.png" alt="" /> Your inbox actually works</h4>
                <p>Your email doesn't route through a home-grown mail server — it runs on infrastructure that already delivers billions of emails a day, so it doesn't land in spam because a new provider hasn't earned a reputation yet.</p>
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