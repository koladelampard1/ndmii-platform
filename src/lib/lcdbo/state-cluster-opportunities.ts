export type ResourceCategory = "Agriculture" | "Solid minerals" | "Other opportunities";

export type StateClusterOpportunity = {
  state: string;
  agriculturalResources: string[];
  solidMinerals: string[];
  otherOpportunities: string[];
  suggestedClusterThemes: string[];
  headlineOpportunity: string;
  prioritySectors: string[];
};

export type ClusterThemeOpportunity = {
  id: string;
  state: string;
  theme: string;
  resourceBase: string;
  valueChainPotential: string;
  investorRelevance: string;
  msmeOpportunity: string;
  category: ResourceCategory;
};

type RawStateOpportunity = {
  state: string;
  agriculturalResources: string[];
  solidMinerals: string[];
  otherOpportunities: string[];
};

const rawStateOpportunities: RawStateOpportunity[] = [
  { state: "Abia", agriculturalResources: ["Cassava", "Yam", "Maize", "Oil Palm", "Vegetables"], solidMinerals: ["Limestone", "Clay", "Lead", "Zinc"], otherOpportunities: ["Palm Oil", "Leather", "Manufacturing"] },
  { state: "Adamawa", agriculturalResources: ["Rice", "Maize", "Sorghum", "Groundnut", "Cotton", "Cattle"], solidMinerals: ["Limestone", "Gypsum", "Kaolin", "Bentonite"], otherOpportunities: ["Livestock", "Fisheries", "Hydro Potential"] },
  { state: "Akwa Ibom", agriculturalResources: ["Oil Palm", "Cassava", "Coconut", "Rubber", "Fisheries"], solidMinerals: ["Clay", "Limestone", "Glass Sand"], otherOpportunities: ["Crude Oil", "Natural Gas", "Deep Seaport", "Blue Economy"] },
  { state: "Anambra", agriculturalResources: ["Rice", "Yam", "Cassava", "Vegetables", "Oil Palm"], solidMinerals: ["Clay", "Lignite", "Glass Sand"], otherOpportunities: ["Commerce", "Manufacturing", "Inland Port"] },
  { state: "Bauchi", agriculturalResources: ["Millet", "Maize", "Rice", "Groundnut", "Cotton"], solidMinerals: ["Gold", "Limestone", "Gypsum", "Kaolin"], otherOpportunities: ["Livestock", "Tourism"] },
  { state: "Bayelsa", agriculturalResources: ["Cassava", "Plantain", "Fisheries", "Coconut"], solidMinerals: ["Clay", "Silica Sand"], otherOpportunities: ["Crude Oil", "Gas", "Mangrove Resources"] },
  { state: "Benue", agriculturalResources: ["Yam", "Cassava", "Rice", "Soybean", "Sesame", "Oranges"], solidMinerals: ["Limestone", "Barite", "Clay"], otherOpportunities: ["Food Processing", "Fruit Value Chains"] },
  { state: "Borno", agriculturalResources: ["Wheat", "Millet", "Sorghum", "Livestock"], solidMinerals: ["Limestone", "Clay", "Diatomite"], otherOpportunities: ["Irrigation Agriculture", "Livestock"] },
  { state: "Cross River", agriculturalResources: ["Cocoa", "Oil Palm", "Banana", "Rubber"], solidMinerals: ["Limestone", "Granite", "Barite"], otherOpportunities: ["Tourism", "Timber", "Deep Seaport Potential"] },
  { state: "Delta", agriculturalResources: ["Cassava", "Oil Palm", "Rubber", "Fisheries"], solidMinerals: ["Clay", "Silica Sand"], otherOpportunities: ["Oil & Gas", "Petrochemicals"] },
  { state: "Ebonyi", agriculturalResources: ["Rice", "Cassava", "Yam"], solidMinerals: ["Lead", "Zinc", "Limestone", "Salt"], otherOpportunities: ["Rice Processing", "Salt Production"] },
  { state: "Edo", agriculturalResources: ["Cocoa", "Rubber", "Oil Palm", "Cassava"], solidMinerals: ["Limestone", "Marble", "Granite"], otherOpportunities: ["Timber", "Rubber Processing"] },
  { state: "Ekiti", agriculturalResources: ["Cocoa", "Cassava", "Yam"], solidMinerals: ["Granite", "Feldspar", "Kaolin"], otherOpportunities: ["Cocoa Processing"] },
  { state: "Enugu", agriculturalResources: ["Cassava", "Yam", "Vegetables"], solidMinerals: ["Coal", "Limestone", "Clay"], otherOpportunities: ["Coal Heritage", "Manufacturing"] },
  { state: "Gombe", agriculturalResources: ["Groundnut", "Maize", "Sorghum"], solidMinerals: ["Gypsum", "Limestone", "Uranium"], otherOpportunities: ["Livestock"] },
  { state: "Imo", agriculturalResources: ["Oil Palm", "Cassava", "Yam"], solidMinerals: ["Lead", "Zinc", "Clay"], otherOpportunities: ["Palm Oil Processing"] },
  { state: "Jigawa", agriculturalResources: ["Rice", "Wheat", "Millet", "Sesame"], solidMinerals: ["Kaolin", "Limestone"], otherOpportunities: ["Irrigation", "Livestock"] },
  { state: "Kaduna", agriculturalResources: ["Maize", "Ginger", "Soybean", "Cotton"], solidMinerals: ["Gold", "Marble", "Limestone", "Graphite"], otherOpportunities: ["Manufacturing", "Logistics"] },
  { state: "Kano", agriculturalResources: ["Rice", "Tomato", "Wheat", "Millet", "Sesame"], solidMinerals: ["Kaolin", "Gypsum", "Limestone"], otherOpportunities: ["Commerce", "Leather", "Textiles"] },
  { state: "Katsina", agriculturalResources: ["Cotton", "Millet", "Sorghum", "Maize"], solidMinerals: ["Kaolin", "Asbestos", "Marble"], otherOpportunities: ["Livestock", "Leather"] },
  { state: "Kebbi", agriculturalResources: ["Rice", "Wheat", "Onion", "Millet"], solidMinerals: ["Limestone", "Gypsum"], otherOpportunities: ["Fisheries", "Irrigation"] },
  { state: "Kogi", agriculturalResources: ["Cassava", "Yam", "Cashew"], solidMinerals: ["Iron Ore", "Coal", "Limestone", "Marble"], otherOpportunities: ["Steel", "Cement", "River Transport"] },
  { state: "Kwara", agriculturalResources: ["Rice", "Cassava", "Sugarcane"], solidMinerals: ["Gold", "Marble", "Limestone"], otherOpportunities: ["Sugar", "Livestock"] },
  { state: "Lagos", agriculturalResources: ["Vegetables", "Coconut", "Fisheries"], solidMinerals: ["Clay", "Silica Sand"], otherOpportunities: ["Ports", "Finance", "ICT", "Manufacturing"] },
  { state: "Nasarawa", agriculturalResources: ["Sesame", "Rice", "Yam", "Cassava"], solidMinerals: ["Lithium", "Tin", "Columbite", "Barite"], otherOpportunities: ["Mining", "Agriculture"] },
  { state: "Niger", agriculturalResources: ["Rice", "Yam", "Maize", "Sugarcane"], solidMinerals: ["Gold", "Talc", "Iron Ore", "Limestone"], otherOpportunities: ["Hydropower", "Mining"] },
  { state: "Ogun", agriculturalResources: ["Cassava", "Maize", "Cocoa"], solidMinerals: ["Limestone", "Granite", "Silica Sand"], otherOpportunities: ["Cement", "Manufacturing"] },
  { state: "Ondo", agriculturalResources: ["Cocoa", "Oil Palm", "Rubber"], solidMinerals: ["Bitumen", "Limestone", "Granite"], otherOpportunities: ["Bitumen", "Forestry"] },
  { state: "Osun", agriculturalResources: ["Cocoa", "Cassava", "Yam"], solidMinerals: ["Gold", "Talc", "Granite"], otherOpportunities: ["Gold Mining"] },
  { state: "Oyo", agriculturalResources: ["Maize", "Cassava", "Cocoa", "Tomato"], solidMinerals: ["Marble", "Talc", "Granite"], otherOpportunities: ["Livestock", "Food Processing"] },
  { state: "Plateau", agriculturalResources: ["Potato", "Maize", "Vegetables"], solidMinerals: ["Tin", "Columbite", "Barite"], otherOpportunities: ["Tourism", "Horticulture"] },
  { state: "Rivers", agriculturalResources: ["Cassava", "Oil Palm", "Fisheries"], solidMinerals: ["Clay", "Silica Sand"], otherOpportunities: ["Oil & Gas", "Ports", "Petrochemicals"] },
  { state: "Sokoto", agriculturalResources: ["Millet", "Onion", "Livestock"], solidMinerals: ["Limestone", "Phosphate", "Gypsum"], otherOpportunities: ["Leather", "Cement"] },
  { state: "Taraba", agriculturalResources: ["Tea", "Coffee", "Rice", "Cassava"], solidMinerals: ["Barite", "Limestone", "Lead", "Zinc"], otherOpportunities: ["Hydropower", "Tourism"] },
  { state: "Yobe", agriculturalResources: ["Millet", "Sesame", "Wheat"], solidMinerals: ["Limestone", "Gypsum", "Kaolin"], otherOpportunities: ["Irrigation", "Livestock"] },
  { state: "Zamfara", agriculturalResources: ["Millet", "Sorghum", "Groundnut"], solidMinerals: ["Gold", "Lead", "Zinc", "Copper"], otherOpportunities: ["Mining", "Livestock"] },
  { state: "Federal Capital Territory", agriculturalResources: ["Maize", "Cassava", "Vegetables"], solidMinerals: ["Granite", "Clay", "Marble"], otherOpportunities: ["Real Estate", "Services", "Tourism"] },
];

const highPotentialStates = ["Ondo", "Kano", "Ogun", "Bayelsa", "Kogi", "Lagos", "Kaduna", "Nasarawa"];

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function themeForResource(resource: string) {
  const key = resource.toLowerCase();
  if (key.includes("fisheries")) return "Seafood Cluster";
  if (key.includes("oil palm") || key.includes("palm oil")) return "Oil Palm Processing Cluster";
  if (key.includes("tomato")) return "Tomato Processing Cluster";
  if (key.includes("rice")) return "Rice Processing Cluster";
  if (key.includes("cassava")) return "Cassava Processing Cluster";
  if (key.includes("cocoa")) return "Cocoa Cluster";
  if (key.includes("rubber")) return "Rubber Cluster";
  if (key.includes("ginger")) return "Ginger Processing Cluster";
  if (key.includes("cashew")) return "Cashew Processing Cluster";
  if (key.includes("cotton")) return "Cotton and Textile Cluster";
  if (key.includes("leather")) return "Leather Cluster";
  if (key.includes("textile")) return "Textile Cluster";
  if (key.includes("manufacturing")) return "Manufacturing Cluster";
  if (key.includes("ports") || key.includes("seaport") || key.includes("inland port") || key.includes("river transport")) return "Ports and Logistics Cluster";
  if (key.includes("blue economy") || key.includes("mangrove")) return "Blue Economy Cluster";
  if (key.includes("iron ore") || key.includes("steel")) return "Steel and Iron Ore Cluster";
  if (key.includes("limestone") || key.includes("cement")) return "Cement and Building Materials Cluster";
  if (key.includes("gold")) return "Gold Mining Cluster";
  if (key.includes("lithium")) return "Lithium Mining Cluster";
  if (key.includes("bitumen")) return "Bitumen Cluster";
  if (key.includes("coal")) return "Coal and Energy Materials Cluster";
  if (key.includes("tin") || key.includes("columbite")) return "Tin and Critical Minerals Cluster";
  if (key.includes("kaolin") || key.includes("clay") || key.includes("silica") || key.includes("glass sand")) return "Industrial Minerals Cluster";
  if (key.includes("livestock") || key.includes("cattle")) return "Livestock Value Chain Cluster";
  if (key.includes("food processing")) return "Food Processing Cluster";
  return `${resource} Cluster`;
}

function sectorForTheme(theme: string) {
  const key = theme.toLowerCase();
  if (key.includes("mining") || key.includes("bitumen") || key.includes("mineral") || key.includes("coal") || key.includes("steel")) return "Solid minerals";
  if (key.includes("leather")) return "Leather and light manufacturing";
  if (key.includes("textile")) return "Textiles and apparel";
  if (key.includes("ports") || key.includes("logistics")) return "Logistics and trade";
  if (key.includes("manufacturing") || key.includes("cement")) return "Manufacturing and construction materials";
  if (key.includes("blue economy") || key.includes("seafood")) return "Blue economy";
  return "Agro-processing";
}

function headlineFor(row: RawStateOpportunity) {
  const anchors = unique([
    ...row.agriculturalResources.slice(0, 2),
    row.solidMinerals[0],
    row.otherOpportunities[0],
  ]).slice(0, 4);
  return `${anchors.join(", ")}-led industrial production potential`;
}

function enrichOpportunity(row: RawStateOpportunity): StateClusterOpportunity {
  const suggestedClusterThemes = unique([
    ...row.agriculturalResources.slice(0, 4).map(themeForResource),
    ...row.otherOpportunities.slice(0, 3).map(themeForResource),
    ...row.solidMinerals.slice(0, 3).map(themeForResource),
  ]).slice(0, 9);

  return {
    ...row,
    suggestedClusterThemes,
    headlineOpportunity: headlineFor(row),
    prioritySectors: unique(suggestedClusterThemes.map(sectorForTheme)).slice(0, 5),
  };
}

export const stateClusterOpportunities = rawStateOpportunities.map(enrichOpportunity);

export const featuredStateClusterOpportunities = highPotentialStates
  .map((state) => stateClusterOpportunities.find((item) => item.state === state))
  .filter((item): item is StateClusterOpportunity => Boolean(item));

export const stateClusterOpportunityByState = new Map(stateClusterOpportunities.map((item) => [item.state, item]));

function categoryForTheme(state: StateClusterOpportunity, theme: string): ResourceCategory {
  const themeKey = theme.toLowerCase();
  if (state.agriculturalResources.some((item) => themeKey.includes(item.toLowerCase().split(" ")[0])) || themeKey.includes("food") || themeKey.includes("seafood")) return "Agriculture";
  if (state.solidMinerals.some((item) => themeKey.includes(item.toLowerCase().split(" ")[0])) || themeKey.includes("mining") || themeKey.includes("mineral") || themeKey.includes("steel") || themeKey.includes("bitumen")) return "Solid minerals";
  return "Other opportunities";
}

function resourceBaseForTheme(state: StateClusterOpportunity, theme: string) {
  const resources = [...state.agriculturalResources, ...state.solidMinerals, ...state.otherOpportunities];
  const themeKey = theme.toLowerCase();
  const matching = resources.filter((resource) => themeKey.includes(resource.toLowerCase().split(" ")[0]));
  return unique(matching.length ? matching : resources.slice(0, 4)).join(", ");
}

export function getClusterThemeOpportunities(limit?: number) {
  const themes = stateClusterOpportunities
    .flatMap((state) =>
      state.suggestedClusterThemes.slice(0, 7).map((theme) => ({
        id: `${slugify(state.state)}-${slugify(theme)}`,
        state: state.state,
        theme: `${state.state} ${theme}`,
        resourceBase: resourceBaseForTheme(state, theme),
        valueChainPotential: `Aggregation, processing, quality improvement and market access around ${resourceBaseForTheme(state, theme).toLowerCase()}.`,
        investorRelevance: "Indicative opportunity for processing infrastructure, shared services, offtake, logistics and patient capital.",
        msmeOpportunity: "MSMEs can participate through production, supply, processing, services, packaging, distribution and cluster support roles.",
        category: categoryForTheme(state, theme),
      })),
    );

  return typeof limit === "number" ? themes.slice(0, limit) : themes;
}

export function searchStateClusterOpportunities(query: string, selectedState?: string) {
  const normalized = query.trim().toLowerCase();
  const states = selectedState
    ? stateClusterOpportunities.filter((item) => item.state === selectedState)
    : stateClusterOpportunities;

  if (!normalized) return states;

  return states.filter((item) => {
    const searchable = [
      item.state,
      item.headlineOpportunity,
      ...item.agriculturalResources,
      ...item.solidMinerals,
      ...item.otherOpportunities,
      ...item.suggestedClusterThemes,
      ...item.prioritySectors,
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalized);
  });
}
