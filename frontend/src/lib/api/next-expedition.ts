import type { Expedition } from "./expeditions";

export function selectNextExpedition(expeditions: Expedition[], today: string): Expedition | undefined {
  return expeditions
    .filter((item) => item.starts_at >= today && item.available_slots > 0)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.slug.localeCompare(b.slug))[0];
}
