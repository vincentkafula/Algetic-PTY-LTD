
import Link from 'next/link';
import React from 'react';

const PriceAreaHomeOne = () => {
  return (
    <>
      <section className="plan_home_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <span>Pricing Plan</span>
            <h2>Our best pricing plan for <br />your solution</h2>
          </div>
          <div className="row">
            <div className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.1s" data-wow-offset="0">
              <div className="pricingTable">
                <div className="pricingTable-header">
                  <h3 className="title">Starter</h3>
                </div>
                <div className="pricing-icon">
                  <i className="ti-medall"></i>
                </div>
                <ul className="pricing-content">
                  <li>5 mailboxes</li>
                  <li>2 phone numbers</li>
                  <li>1 domain</li>
                  <li>Email support</li>
                </ul>
                <div className="price-value">
                  <span className="amount">$99</span>
                  <span className="duration">/mo</span>
                </div>
                <div>
                  <Link href="/login" className="btn_one">Get Started</Link>
                </div>
              </div>
            </div> 
            <div className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.1s" data-wow-offset="0">
              <div className="pricingTable">
                <div className="pricingTable-header">
                  <h3 className="title">Growing Business</h3>
                </div>
                <div className="pricing-icon">
                  <i className="ti-server"></i>
                </div>
                <ul className="pricing-content">
                  <li>25 mailboxes</li>
                  <li>10 phone numbers</li>
                  <li>Call centre included</li>
                  <li>5 domains</li>
                  <li>Priority support</li>
                </ul>
                <div className="price-value">
                  <span className="amount">$199</span>
                  <span className="duration">/mo</span>
                </div>
                <div>
                  <Link href="/login" className="btn_one">Get Started</Link>
                </div>
              </div>
            </div> 
            <div className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.1s" data-wow-offset="0">
              <div className="pricingTable">
                <div className="pricingTable-header">
                  <h3 className="title">Established Business</h3>
                </div>
                <div className="pricing-icon">
                  <i className="ti-cup"></i>
                </div>
                <ul className="pricing-content">
                  <li>Unlimited mailboxes</li>
                  <li>Unlimited numbers</li>
                  <li>Team calling</li>
                  <li>Unlimited domains</li>
                  <li>Dedicated support</li>
                </ul>
                <div className="price-value">
                  <span className="amount">$299</span>
                  <span className="duration">/mo</span>
                </div>
                <div>
                  <Link href="/login" className="btn_one">Get Started</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default PriceAreaHomeOne;