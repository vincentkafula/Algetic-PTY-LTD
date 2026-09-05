

import HeaderOne from '@/layouts/headers/HeaderOne';
import React from 'react';
import Breadcrumb from '../common/Breadcrumb';
import AboutArea from './AboutArea';
import CounterAreaHomeOne from '../homes/home/CounterAreaHomeOne';
import AoutUsAreaHomeOne from '../homes/home/AoutUsAreaHomeOne';
import TeamAreaHomeOne from '../homes/home/TeamAreaHomeOne';
import FooterOne from '@/layouts/footers/FooterOne';

const About = () => {
  return (
    <>
      <HeaderOne />
      <Breadcrumb title="About Us" subtitle="About Us" />
      <AboutArea />
      <CounterAreaHomeOne />
      <AoutUsAreaHomeOne />
      <TeamAreaHomeOne />
      <FooterOne />
    </>
  );
};

export default About;
