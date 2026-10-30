import { Categories, DesignsGallery, FamilyRsvp, FinalCta, Hero, PromiseAndFaq, ProvidersTeaser, Steps } from "@/pages/Home/sections";

export function Home() {
  return (
    <>
      <Hero />
      <Categories />
      <DesignsGallery />
      <Steps />
      <FamilyRsvp />
      <ProvidersTeaser />
      <PromiseAndFaq />
      <FinalCta />
    </>
  );
}
