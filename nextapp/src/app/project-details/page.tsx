import ProjectDetails from '@/components/project-details';
import Wrapper from '@/layouts/Wrapper';
import React from 'react';


export const metadata = {
  title: "Project Details - Altegic Solutions",
};

const index = () => {
  return (
    <Wrapper>
      <ProjectDetails />
    </Wrapper>
  );
};

export default index;