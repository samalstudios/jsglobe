import { bus } from './bus.js';

const sources = new Set();

const flatten = () => {
  const items = [];
  sources.forEach((source) => {
    const list = typeof source === 'function' ? source() : source;
    if (Array.isArray(list)) items.push(...list.filter(Boolean));
  });
  return items;
};

const score = (command, query) => {
  const label = command.label.toLowerCase();
  const group = (command.group ?? '').toLowerCase();
  const words = [label, group, ...(command.keywords ?? []).map((word) => word.toLowerCase())];
  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (words.some((word) => word.startsWith(query))) return 60;
  if (label.includes(query)) return 45;
  if (words.some((word) => word.includes(query))) return 30;
  const initials = label
    .split(/\s+/)
    .map((word) => word[0])
    .join('');
  return initials.startsWith(query) ? 25 : 0;
};

export const commands = {
  provide(source) {
    sources.add(source);
    bus.emit('commands:change');
    return () => {
      sources.delete(source);
      bus.emit('commands:change');
    };
  },

  all: () => flatten().filter((command) => command.when === undefined || command.when()),

  search(query, limit = 40) {
    const term = query.trim().toLowerCase();
    const list = commands.all();
    if (!term) return list.slice(0, limit);
    return list
      .map((command) => ({ command, rank: score(command, term) }))
      .filter((entry) => entry.rank > 0)
      .sort((a, b) => b.rank - a.rank || a.command.label.localeCompare(b.command.label))
      .slice(0, limit)
      .map((entry) => entry.command);
  },
};
