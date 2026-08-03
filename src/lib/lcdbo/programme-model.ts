export type LcdboClaimClassification =
  | "Source-backed programme ambition"
  | "Source-backed programme projection"
  | "Source-backed programme target"
  | "Source-backed programme framework"
  | "Reference geography"
  | "Requires institutional validation before launch";

export type LcdboAuthoritativeMeasure = {
  key: string;
  value: string;
  label: string;
  classification: LcdboClaimClassification;
  timeframe: string;
  source: "LCDBO MODEL IN NIGERIA.pdf" | "LCBDO KEY PROGRAMMES AND MILESTONES.docx";
  note: string;
};

export type LcdboProgrammePillar = {
  title: string;
  description: string;
};

export type LcdboMilestoneProgramme = {
  title: string;
  abbreviation: string;
  description: string;
};

export type LcdboImplementationPhase = {
  phase: string;
  title: string;
  timeframe: string;
  focus: string[];
  geography: string;
};

export type LcdboKpiTarget = {
  indicator: string;
  target: string;
  classification: LcdboClaimClassification;
};

export const lcdboAuthoritativeSourceSummary = {
  sources: ["LCDBO MODEL IN NIGERIA.pdf", "LCBDO KEY PROGRAMMES AND MILESTONES.docx"],
  sourceStatus: "User-approved LCDBO programme source material for public website integration.",
  governanceDisclosure:
    "Programme figures are presented as source-backed ambitions, projections, targets or reference geography. They are not live achieved results unless explicitly labelled as verified operational data.",
} as const;

export const lcdboAuthoritativeMeasures: LcdboAuthoritativeMeasure[] = [
  {
    key: "lga-industrial-development",
    value: "774",
    label: "LGAs in the national industrial-development pathway",
    classification: "Reference geography",
    timeframe: "National programme design scope",
    source: "LCDBO MODEL IN NIGERIA.pdf",
    note: "Frames the long-term ambition to organise industrial development across Nigeria's 774 LGAs.",
  },
  {
    key: "msmes-per-lga",
    value: "5,000",
    label: "MSMEs/businesses per LGA projection baseline",
    classification: "Source-backed programme projection",
    timeframe: "Five-year projection baseline",
    source: "LCDBO MODEL IN NIGERIA.pdf",
    note: "The source projection uses 5,000 businesses per LGA to model revenue and job potential; it is not an achieved count.",
  },
  {
    key: "investment-mobilisation-2030",
    value: "$100B",
    label: "investment mobilisation ambition by 2030",
    classification: "Source-backed programme ambition",
    timeframe: "By 2030",
    source: "LCBDO KEY PROGRAMMES AND MILESTONES.docx",
    note: "Presented as a mobilisation ambition across public, private, development-finance and investor channels.",
  },
  {
    key: "economy-pathway-2030",
    value: "$1T",
    label: "economy contribution pathway by 2030",
    classification: "Source-backed programme ambition",
    timeframe: "By 2030",
    source: "LCDBO MODEL IN NIGERIA.pdf",
    note: "LCDBO is positioned as a contribution pathway toward Nigeria's wider $1T economy objective.",
  },
  {
    key: "top-ten-economy-2035",
    value: "Top 10",
    label: "global economy ambition",
    classification: "Source-backed programme ambition",
    timeframe: "By 2035",
    source: "LCBDO KEY PROGRAMMES AND MILESTONES.docx",
    note: "A national ambition referenced in the LCDBO milestone source, not a guaranteed outcome.",
  },
  {
    key: "jobs-2030",
    value: "20M+",
    label: "job-creation ambition",
    classification: "Source-backed programme projection",
    timeframe: "By 2030",
    source: "LCDBO MODEL IN NIGERIA.pdf",
    note: "The source projects direct and indirect job potential; the website must not present this as jobs already created.",
  },
  {
    key: "formalisation-target",
    value: "20M",
    label: "MSMEs formalised target",
    classification: "Source-backed programme target",
    timeframe: "Five-year KPI framework",
    source: "LCDBO MODEL IN NIGERIA.pdf",
    note: "KPI target requiring formal institutional validation before production launch reporting.",
  },
];

export const lcdboProgrammePillars: LcdboProgrammePillar[] = [
  { title: "Industrial Cluster Development", description: "Develop coordinated production ecosystems across local raw-material and value-chain opportunities." },
  { title: "Enterprise Identification and Formalisation", description: "Bring MSMEs, associations and productive enterprises into trusted DBIN identity and participation records." },
  { title: "Research Commercialisation and Innovation", description: "Move R&D, inventions and raw-material knowledge into products, production capability and enterprise growth." },
  { title: "Infrastructure Enablement", description: "Coordinate industrial parks, power, water, logistics, research facilities, skills centres and broadband infrastructure." },
  { title: "Investment and Finance Mobilisation", description: "Build investable pipelines for equity, debt, guarantees, blended finance, development capital and private investment." },
  { title: "Skills and Entrepreneurship Development", description: "Connect youth, artisans, retirees, NYSC SAED pathways and enterprise training to production opportunities." },
  { title: "Market Access and Export Development", description: "Link cluster production to procurement, offtake, AfCFTA, export channels and non-oil market expansion." },
  { title: "Policy and Institutional Coordination", description: "Align federal, state, LGA, MDA, association and private-sector actors around accountable implementation." },
  { title: "Security, Community Protection and Operational Resilience", description: "Plan local protection, community participation and resilience measures for industrial hubs." },
  { title: "Digital Infrastructure and Programme Intelligence", description: "Use DBIN identity, workflow, reporting and intelligence layers to support governed delivery and transparency." },
];

export const lcdboMilestoneProgrammes: LcdboMilestoneProgramme[] = [
  {
    title: "Sustainable Economic and Industrial Development",
    abbreviation: "SEID",
    description: "Industrial development through 774 LGA-linked cluster pathways across non-oil sectors.",
  },
  {
    title: "Sustainable Security Architectural Development",
    abbreviation: "SSAD",
    description: "Security and community-protection architecture supporting industrial hubs and local resilience.",
  },
  {
    title: "Sustainable Infrastructural Development",
    abbreviation: "SID",
    description: "A coordinated infrastructure agenda for industrial zones, production ecosystems and enabling services.",
  },
  {
    title: "Transport and Road Infrastructural Development",
    abbreviation: "TRID",
    description: "Road, transport and logistics support for production, movement of goods and market access.",
  },
  {
    title: "Housing, Health and Education Infrastructural Development",
    abbreviation: "HHEID",
    description: "Social infrastructure connected to productive communities, workforce stability and cluster participation.",
  },
  {
    title: "Energy and Power Infrastructural Development",
    abbreviation: "EPID",
    description: "Power and energy infrastructure required for reliable local production and industrial processing.",
  },
  {
    title: "ICT and Broadband Infrastructural Development",
    abbreviation: "IBID",
    description: "Digital connectivity for identity, reporting, market access, skills delivery and programme intelligence.",
  },
];

export const lcdboImplementationPhases: LcdboImplementationPhase[] = [
  {
    phase: "Phase One",
    title: "Policy and Institutional Setup",
    timeframe: "3-6 months",
    focus: ["National policy approval", "Legal framework", "Stakeholder engagement", "Pilot industrial clusters", "Digital business registration", "Baseline assessment", "Entrepreneurship centre"],
    geography: "Across selected regions",
  },
  {
    phase: "Phase Two",
    title: "Infrastructure Development",
    timeframe: "Years 1-2",
    focus: ["Industrial parks", "Power supply", "Water systems", "Digital infrastructure", "Logistics hubs", "Research and skills centres", "Special infrastructure development"],
    geography: "Southwest, Northcentral and Southeast selected regions",
  },
  {
    phase: "Phase Three",
    title: "Commercial Scale-Up",
    timeframe: "Years 2-3",
    focus: ["Mass production", "Export promotion", "Financing expansion", "Technology deployment", "Private-sector investment", "International partnerships"],
    geography: "South-South, Northwest and Northeast selected regions",
  },
  {
    phase: "Phase Four",
    title: "Global Competitiveness",
    timeframe: "Years 4-5",
    focus: ["Increased exports", "Regional value chains", "Continental manufacturing leadership", "Innovation-driven industries", "Sustainable industrial growth"],
    geography: "Across all regions",
  },
];

export const lcdboPolicyAlignment = [
  "Commercialisation of R&D, results, inventions and innovations from STI",
  "National Industrial Policy 2025",
  "One LGA One Product / One Product One LGA",
  "Double Your Export",
  "3 Million Technical Talent",
  "NYSC SAED",
  "National Single Window",
  "Backward Integration",
  "Nigeria First",
  "One Youth Two Skills",
  "Special Agro-Industrial Processing Zones",
  "Skill Up Artisans",
] as const;

export const lcdboStrategicObjectives = [
  "Increase domestic value addition",
  "Reduce import dependency",
  "Develop industrial clusters across all 774 LGAs",
  "Promote MSME commercialisation",
  "Increase Nigerian participation in strategic industries",
  "Enhance export competitiveness",
  "Create sustainable employment",
  "Improve technology transfer",
  "Expand digital formalisation",
  "Increase tax and revenue",
] as const;

export const lcdboInstitutionalFramework = [
  { actor: "Federal Government", contribution: "Policy formulation, regulation, national funding and infrastructure investment." },
  { actor: "State Governments", contribution: "Industrial land, equity contribution, local infrastructure, investment promotion and skills development." },
  { actor: "Local Governments", contribution: "Community mobilisation, cluster management, local market development and equity contribution." },
  { actor: "Private Sector", contribution: "Investment, manufacturing, technology and market expansion." },
  { actor: "Financial Institutions", contribution: "Credit, guarantees, working capital and investment financing." },
  { actor: "Development Partners", contribution: "Technical assistance, capacity building, grants and innovation support." },
  { actor: "Academic and Research Institutions", contribution: "Research, product development, skills training and technology transfer." },
  { actor: "Host Communities", contribution: "Community participation, local support and protection of project assets and hubs." },
] as const;

export const lcdboKeyDrivers = [
  "Federal Government leadership and presidential-level support framework",
  "Federal Ministry of Innovation, Science and Technology",
  "Federal Ministry of Industry, Trade and Investment",
  "Raw Materials Research and Development Council",
  "Roseate Forte Nigeria Limited / LCDBO team",
  "ARISE Integrated Industrial Platforms",
] as const;

export const lcdboStrategicPartnerGroups = [
  "Nigerian Society of Engineers",
  "NCGC",
  "Relevant MDAs",
  "36 states and FCT",
  "774 LGAs",
  "ALGON",
  "Nigeria Governors' Forum",
  "Six Regional Development Commissions",
  "NYSC",
  "Bank of Industry",
  "African Development Bank Group",
  "Islamic Development Bank Group",
  "Other Multinational Development Banks",
  "Foreign embassies and international business communities",
  "NASSI, organised private sector and BMOs",
  "Host communities",
  "Security institutions and authorised protection networks",
  "Local and global investors",
] as const;

export const lcdboInvestmentPipelines = [
  "LCDBO model and Special Industrial Clusters Investment Programme",
  "Economic and industrial reforms",
  "Infrastructure development",
  "Public-private partnerships",
  "Lands and raw materials",
  "Human capital",
  "Credit guarantees",
  "Pre-feasibility and EIA preparation",
  "Feasibility reports",
  "Master planning",
] as const;

export const lcdboInvestmentSources = [
  "Available funds and equity contributions from governments, states, LGAs, associations and businesses",
  "Blended finance, grants, venture capital and angel investment",
  "Global development institution contributions",
  "OEM investment and capital goods",
  "Equity contributions from investors and backers",
  "Crowdfunding and social capital",
  "Skill outsourcing, innovation and technology transfer",
  "Bonds, mutual funds, stocks and pension funds",
  "Cash in advance and forward buying",
  "Intellectual property and royalties",
] as const;

export const lcdboKpiFramework: LcdboKpiTarget[] = [
  { indicator: "Industrial Clusters", target: "774", classification: "Source-backed programme target" },
  { indicator: "MSMEs Formalized", target: "20 million", classification: "Source-backed programme target" },
  { indicator: "Jobs Created", target: "40 million", classification: "Source-backed programme target" },
  { indicator: "Youth Trained", target: "10 million", classification: "Source-backed programme target" },
  { indicator: "Local Content Utilization", target: "80%", classification: "Source-backed programme target" },
  { indicator: "Non-Oil Export Growth", target: "+60%", classification: "Source-backed programme target" },
  { indicator: "Digital Business IDs Issued", target: "20 million", classification: "Source-backed programme target" },
  { indicator: "Manufacturing Contribution to GDP", target: "+40 percentage points", classification: "Source-backed programme target" },
  { indicator: "Annual Private Investment Mobilized", target: "$20 billion", classification: "Source-backed programme target" },
  { indicator: "Increase in Government Revenue", target: "+60%", classification: "Source-backed programme target" },
];
