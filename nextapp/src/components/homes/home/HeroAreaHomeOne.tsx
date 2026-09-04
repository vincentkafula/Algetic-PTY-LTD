
'use client'

import Link from 'next/link';

const HeroAreaHomeOne = () => {

  return (
    <>
      <section className="home_bg hb_height"
        style={{ backgroundImage: `url(/assets/img/bg/home-bg.jpg)`, backgroundSize: "cover", backgroundPosition: "center center" }}>
        <div className="container">
          <div className="row">
            <div className="col-lg-7 col-sm-12 col-xs-12">
              <div className="hero-text ht_top">
                <h1>Business email, phone, and a website — set up today, not next quarter</h1>
                <p>Most small businesses juggle five different logins to get online — one for email, one for phone, one for their domain, one for a developer. Altegic puts all of it behind one login, so setting up how your business communicates takes an afternoon, not a month of vendor calls.</p>
              </div>
              <div className="home_btns" style={{display: 'flex'}}>
                <Link href="/login" className="btn_one">Create an account</Link>
                <a href="#service" className="video-play"><i className="ti-arrow-right"></i> <span className="video-title">See what's included</span></a>
              </div>
            </div>
          </div>
        </div>
      </section>


    </>
  );
};

export default HeroAreaHomeOne;