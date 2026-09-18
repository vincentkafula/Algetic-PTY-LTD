import HeaderOne from '@/layouts/headers/HeaderOne';
import FooterOne from '@/layouts/footers/FooterOne';
import Breadcrumb from '@/components/common/Breadcrumb';
import DomainSearchArea from './DomainSearchArea';

export default function DomainSearch() {
  return (
    <>
      <HeaderOne />
      <Breadcrumb title="Domain Search" subtitle="Domains" />
      <DomainSearchArea />
      <FooterOne />
    </>
  );
}
