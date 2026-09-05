'use client'

import Link from 'next/link';
import Slider from 'react-slick';

const slider_settings = {
  dots: true,
  arrows: false,
  infinite: true,
  speed: 700,
  slidesToShow: 1,
  slidesToScroll: 1,
  autoplay: true,
  autoplaySpeed: 4500,
  pauseOnHover: true,
  fade: true,
};

const slides = [
  {
    tag: 'One account, everything included',
    title: 'Business email, phone, and a website — set up today, not next quarter',
    text: "Most small businesses juggle five different logins to get online — one for email, one for phone, one for their domain, one for a developer. Altegic puts all of it behind one login.",
  },
  {
    tag: 'Email',
    title: "A real inbox with your business name on it",
    text: "sales@yourcompany.com — send and receive mail, check it in our webmail or set it up in Outlook or on your phone. No spam-folder problems from an unknown new provider.",
  },
  {
    tag: 'Voice',
    title: 'A business number, answerable from anywhere',
    text: 'Pick a local number in the US, Canada, UK, South Africa, or Zambia. No landline, no hardware to install — just a real number that works on day one.',
  },
  {
    tag: 'Domains',
    title: 'Your business name, live on the web',
    text: "Search, see the real price upfront, and register — with DNS management included the moment it's yours.",
  },
  {
    tag: 'Team Calling & Call Centre',
    title: 'A real phone system for a growing team',
    text: 'Softphones for every team member, IVR menus, and call queues — all built on the same account, no separate vendor to manage.',
  },
];

const HeroAreaHomeOne = () => {
  return (
    <>
      <section className="home_bg hb_height hero-slider-wrap"
        style={{ backgroundImage: `url(/assets/img/bg/home-bg.jpg)`, backgroundSize: "cover", backgroundPosition: "center center" }}>
        <div className="container">
          <Slider {...slider_settings}>
            {slides.map((slide, i) => (
              <div key={i}>
                <div className="row align-items-center">
                  <div className="col-lg-7 col-sm-12 col-xs-12">
                    <div className="hero-text ht_top">
                      <span style={{ display: 'inline-block', color: '#18fef5', fontWeight: 600, letterSpacing: '0.03em', marginBottom: 10, fontSize: 14, textTransform: 'uppercase' }}>{slide.tag}</span>
                      <h1>{slide.title}</h1>
                      <p>{slide.text}</p>
                    </div>
                    <div className="home_btns" style={{ display: 'flex' }}>
                      <Link href="/login" className="btn_one">Create an account</Link>
                      <a href="#service" className="video-play"><i className="ti-arrow-right"></i> <span className="video-title">See what's included</span></a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </section>
    </>
  );
};

export default HeroAreaHomeOne;
