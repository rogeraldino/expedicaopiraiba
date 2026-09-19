export type TargetSpecies = {
  id: string;
  common_name: string;
  slug: string;
  scientific_name?: string;
  category: string;
  is_primary: boolean;
};

export type Lodge = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  river_section?: string;
  description?: string;
  amenities?: string[];
  meeting_point?: string;
  directions?: string;
  cover_image_url?: string;
};

export type Expedition = {
  id: string;
  name: string;
  slug: string;
  destination: string;
  departure_location: string;
  starts_at: string;
  ends_at: string;
  duration_days: number;
  available_slots: number;
  price_per_person_cents: number;
  summary: string;
  cover_image_url?: string;
  lodge?: Lodge | null;
  target_species?: TargetSpecies[];
  inclusions?: string[];
};

const defaultSpecies: TargetSpecies[] = [
  { id: "1", common_name: "Piraíba", slug: "piraiba", category: "COURO", is_primary: true },
  { id: "2", common_name: "Pirarara", slug: "pirarara", category: "COURO", is_primary: true },
  { id: "3", common_name: "Bargada", slug: "bargada", category: "COURO", is_primary: false },
];

const preview: Expedition[] = [
  {
    id: "sao-felix-01-out",
    name: "São Félix do Araguaia — 01 a 04 Out",
    slug: "sao-felix-01-out",
    destination: "São Félix do Araguaia/MT (Pousada Solar das Águas)",
    departure_location: "São Félix do Araguaia/MT",
    starts_at: "2026-10-01",
    ends_at: "2026-10-04",
    duration_days: 4,
    available_slots: 12,
    price_per_person_cents: 560000,
    summary: "4 dias de pescaria completos All Inclusive no Rio Araguaia na Pousada Solar das Águas.",
    cover_image_url: "/expeditions/ponte-sao-felix.jpg",
    lodge: {
      id: "solar-das-aguas",
      name: "Pousada Solar das Águas",
      slug: "solar-das-aguas",
      city: "São Félix do Araguaia",
      state: "MT",
      river_section: "Médio Araguaia",
    },
    target_species: defaultSpecies,
  },
  {
    id: "bandeirantes-15-out",
    name: "Bandeirantes — 15 a 18 Out",
    slug: "bandeirantes-15-out",
    destination: "Bandeirantes/GO (Pousada Canaã)",
    departure_location: "Bandeirantes/GO",
    starts_at: "2026-10-15",
    ends_at: "2026-10-18",
    duration_days: 4,
    available_slots: 12,
    price_per_person_cents: 510000,
    summary: "4 dias de pescaria de gigantes All Inclusive no Rio Araguaia na Pousada Canaã.",
    cover_image_url: "/expeditions/bandeirantes-piraiba.jpg",
    lodge: {
      id: "pousada-canaa",
      name: "Pousada Canaã",
      slug: "pousada-canaa",
      city: "Bandeirantes",
      state: "GO",
      river_section: "Alto-Médio Araguaia",
    },
    target_species: defaultSpecies,
  },
  {
    id: "bandeirantes-casais-22-out",
    name: "Pescaria de Casais — 22 a 24 Out",
    slug: "bandeirantes-casais-22-out",
    destination: "Bandeirantes/GO (Pousada Canaã)",
    departure_location: "Bandeirantes/GO",
    starts_at: "2026-10-22",
    ends_at: "2026-10-24",
    duration_days: 3,
    available_slots: 12,
    price_per_person_cents: 420000,
    summary: "Momentos a dois e memórias para sempre. R$ 8.400 por casal.",
    cover_image_url: "/expeditions/casais-pesca.jpg",
    lodge: {
      id: "pousada-canaa",
      name: "Pousada Canaã",
      slug: "pousada-canaa",
      city: "Bandeirantes",
      state: "GO",
      river_section: "Alto-Médio Araguaia",
    },
    target_species: defaultSpecies,
  },
  {
    id: "sao-felix-28-out",
    name: "São Félix do Araguaia — 28 a 31 Out",
    slug: "sao-felix-28-out",
    destination: "São Félix do Araguaia/MT (Pousada Solar das Águas)",
    departure_location: "São Félix do Araguaia/MT",
    starts_at: "2026-10-28",
    ends_at: "2026-10-31",
    duration_days: 4,
    available_slots: 12,
    price_per_person_cents: 560000,
    summary: "Fechamento de temporada 2026 com chave de ouro em São Félix do Araguaia.",
    cover_image_url: "/expeditions/por-do-sol-araguaia.jpg",
    lodge: {
      id: "solar-das-aguas",
      name: "Pousada Solar das Águas",
      slug: "solar-das-aguas",
      city: "São Félix do Araguaia",
      state: "MT",
      river_section: "Médio Araguaia",
    },
    target_species: defaultSpecies,
  },
];

export const expeditionImages: Record<string, string> = {
  "sao-felix-01-out": "/ims-pesca/rogerio-e-uli-piraiba-206-1.jpg",
  "bandeirantes-15-out": "/ims-pesca/wender-piraiba-186-3.jpg",
  "bandeirantes-casais-22-out": "/ims-pesca/img-20260723-wa0173.jpg",
  "sao-felix-28-out": "/ims-pesca/trible-de-pirararas-3.jpg",
  "rio-araguaia": "/ims-pesca/duble-de-piraiba-e-pirarara-top-1.jpg",
};

export async function getExpeditions(): Promise<Expedition[]> {
  const api = process.env.API_URL ?? "http://localhost:8000/api";
  try {
    const response = await fetch(`${api}/expeditions/`, { next: { revalidate: 60 } });
    if (!response.ok) return preview;
    const data = (await response.json()) as Expedition[];
    return data.length ? data : preview;
  } catch {
    return preview;
  }
}

export const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
export const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
