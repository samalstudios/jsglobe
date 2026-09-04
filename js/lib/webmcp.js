// Offering the tools on a page to an agent browsing it.
//
// WebMCP is the proposal behind navigator.modelContext: a page describes what
// it can do, and an assistant running in the browser calls those descriptions
// instead of guessing at the interface. Nothing here reaches the network. When
// the browser has no such thing, everything below quietly does nothing, which
// is the common case and must stay the cheap one.
//
// The descriptors are also worth having on their own: they are the same shape
// as a schema.org action, so the same list can answer a crawler.

// only these types survive a round trip through a tool call, so a descriptor
// that asks for anything else is a mistake worth catching
const TYPES = new Set(['string', 'number', 'integer', 'boolean']);

const isPlain = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// what is wrong with a descriptor, in the words someone would need to fix it
export const faultsIn = (tool) => {
  const faults = [];
  if (!isPlain(tool)) return ['not an object'];
  if (!tool.name || !/^[a-z][a-z0-9_]{1,63}$/.test(tool.name)) faults.push('name must be lower case, start with a letter, and be 2 to 64 characters');
  if (!tool.description || tool.description.length < 12) faults.push('description must say what the tool does');
  if (typeof tool.run !== 'function') faults.push('run must be a function');

  const params = tool.params ?? {};
  if (!isPlain(params)) faults.push('params must be an object');
  else {
    for (const [key, spec] of Object.entries(params)) {
      if (!isPlain(spec)) faults.push(`${key}: not an object`);
      else if (!TYPES.has(spec.type)) faults.push(`${key}: type must be one of ${[...TYPES].join(', ')}`);
      else if (!spec.description) faults.push(`${key}: needs a description`);
    }
  }
  return faults;
};

export const isValid = (tool) => faultsIn(tool).length === 0;

// the descriptor as JSON Schema, which is what every caller of a tool expects
export const schemaFor = (tool) => {
  const properties = {};
  const required = [];
  for (const [key, spec] of Object.entries(tool.params ?? {})) {
    const { required: needed, ...rest } = spec;
    properties[key] = rest;
    if (needed) required.push(key);
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
};

// the same tool written as a schema.org action, so a page can describe to a
// crawler what it describes to an agent
export const actionFor = (tool, url) => ({
  '@type': 'Action',
  name: tool.name,
  description: tool.description,
  ...(url ? { target: { '@type': 'EntryPoint', urlTemplate: url } } : {}),
});

export const supported = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.modelContext);

// The proposal has gone through two shapes: a whole context handed over at
// once, and tools registered one by one. Both are answered here so a page does
// not have to care which one the browser shipped.
const offer = (tools) => {
  const context = navigator.modelContext;
  const described = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: schemaFor(tool),
    async execute(args) {
      const text = await tool.run(args ?? {});
      return { content: [{ type: 'text', text: String(text ?? '') }] };
    },
  }));

  if (typeof context.registerTool === 'function') {
    const handles = described.map((tool) => context.registerTool(tool));
    return () => handles.forEach((handle) => handle?.unregister?.());
  }

  if (typeof context.provideContext === 'function') {
    context.provideContext({ tools: described });
    return () => context.provideContext({ tools: [] });
  }

  return () => {};
};

// Hand a set of tools to the browsing agent, and take them back when the app
// that owns them closes. A tool that is not properly described is dropped
// rather than offered, because an agent cannot tell a bad description from a
// bad page.
export const provide = (tools = [], { onFault } = {}) => {
  const good = [];
  for (const tool of tools) {
    const faults = faultsIn(tool);
    if (faults.length) onFault?.(tool?.name ?? 'tool', faults);
    else good.push(tool);
  }
  if (!good.length || !supported()) return () => {};
  try {
    return offer(good);
  } catch {
    return () => {};
  }
};
