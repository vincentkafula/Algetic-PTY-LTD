

import Link from 'next/link';
import React from 'react';

const services = [
  { img: 'service1.png', title: 'Email', desc: 'A real @yourcompany address with full send and receive — check it in our own webmail, or set it up in Outlook, Apple Mail, or your phone.' },
  { img: 'service2.png', title: 'Voice', desc: 'A business phone number, answerable from anywhere. Pick a local number in the US, Canada, UK, South Africa, or Zambia — no landline required.' },
  { img: 'service3.png', title: 'Team Calling', desc: 'Register real softphones for your team on a real calling network — call each other directly, or dial out to any phone number.' },
  { img: 'service8.png', title: 'Call Centre', desc: 'IVR menus, call queues, and agents — built on top of your phone numbers, so incoming calls reach the right person automatically.' },
  { img: 'service9.png', title: 'Domains', desc: "Your business name, as a website address. Search, see the real price upfront, and register — with DNS management included once it's live." },
  { img: 'service10.png', title: 'Website & Software', desc: 'Need a website built, or custom software for your business? Submit a request and our team takes it from there.' },
  { img: 'service1.png', title: 'Internet Service', desc: "Need connectivity for your office? We'll help arrange internet service through a trusted provider." },
  { img: 'service2.png', title: 'IP Phones', desc: 'Physical desk phones and wireless headsets, shipped to your office and ready to work with your new phone numbers.' },
];

const ServiceArea = () => {
  return (
    <>
      <section className="service_area section-padding">
        <div className="container">
          <div className="row">
            {services.map((s, i) => (
              <div className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0" key={s.title}>
                <div className="single_service">
                  <img src={`assets/img/${s.img}`} className="img-fluid" alt={s.title} />
                  <h2>{s.title}</h2>
                  <p>{s.desc}</p>
                  <Link href="/login">Get started <i className="ti-arrow-top-right"></i></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default ServiceArea;
