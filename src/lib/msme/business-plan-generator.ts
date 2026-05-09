export type BusinessPlanPurpose = "loan_application" | "grant_application" | "investor_pitch" | "internal_planning";

export type BusinessPlanAnswers = Record<string, string>;

export type BusinessPlanSection = {
  title: string;
  body: string[];
};

export type GeneratedBusinessPlan = {
  title: string;
  purpose: BusinessPlanPurpose;
  generatedAt: string;
  businessName: string;
  msmeId: string;
  sections: BusinessPlanSection[];
};

export const BUSINESS_PLAN_DISCLAIMER =
  "This business plan was generated based on information supplied by the business owner and should be reviewed before submission to financial institutions or investors.";

const missing = "Not provided by business owner.";

function answer(answers: BusinessPlanAnswers, key: string) {
  const value = answers[key]?.trim();
  return value && value.length > 0 ? value : missing;
}

function sentence(label: string, value: string) {
  return `${label}: ${value}`;
}

function listLine(values: string[]) {
  return values.filter(Boolean).join(" ");
}

function purposeLabel(purpose: BusinessPlanPurpose) {
  const labels: Record<BusinessPlanPurpose, string> = {
    loan_application: "Loan Application",
    grant_application: "Grant Application",
    investor_pitch: "Investor Pitch",
    internal_planning: "Internal Planning",
  };
  return labels[purpose];
}

export function businessPlanToText(plan: GeneratedBusinessPlan) {
  const parts = [
    plan.title,
    `Purpose: ${purposeLabel(plan.purpose)}`,
    `Business: ${plan.businessName}`,
    `DBIN/MSME ID: ${plan.msmeId}`,
    `Generated: ${new Date(plan.generatedAt).toLocaleString("en-NG")}`,
    "",
  ];

  for (const section of plan.sections) {
    parts.push(section.title.toUpperCase());
    parts.push(...section.body);
    parts.push("");
  }

  return parts.join("\n");
}

export function generateBusinessPlan({
  answers,
  businessName,
  msmeId,
  purpose,
  generatedAt = new Date().toISOString(),
}: {
  answers: BusinessPlanAnswers;
  businessName: string;
  msmeId: string;
  purpose: BusinessPlanPurpose;
  generatedAt?: string;
}): GeneratedBusinessPlan {
  const planBusinessName = businessName || answer(answers, "registeredBusinessName");
  const owner = answer(answers, "ownerName");
  const sector = answer(answers, "sector");
  const location = answer(answers, "location");
  const registration = answer(answers, "registrationStatus");
  const products = answer(answers, "products");
  const problem = answer(answers, "customerProblem");
  const solution = answer(answers, "solution");
  const customers = answer(answers, "targetCustomers");
  const marketSize = answer(answers, "marketOpportunity");
  const competitors = answer(answers, "competitors");
  const advantage = answer(answers, "competitiveAdvantage");
  const operations = answer(answers, "operationsModel");
  const suppliers = answer(answers, "suppliers");
  const logistics = answer(answers, "logistics");
  const salesChannels = answer(answers, "salesChannels");
  const marketing = answer(answers, "marketingApproach");
  const team = answer(answers, "teamStructure");
  const staffCount = answer(answers, "staffCount");
  const dailySales = answer(answers, "dailySales");
  const monthlySales = answer(answers, "monthlySales");
  const costs = answer(answers, "monthlyCosts");
  const fundingAmount = answer(answers, "fundingAmount");
  const fundingUse = answer(answers, "fundingUse");
  const repayment = answer(answers, "repaymentPlan");
  const risks = answer(answers, "risks");
  const mitigation = answer(answers, "mitigation");
  const actionPlan = answer(answers, "ninetyDayPlan");

  return {
    title: "DBIN Business Plan",
    purpose,
    generatedAt,
    businessName: planBusinessName,
    msmeId,
    sections: [
      {
        title: "Cover Page",
        body: [
          `${planBusinessName} Business Plan`,
          sentence("Prepared for", purposeLabel(purpose)),
          sentence("Business owner or lead", owner),
          sentence("DBIN/MSME ID", msmeId || missing),
          sentence("Generated timestamp", new Date(generatedAt).toLocaleString("en-NG")),
        ],
      },
      {
        title: "Executive Summary",
        body: [
          listLine([
            `${planBusinessName} is a Nigerian MSME operating in the ${sector} sector.`,
            `The business is located in ${location}.`,
            `Its current registration position is: ${registration}`,
          ]),
          `The plan is prepared for ${purposeLabel(purpose).toLowerCase()} and summarizes the business model, market opportunity, operating plan, financial assumptions, funding needs, risks, and the next 90 days of execution.`,
        ],
      },
      {
        title: "Business Description",
        body: [
          sentence("Business name", planBusinessName),
          sentence("Owner or principal contact", owner),
          sentence("Sector", sector),
          sentence("Location served", location),
          sentence("Registration status", registration),
          sentence("Expansion plan", answer(answers, "expansionPlans")),
        ],
      },
      {
        title: "Problem and Solution",
        body: [
          sentence("Customer problem", problem),
          sentence("Business solution", solution),
        ],
      },
      {
        title: "Products and Services",
        body: [
          sentence("Main products or services", products),
          sentence("Pricing approach", answer(answers, "pricing")),
          sentence("Quality or compliance approach", answer(answers, "qualityControls")),
        ],
      },
      {
        title: "Market Opportunity",
        body: [
          sentence("Target customers", customers),
          sentence("Market opportunity", marketSize),
          sentence("Customer acquisition pattern", answer(answers, "customerAcquisition")),
        ],
      },
      {
        title: "Competitor Analysis",
        body: [
          sentence("Known competitors", competitors),
          sentence("Business advantage", advantage),
          sentence("How customers compare options", answer(answers, "customerDecisionFactors")),
        ],
      },
      {
        title: "Marketing and Sales Strategy",
        body: [
          sentence("Sales channels", salesChannels),
          sentence("Marketing approach", marketing),
          sentence("Monthly sales pattern", monthlySales),
        ],
      },
      {
        title: "Operations Plan",
        body: [
          sentence("Operating model", operations),
          sentence("Supplier structure", suppliers),
          sentence("Logistics and distribution", logistics),
          sentence("Current operational challenges", answer(answers, "operationalChallenges")),
        ],
      },
      {
        title: "Management and Team",
        body: [
          sentence("Management structure", team),
          sentence("Staff count", staffCount),
          sentence("Key skills or support needed", answer(answers, "skillsNeeded")),
        ],
      },
      {
        title: "Financial Assumptions",
        body: [
          sentence("Reported daily sales", dailySales),
          sentence("Reported monthly sales", monthlySales),
          sentence("Reported monthly operating costs", costs),
          sentence("Record keeping approach", answer(answers, "recordKeeping")),
          "The figures above are reported by the business owner. No financial figures have been estimated or fabricated by DBIN.",
        ],
      },
      {
        title: "Funding Request",
        body: [
          sentence("Funding amount requested or gap", fundingAmount),
          sentence("Proposed use of funds", fundingUse),
          sentence("Repayment or sustainability plan", repayment),
        ],
      },
      {
        title: "Risk Analysis",
        body: [
          sentence("Key risks", risks),
          sentence("Mitigation approach", mitigation),
        ],
      },
      {
        title: "90-Day Action Plan",
        body: [
          actionPlan,
          sentence("Priority support required", answer(answers, "prioritySupport")),
        ],
      },
      {
        title: "Disclaimer",
        body: [BUSINESS_PLAN_DISCLAIMER],
      },
    ],
  };
}
