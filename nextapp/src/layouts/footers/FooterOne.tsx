

import Link from 'next/link';
import React from 'react';

const FooterOne = () => {
  return (
    <>
      <div className="footer section-padding"
        style={{ backgroundImage: `url(assets/img/bg/section-2.jpg)`, backgroundSize: "cover", backgroundPosition: "center center" }}>
        <div className="container">
          <div className="row">
            <div className="col-lg-3 col-sm-6 col-xs-12">
              <div className="single_footer">
                <Link href="/"><img src="/assets/img/logo-full.png" alt="Altegic Solutions" style={{ height: 40, width: 'auto' }} /></Link>
                <p>Altegic helps small businesses set up business email, phone, domains, and more — all from one account, without the vendor sprawl.</p>
                <div className="social_profile">
                  <ul>
                    <li><a href="#" className="f_facebook"><i className="ti-facebook" title="Facebook"></i></a></li>
                    <li><a href="#" className="f_twitter"><i className="ti-twitter" title="Twitter"></i></a></li>
                    <li><a href="#" className="f_instagram"><i className="ti-instagram" title="Instagram"></i></a></li>
                    <li><a href="#" className="f_linkedin"><i className="ti-linkedin" title="LinkedIn"></i></a></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-sm-6 col-xs-12">
              <div className="single_footer">
                <h4>About Altegic</h4>
                <ul>
                  <li><a href="/#about">About</a></li>
                  <li><a href="/#pricing">Pricing</a></li>
                  <li><a href="/#team">Team</a></li>
                  <li><a href="/#coverage">Coverage</a></li>
                  <li><a href="/contact">Contact us</a></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3 col-sm-6 col-xs-12">
              <div className="single_footer">
                <h4>Our services</h4>
                <ul>
                  <li><a href="/#service">Email</a></li>
                  <li><a href="/#service">Voice</a></li>
                  <li><a href="/#service">Team Calling</a></li>
                  <li><a href="/#service">Call Centre</a></li>
                  <li><a href="/#service">Domains</a></li>
                  <li><a href="/service">View all services</a></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3 col-sm-6 col-xs-12">
              <div className="single_footer">
                <h4>Account</h4>
                <ul>
                  <li><Link href="/login">Log in</Link></li>
                  <li><Link href="/login">Create an account</Link></li>
                  <li><Link href="/webmail-login">Webmail</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="row fc">
            <div className="col-lg-6 col-sm-6 col-xs-12">
              <div className="footer_copyright">
                <p>&copy; {new Date().getFullYear()} Altegic. All Rights Reserved.</p>
              </div>
            </div>
            <div className="col-lg-6 col-sm-6 col-xs-12">
              <div className="footer_menu">
                <ul>
                  <li><a href="#">Terms of use</a></li>
                  <li><a href="#">Privacy Policy</a></li>
                  <li><a href="#">Cookie Policy</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FooterOne;
