import Error from "@/components/Error";
import Wrapper from "@/layouts/Wrapper";


export const metadata = {
  title: "Page Not Found - Altegic Solutions",
};

const index = () => {
  return (
    <Wrapper>
      <Error />
    </Wrapper>
  );
};

export default index;