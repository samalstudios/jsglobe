import { progressive, capped, taperedAllowance, summarise } from './tax.js';

const YEAR = 2025;

const pensionRelief = (gross, percent) => Math.max(0, Math.min(1, (percent ?? 0) / 100)) * gross;

const UK_STUDENT = {
  none: { rate: 0, over: Infinity },
  plan1: { rate: 0.09, over: 26065 },
  plan2: { rate: 0.09, over: 28470 },
  plan4: { rate: 0.09, over: 32745 },
  plan5: { rate: 0.09, over: 25000 },
  postgrad: { rate: 0.06, over: 21000 },
};

const uk = {
  id: 'uk',
  name: 'United Kingdom',
  currency: 'GBP',
  year: '2025/26',
  notes: [
    'Employment income under PAYE, with the standard personal allowance.',
    'National Insurance is class 1 at the employee rate.',
    'Leaves out tax credits, benefits, salary sacrifice and the marriage allowance.',
  ],
  fields: [
    { key: 'region', label: 'Where you live', type: 'select', default: 'rest',
      options: [{ value: 'rest', label: 'England, Wales or Northern Ireland' }, { value: 'scotland', label: 'Scotland' }] },
    { key: 'pension', label: 'Pension contribution', type: 'percent', default: 0, hint: 'Percent of gross, taken before tax' },
    { key: 'student', label: 'Student loan', type: 'select', default: 'none',
      options: [
        { value: 'none', label: 'None' }, { value: 'plan1', label: 'Plan 1' }, { value: 'plan2', label: 'Plan 2' },
        { value: 'plan4', label: 'Plan 4 (Scotland)' }, { value: 'plan5', label: 'Plan 5' }, { value: 'postgrad', label: 'Postgraduate' },
      ] },
  ],
  compute({ gross, region = 'rest', pension = 0, student = 'none' }) {
    const contributions = pensionRelief(gross, pension);
    const forTax = gross - contributions;
    const allowance = taperedAllowance(12570, forTax, 100000);
    const taxable = Math.max(0, forTax - allowance);

    const topStarts = 125140 - allowance;
    const bands = region === 'scotland'
      ? [
          { upTo: 2306, rate: 0.19 },
          { upTo: 13991, rate: 0.2 },
          { upTo: 31092, rate: 0.21 },
          { upTo: 62430, rate: 0.42 },
          { upTo: topStarts, rate: 0.45 },
          { rate: 0.48 },
        ]
      : [{ upTo: 37700, rate: 0.2 }, { upTo: topStarts, rate: 0.4 }, { rate: 0.45 }];

    const incomeTax = progressive(taxable, bands);
    const nationalInsurance = capped(gross, 0.08, 50270, 12570) + capped(gross, 0.02, Infinity, 50270);
    const plan = UK_STUDENT[student] ?? UK_STUDENT.none;
    const loan = Math.max(0, gross - plan.over) * plan.rate;

    return summarise(gross, [
      { label: 'Income tax', amount: incomeTax, kind: 'tax' },
      { label: 'National Insurance', amount: nationalInsurance, kind: 'social' },
      { label: 'Student loan', amount: loan, kind: 'other' },
      { label: 'Pension', amount: contributions, kind: 'other' },
    ]);
  },
};

const US_FEDERAL = {
  single: {
    deduction: 15000,
    bands: [
      { upTo: 11925, rate: 0.1 }, { upTo: 48475, rate: 0.12 }, { upTo: 103350, rate: 0.22 },
      { upTo: 197300, rate: 0.24 }, { upTo: 250525, rate: 0.32 }, { upTo: 626350, rate: 0.35 }, { rate: 0.37 },
    ],
    medicareOver: 200000,
  },
  joint: {
    deduction: 30000,
    bands: [
      { upTo: 23850, rate: 0.1 }, { upTo: 96950, rate: 0.12 }, { upTo: 206700, rate: 0.22 },
      { upTo: 394600, rate: 0.24 }, { upTo: 501050, rate: 0.32 }, { upTo: 751600, rate: 0.35 }, { rate: 0.37 },
    ],
    medicareOver: 250000,
  },
  head: {
    deduction: 22500,
    bands: [
      { upTo: 17000, rate: 0.1 }, { upTo: 64850, rate: 0.12 }, { upTo: 103350, rate: 0.22 },
      { upTo: 197300, rate: 0.24 }, { upTo: 250500, rate: 0.32 }, { upTo: 626350, rate: 0.35 }, { rate: 0.37 },
    ],
    medicareOver: 200000,
  },
};

const US_STATES = {
  none: { label: 'No state income tax', rate: 0 },
  az: { label: 'Arizona', rate: 0.025 },
  co: { label: 'Colorado', rate: 0.044 },
  il: { label: 'Illinois', rate: 0.0495 },
  in: { label: 'Indiana', rate: 0.03 },
  ky: { label: 'Kentucky', rate: 0.04 },
  ma: { label: 'Massachusetts', rate: 0.05 },
  mi: { label: 'Michigan', rate: 0.0425 },
  nc: { label: 'North Carolina', rate: 0.0425 },
  pa: { label: 'Pennsylvania', rate: 0.0307 },
  ut: { label: 'Utah', rate: 0.0455 },
};

const usa = {
  id: 'us',
  name: 'United States',
  currency: 'USD',
  year: YEAR,
  notes: [
    'Federal income tax on wages with the standard deduction, plus FICA.',
    'States shown are the ones with a single flat rate, or none at all.',
    'Leaves out credits, itemised deductions, local taxes and pre-tax benefits.',
  ],
  fields: [
    { key: 'status', label: 'Filing status', type: 'select', default: 'single',
      options: [{ value: 'single', label: 'Single' }, { value: 'joint', label: 'Married filing jointly' }, { value: 'head', label: 'Head of household' }] },
    { key: 'state', label: 'State', type: 'select', default: 'none',
      options: Object.entries(US_STATES).map(([value, entry]) => ({ value, label: entry.label })) },
    { key: 'retirement', label: '401(k) contribution', type: 'percent', default: 0, hint: 'Percent of pay, before federal tax' },
  ],
  compute({ gross, status = 'single', state = 'none', retirement = 0 }) {
    const plan = US_FEDERAL[status] ?? US_FEDERAL.single;
    const deferred = pensionRelief(gross, retirement);
    const forTax = Math.max(0, gross - deferred - plan.deduction);
    const federal = progressive(forTax, plan.bands);

    const socialSecurity = capped(gross, 0.062, 176100);
    const medicare = gross * 0.0145 + Math.max(0, gross - plan.medicareOver) * 0.009;
    const stateRate = (US_STATES[state] ?? US_STATES.none).rate;
    const stateTax = Math.max(0, gross - deferred) * stateRate;

    return summarise(gross, [
      { label: 'Federal income tax', amount: federal, kind: 'tax' },
      { label: 'State income tax', amount: stateTax, kind: 'tax' },
      { label: 'Social Security', amount: socialSecurity, kind: 'social' },
      { label: 'Medicare', amount: medicare, kind: 'social' },
      { label: '401(k)', amount: deferred, kind: 'other' },
    ]);
  },
};

const CA_PROVINCES = {
  on: { label: 'Ontario', bands: [{ upTo: 52886, rate: 0.0505 }, { upTo: 105775, rate: 0.0915 }, { upTo: 150000, rate: 0.1116 }, { upTo: 220000, rate: 0.1216 }, { rate: 0.1316 }], credit: 12747 },
  bc: { label: 'British Columbia', bands: [{ upTo: 49279, rate: 0.0506 }, { upTo: 98560, rate: 0.077 }, { upTo: 113158, rate: 0.105 }, { upTo: 137407, rate: 0.1229 }, { upTo: 186306, rate: 0.147 }, { upTo: 259829, rate: 0.168 }, { rate: 0.205 }], credit: 12932 },
  ab: { label: 'Alberta', bands: [{ upTo: 60000, rate: 0.08 }, { upTo: 151234, rate: 0.1 }, { upTo: 181481, rate: 0.12 }, { upTo: 241974, rate: 0.13 }, { upTo: 362961, rate: 0.14 }, { rate: 0.15 }], credit: 22323 },
  qc: { label: 'Quebec', bands: [{ upTo: 53255, rate: 0.14 }, { upTo: 106495, rate: 0.19 }, { upTo: 129590, rate: 0.24 }, { rate: 0.2575 }], credit: 18571 },
  mb: { label: 'Manitoba', bands: [{ upTo: 47564, rate: 0.108 }, { upTo: 101200, rate: 0.1275 }, { rate: 0.174 }], credit: 15780 },
  sk: { label: 'Saskatchewan', bands: [{ upTo: 53463, rate: 0.105 }, { upTo: 152750, rate: 0.125 }, { rate: 0.145 }], credit: 18991 },
  ns: { label: 'Nova Scotia', bands: [{ upTo: 30507, rate: 0.0879 }, { upTo: 61015, rate: 0.1495 }, { upTo: 95883, rate: 0.1667 }, { upTo: 154650, rate: 0.175 }, { rate: 0.21 }], credit: 11744 },
  nb: { label: 'New Brunswick', bands: [{ upTo: 51306, rate: 0.094 }, { upTo: 102614, rate: 0.14 }, { upTo: 190060, rate: 0.16 }, { rate: 0.195 }], credit: 13396 },
};

const canada = {
  id: 'ca',
  name: 'Canada',
  currency: 'CAD',
  year: YEAR,
  notes: [
    'Federal and provincial tax on employment income, with the basic personal amounts.',
    'CPP and EI are at the employee rate. Quebec uses QPP and its own parental plan.',
    'Leaves out other credits, RRSP room carried forward and the Quebec abatement.',
  ],
  fields: [
    { key: 'province', label: 'Province', type: 'select', default: 'on',
      options: Object.entries(CA_PROVINCES).map(([value, entry]) => ({ value, label: entry.label })) },
    { key: 'rrsp', label: 'RRSP contribution', type: 'percent', default: 0, hint: 'Percent of pay, deducted before tax' },
  ],
  compute({ gross, province = 'on', rrsp = 0 }) {
    const home = CA_PROVINCES[province] ?? CA_PROVINCES.on;
    const contributions = pensionRelief(gross, rrsp);
    const forTax = Math.max(0, gross - contributions);

    const federalBands = [
      { upTo: 57375, rate: 0.15 }, { upTo: 114750, rate: 0.205 }, { upTo: 177882, rate: 0.26 },
      { upTo: 253414, rate: 0.29 }, { rate: 0.33 },
    ];
    const federalCredit = 16129;
    const federal = Math.max(0, progressive(forTax, federalBands) - federalCredit * 0.15);
    const provincial = Math.max(0, progressive(forTax, home.bands) - home.credit * home.bands[0].rate);

    const quebec = province === 'qc';
    const pensionPlan = capped(gross, quebec ? 0.064 : 0.0595, 71300, 3500) + capped(gross, 0.04, 81200, 71300);
    const insurance = quebec ? capped(gross, 0.0131, 65700) : capped(gross, 0.0164, 65700);
    const parental = quebec ? capped(gross, 0.00494, 98000) : 0;

    return summarise(gross, [
      { label: 'Federal tax', amount: federal, kind: 'tax' },
      { label: `${home.label} tax`, amount: provincial, kind: 'tax' },
      { label: quebec ? 'QPP' : 'CPP', amount: pensionPlan, kind: 'social' },
      { label: 'Employment insurance', amount: insurance, kind: 'social' },
      { label: 'Parental insurance', amount: parental, kind: 'social' },
      { label: 'RRSP', amount: contributions, kind: 'other' },
    ]);
  },
};


const germanBase = (income) => {
  const x = Math.floor(income);
  if (x <= 12096) return 0;
  if (x <= 17443) {
    const y = (x - 12096) / 10000;
    return (932.3 * y + 1400) * y;
  }
  if (x <= 68480) {
    const z = (x - 17443) / 10000;
    return (176.64 * z + 2397) * z + 1015.13;
  }
  if (x <= 277825) return 0.42 * x - 10911.92;
  return 0.45 * x - 19246.67;
};

const GERMAN_STATES = {
  bw: { label: 'Baden-Wurttemberg', church: 0.08 },
  by: { label: 'Bavaria', church: 0.08 },
  be: { label: 'Berlin', church: 0.09 },
  bb: { label: 'Brandenburg', church: 0.09 },
  hb: { label: 'Bremen', church: 0.09 },
  hh: { label: 'Hamburg', church: 0.09 },
  he: { label: 'Hesse', church: 0.09 },
  mv: { label: 'Mecklenburg-Vorpommern', church: 0.09 },
  ni: { label: 'Lower Saxony', church: 0.09 },
  nw: { label: 'North Rhine-Westphalia', church: 0.09 },
  rp: { label: 'Rhineland-Palatinate', church: 0.09 },
  sl: { label: 'Saarland', church: 0.09 },
  sn: { label: 'Saxony', church: 0.09, careShift: 0.005 },
  st: { label: 'Saxony-Anhalt', church: 0.09 },
  sh: { label: 'Schleswig-Holstein', church: 0.09 },
  th: { label: 'Thuringia', church: 0.09 },
};

const PENSION_CEILING = 96600;
const HEALTH_CEILING = 66150;

const germanTarif = (income) => {
  const x = Math.floor(Math.max(0, income));
  if (x <= 12096) return 0;
  if (x <= 17443) {
    const y = (x - 12096) / 10000;
    return (932.3 * y + 1400) * y;
  }
  if (x <= 68480) {
    const z = (x - 17443) / 10000;
    return (176.64 * z + 2397) * z + 1015.13;
  }
  if (x <= 277825) return 0.42 * x - 10911.92;
  return 0.45 * x - 19246.67;
};

const germanClassTax = (zvE, taxClass) => {
  if (taxClass === 'three') return 2 * germanTarif(zvE / 2);
  if (taxClass === 'five' || taxClass === 'six') {
    const upper = germanTarif(zvE * 1.25);
    const lower = germanTarif(zvE * 0.75);
    return Math.max(germanTarif(zvE), 2 * (upper - lower));
  }
  return germanTarif(zvE);
};

const germany = {
  id: 'de',
  name: 'Germany',
  currency: 'EUR',
  year: YEAR,
  notes: [
    'The official tarif for the year, with the tax class applied as payroll does it.',
    'Contributions are taken off before tax through the Vorsorgepauschale.',
    'Child allowances lower the solidarity surcharge and church tax, not the income tax itself.',
    'Saxony charges the employee half a point more for care insurance.',
  ],
  fields: [
    { key: 'taxClass', label: 'Tax class', type: 'select', default: 'one',
      options: [
        { value: 'one', label: 'I, on your own' },
        { value: 'two', label: 'II, single parent' },
        { value: 'three', label: 'III, married, the higher earner' },
        { value: 'four', label: 'IV, married, both earning alike' },
        { value: 'five', label: 'V, married, the lower earner' },
        { value: 'six', label: 'VI, a second job' },
      ] },
    { key: 'state', label: 'Federal state', type: 'select', default: 'nw',
      options: Object.entries(GERMAN_STATES).map(([value, entry]) => ({ value, label: entry.label })) },
    { key: 'church', label: 'Church member', type: 'select', default: 'no',
      options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    { key: 'children', label: 'Children', type: 'number', default: 0, hint: 'Child allowances counted for you' },
    { key: 'young', label: 'Under 23 and childless', type: 'select', default: 'no',
      options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], hint: 'Under 23 you are spared the childless surcharge' },
    { key: 'health', label: 'Health insurance', type: 'select', default: 'statutory',
      options: [{ value: 'statutory', label: 'Statutory' }, { value: 'private', label: 'Private' }] },
    { key: 'extra', label: 'Extra health contribution', type: 'percent', default: 2.5,
      hint: 'Your fund sets this, 2.5 on average', when: (input) => (input.health ?? 'statutory') === 'statutory' },
    { key: 'premium', label: 'Private premium a month', type: 'money', default: 750,
      hint: 'Your share of health and care cover', when: (input) => input.health === 'private' },
  ],
  compute({ gross, taxClass = 'one', state = 'nw', church = 'no', children = 0, young = 'no', health = 'statutory', extra = 2.5, premium = 750 }) {
    const home = GERMAN_STATES[state] ?? GERMAN_STATES.nw;
    const kids = Math.max(0, Math.floor(Number(children) || 0));

    const pension = capped(gross, 0.093, PENSION_CEILING);
    const unemployment = capped(gross, 0.013, PENSION_CEILING);

    let healthCost = 0;
    let careCost = 0;
    if (health === 'private') {
      healthCost = Math.max(0, Number(premium) || 0) * 12;
    } else {
      const extraRate = Math.max(0, Number(extra) || 0) / 100;
      healthCost = capped(gross, 0.073 + extraRate / 2, HEALTH_CEILING);
      let careRate = 0.018;
      if (kids === 0 && young !== 'yes') careRate += 0.006;
      if (kids >= 2) careRate -= Math.min(kids, 5) === kids ? (Math.min(kids, 5) - 1) * 0.0025 : 0.01;
      careRate = Math.max(0.008, careRate) + (home.careShift ?? 0);
      careCost = capped(gross, careRate, HEALTH_CEILING);
    }

    const contributions = pension + unemployment + healthCost + careCost;
    const zvE = Math.max(0, gross - 1230 - 36 - contributions);

    const single = taxClass === 'two' ? Math.max(0, zvE - (4260 + Math.max(0, kids - 1) * 240)) : zvE;
    const incomeTax = germanClassTax(single, taxClass);

    const childAllowance = kids * (taxClass === 'three' ? 9600 : 4800);
    const surchargeBase = germanClassTax(Math.max(0, single - childAllowance), taxClass);
    const freeOf = taxClass === 'three' ? 39900 : 19950;
    const soli = surchargeBase <= freeOf ? 0 : Math.min(0.119 * (surchargeBase - freeOf), 0.055 * surchargeBase);
    const churchTax = church === 'yes' ? surchargeBase * home.church : 0;

    return summarise(gross, [
      { label: 'Income tax', amount: incomeTax, kind: 'tax' },
      { label: 'Solidarity surcharge', amount: soli, kind: 'tax' },
      { label: 'Church tax', amount: churchTax, kind: 'tax' },
      { label: 'Pension insurance', amount: pension, kind: 'social' },
      { label: 'Unemployment insurance', amount: unemployment, kind: 'social' },
      { label: health === 'private' ? 'Private health cover' : 'Health insurance', amount: healthCost, kind: 'social' },
      { label: 'Care insurance', amount: careCost, kind: 'social' },
    ]);
  },
};

const france = {
  id: 'fr',
  name: 'France',
  currency: 'EUR',
  year: YEAR,
  notes: [
    'The barème on employment income after the ten percent allowance for work costs.',
    'The family quotient counts a half part for each of the first two children.',
   'Tax is worked out on pay after contributions, as the barème requires.',
    'Employee contributions are taken together at the usual private sector rate.',
  ],
  fields: [
    { key: 'household', label: 'Household', type: 'select', default: 'single',
      options: [{ value: 'single', label: 'On your own' }, { value: 'couple', label: 'Married or in a civil union' }] },
    { key: 'children', label: 'Children', type: 'number', default: 0 },
  ],
  compute({ gross, household = 'single', children = 0 }) {
    const social = gross * 0.22;
    const afterSocial = Math.max(0, gross - social);
    const allowance = Math.min(Math.max(afterSocial * 0.1, 495), 14171);
    const forTax = Math.max(0, afterSocial - allowance);

    const kids = Math.max(0, Number(children) || 0);
    const parts = (household === 'couple' ? 2 : 1) + Math.min(kids, 2) * 0.5 + Math.max(0, kids - 2);
    const bands = [
      { upTo: 11497, rate: 0 }, { upTo: 29315, rate: 0.11 }, { upTo: 83823, rate: 0.3 },
      { upTo: 180294, rate: 0.41 }, { rate: 0.45 },
    ];
    const incomeTax = progressive(forTax / parts, bands) * parts;

    return summarise(gross, [
      { label: 'Income tax', amount: incomeTax, kind: 'tax' },
      { label: 'Employee contributions', amount: social, kind: 'social' },
    ]);
  },
};

const netherlands = {
  id: 'nl',
  name: 'Netherlands',
  currency: 'EUR',
  year: YEAR,
  notes: [
    'Box 1 tax on employment income, with the general and labour credits.',
    'The thirty percent ruling is applied to the taxable part of your pay.',
    'Leaves out the mortgage deduction and other personal allowances.',
  ],
  fields: [
    { key: 'ruling', label: 'The 30 percent ruling', type: 'select', default: 'no',
      options: [{ value: 'no', label: 'Does not apply' }, { value: 'yes', label: 'Applies' }] },
    { key: 'pensionAge', label: 'State pension age', type: 'select', default: 'under',
      options: [{ value: 'under', label: 'Below it' }, { value: 'over', label: 'Reached it' }] },
  ],
  compute({ gross, ruling = 'no', pensionAge = 'under' }) {
    const free = ruling === 'yes' ? gross * 0.3 : 0;
    const forTax = Math.max(0, gross - free);

    const bands = pensionAge === 'over'
      ? [{ upTo: 38441, rate: 0.1792 }, { upTo: 76817, rate: 0.3748 }, { rate: 0.495 }]
      : [{ upTo: 38441, rate: 0.3582 }, { upTo: 76817, rate: 0.3748 }, { rate: 0.495 }];
    const raw = progressive(forTax, bands);

    const general = forTax <= 28406
      ? 3068
      : Math.max(0, 3068 - (forTax - 28406) * 0.06337);
    const labour = forTax <= 12169
      ? forTax * 0.08053
      : forTax <= 26288
        ? 980 + (forTax - 12169) * 0.30030
        : forTax <= 43071
          ? 5220 + (forTax - 26288) * 0.02258
          : Math.max(0, 5599 - (forTax - 43071) * 0.0651);

    const tax = Math.max(0, raw - general - labour);
    return summarise(gross, [
      { label: 'Box 1 tax after credits', amount: tax, kind: 'tax' },
    ]);
  },
};

const flat = (id, name, currency, notes, fields, build) => ({ id, name, currency, year: YEAR, notes, fields, compute: build });

const belgium = flat('be', 'Belgium', 'EUR',
  ['Federal tax on employment income after social security and the work allowance.', 'Municipal surcharge is taken at seven percent, the usual level.', 'Leaves out the many personal and family credits.'],
  [{ key: 'married', label: 'Household', type: 'select', default: 'single', options: [{ value: 'single', label: 'On your own' }, { value: 'couple', label: 'Married or cohabiting' }] }],
  ({ gross, married = 'single' }) => {
    const social = gross * 0.1307;
    const afterSocial = Math.max(0, gross - social);
    const costs = Math.min(afterSocial * 0.3, 5750);
    const exempt = married === 'couple' ? 21200 : 10910;
    const forTax = Math.max(0, afterSocial - costs);
    const bands = [{ upTo: 15820, rate: 0.25 }, { upTo: 27920, rate: 0.4 }, { upTo: 48320, rate: 0.45 }, { rate: 0.5 }];
    const raw = Math.max(0, progressive(forTax, bands) - exempt * 0.25);
    return summarise(gross, [
      { label: 'Income tax', amount: raw, kind: 'tax' },
      { label: 'Municipal surcharge', amount: raw * 0.07, kind: 'tax' },
      { label: 'Social security', amount: social, kind: 'social' },
    ]);
  });

const spain = flat('es', 'Spain', 'EUR',
  ['State and regional tax added together at the common rates.', 'Social security is at the employee rate up to the monthly ceiling.', 'Regions set their own half of the scale, so your bill may differ.'],
  [{ key: 'children', label: 'Children', type: 'number', default: 0 }],
  ({ gross, children = 0 }) => {
    const social = capped(gross, 0.0635, 59059);
    const forTax = Math.max(0, gross - social - 2000);
    const personal = 5550 + Math.min(Math.max(0, Number(children) || 0), 4) * 2400;
    const bands = [
      { upTo: 12450, rate: 0.19 }, { upTo: 20200, rate: 0.24 }, { upTo: 35200, rate: 0.3 },
      { upTo: 60000, rate: 0.37 }, { upTo: 300000, rate: 0.45 }, { rate: 0.47 },
    ];
    const tax = Math.max(0, progressive(forTax, bands) - progressive(personal, bands));
    return summarise(gross, [
      { label: 'Income tax', amount: tax, kind: 'tax' },
      { label: 'Social security', amount: social, kind: 'social' },
    ]);
  });

const italy = flat('it', 'Italy', 'EUR',
  ['National tax at the three rates, with the employment credit.', 'Regional and municipal surcharges are taken at typical levels.', 'Social security is at the usual employee rate.'],
  [],
  ({ gross }) => {
    const social = gross * 0.0919;
    const forTax = Math.max(0, gross - social);
    const bands = [{ upTo: 28000, rate: 0.23 }, { upTo: 50000, rate: 0.35 }, { rate: 0.43 }];
    const raw = progressive(forTax, bands);
    const credit = forTax <= 15000
      ? 1955
      : forTax <= 28000
        ? 1910 + 1190 * ((28000 - forTax) / 13000)
        : forTax <= 50000
          ? 1910 * ((50000 - forTax) / 22000)
          : 0;
    const national = Math.max(0, raw - credit);
    return summarise(gross, [
      { label: 'National tax', amount: national, kind: 'tax' },
      { label: 'Regional surcharge', amount: forTax * 0.0173, kind: 'tax' },
      { label: 'Municipal surcharge', amount: forTax * 0.006, kind: 'tax' },
      { label: 'Social security', amount: social, kind: 'social' },
    ]);
  });

const portugal = flat('pt', 'Portugal', 'EUR',
  ['Mainland rates on employment income, with the standard deduction.', 'Social security is at the employee rate of eleven percent.', 'Madeira and the Azores use lower rates that are not shown here.'],
  [],
  ({ gross }) => {
    const social = gross * 0.11;
    const forTax = Math.max(0, gross - Math.max(4104, social));
    const bands = [
      { upTo: 8059, rate: 0.13 }, { upTo: 12160, rate: 0.165 }, { upTo: 17233, rate: 0.22 },
      { upTo: 22306, rate: 0.25 }, { upTo: 28400, rate: 0.32 }, { upTo: 41629, rate: 0.355 },
      { upTo: 44987, rate: 0.435 }, { upTo: 83696, rate: 0.45 }, { rate: 0.48 },
    ];
    return summarise(gross, [
      { label: 'Income tax', amount: progressive(forTax, bands), kind: 'tax' },
      { label: 'Social security', amount: social, kind: 'social' },
    ]);
  });

const ireland = flat('ie', 'Ireland', 'EUR',
  ['Income tax with the personal and employee credits, plus PRSI and USC.', 'The standard rate band widens for a married couple with one income.', 'Leaves out other reliefs and the home carer credit.'],
  [{ key: 'household', label: 'Household', type: 'select', default: 'single', options: [{ value: 'single', label: 'On your own' }, { value: 'couple', label: 'Married, one income' }] }],
  ({ gross, household = 'single' }) => {
    const cut = household === 'couple' ? 53000 : 44000;
    const bands = [{ upTo: cut, rate: 0.2 }, { rate: 0.4 }];
    const credits = household === 'couple' ? 4950 : 4000;
    const tax = Math.max(0, progressive(gross, bands) - credits);
    const prsiCredit = Math.max(0, 624 - Math.max(0, gross - 18304) / 6);
    const prsi = gross > 18304 ? Math.max(0, gross * 0.042 - prsiCredit) : 0;
    const usc = gross <= 13000 ? 0 : progressive(gross, [
      { upTo: 12012, rate: 0.005 }, { upTo: 27382, rate: 0.02 }, { upTo: 70044, rate: 0.03 }, { rate: 0.08 },
    ]);
    return summarise(gross, [
      { label: 'Income tax', amount: tax, kind: 'tax' },
      { label: 'Universal social charge', amount: usc, kind: 'tax' },
      { label: 'PRSI', amount: prsi, kind: 'social' },
    ]);
  });

const austria = flat('at', 'Austria', 'EUR',
  ['Income tax on the twelve monthly payments, with the traffic credit.', 'The thirteenth and fourteenth salaries are taxed more lightly and are not counted here.', 'Social security is at the employee rate up to the ceiling.'],
  [],
  ({ gross }) => {
    const social = capped(gross, 0.1812, 92400);
    const forTax = Math.max(0, gross - social);
    const bands = [
      { upTo: 13308, rate: 0 }, { upTo: 21617, rate: 0.2 }, { upTo: 35836, rate: 0.3 },
      { upTo: 69166, rate: 0.4 }, { upTo: 103072, rate: 0.48 }, { upTo: 1000000, rate: 0.5 }, { rate: 0.55 },
    ];
    const tax = Math.max(0, progressive(forTax, bands) - 487);
    return summarise(gross, [
      { label: 'Income tax', amount: tax, kind: 'tax' },
      { label: 'Social security', amount: social, kind: 'social' },
    ]);
  });

const poland = flat('pl', 'Poland', 'PLN',
  ['The two rate scale with the tax reducing amount.', 'Social and health contributions are at the employee rates.', 'Leaves out the relief for the young and joint assessment.'],
  [],
  ({ gross }) => {
    const social = gross * 0.1371;
    const health = (gross - social) * 0.09;
    const forTax = Math.max(0, gross - social);
    const bands = [{ upTo: 120000, rate: 0.12 }, { rate: 0.32 }];
    const tax = Math.max(0, progressive(forTax, bands) - 3600);
    return summarise(gross, [
      { label: 'Income tax', amount: tax, kind: 'tax' },
      { label: 'Social contributions', amount: social, kind: 'social' },
      { label: 'Health contribution', amount: health, kind: 'social' },
    ]);
  });

const sweden = flat('se', 'Sweden', 'SEK',
  ['Municipal tax at the average rate, plus national tax above the threshold.', 'The basic deduction and the earned income credit are both applied.', 'Your municipality sets its own rate, so the bill varies by where you live.'],
  [],
  ({ gross }) => {
    const basic = Math.min(Math.max(0, gross * 0.2), 45700);
    const forTax = Math.max(0, gross - basic);
    const municipal = forTax * 0.3241;
    const national = Math.max(0, forTax - 625800) * 0.2;
    const credit = Math.min(municipal, 3000 + gross * 0.02);
    return summarise(gross, [
      { label: 'Municipal tax', amount: Math.max(0, municipal - credit), kind: 'tax' },
      { label: 'National tax', amount: national, kind: 'tax' },
    ]);
  });

const denmark = flat('dk', 'Denmark', 'DKK',
  ['Labour market contribution first, then bottom and top tax with the personal allowance.', 'Municipal tax is at the average rate.', 'Leaves out church tax and the many deductions.'],
  [],
  ({ gross }) => {
    const am = gross * 0.08;
    const afterAm = gross - am;
    const forTax = Math.max(0, afterAm - 51600);
    const municipal = forTax * 0.2542;
    const bottom = forTax * 0.1201;
    const top = Math.max(0, afterAm - 611800) * 0.15;
    return summarise(gross, [
      { label: 'Labour market contribution', amount: am, kind: 'social' },
      { label: 'Municipal tax', amount: municipal, kind: 'tax' },
      { label: 'Bottom tax', amount: bottom, kind: 'tax' },
      { label: 'Top tax', amount: top, kind: 'tax' },
    ]);
  });

const norway = flat('no', 'Norway', 'NOK',
  ['Flat tax on ordinary income after the standard deductions, plus the step tax.', 'National insurance is at the employee rate.', 'Leaves out the many special deductions.'],
  [],
  ({ gross }) => {
    const insurance = gross * 0.077;
    const minimum = Math.min(gross * 0.46, 92000);
    const forOrdinary = Math.max(0, gross - minimum - 108550);
    const ordinary = forOrdinary * 0.22;
    const step = progressive(gross, [
      { upTo: 217400, rate: 0 }, { upTo: 306050, rate: 0.017 }, { upTo: 697150, rate: 0.04 },
      { upTo: 942400, rate: 0.137 }, { upTo: 1410750, rate: 0.167 }, { rate: 0.177 },
    ]);
    return summarise(gross, [
      { label: 'Tax on ordinary income', amount: ordinary, kind: 'tax' },
      { label: 'Step tax', amount: step, kind: 'tax' },
      { label: 'National insurance', amount: insurance, kind: 'social' },
    ]);
  });

const finland = flat('fi', 'Finland', 'EUR',
  ['State tax on the scale, plus municipal tax at the average rate.', 'Employee pension and unemployment contributions are included.', 'Leaves out the church tax and the earned income deductions.'],
  [],
  ({ gross }) => {
    const pension = gross * 0.0715;
    const unemployment = gross * 0.0059;
    const forTax = Math.max(0, gross - pension - unemployment);
    const state = progressive(forTax, [
      { upTo: 21200, rate: 0.1264 }, { upTo: 31500, rate: 0.19 }, { upTo: 52100, rate: 0.3025 },
      { upTo: 88200, rate: 0.34 }, { upTo: 150000, rate: 0.42 }, { rate: 0.44 },
    ]);
    return summarise(gross, [
      { label: 'Income tax', amount: state, kind: 'tax' },
      { label: 'Pension contribution', amount: pension, kind: 'social' },
      { label: 'Unemployment contribution', amount: unemployment, kind: 'social' },
    ]);
  });

const switzerland = flat('ch', 'Switzerland', 'CHF',
  ['Federal tax on the scale, with cantonal and municipal tax at a typical multiple.', 'Cantons differ enormously, so treat the cantonal part as a rough guide.', 'Contributions cover old age and unemployment, plus the occupational pension at a middle rate.'],
  [{ key: 'household', label: 'Household', type: 'select', default: 'single', options: [{ value: 'single', label: 'On your own' }, { value: 'couple', label: 'Married' }] }],
  ({ gross, household = 'single' }) => {
    const stateSocial = capped(gross, 0.053, Infinity) + capped(gross, 0.011, 148200);
    const coordinated = Math.max(0, Math.min(gross, 90720) - 26460);
    const occupational = coordinated * 0.05;
    const social = stateSocial + occupational;
    const forTax = Math.max(0, gross - social - 2600);
    const bands = household === 'couple'
      ? [{ upTo: 30800, rate: 0 }, { upTo: 50900, rate: 0.01 }, { upTo: 58400, rate: 0.02 }, { upTo: 75300, rate: 0.03 }, { upTo: 90300, rate: 0.04 }, { upTo: 103400, rate: 0.05 }, { upTo: 114700, rate: 0.06 }, { upTo: 124200, rate: 0.07 }, { upTo: 131700, rate: 0.08 }, { upTo: 137300, rate: 0.09 }, { upTo: 141200, rate: 0.1 }, { upTo: 143100, rate: 0.11 }, { upTo: 145000, rate: 0.12 }, { upTo: 895900, rate: 0.13 }, { rate: 0.115 }]
      : [{ upTo: 15000, rate: 0 }, { upTo: 32800, rate: 0.0077 }, { upTo: 42900, rate: 0.0088 }, { upTo: 57200, rate: 0.0264 }, { upTo: 75200, rate: 0.0297 }, { upTo: 81000, rate: 0.0594 }, { upTo: 107400, rate: 0.066 }, { upTo: 139600, rate: 0.088 }, { upTo: 182600, rate: 0.11 }, { upTo: 783200, rate: 0.132 }, { rate: 0.115 }];
    const federal = progressive(forTax, bands);
    return summarise(gross, [
      { label: 'Federal tax', amount: federal, kind: 'tax' },
      { label: 'Cantonal and municipal tax', amount: federal * 1.9, kind: 'tax' },
      { label: 'Old age and unemployment', amount: stateSocial, kind: 'social' },
      { label: 'Occupational pension', amount: occupational, kind: 'social' },
    ]);
  });

const czechia = flat('cz', 'Czechia', 'CZK',
  ['Flat fifteen percent up to the ceiling, then twenty three percent above it.', 'The taxpayer credit is applied in full.', 'Social and health contributions are at the employee rates.'],
  [],
  ({ gross }) => {
    const social = capped(gross, 0.065, 2234736);
    const health = gross * 0.045;
    const bands = [{ upTo: 1676052, rate: 0.15 }, { rate: 0.23 }];
    const tax = Math.max(0, progressive(gross, bands) - 30840);
    return summarise(gross, [
      { label: 'Income tax', amount: tax, kind: 'tax' },
      { label: 'Social insurance', amount: social, kind: 'social' },
      { label: 'Health insurance', amount: health, kind: 'social' },
    ]);
  });

const greece = flat('gr', 'Greece', 'EUR',
  ['The employment scale with the tax credit that falls as income rises.', 'Social security is at the employee rate up to the ceiling.', 'Leaves out the solidarity contribution, which is suspended.'],
  [{ key: 'children', label: 'Children', type: 'number', default: 0 }],
  ({ gross, children = 0 }) => {
    const social = capped(gross, 0.1387, 84960);
    const forTax = Math.max(0, gross - social);
    const bands = [
      { upTo: 10000, rate: 0.09 }, { upTo: 20000, rate: 0.22 }, { upTo: 30000, rate: 0.28 },
      { upTo: 40000, rate: 0.36 }, { rate: 0.44 },
    ];
    const kids = Math.min(Math.max(0, Number(children) || 0), 4);
    const base = [777, 810, 900, 1120, 1340][kids];
    const credit = forTax <= 12000 ? base : Math.max(0, base - (forTax - 12000) * 0.02);
    const tax = Math.max(0, progressive(forTax, bands) - credit);
    return summarise(gross, [
      { label: 'Income tax', amount: tax, kind: 'tax' },
      { label: 'Social security', amount: social, kind: 'social' },
    ]);
  });

const hungary = flat('hu', 'Hungary', 'HUF',
  ['A flat fifteen percent on employment income.', 'Social contribution is at the employee rate of eighteen and a half percent.', 'Leaves out the family allowance, which can be large.'],
  [],
  ({ gross }) => summarise(gross, [
    { label: 'Income tax', amount: gross * 0.15, kind: 'tax' },
    { label: 'Social contributions', amount: gross * 0.185, kind: 'social' },
  ]));

const romania = flat('ro', 'Romania', 'RON',
  ['A flat ten percent, charged after the pension and health contributions.', 'Contributions are twenty five and ten percent of gross.', 'Leaves out the personal deduction for lower pay.'],
  [],
  ({ gross }) => {
    const pension = gross * 0.25;
    const health = gross * 0.1;
    const tax = Math.max(0, gross - pension - health) * 0.1;
    return summarise(gross, [
      { label: 'Income tax', amount: tax, kind: 'tax' },
      { label: 'Pension contribution', amount: pension, kind: 'social' },
      { label: 'Health contribution', amount: health, kind: 'social' },
    ]);
  });

const luxembourg = flat('lu', 'Luxembourg', 'EUR',
  ['Class one and class two of the scale, with the employment fund surcharge.', 'Social contributions cover pension, health and long term care.', 'Leaves out the many credits and the dependent child relief.'],
  [{ key: 'household', label: 'Tax class', type: 'select', default: 'single', options: [{ value: 'single', label: 'Class 1, on your own' }, { value: 'couple', label: 'Class 2, married' }] }],
  ({ gross, household = 'single' }) => {
    const social = capped(gross, 0.1205, 140000);
    const forTax = Math.max(0, gross - social);
    const bands = [
      { upTo: 13230, rate: 0 }, { upTo: 15435, rate: 0.08 }, { upTo: 17640, rate: 0.09 },
      { upTo: 19845, rate: 0.1 }, { upTo: 22050, rate: 0.11 }, { upTo: 24255, rate: 0.12 },
      { upTo: 26460, rate: 0.14 }, { upTo: 28665, rate: 0.16 }, { upTo: 30870, rate: 0.18 },
      { upTo: 33075, rate: 0.2 }, { upTo: 35280, rate: 0.22 }, { upTo: 37485, rate: 0.24 },
      { upTo: 39690, rate: 0.26 }, { upTo: 41895, rate: 0.28 }, { upTo: 44100, rate: 0.3 },
      { upTo: 46305, rate: 0.32 }, { upTo: 48510, rate: 0.34 }, { upTo: 50715, rate: 0.36 },
      { upTo: 110403, rate: 0.39 }, { upTo: 165600, rate: 0.4 }, { upTo: 220788, rate: 0.41 }, { rate: 0.42 },
    ];
    const raw = household === 'couple' ? 2 * progressive(forTax / 2, bands) : progressive(forTax, bands);
    return summarise(gross, [
      { label: 'Income tax', amount: raw, kind: 'tax' },
      { label: 'Employment fund surcharge', amount: raw * 0.07, kind: 'tax' },
      { label: 'Social contributions', amount: social, kind: 'social' },
    ]);
  });

export const COUNTRIES = [
  uk, ireland, germany, france, netherlands, belgium, luxembourg, switzerland, austria,
  spain, portugal, italy, greece,
  sweden, denmark, norway, finland,
  poland, czechia, hungary, romania,
  usa, canada,
].sort((a, b) => a.name.localeCompare(b.name));
