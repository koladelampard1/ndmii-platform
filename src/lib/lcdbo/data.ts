import {
  getProgrammeBySlug,
  listClustersForProgramme,
  loadGeographyCatalog,
  loadPlatformWorkspaceFoundation,
} from "@/lib/data/platform-foundation";
import {
  fallbackClusters,
  fallbackPartners,
  LCDBO_PROGRAMME_SLUG,
  toClusterCards,
  toPartnerCards,
  type LcdboClusterCard,
  type LcdboPartnerCard,
} from "@/lib/lcdbo/content";
import type { Programme } from "@/types/platform";

export type LcdboPublicData = {
  programme: Programme | null;
  clusters: LcdboClusterCard[];
  partners: LcdboPartnerCard[];
  dataSource: "platform_foundation" | "fallback";
};

export async function loadLcdboPublicData(): Promise<LcdboPublicData> {
  try {
    const foundation = await loadPlatformWorkspaceFoundation();
    const programme = foundation.programmes.find((item) => item.slug === LCDBO_PROGRAMME_SLUG) ?? null;
    const geography = await loadGeographyCatalog();
    const rawClusters = programme ? await listClustersForProgramme(programme.id) : foundation.clusters;

    return {
      programme,
      clusters: toClusterCards({
        clusters: rawClusters.length ? rawClusters : foundation.clusters,
        states: geography.states,
        lgas: geography.lgas,
      }),
      partners: toPartnerCards(foundation.institutions),
      dataSource: "platform_foundation",
    };
  } catch (error) {
    console.warn("[lcdbo-public-data] using fallback content", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      programme: null,
      clusters: fallbackClusters,
      partners: fallbackPartners,
      dataSource: "fallback",
    };
  }
}

export async function loadLcdboProgramme() {
  try {
    return await getProgrammeBySlug(LCDBO_PROGRAMME_SLUG);
  } catch {
    return null;
  }
}
