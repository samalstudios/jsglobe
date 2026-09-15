// Time, distance and speed on a journey.
//
// Distances and speeds share a unit (kilometres and km/h, or miles and mph),
// so nothing here needs to know which one it is. Times are in hours.
//
//   travelTime(300, 110)                    // 2.727 hours
//   compareSpeeds({ distance: 300, from: 110, to: 130 }).saved  // 0.42 hours

export const KM_PER_MILE = 1.609344;

/** Hours to cover a distance at a steady speed. */
export const travelTime = (distance, speed) => (speed > 0 ? distance / speed : Infinity);

/** The steady speed that covers a distance in the given hours. */
export const speedFor = (distance, hours) => (hours > 0 ? distance / hours : Infinity);

/**
 * How two speeds over the same distance compare. Breaks are hours spent
 * stopped, added to both; unit is km or mi, which only the fuel estimate needs.
 */
export const compareSpeeds = ({ distance, from, to, breaks = 0, unit = 'km' }) => {
  const kmh = (speed) => (unit === 'mi' ? speed * KM_PER_MILE : speed);
  const slow = travelTime(distance, from) + breaks;
  const fast = travelTime(distance, to) + breaks;
  const saved = slow - fast;
  return {
    slow,
    fast,
    saved,
    speedChange: from > 0 ? to / from - 1 : 0,
    timeChange: slow > 0 ? fast / slow - 1 : 0,
    // what a single hour at the faster speed buys on this road
    minutesPerHour: from > 0 ? 60 * (1 - from / to) : 0,
    fuelChange: fuelFactor(kmh(to)) / fuelFactor(kmh(from)) - 1,
  };
};

// Fuel per distance for a typical car rises with the square of speed once air
// resistance takes over. This is a rough shape, not a figure for any one car:
// about half the fuel at 90 km/h goes to rolling and the engine, half to air.
const REFERENCE_KMH = 90;

/** Fuel used per distance at a speed in km/h, relative to 90 km/h. */
export const fuelFactor = (kmh) => 0.52 + 0.48 * (kmh / REFERENCE_KMH) ** 2;

/**
 * A journey made of legs, each a distance with either a speed or hours.
 * Returns the totals and both averages: over the driving time only, and over
 * the whole trip including breaks. The naive average of the leg speeds is
 * given too, since it is the mistake people usually make.
 */
export const averageSpeed = (legs = [], breaks = 0) => {
  let distance = 0;
  let driving = 0;
  const speeds = [];
  for (const leg of legs) {
    const length = Number(leg.distance) || 0;
    const hours = leg.hours !== undefined && leg.hours !== null && leg.hours !== '' ? Number(leg.hours) : travelTime(length, Number(leg.speed));
    if (!(length > 0) || !(hours > 0) || !Number.isFinite(hours)) continue;
    distance += length;
    driving += hours;
    speeds.push(length / hours);
  }
  const total = driving + (Number(breaks) || 0);
  return {
    distance,
    driving,
    total,
    moving: driving > 0 ? distance / driving : 0,
    overall: total > 0 ? distance / total : 0,
    naive: speeds.length ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 0,
    legs: speeds.length,
  };
};

/** Hours as { hours, minutes, seconds }, rounded to the second. */
export const splitHours = (value) => {
  const seconds = Math.round(Math.abs(value) * 3600);
  return { hours: Math.floor(seconds / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60, negative: value < 0 };
};

/** Hours written as 2 h 43 min, or 43 min, or 50 s, rounded to the minute unless seconds are asked for. */
export const formatHours = (value, { seconds = false } = {}) => {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '−' : '';
  if (seconds && Math.abs(value) < 1 / 60) return `${sign}${Math.round(Math.abs(value) * 3600)} s`;
  const minutes = Math.round(Math.abs(value) * 60);
  const hours = Math.floor(minutes / 60);
  if (hours) return `${sign}${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  return `${sign}${minutes} min`;
};

/** Reads 2:30, 2h30, 2.5 or 150m as hours. Returns NaN when it cannot. */
export const parseDuration = (text = '') => {
  const value = String(text).trim().toLowerCase();
  if (!value) return NaN;
  const clock = value.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60 + Number(clock[3] ?? 0) / 3600;
  const short = value.match(/^(\d+)\s*h\s*(\d{1,2})$/);
  if (short) return Number(short[1]) + Number(short[2]) / 60;
  const units = value.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?)?$/);
  if (units && (units[1] || units[2])) return Number(units[1] ?? 0) + Number(units[2] ?? 0) / 60;
  const plain = Number(value.replace(',', '.'));
  return Number.isFinite(plain) ? plain : NaN;
};
