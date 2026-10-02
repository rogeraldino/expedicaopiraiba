import { GalleryPreview } from "@/components/home/gallery-preview";
import { HomeHero } from "@/components/home/home-hero";
import { ExpeditionSection } from "@/components/home/expedition-section";
import { ExperienceSection } from "@/components/home/experience-section";
import { StoriesSection } from "@/components/home/stories-section";
import { Season2027 } from "@/components/home/season-2027";
import { FaqSection } from "@/components/home/faq-section";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getExpeditions } from "@/lib/api/expeditions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const expeditions = await getExpeditions();

  return (
    <div className="home-page min-h-screen bg-paper text-ink">
      <SiteHeader />
      <main>
        <HomeHero expeditions={expeditions} />
        <ExpeditionSection expeditions={expeditions} />
        <ExperienceSection />
        <StoriesSection />
        <GalleryPreview />
        <Season2027 />
        <FaqSection />
      </main>
      <SiteFooter />
    </div>
  );
}
