
import Team from '@/components/team';
import Wrapper from '@/layouts/Wrapper';
import React from 'react';


export const metadata = {
  title: "Our Team - Altegic Solutions",
};

const index = () => {
  return (
    <Wrapper>
      <Team />
    </Wrapper>
  );
};

export default index;