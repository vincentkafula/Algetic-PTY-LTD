

import Link from 'next/link';
import React from 'react';

const tech_services = [
  { icon: 'ti-email', title: 'Email', desc: 'A real @yourcompany address with full send and receive — check it in our own webmail, or set it up in Outlook, Apple Mail, or your phone.' },
  { icon: 'ti-mobile', title: 'Voice', desc: 'A business phone number, answerable from anywhere. Pick a local number in the US, Canada, UK, South Africa, or Zambia — no landline required.' },
  { icon: 'ti-microphone-alt', title: 'Team Calling', desc: 'Register real softphones for your team on a real calling network — call each other directly, or dial out to any phone number.' },
  { icon: 'ti-headphone-alt', title: 'Call Centre', desc: 'IVR menus, call queues, and agents — built on top of your phone numbers, so incoming calls reach the right person automatically.' },
  { icon: 'ti-world', title: 'Domains', desc: "Your business name, as a website address. Search, see the real price upfront, and register — with DNS management included once it's live.", link: '/domains', linkLabel: 'Search domains' },
  { icon: 'ti-signal', title: 'Internet Service', desc: "Need connectivity for your office? We'll help arrange internet service through a trusted provider." },
  { icon: 'ti-tablet', title: 'IP Phones', desc: 'Physical desk phones and wireless headsets, shipped to your office and ready to work with your new phone numbers.' },
];

const business_services = [
  { icon: 'ti-briefcase', title: 'Business Registration', desc: 'Register your company with CIPC — name reservation, registration certificate, and your SARS income tax number, handled for you.', link: '/business-registration', linkLabel: 'Learn more' },
  { icon: 'ti-receipt', title: 'Tax Filing with SARS', desc: 'Individual and business tax returns filed with SARS — provisional tax, income tax, and general SARS compliance.' },
  { icon: 'ti-palette', title: 'Web Development', desc: 'A website built for your business, from a simple brochure site to something more custom — submit a request and our team takes it from there.' },
  { icon: 'ti-write', title: 'Company Amendment', desc: 'Update your company details with CIPC — name changes, director changes, registered address updates.' },
];

const ServiceArea = () => {
  return (
    <>
      <section className="service_area section-padding">
        <div className="container">
          <div className="section-title text-center" style={{ marginBottom: 40 }}>
            <span>Technology</span>
            <h2>Communications & online presence</h2>
          </div>
          <div className="row">
            {tech_services.map((s) => (
              <div className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0" key={s.title}>
                <div className="single_service">
                  <div className="service-icon-badge"><i className={s.icon}></i></div>
                  <h2>{s.title}</h2>
                  <p>{s.desc}</p>
                  <Link href={s.link || '/login'}>{s.linkLabel || 'Get started'} <i className="ti-arrow-top-right"></i></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="service_area section-padding" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-title text-center" style={{ marginBottom: 40 }}>
            <span>Business & Compliance</span>
            <h2>Registration, tax, and company admin</h2>
          </div>
          <div className="row">
            {business_services.map((s) => (
              <div className="col-lg-3 col-sm-6 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0" key={s.title}>
                <div className="single_service">
                  <div className="service-icon-badge"><i className={s.icon}></i></div>
                  <h2 style={{ fontSize: 18 }}>{s.title}</h2>
                  <p>{s.desc}</p>
                  <Link href={s.link || '/contact'}>{s.linkLabel || 'Get a quote'} <i className="ti-arrow-top-right"></i></Link>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center" style={{ marginTop: 30 }}>
            <Link href="/pricing" className="btn_one">See pricing for these services <i className="ti-arrow-top-right"></i></Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default ServiceArea;
