

import React from 'react';
import HeaderOne from '@/layouts/headers/HeaderOne';
import HeroAreaHomeOne from './HeroAreaHomeOne'; 
import AboutAreaHomeOne from './AboutAreaHomeOne';
import ServiceAreaHomeOne from './ServiceAreaHomeOne';
import AoutUsAreaHomeOne from './AoutUsAreaHomeOne';
import ChooseAreaHomeOne from './ChooseAreaHomeOne';
import PriceAreaHomeOne from './PriceAreaHomeOne';
import TeamAreaHomeOne from './TeamAreaHomeOne';
import FooterOne from '@/layouts/footers/FooterOne';
import CounterAreaHomeOne from './CounterAreaHomeOne';

const HomeOne = () => {
  return (
    <>
       <HeaderOne />
       <HeroAreaHomeOne />
       <CounterAreaHomeOne />
       <AboutAreaHomeOne />
       <ServiceAreaHomeOne />
       <AoutUsAreaHomeOne />
       <ChooseAreaHomeOne />
       <PriceAreaHomeOne />
       <TeamAreaHomeOne />
       <FooterOne />
    </>
  );
};

export default HomeOne;
