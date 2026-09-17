

import React from 'react';

const roles = [
  { title: 'Founder & Lead', desc: 'Platform & infrastructure' },
  { title: 'Support Engineer', desc: 'Customer onboarding' },
  { title: 'Developer', desc: 'Website & software requests' },
  { title: 'Operations', desc: 'Billing & accounts' },
];

const TeamArea = () => {
  return (
    <>
      <section className="team_area section-padding">
        <div className="container">
          <div className="row">
            {roles.map((r) => (
              <div className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s" data-wow-offset="0" key={r.title}>
                <div className="single_team text-center">
                  <i className="ti-user" style={{ fontSize: 40, display: 'block', margin: '0 auto 16px' }}></i>
                  <h4>{r.title}</h4>
                  <p>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default TeamArea;
