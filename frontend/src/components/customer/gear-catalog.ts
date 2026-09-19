export type GearCategory = "RODS_REELS" | "TERMINALS_LURES" | "APPAREL_UV" | "TOOLS_SAFETY";

export type GearItem = {
  id: string;
  category: GearCategory;
  categoryName: string;
  name: string;
  targetSpecies: string;
  description: string;
  specs: string[];
  supportsRental: boolean;
  supportsPurchase: boolean;
  rentalPriceDailyCents: number;
  purchasePriceCents: number;
  badge?: string;
};

export const GEAR_CATEGORIES: { id: GearCategory; label: string; icon: string }[] = [
  { id: "RODS_REELS", label: "Varas & Carretilhas", icon: "🎣" },
  { id: "TERMINALS_LURES", label: "Terminais & Iscas", icon: "🪝" },
  { id: "APPAREL_UV", label: "Vestuário UV50+", icon: "👕" },
  { id: "TOOLS_SAFETY", label: "Acessórios & Bordo", icon: "🕶️" },
];

export const GEAR_CATALOG: GearItem[] = [
  // 1. VARAS E CARRETILHAS / MOLINETES
  {
    id: "conjunto-piraiba-heavy",
    category: "RODS_REELS",
    categoryName: "Varas & Carretilhas",
    name: "Conjunto Heavy Piraíba Especial (80-120 lbs)",
    targetSpecies: "Piraíbas de +2m e gigantes de couro nos poços profundos do Araguaia",
    description:
      "Vara inteiriça de carbono maciço de alta resistência combinada com carretilha perfil alto marinizada de alto drag (25kg+), abastecida com 250m de multifilamento 0.70mm e líder 120lbs.",
    specs: [
      "Vara Carbono Tubular 80-120 lbs 5'6\"",
      "Carretilha Perfil Alto c/ Freio Duplo de Carbono (Drag 25kg+)",
      "250 metros de Multifilamento 8X 0.70mm (100 lbs)",
      "Líder Fluorocarbono 1.20mm (120 lbs) montado",
    ],
    supportsRental: true,
    supportsPurchase: true,
    rentalPriceDailyCents: 8500, // R$ 85/dia
    purchasePriceCents: 115000, // R$ 1.150
    badge: "Mais Escolhido para Piraíba",
  },
  {
    id: "conjunto-pirarara-medium-heavy",
    category: "RODS_REELS",
    categoryName: "Varas & Carretilhas",
    name: "Conjunto Pirarara & Rodada Médio-Pesado (50-80 lbs)",
    targetSpecies: "Pirararas de até 50kg, Barbados, Pintados e Cacharas",
    description:
      "Equipamento de ação progressiva com ótima sensibilidade para fisgadas de pirararas na praia e na rodada. Molinete ou carretilha marinizada com recolhimento macio e freio confiável.",
    specs: [
      "Vara Grafite Ação Progressiva 50-80 lbs 6'0\"",
      "Molinete Heavy 6500 ou Carretilha Perfil Alto",
      "200 metros de Multifilamento 0.52mm (65 lbs)",
      "Líder Shock Leader 80 lbs encastoado",
    ],
    supportsRental: true,
    supportsPurchase: true,
    rentalPriceDailyCents: 6500, // R$ 65/dia
    purchasePriceCents: 78000, // R$ 780
    badge: "Ideal para Pirarara",
  },
  {
    id: "conjunto-arremesso-iscas",
    category: "RODS_REELS",
    categoryName: "Varas & Carretilhas",
    name: "Conjunto Médio de Arremesso / Iscas Artificiais (20-40 lbs)",
    targetSpecies: "Tucunarés Azuis, Bicudas, Cachorras-Largas e Aruanãs",
    description:
      "Conjunto leve e rápido para quem deseja intercalar a pesca de fundo com arremessos esportivos nas estruturas de galhadas e praias.",
    specs: [
      "Vara Carbono IM8 Ação Rápida 20-40 lbs 5'8\"",
      "Carretilha Perfil Baixo Rápida (recolhimento 7.3:1)",
      "150 metros de Multifilamento 4X 0.35mm (40 lbs)",
      "Líder Fluorocarbono 0.50mm",
    ],
    supportsRental: true,
    supportsPurchase: true,
    rentalPriceDailyCents: 5000, // R$ 50/dia
    purchasePriceCents: 62000, // R$ 620
    badge: "Para Iscas Artificiais",
  },

  // 2. TERMINAIS, ANZÓIS E ISCAS
  {
    id: "kit-terminais-poco-pro",
    category: "TERMINALS_LURES",
    categoryName: "Terminais & Iscas",
    name: "Kit Completo Terminais de Poço (Piraíba & Pirarara Pro)",
    targetSpecies: "Montagem profissional para poços e remansos do Araguaia",
    description:
      "Estojo lacrado com todos os terminais pesados necessários para 4 dias de pescaria sem perda de tempo amarrando no barco.",
    specs: [
      "10 Anzóis Circle Hook 9/0 e 11/0 encastoados em aço flexível 120 lbs",
      "8 Chumbadas esféricas de poço (90g, 120g e 150g)",
      "8 Giradores de rolamento marinizados 150 lbs",
      "Estojo impermeável rígido incluso",
    ],
    supportsRental: false,
    supportsPurchase: true,
    rentalPriceDailyCents: 0,
    purchasePriceCents: 14000, // R$ 140
    badge: "Indispensável",
  },
  {
    id: "kit-iscas-artificiais-araguaia",
    category: "TERMINALS_LURES",
    categoryName: "Terminais & Iscas",
    name: "Kit Iscas Artificiais Consagradas do Araguaia",
    targetSpecies: "Tucunaré, Cachorra, Bicuda e predadores do rio",
    description:
      "Seleção das 5 melhores iscas testadas e aprovadas pelos guias nativos da Expedição Piraíba com garateias reforçadas.",
    specs: [
      "2 Zaras de superfície 12cm c/ garateias reforçadas 4X",
      "2 Meias-águas de barbela profunda para correnteza",
      "1 Jig de pena artesanal de alta vibração",
      "Estojo porta-iscas com trava de segurança",
    ],
    supportsRental: false,
    supportsPurchase: true,
    rentalPriceDailyCents: 0,
    purchasePriceCents: 19000, // R$ 190
    badge: "Recomendado pelos Guias",
  },
  {
    id: "carretel-multifilamento-8x",
    category: "TERMINALS_LURES",
    categoryName: "Terminais & Iscas",
    name: "Carretel Linha Multifilamento 8X Pro (300m)",
    targetSpecies: "Abastecimento extra para pedrais e galhadas",
    description:
      "Linha trançada com 8 fios de alta densidade, zero elasticidade e proteção contra atrito com pedras do fundo.",
    specs: [
      "Bitola 0.65mm com resistência de 90 lbs (41 kg)",
      "Trança com revestimento repelente à água",
      "Carretel lacrado com 300 metros",
    ],
    supportsRental: false,
    supportsPurchase: true,
    rentalPriceDailyCents: 0,
    purchasePriceCents: 11000, // R$ 110
  },

  // 3. VESTUÁRIO UV50+
  {
    id: "camisa-uv50-oficial",
    category: "APPAREL_UV",
    categoryName: "Vestuário UV50+",
    name: "Camisa Manga Longa Oficial UV50+ Expedição Piraíba",
    targetSpecies: "Proteção solar diária para 8+ horas de pesca no barco",
    description:
      "Tecido tecnológico dry-fit com microperfurações que facilitam a ventilação e secagem rápida. Proteção solar permanente fator UV50+.",
    specs: [
      "Fator de proteção solar permanente UV50+",
      "Capuz anatômico integrado e passa-dedo no punho",
      "Tecido antibacteriano com tratamento antiodor",
      "Tamanhos disponíveis: P, M, G, GG e XGG",
    ],
    supportsRental: false,
    supportsPurchase: true,
    rentalPriceDailyCents: 0,
    purchasePriceCents: 15000, // R$ 150
    badge: "Uniforme Oficial",
  },
  {
    id: "buff-pesca-uv",
    category: "APPAREL_UV",
    categoryName: "Vestuário UV50+",
    name: "Bandana / Buff de Pesca UV50+ Tubular",
    targetSpecies: "Proteção da nuca, pescoço e rosto contra reflexo solar",
    description:
      "Acessório indispensável contra a queimação do reflexo do sol na água e do vento forte durante a navegação rápida.",
    specs: [
      "Tecido elástico de alta respirabilidade",
      "Proteção UV50+ com secagem ultrarrápida",
      "Estampa temática exclusiva do Rio Araguaia",
    ],
    supportsRental: false,
    supportsPurchase: true,
    rentalPriceDailyCents: 0,
    purchasePriceCents: 4500, // R$ 45
  },
  {
    id: "chapeu-expedicao-nuca",
    category: "APPAREL_UV",
    categoryName: "Vestuário UV50+",
    name: "Chapéu de Expedição com Protetor de Nuca Removível",
    targetSpecies: "Proteção completa 360° para cabeça e nuca",
    description:
      "Aba semi-rígida que não deforma com o vento da navegação, com protetor de nuca destacável em velcro e cordão de queixo ajustável.",
    specs: [
      "Tecido leve em poliamida com repelência a respingos",
      "Aba de 8cm com forro antirreflexo escuro",
      "Respiradouros laterais em tela",
    ],
    supportsRental: false,
    supportsPurchase: true,
    rentalPriceDailyCents: 0,
    purchasePriceCents: 8500, // R$ 85
  },
  {
    id: "luvas-pesca-reforcadas",
    category: "APPAREL_UV",
    categoryName: "Vestuário UV50+",
    name: "Luvas de Pesca com Reforço para Linhas Pesadas",
    targetSpecies: "Proteção das mãos no arremesso e manuseio de peixes",
    description:
      "Evita cortes causados pela linha multifilamento tensionada e protege contra espinhos e raios das barbatanas de pirararas e piraíbas.",
    specs: [
      "Reforço em couro sintético no indicador e polegar",
      "Palma antiderrapante para manuseio seguro da vara",
      "Fecho em velcro no punho",
    ],
    supportsRental: false,
    supportsPurchase: true,
    rentalPriceDailyCents: 0,
    purchasePriceCents: 7000, // R$ 70
  },

  // 4. FERRAMENTAS E ACESSÓRIOS DE BORDO
  {
    id: "oculos-polarizado-flutuante",
    category: "TOOLS_SAFETY",
    categoryName: "Acessórios & Bordo",
    name: "Óculos Polarizado de Alta Definição (Armação Flutuante)",
    targetSpecies: "Enxergar peixes, troncos submersos e fundo do rio",
    description:
      "Lente polarizada TAC âmbar de alto contraste que corta o reflexo solar na água do Araguaia. Armação tecnológica ultraleve que não afunda se cair no rio.",
    specs: [
      "Lentes TAC polarizadas com filtro UVA/UVB 400",
      "Armação polimérica flutuante de alta flexibilidade",
      "Acompanha cordão esportivo e estojo rígido",
    ],
    supportsRental: true,
    supportsPurchase: true,
    rentalPriceDailyCents: 2500, // R$ 25/dia
    purchasePriceCents: 16000, // R$ 160
    badge: "Flutuante",
  },
  {
    id: "kit-alicate-boga-grip",
    category: "TOOLS_SAFETY",
    categoryName: "Acessórios & Bordo",
    name: "Kit Alicate Desengasgador Longo + Boga Grip com Balança",
    targetSpecies: "Contenção segura e desengaste rápido de gigantes",
    description:
      "Alicate de bico longo 28cm para retirar anzóis de bocas profundas com segurança, mais alicate pega-peixe labial com balança analógica até 25kg.",
    specs: [
      "Alicate longo 28cm em aço carbono niquelado anticorrosão",
      "Boga grip em alumínio de aviação com balança integrada",
      "Cordão de segurança espiral com mosquetão em inox",
    ],
    supportsRental: false,
    supportsPurchase: true,
    rentalPriceDailyCents: 0,
    purchasePriceCents: 13000, // R$ 130
  },
  {
    id: "bolsa-estanque-drybag-15l",
    category: "TOOLS_SAFETY",
    categoryName: "Acessórios & Bordo",
    name: "Bolsa Estanque Impermeável 15L (Dry Bag)",
    targetSpecies: "Proteção de celulares, câmeras, carteiras e roupas secas",
    description:
      "Proteção 100% estanque contra respingos violentos, chuva torrencial e poeira durante toda a navegação no rio.",
    specs: [
      "Lona vinílica PVC 500D com solda eletrônica sem costura",
      "Fechamento roll-top hermético com fivela de alta resistência",
      "Alça tiracolo acolchoada e ajustável",
    ],
    supportsRental: false,
    supportsPurchase: true,
    rentalPriceDailyCents: 0,
    purchasePriceCents: 9000, // R$ 90
  },
];
