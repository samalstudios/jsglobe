export const progressive = (amount, bands) => {
  let owed = 0;
  let floor = 0;
  for (const band of bands) {
    const ceiling = band.upTo ?? Infinity;
    if (amount <= floor) break;
    owed += (Math.min(amount, ceiling) - floor) * band.rate;
    floor = ceiling;
  }
  return owed;
};

export const marginalBand = (amount, bands) => {
  let floor = 0;
  for (const band of bands) {
    const ceiling = band.upTo ?? Infinity;
    if (amount <= ceiling) return band.rate;
    floor = ceiling;
  }
  return bands[bands.length - 1]?.rate ?? 0;
};

export const capped = (base, rate, ceiling = Infinity, floor = 0) =>
  Math.max(0, Math.min(base, ceiling) - floor) * rate;

export const taperedAllowance = (allowance, income, from, rate = 0.5) =>
  Math.max(0, allowance - Math.max(0, income - from) * rate);

const round = (value) => Math.round(value * 100) / 100;

export function summarise(gross, lines) {
  const kept = lines.filter((line) => line && line.amount > 0.004);
  const tax = kept.filter((line) => line.kind === 'tax').reduce((sum, line) => sum + line.amount, 0);
  const social = kept.filter((line) => line.kind === 'social').reduce((sum, line) => sum + line.amount, 0);
  const other = kept.filter((line) => line.kind === 'other').reduce((sum, line) => sum + line.amount, 0);
  const taken = tax + social + other;
  return {
    gross: round(gross),
    lines: kept.map((line) => ({ ...line, amount: round(line.amount) })),
    tax: round(tax),
    social: round(social),
    other: round(other),
    taken: round(taken),
    net: round(gross - taken),
  };
}

export function rates(country, input) {
  const here = country.compute(input);
  const step = 100;
  const ahead = country.compute({ ...input, gross: input.gross + step });
  const marginal = input.gross > 0 ? 1 - (ahead.net - here.net) / step : 0;
  return {
    ...here,
    average: input.gross > 0 ? here.taken / input.gross : 0,
    marginal: Math.max(0, Math.min(1, marginal)),
  };
}
