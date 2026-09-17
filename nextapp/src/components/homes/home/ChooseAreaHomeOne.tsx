
import Link from 'next/link';
import React from 'react';

const ChooseAreaHomeOne = () => {
  return (
    <>
      <section className="why_area section-padding" 
      style={{ backgroundImage: `url(assets/img/bg/section-2.jpg)`, backgroundSize: "cover", backgroundPosition: "center center" }}>
        <div className="container">
          <div className="row">
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.1s" data-wow-offset="0">
              <div className="ab_content">
                <span>Ready when you are</span>
                <h2>Your business email and phone number, live by this afternoon.</h2>
                <p>No sales call, no contract to sign first. Create an account, add what you need, and you're set up — cancel anytime if it's not the right fit.</p>
              </div>
              <div className="row">
                <div className="skill_btn">
                  <Link href="/login" className="btn_one">Create an account <i className="ti-arrow-top-right"></i></Link>
                  <a href="#service" className="btn_two">See what's included <i className="ti-arrow-top-right"></i></a>
                </div>
              </div>
            </div>
            <div className="col-lg-6 col-sm-12 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0">
              <div className="feature-showcase">
                <div className="feature-showcase-item">
                  <div className="service-icon-badge"><i className="ti-email"></i></div>
                  <div><h4>Email</h4><p>sales@yourcompany.com</p></div>
                </div>
                <div className="feature-showcase-item">
                  <div className="service-icon-badge"><i className="ti-mobile"></i></div>
                  <div><h4>Voice</h4><p>A number that's really yours</p></div>
                </div>
                <div className="feature-showcase-item">
                  <div className="service-icon-badge"><i className="ti-world"></i></div>
                  <div><h4>Domains</h4><p>Your name, live on the web</p></div>
                </div>
              </div>
            </div> 
          </div>
        </div> 
      </section>
    </>
  );
};

export default ChooseAreaHomeOne;