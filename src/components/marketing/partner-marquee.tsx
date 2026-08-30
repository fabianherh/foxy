"use client";

import { InfiniteSlider } from "@/components/ui/logo-marquee";

export function PartnerMarquee({ partners }: { partners: string[] }) {
  return (
    <div className="ribbon-marquee" aria-label={`Powered by ${partners.join(", ")}`}>
      <InfiniteSlider gap={44} duration={26} durationOnHover={70}>
        {[...partners, ...partners].map((partner, index) => (
          <span className="ribbon-item" key={`${partner}-${index}`} aria-hidden={index >= partners.length}>
            <strong>{partner}</strong>
            <i />
          </span>
        ))}
      </InfiniteSlider>
    </div>
  );
}
