import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

const photos = [
  { src: "img-20260723-wa0173.jpg", title: "Pescaria de Casais — Troféu Araguaia", desc: "Casal celebrando a captura de uma gigante no Araguaia. Experiência inesquecível a dois." },
  { src: "rogerio-e-uli-piraiba-206-1.jpg", title: "Piraíba de 2,06m — Rogério e Uli", desc: "Gigante lendária de mais de 2 metros fisgada e manejada com respeito no poço das piraíbas." },
  { src: "img-20250417-wa0027.jpg", title: "Pirarara Monstro no Barranco", desc: "Batalha emocionante no Araguaia contra uma das maiores pirararas da temporada." },
  { src: "wender-piraiba-186-3.jpg", title: "Piraíba de 1,86m — Wender", desc: "Troféu embarcado em Bandeirantes após mais de uma hora de pura adrenalina." },
  { src: "trible-de-pirararas-3.jpg", title: "Triplê Histórico de Pirararas", desc: "Três pescadores com três pirararas gigantes capturadas simultaneamente na mesma ação." },
  { src: "duble-de-piraiba-e-pirarara-top-1.jpg", title: "Dublê Épico de Piraíba e Pirarara", desc: "A magia do Rio Araguaia: dois gigantes de espécies nobres no mesmo momento." },
  { src: "img-20260723-wa0169.jpg", title: "Pirarara Lendária na Praia de Areia", desc: "Registro clássico do pescador com grande pirarara nas praias de água cristalina do Araguaia." },
  { src: "img-20260723-wa0170.jpg", title: "Pirarara Vermelha no Barco", desc: "Cores vivas e força descomunal: o charme e a bravura da pirarara do Araguaia." },
  { src: "img-20260723-wa0198.jpg", title: "Piraíba Prateada do Araguaia", desc: "O 'Filhote' gigante no colo do pescador demonstrando toda a imponência do peixe de couro." },
  { src: "img-20260723-wa0199.jpg", title: "Soltura e Preservação da Gigante", desc: "Compromisso com o pesque e solte: peixe oxigenado e devolvido com vida ao rio." },
  { src: "img-20250412-wa0033.jpg", title: "Fisgada Brutal no Meio do Rio", desc: "Pescador erguendo exemplar de respeito durante a temporada de águas limpas." },
  { src: "img-20250412-wa0041.jpg", title: "Pirarara de Mais de 35kg", desc: "Peixe de couro espetacular capturado com isca viva e guia especializado." },
  { src: "img-20250412-wa0051.jpg", title: "Troféu no Pôr do Sol", desc: "Final de tarde abençoado com peixe na linha e muita celebração a bordo." },
  { src: "img-20250413-wa0074.jpg", title: "Gigante Araguaiana", desc: "Orgulho de quem enfrentou a correnteza e venceu a disputa contra o monstro." },
  { src: "img-20250413-wa0123.jpg", title: "Piraíba no Bico da Voadeira", desc: "Registro memorável com a tripulação reunida em comemoração ao grande troféu." },
  { src: "img-20250417-wa0027.jpg", title: "Pirarara Monstro no Barranco", desc: "Briga pesada nos troncos e pedrais: vitória do pescador e do guia nativo." },
  { src: "whatsapp-image-2024-05-22-at-133904.jpeg", title: "Emoção à Flor da Pele", desc: "Sorriso no rosto e troféu nos braços: é isso que a Expedição Piraíba proporciona." },
  { src: "whatsapp-image-2024-05-24-at-145907.jpeg", title: "Dupla Vitoriosa no Araguaia", desc: "Pesca esportiva entre amigos que se torna história para contar a vida inteira." },
  { src: "whatsapp-image-2025-01-08-at-202540-1.jpeg", title: "Pirarara Lendária Noturna", desc: "A emoção de fisgar e embarcar um peixe desse porte nas noites do Araguaia." },
  { src: "whatsapp-image-2025-01-09-at-154004-14.jpeg", title: "Rei do Rio em São Félix", desc: "Mais um gigante catalogado no acervo oficial de mais de duas décadas de expedições." },
  { src: "20250414-065052.jpg", title: "Manhã de Troféus no Araguaia", desc: "Primeiras horas do dia e o alarme da carretilha cantando sem parar." },
  { src: "20250409-143952.jpg", title: "Pescadores em Sintonia com o Rio", desc: "Equipe completa celebrando a pescaria perfeita com guia nativo experiente." },
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
                  src={`/ims-pesca/${photo.src}`}
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
