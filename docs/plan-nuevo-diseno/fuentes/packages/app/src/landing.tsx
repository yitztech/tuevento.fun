import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { tr, useLocale } from "./i18n";
import { HomeCategories } from "./ui/site/home-categories";
import { HomeDesigns } from "./ui/site/home-designs";
import { HomeFamily } from "./ui/site/home-family";
import { HomeFaq } from "./ui/site/home-faq";
import { HomeHero } from "./ui/site/home-hero";
import { HomeNewsletter } from "./ui/site/home-newsletter";
import { HomeProviders } from "./ui/site/home-providers";
import { HomeSteps } from "./ui/site/home-steps";
import { SiteLayout } from "./ui/site/site-layout";

export function LandingPage() {
  const { locale } = useLocale();
  const { hash } = useLocation();
  useEffect(() => {
    document.title = tr("landing.tueventofunInviteGatherCelebrate");
    const meta = document.querySelector('meta[name="description"]');
    const previous = meta?.getAttribute("content");
    meta?.setAttribute("content", tr("common.metaDescription"));
    return () => {
      if (previous) meta?.setAttribute("content", previous);
    };
  }, [locale]);
  // Los enlaces a una sección llegan también desde otras páginas del sitio
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  return (
    <SiteLayout>
      <HomeHero />
      <HomeCategories />
      <HomeDesigns />
      <HomeSteps />
      <HomeFamily />
      <HomeProviders />
      <HomeFaq />
      <HomeNewsletter />
    </SiteLayout>
  );
}
