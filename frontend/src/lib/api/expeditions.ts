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
    const response = await fetch(`${api}/expeditions/`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as Expedition[];
    return data;
  } catch {
    return [];
  }
}

export const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
export const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
