
'use client'

import Link from 'next/link';
import Slider from 'react-slick';



// slider setting 
const slider_setting = {
  speed: 4000,
  autoplay: true,
  autoplaySpeed: 0,
  cssEase: "linear",
  slidesToShow: 1,
  slidesToScroll: 1,
  variableWidth: true,
  infinite: true,
  initialSlide: 1,
  arrows: false,
  buttons: false,
  pauseOnFocus: false,
  pauseOnHover: true,
};

const slider_data = [
  "*Email*",
  "*Voice*",
  "*Team Calling*",
  "*Call Centre*",
  "*Domains*",
  "*Website & Software*",
  "*Internet Service*",
  "*IP Phones*",
  "*Email*",
  "*Voice*",
  "*Team Calling*",
  "*Call Centre*",
  "*Domains*",
  "*Website & Software*",
  "*Internet Service*",
  "*IP Phones*",

]
 
const ServiceAreaHomeOne = () => {


  return (
    <>
      <section className="service_area section-padding" id="service">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 col-sm-6 col-xs-12">
              <div className="section-title">
                <span>Our services</span>
                <h2>Everything your business needs <br />to communicate, professionally</h2>
              </div>
            </div>
            <div className="col-lg-6 col-sm-6 col-xs-12">
              <div className="ser_btn">
                <Link href="/service" className="btn_two">View all 8 services <i className="ti-arrow-top-right"></i></Link>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0">
              <div className="single_service">
                <img src="assets/img/service1.png" className="img-fluid" alt="image" />
                <h2>Email</h2>
                <p>A real @yourcompany address with full send and receive — check it in our own webmail, or set it up in Outlook, Apple Mail, or your phone.</p>
                <Link href="/service">Read More <i className="ti-arrow-top-right"></i></Link>
              </div>
            </div>
            <div className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0">
              <div className="single_service">
                <img src="assets/img/service2.png" className="img-fluid" alt="image" />
                <h2>Voice</h2>
                <p>A business phone number, answerable from anywhere. Pick a local number in the US, Canada, UK, South Africa, or Zambia — no landline required.</p>
                <Link href="/service">Read More <i className="ti-arrow-top-right"></i></Link>
              </div>
            </div>
            <div className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0">
              <div className="single_service">
                <img src="assets/img/service3.png" className="img-fluid" alt="image" />
                <h2>Domains</h2>
                <p>Your business name, as a website address. Search, see the real price upfront, and register — with DNS management included once it's live.</p>
                <Link href="/service">Read More <i className="ti-arrow-top-right"></i></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="marq_text">
        <div id="supermarquee1">

          <Slider
            {...slider_setting}
            className="swiper-container tp-text-slider-4-active"
          >
            {slider_data.map((item, i) => (
              <div key={i}
                className="me-4">
                 {item} 
              </div>
            ))}
          </Slider>


        </div>
      </div>

    </>
  );
};

export default ServiceAreaHomeOne;