import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { gallery } from "@/lib/home-content";

export function GalleryPreview() {
  return (
    <section id="galeria" className="home-shell scroll-mt-20 pb-16 lg:pb-20" aria-labelledby="gallery-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="home-eyebrow text-gold-700">Galeria</p><h2 id="gallery-title" className="home-display mt-2 text-3xl md:text-4xl">Momentos que falam por si.</h2></div>
        <Link href="/galeria" className="home-text-link inline-flex items-center gap-2">Ver galeria completa <ArrowRight size={16} /></Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {gallery.slice(0, 6).map(([src, alt]) => (
          <Link href="/galeria" key={src} aria-label={`Ver galeria: ${alt}`} className="group relative aspect-[4/3] overflow-hidden rounded-md bg-river-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600">
            <Image src={`/ims-pesca/${src}`} alt={alt} fill sizes="(min-width:1024px) 16vw, (min-width:640px) 33vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
          </Link>
        ))}
      </div>
    </section>
  );
}
