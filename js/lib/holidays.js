const iso = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const fromDate = (date) => iso(date.getFullYear(), date.getMonth() + 1, date.getDate());

const shift = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const easter = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const nth = (year, month, weekday, count) => {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + offset + (count - 1) * 7);
};

const last = (year, month, weekday) => {
  const end = new Date(year, month, 0);
  const offset = (end.getDay() - weekday + 7) % 7;
  return new Date(year, month - 1, end.getDate() - offset);
};

export const HOLIDAY_SETS = [
  {
    id: 'us-holidays',
    name: 'US Public Holidays',
    color: '#3b82f6',
    build: (year) => [
      [iso(year, 1, 1), "New Year's Day"],
      [fromDate(nth(year, 1, 1, 3)), 'Martin Luther King Jr. Day'],
      [fromDate(nth(year, 2, 1, 3)), "Presidents' Day"],
      [fromDate(last(year, 5, 1)), 'Memorial Day'],
      [iso(year, 6, 19), 'Juneteenth'],
      [iso(year, 7, 4), 'Independence Day'],
      [fromDate(nth(year, 9, 1, 1)), 'Labor Day'],
      [fromDate(nth(year, 10, 1, 2)), 'Columbus Day'],
      [iso(year, 11, 11), 'Veterans Day'],
      [fromDate(nth(year, 11, 4, 4)), 'Thanksgiving'],
      [iso(year, 12, 25), 'Christmas Day'],
    ],
  },
  {
    id: 'uk-holidays',
    name: 'UK Bank Holidays',
    color: '#ef4444',
    build: (year) => [
      [iso(year, 1, 1), "New Year's Day"],
      [fromDate(shift(easter(year), -2)), 'Good Friday'],
      [fromDate(shift(easter(year), 1)), 'Easter Monday'],
      [fromDate(nth(year, 5, 1, 1)), 'Early May Bank Holiday'],
      [fromDate(last(year, 5, 1)), 'Spring Bank Holiday'],
      [fromDate(last(year, 8, 1)), 'Summer Bank Holiday'],
      [iso(year, 12, 25), 'Christmas Day'],
      [iso(year, 12, 26), 'Boxing Day'],
    ],
  },
  {
    id: 'de-holidays',
    name: 'German Public Holidays',
    color: '#f59e0b',
    build: (year) => [
      [iso(year, 1, 1), 'Neujahr'],
      [fromDate(shift(easter(year), -2)), 'Karfreitag'],
      [fromDate(shift(easter(year), 1)), 'Ostermontag'],
      [iso(year, 5, 1), 'Tag der Arbeit'],
      [fromDate(shift(easter(year), 39)), 'Christi Himmelfahrt'],
      [fromDate(shift(easter(year), 50)), 'Pfingstmontag'],
      [iso(year, 10, 3), 'Tag der Deutschen Einheit'],
      [iso(year, 12, 25), '1. Weihnachtstag'],
      [iso(year, 12, 26), '2. Weihnachtstag'],
    ],
  },
  {
    id: 'fr-holidays',
    name: 'French Public Holidays',
    color: '#8b5cf6',
    build: (year) => [
      [iso(year, 1, 1), "Jour de l'An"],
      [fromDate(shift(easter(year), 1)), 'Lundi de Pâques'],
      [iso(year, 5, 1), 'Fête du Travail'],
      [iso(year, 5, 8), 'Victoire 1945'],
      [fromDate(shift(easter(year), 39)), 'Ascension'],
      [fromDate(shift(easter(year), 50)), 'Lundi de Pentecôte'],
      [iso(year, 7, 14), 'Fête Nationale'],
      [iso(year, 8, 15), 'Assomption'],
      [iso(year, 11, 1), 'Toussaint'],
      [iso(year, 11, 11), 'Armistice 1918'],
      [iso(year, 12, 25), 'Noël'],
    ],
  },
  {
    id: 'observances',
    name: 'Global Observances',
    color: '#14b8a6',
    build: (year) => [
      [iso(year, 2, 14), "Valentine's Day"],
      [iso(year, 3, 8), "International Women's Day"],
      [iso(year, 3, 14), 'Pi Day'],
      [iso(year, 4, 22), 'Earth Day'],
      [iso(year, 6, 5), 'World Environment Day'],
      [iso(year, 9, 21), 'International Day of Peace'],
      [iso(year, 10, 31), 'Halloween'],
      [iso(year, 12, 31), "New Year's Eve"],
    ],
  },
];

export const holidaysFor = (setId, year) => {
  const set = HOLIDAY_SETS.find((item) => item.id === setId);
  if (!set) return [];
  return set.build(year).map(([date, title]) => ({ date, title, calendarId: set.id, allDay: true, readonly: true }));
};
