import DomainSearch from '@/components/domain-search';
import Wrapper from '@/layouts/Wrapper';

export const metadata = {
  title: "Domain Search - Altegic Solutions",
};

export default function Page() {
  return (
    <Wrapper>
      <DomainSearch />
    </Wrapper>
  );
}
