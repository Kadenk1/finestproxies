import { Hero } from "@/components/marketing/hero";
import { StatsStrip } from "@/components/marketing/stats-strip";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { NetworkSection } from "@/components/marketing/network-section";
import { CtaBanner } from "@/components/marketing/cta-banner";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsStrip />
      <ProductShowcase />
      <FeatureGrid />
      <NetworkSection />
      <CtaBanner />
    </>
  );
}
