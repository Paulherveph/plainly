import type { AnalysisDraft, OutputLocale } from "../domain/analysis";

type Fixture = {
  marker: string;
  summary: Record<OutputLocale, string>;
  draft: Omit<AnalysisDraft, "summary">;
};

/** Deterministic outputs for the three samples. Quotes are verbatim from /samples/*.pdf. */
export const FIXTURES: Fixture[] = [
  {
    marker: "14 Rue des Lilas",
    summary: {
      en: "This is a 12-month lease for an apartment in Lyon starting 1 December 2026. You pay €850 rent plus €60 charges each month, and a €1,700 deposit by 20 November. It renews on its own every year unless you send three months' notice by registered letter.",
      fr: "Il s'agit d'un bail de 12 mois pour un appartement à Lyon, à partir du 1er décembre 2026. Vous payez 850 € de loyer et 60 € de charges par mois, plus un dépôt de 1 700 € avant le 20 novembre. Il se renouvelle chaque année sauf préavis de trois mois par lettre recommandée.",
      zh: "这是一份里昂公寓的 12 个月租约，从 2026 年 12 月 1 日开始。每月租金 850 欧元加 60 欧元杂费，押金 1,700 欧元须在 11 月 20 日前支付。除非你提前三个月用挂号信通知，否则租约每年自动续期。",
    },
    draft: {
      documentType: "Lease",
      language: "en",
      keyFacts: [
        {
          label: "Monthly rent",
          value: "€850 + €60 charges",
          cite: {
            page: 1,
            quote: "The monthly rent is €850, payable on or before the 5th day of each month",
          },
        },
        {
          label: "Deposit",
          value: "€1,700",
          cite: { page: 1, quote: "security deposit of €1,700 no later than 20 November 2026" },
        },
        {
          label: "Start date",
          value: "1 December 2026",
          cite: { page: 1, quote: "The lease begins on 1 December 2026" },
        },
        {
          label: "Length",
          value: "12 months, renews automatically",
          cite: { page: 3, quote: "This lease renews automatically for successive twelve-month periods" },
        },
        {
          label: "Landlord",
          value: "Marc Petit",
          cite: { page: 1, quote: "between Marc Petit (the Landlord) and Amina Diallo (the Tenant)" },
        },
        // Invented on purpose: verification must drop it.
        {
          label: "Parking",
          value: "One space included",
          cite: { page: 2, quote: "One parking space is included in the rent" },
        },
      ],
      actions: [
        {
          title: "Sign and return the lease",
          detail: "Send the signed agreement back to the landlord.",
          dueOn: "2026-11-05",
          cite: { page: 1, quote: "The Tenant must sign and return this agreement by 5 November 2026" },
        },
        {
          title: "Pay the security deposit",
          detail: "€1,700 by bank transfer.",
          dueOn: "2026-11-20",
          cite: { page: 1, quote: "security deposit of €1,700 no later than 20 November 2026" },
        },
        {
          title: "Send proof of home insurance",
          detail: "A certificate from your insurer, before you move in.",
          dueOn: "2026-12-01",
          cite: { page: 2, quote: "provide a certificate of home insurance before 1 December 2026" },
        },
        {
          title: "Pay rent every month",
          detail: "€850 by the 5th of each month.",
          dueOn: null,
          cite: { page: 1, quote: "payable on or before the 5th day of each month by bank transfer" },
        },
      ],
      watchOuts: [
        {
          severity: "critical",
          title: "It renews automatically",
          explanation:
            "To leave, send notice by registered letter at least three months before the end date. Otherwise you are committed for another year.",
          cite: {
            page: 3,
            quote: "The Tenant must give three months' written notice by registered letter to end the lease",
          },
        },
        {
          severity: "caution",
          title: "10% late fee",
          explanation: "Paying more than five days late adds €85 to that month.",
          cite: { page: 2, quote: "incurs a late fee of 10% of the monthly rent" },
        },
        {
          severity: "caution",
          title: "Small repairs are on you",
          explanation: "Anything under €150 to fix is yours to pay.",
          cite: {
            page: 2,
            quote: "Minor repairs costing less than €150 are the responsibility of the Tenant",
          },
        },
        {
          severity: "info",
          title: "Landlord visits",
          explanation: "The landlord can come in with 24 hours' notice.",
          cite: { page: 2, quote: "with at least 24 hours' notice for inspection or repairs" },
        },
      ],
      glossary: [
        {
          term: "Security deposit",
          plain: "Money you pay upfront. You get it back at the end if there's no damage or unpaid rent.",
        },
        { term: "Registered letter", plain: "A tracked letter with proof of delivery (lettre recommandée)." },
        {
          term: "Jointly and severally liable",
          plain:
            "If you share the flat, each person can be asked to pay the full rent, not just their share.",
        },
      ],
    },
  },
  {
    marker: "2026/RP/48213",
    summary: {
      en: "Your residence permit ends on 15 January 2027. To renew it, book an appointment and apply by 15 December 2026, pay a €225 fee online, and bring your passport, permit, photos, proof of address and enrolment certificate.",
      fr: "Votre titre de séjour expire le 15 janvier 2027. Pour le renouveler, prenez rendez-vous et déposez votre demande avant le 15 décembre 2026, payez 225 € en ligne et apportez passeport, titre actuel, photos, justificatif de domicile et certificat de scolarité.",
      zh: "你的居留许可将于 2027 年 1 月 15 日到期。续签需在 2026 年 12 月 15 日前预约并提交申请，在线支付 225 欧元，并携带护照、现有居留卡、照片、地址证明和在读证明。",
    },
    draft: {
      documentType: "Visa notice",
      language: "en",
      keyFacts: [
        {
          label: "Permit expires",
          value: "15 January 2027",
          cite: { page: 1, quote: "Your current residence permit expires on 15 January 2027" },
        },
        {
          label: "Apply by",
          value: "15 December 2026",
          cite: { page: 1, quote: "submit your application no later than 15 December 2026" },
        },
        {
          label: "Fee",
          value: "€225, paid online",
          cite: { page: 1, quote: "A stamp duty of €225 is payable online" },
        },
      ],
      actions: [
        {
          title: "Book an appointment and apply",
          detail: "Online, before the deadline.",
          dueOn: "2026-12-15",
          cite: { page: 1, quote: "submit your application no later than 15 December 2026" },
        },
        {
          title: "Gather your documents",
          detail:
            "Passport, permit, 3 photos, proof of address, enrolment certificate. Originals and copies.",
          dueOn: null,
          cite: {
            page: 2,
            quote:
              "Bring the original and one copy of: your passport, your current permit, three recent photographs",
          },
        },
      ],
      watchOuts: [
        {
          severity: "critical",
          title: "Incomplete files are returned",
          explanation: "One missing document and your file is sent back unread.",
          cite: { page: 2, quote: "Incomplete files will be returned without examination" },
        },
        {
          severity: "caution",
          title: "Late applications may not be ready in time",
          explanation: "Applying after 15 December could leave you without a valid permit.",
          cite: { page: 1, quote: "may not be processed before the expiry of your permit" },
        },
      ],
      glossary: [
        {
          term: "Stamp duty",
          plain: "An official fee, here paid online as an electronic stamp (timbre fiscal).",
        },
        { term: "Prefecture", plain: "The local government office that handles residence permits." },
      ],
    },
  },
  {
    marker: "Nordlys",
    summary: {
      en: "Nordlys offers you a full-time Product Designer job starting 4 January 2027, at €48,000 gross a year. You must sign by 25 November 2026. There's a four-month trial period that can be extended once, and a 12-month non-compete after you leave.",
      fr: "Nordlys vous propose un poste de Product Designer à temps plein à partir du 4 janvier 2027, pour 48 000 € bruts par an. Signez avant le 25 novembre 2026. Période d'essai de quatre mois renouvelable une fois, et clause de non-concurrence de 12 mois.",
      zh: "Nordlys 为你提供全职产品设计师职位，2027 年 1 月 4 日入职，年薪税前 48,000 欧元。须在 2026 年 11 月 25 日前签字。试用期四个月，可延长一次；离职后有 12 个月竞业限制。",
    },
    draft: {
      documentType: "Job offer",
      language: "en",
      keyFacts: [
        {
          label: "Salary",
          value: "€48,000 gross / year",
          cite: { page: 1, quote: "Your gross annual salary will be €48,000" },
        },
        {
          label: "Start date",
          value: "4 January 2027",
          cite: { page: 1, quote: "Your start date will be 4 January 2027" },
        },
        {
          label: "Hours",
          value: "35 h / week, 2 remote days",
          cite: { page: 1, quote: "The position is full-time, 35 hours per week" },
        },
        {
          label: "Paid leave",
          value: "25 days / year",
          cite: { page: 2, quote: "25 working days of paid leave per year" },
        },
      ],
      actions: [
        {
          title: "Sign and return the offer",
          detail: "The offer lapses after this date.",
          dueOn: "2026-11-25",
          cite: { page: 1, quote: "This offer is valid until 25 November 2026" },
        },
        {
          title: "First day at work",
          detail: "Full-time from this date.",
          dueOn: "2027-01-04",
          cite: { page: 1, quote: "Your start date will be 4 January 2027" },
        },
      ],
      watchOuts: [
        {
          severity: "critical",
          title: "12-month non-compete",
          explanation: "After leaving, you can't join a direct competitor in France for a year.",
          cite: {
            page: 2,
            quote: "For twelve months after leaving, you may not work for a direct competitor within France",
          },
        },
        {
          severity: "caution",
          title: "Trial period can double",
          explanation: "Four months, renewable once, so up to eight months.",
          cite: { page: 1, quote: "a trial period of four months, renewable once" },
        },
      ],
      glossary: [
        { term: "Gross salary", plain: "Pay before social charges and income tax are taken out." },
        { term: "Trial period", plain: "A first phase where either side can end the contract quickly." },
        { term: "Non-compete", plain: "A promise not to work for competitors for a time after you leave." },
      ],
    },
  },
];
