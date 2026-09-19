import BusinessRegistration from '@/components/business-registration';
import Wrapper from '@/layouts/Wrapper';

export const metadata = {
  title: "Business Registration - Altegic Solutions",
};

export default function Page() {
  return (
    <Wrapper>
      <BusinessRegistration />
    </Wrapper>
  );
}
