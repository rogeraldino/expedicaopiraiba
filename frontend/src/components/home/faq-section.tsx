"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: "Preciso de licença de pesca (RGP) para pescar no Rio Araguaia?",
    answer:
      "Sim. A Licença de Pesca Amadora (federal do Ministério da Pesca e Aquicultura e, quando exigida, estadual) é obrigatória para a prática da pesca esportiva no Rio Araguaia. A emissão é 100% online e nossa equipe orienta cada pescador com o passo a passo completo antes do embarque.",
  },
  {
    question: "O que está incluso no pacote da pescaria?",
    answer:
      "O pacote inclui hospedagem completa (café, almoço e jantar), barcos rápidos com piloteiros nativos especializados, combustível 100% livre para todos os dias de pesca, iscas vivas e naturais, kit sashimi e ceviche preparados no rio, além de refrigerantes, água mineral e gelo à vontade. Na Pescaria de Casais, o pacote conta com All Inclusive completo de cervejas premium. Nas expedições regulares, as cervejas são selecionadas de forma personalizada para o barco.",
  },
  {
    question: "Como funciona o pagamento e o sinal da reserva?",
    answer:
      "A reserva é garantida com um sinal de 20% do valor total via PIX no momento da contratação. O saldo restante pode ser quitado de forma programada até a data da viagem, com controle em tempo real pelo Portal do Cliente sem burocracia.",
  },
  {
    question: "Como funcionam os barcos e a formação de duplas?",
    answer:
      "A pescaria é realizada em duplas por barco, acompanhadas por um guia nativo experiente que conhece cada poço e curva do rio. Você pode vir com seu parceiro de pesca ou organizamos a dupla com outro participante de perfil similar do grupo.",
  },
  {
    question: "Como funciona a logística e como chegar até a pousada?",
    answer:
      "Para as expedições em São Félix do Araguaia/MT, o acesso pode ser feito via voos regionais até Confresa/MT, voos fretados ou transfer terrestre a partir de Palmas/TO. Para Bandeirantes/GO, o acesso rodoviário é totalmente asfaltado a partir de Goiânia (aprox. 440 km). Auxiliamos na indicação de transfers e horários ideais de encontro.",
  },
  {
    question: "Quais equipamentos e roupas devo levar?",
    answer:
      "Recomendamos vestuário leve com proteção UV (camisetas de manga longa, calças de secagem rápida, chapéu e óculos polarizados), além de protetor solar e repelente. Para os grandes peixes de couro (Piraíba e Pirarara), recomendamos conjuntos pesados (varas de 80 a 120 lb com carretilhas de perfil alto ou molinetes robustos). Logo após a confirmação, disponibilizamos um checklist interativo completo.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="scroll-mt-16 bg-sand-50/70 py-16 md:py-20" aria-labelledby="faq-title">
      <div className="home-shell max-w-4xl">
        <div className="text-center">
          <p className="home-eyebrow text-gold-600 flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider">
            <HelpCircle className="size-4" />
            Tire Suas Dúvidas
          </p>
          <h2 id="faq-title" className="home-display mt-2 text-3xl text-brand-900 md:text-4xl">
            Perguntas Frequentes
          </h2>
          <p className="mt-3 text-sm text-ink-600 md:text-base">
            Tudo o que você precisa saber sobre as nossas expedições, estrutura e logística no Araguaia.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.question}
                className="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-sm transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left font-bold text-ink-900 hover:text-brand-700 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm md:text-base">{faq.question}</span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-brand-600 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-ink-900/5 px-5 pb-5 pt-3">
                    <p className="text-sm leading-relaxed text-ink-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-brand-800/15 bg-brand-900/5 p-6 text-center">
          <p className="text-sm font-semibold text-brand-900">Ainda tem alguma dúvida específica sobre a sua viagem?</p>
          <p className="mt-1 text-xs text-ink-600">Nossa equipe de operações está disponível no WhatsApp para ajudar você com todos os detalhes.</p>
          <a
            href="https://wa.me/5562981612128?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20as%20expedições."
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-brand-700 transition-colors"
          >
            Falar com a equipe no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
