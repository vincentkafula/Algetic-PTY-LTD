
import Faq from '@/components/faq';
import Wrapper from '@/layouts/Wrapper';
import React from 'react';

export const metadata = {
  title: "FAQ - Altegic Solutions",
};


const index = () => {
  return (
    <Wrapper>
      <Faq />
    </Wrapper>
  );
};

export default index;