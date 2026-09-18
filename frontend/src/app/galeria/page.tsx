import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

const photos = [
  { src: "foto-4.jpg", title: "Piraíba de 2,06m capturada em São Félix", desc: "Registro histórico de um dos maiores gigantes do Rio Araguaia." },
  { src: "foto-7.jpg", title: "Piraíba de 1,86m em Bandeirantes", desc: "Batalha inesquecível no poço das gigantes." },
  { src: "foto-5.jpg", title: "Triplê de Pirararas Lendárias", desc: "Três pirararas de grande porte capturadas no mesmo dia." },
  { src: "foto-8.jpg", title: "Dublê de Piraíba e Pirarara", desc: "Emoção em dose dupla para a mesma equipe." },
  { src: "foto-9.jpg", title: "Troféu Pescaria de Casais", desc: "Experiências e memórias compartilhadas a dois no Rio Araguaia." },
  { src: "foto-6.jpg", title: "Gigante embarcada com segurança", desc: "Manejo responsável e soltura para preservação da espécie." },
  { src: "foto-1.jpg", title: "Barco de apoio navegando ao amanhecer", desc: "Estrutura rápida e confortável para navegação segura." },
  { src: "foto-2.jpg", title: "Amanhecer no Rio Araguaia", desc: "A magia da natureza intocada antes do primeiro arremesso." },
  { src: "foto-3.jpg", title: "Praia de areia branca & Resenha", desc: "Parada para sashimi fresco e churrasco de chão." },
  { src: "foto-10.jpg", title: "Pescadores em ação de pesca esportiva", desc: "Piloteiros experientes posicionando nos melhores poços." },
  { src: "foto-11.jpg", title: "Pôr do sol cinematográfico no Araguaia", desc: "O encerramento perfeito de um dia de muitas fisgadas." },
  { src: "foto-12.jpg", title: "Confraternização noturna na pousada", desc: "Resenha, boa comida e premiação entre as duplas." },
];

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-background text-ink-900">
      <SiteHeader />
      <div className="container-page py-5 text-sm text-ink-500">
        <Link href="/" className="hover:text-brand-700">Início</Link>
        <span className="px-2">›</span>
        <span className="font-bold text-ink-900">Galeria de Troféus</span>
      </div>

      <section className="container-page pb-16">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="rounded-full bg-brand-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-800">
              Acervo Oficial
            </span>
            <h1 className="mt-2 text-4xl font-black text-brand-900 sm:text-5xl">Histórias Reais, Peixes Gigantes!</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">
              Registros autênticos de mais de 20 anos de expedições de pesca esportiva no Rio Araguaia com a equipe da Expedição Piraíba.
            </p>
          </div>
          <a
            href="https://wa.me/5562981612128?text=Olá!%20Vi%20a%20galeria%20e%20gostaria%20de%20saber%20sobre%20as%20expedições."
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 text-sm font-bold text-white shadow hover:bg-[#1EBE5D]"
          >
            <MessageCircle className="size-4" /> Enviar mensagem
          </a>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <article key={photo.src} className="group overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative aspect-[4/3] overflow-hidden bg-black/10">
                <Image
                  src={`/gallery/${photo.src}`}
                  alt={photo.title}
                  fill
                  sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h2 className="text-base font-black text-brand-900 leading-tight">{photo.title}</h2>
                <p className="mt-1 text-xs text-ink-500 leading-relaxed">{photo.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
