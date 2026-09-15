// A Model Context Protocol client for the browser.
//
// It speaks JSON-RPC to a server over the streamable HTTP transport, the older
// HTTP with server sent events transport, or to a small server that lives in
// the page for trying things without one. Every message in either direction
// is handed to onMessage, so a caller can show the whole conversation.

export const PROTOCOL_VERSION = '2025-06-18';

export const CLIENT_INFO = { name: 'Toolbox MCP Tester', version: '1.0.0' };

// ---- server sent events ------------------------------------------------

// Feeds text in as it arrives and calls onEvent for each complete event.
export const sseParser = (onEvent) => {
  let buffer = '';
  let data = [];
  let event = '';
  let id = '';
  const dispatch = () => {
    if (data.length) onEvent({ event: event || 'message', data: data.join('\n'), id });
    data = [];
    event = '';
  };
  return (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop();
    for (const line of lines) {
      if (line === '') dispatch();
      else if (line.startsWith(':')) continue;
      else {
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'data') data.push(value);
        else if (field === 'event') event = value;
        else if (field === 'id') id = value;
      }
    }
  };
};

const readStream = async (body, onText, signal) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  signal?.addEventListener('abort', () => reader.cancel().catch(() => {}), { once: true });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(decoder.decode(value, { stream: true }));
  }
};

// ---- errors ------------------------------------------------------------

export class McpError extends Error {
  constructor(message, { code, data, status } = {}) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.data = data;
    this.status = status;
  }
}

// A failed fetch in a browser rarely says why; nearly always it is CORS or a
// server that is not there.
const reachFailure = (url, error) =>
  new McpError(
    `Could not reach ${url}. The server may be down, or it does not allow requests from this page (CORS).`,
    { data: error?.message },
  );

// ---- transports --------------------------------------------------------

// A transport sends one JSON-RPC message and passes whatever comes back,
// replies and server messages alike, to receive.
const streamableHttp = ({ url, headers = {} }, receive) => {
  let session = null;
  let version = null;
  let listening = null;
  const controllers = new Set();

  const headersFor = (extra = {}) => ({
    ...headers,
    ...(session ? { 'mcp-session-id': session } : {}),
    ...(version ? { 'mcp-protocol-version': version } : {}),
    ...extra,
  });

  const consume = async (response, controller) => {
    const type = response.headers.get('content-type') ?? '';
    if (type.includes('text/event-stream')) {
      const parse = sseParser(({ data }) => {
        if (!data.trim()) return;
        try {
          receive(JSON.parse(data));
        } catch {
          receive({ unreadable: data });
        }
      });
      await readStream(response.body, parse, controller.signal);
    } else if (type.includes('json')) {
      const text = await response.text();
      if (!text.trim()) return;
      const message = JSON.parse(text);
      (Array.isArray(message) ? message : [message]).forEach(receive);
    }
  };

  return {
    kind: 'http',
    get session() {
      return session;
    },
    setVersion(next) {
      version = next;
    },
    async send(message) {
      const controller = new AbortController();
      controllers.add(controller);
      try {
        let response;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: headersFor({ 'content-type': 'application/json', accept: 'application/json, text/event-stream' }),
            body: JSON.stringify(message),
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          throw reachFailure(url, error);
        }
        const issued = response.headers.get('mcp-session-id');
        if (issued) session = issued;
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          let detail = text;
          try {
            const parsed = JSON.parse(text);
            if (parsed?.error) return receive(parsed);
            detail = parsed?.message ?? text;
          } catch {}
          throw new McpError(`The server answered ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 300)}` : ''}`, { status: response.status });
        }
        await consume(response, controller);
      } finally {
        controllers.delete(controller);
      }
    },
    // the optional stream a server can use to reach the client unprompted
    async listen() {
      if (listening) return;
      const controller = new AbortController();
      listening = controller;
      try {
        const response = await fetch(url, { method: 'GET', headers: headersFor({ accept: 'text/event-stream' }), signal: controller.signal });
        if (response.ok) await consume(response, controller);
      } catch {}
      if (listening === controller) listening = null;
    },
    async close() {
      listening?.abort();
      listening = null;
      controllers.forEach((controller) => controller.abort());
      if (session) {
        await fetch(url, { method: 'DELETE', headers: headersFor() }).catch(() => {});
      }
      session = null;
    },
  };
};

// The 2024-11-05 transport: a GET stream announces where to post, and every
// reply comes back on that stream.
const legacySse = ({ url, headers = {} }, receive) => {
  const controller = new AbortController();
  let endpoint = null;
  let ready = null;

  const open = () => {
    ready ??= new Promise((resolve, reject) => {
      (async () => {
        let response;
        try {
          response = await fetch(url, { headers: { ...headers, accept: 'text/event-stream' }, signal: controller.signal });
        } catch (error) {
          return reject(reachFailure(url, error));
        }
        if (!response.ok) return reject(new McpError(`The server answered ${response.status} ${response.statusText}`, { status: response.status }));
        const parse = sseParser(({ event, data }) => {
          if (event === 'endpoint') {
            endpoint = new URL(data.trim(), url).href;
            resolve();
          } else if (data.trim()) {
            try {
              receive(JSON.parse(data));
            } catch {
              receive({ unreadable: data });
            }
          }
        });
        try {
          await readStream(response.body, parse, controller.signal);
        } catch {}
        if (!endpoint) reject(new McpError('The stream closed before the server said where to send messages.'));
      })();
    });
    return ready;
  };

  return {
    kind: 'sse',
    session: null,
    setVersion() {},
    async send(message) {
      await open();
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify(message),
        });
      } catch (error) {
        throw reachFailure(endpoint, error);
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new McpError(`The server answered ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`, { status: response.status });
      }
    },
    listen() {},
    async close() {
      controller.abort();
    },
  };
};

// A server in the page, so the tester can be tried with nothing running.
export const demoServer = () => {
  const notes = new Map([
    ['welcome', 'Welcome to the demo server. Everything here runs in your browser.'],
    ['todo', '- try the add tool\n- read a resource\n- get the review prompt'],
  ]);
  const tools = [
    {
      name: 'echo',
      title: 'Echo',
      description: 'Sends the text straight back.',
      inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'What to send back' } }, required: ['text'] },
    },
    {
      name: 'add',
      title: 'Add numbers',
      description: 'Adds two numbers and returns the sum as text and as structured content.',
      inputSchema: {
        type: 'object',
        properties: { a: { type: 'number', description: 'First number' }, b: { type: 'number', description: 'Second number' } },
        required: ['a', 'b'],
      },
      outputSchema: { type: 'object', properties: { sum: { type: 'number' } }, required: ['sum'] },
    },
    {
      name: 'time',
      title: 'Current time',
      description: 'The time now in a time zone.',
      inputSchema: {
        type: 'object',
        properties: {
          zone: { type: 'string', description: 'An IANA time zone', default: 'UTC', enum: ['UTC', 'Europe/Berlin', 'America/New_York', 'Asia/Tokyo'] },
          seconds: { type: 'boolean', description: 'Include seconds', default: true },
        },
      },
    },
    {
      name: 'save_note',
      title: 'Save a note',
      description: 'Stores a note that then shows up as a resource.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', pattern: '^[a-z0-9-]+$' }, text: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
        required: ['name', 'text'],
      },
    },
    {
      name: 'fail',
      title: 'Always fails',
      description: 'Returns a tool error, to see how one looks.',
      inputSchema: { type: 'object', properties: {} },
    },
  ];
  const prompts = [
    {
      name: 'review',
      title: 'Review code',
      description: 'Asks for a careful review of some code.',
      arguments: [
        { name: 'code', description: 'The code to review', required: true },
        { name: 'focus', description: 'What to look at most, such as security', required: false },
      ],
    },
  ];
  const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
  const fault = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  const call = (name, args = {}) => {
    if (name === 'echo') return { content: [{ type: 'text', text: String(args.text ?? '') }] };
    if (name === 'add') {
      const sum = Number(args.a) + Number(args.b);
      return { content: [{ type: 'text', text: String(sum) }], structuredContent: { sum } };
    }
    if (name === 'time') {
      const text = new Date().toLocaleTimeString('en-GB', { timeZone: args.zone || 'UTC', ...(args.seconds === false ? { hour: '2-digit', minute: '2-digit' } : {}) });
      return { content: [{ type: 'text', text: `${text} in ${args.zone || 'UTC'}` }] };
    }
    if (name === 'save_note') {
      notes.set(String(args.name), String(args.text));
      return { content: [{ type: 'text', text: `Saved note://${args.name}` }, { type: 'resource_link', uri: `note://${args.name}`, name: String(args.name), mimeType: 'text/plain' }] };
    }
    if (name === 'fail') return { isError: true, content: [{ type: 'text', text: 'This tool always fails.' }] };
    return null;
  };

  return {
    handle(message, send) {
      const { id, method, params = {} } = message;
      if (id === undefined) return;
      if (method === 'initialize') {
        return send(ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: true }, resources: { listChanged: true }, prompts: {}, logging: {} },
          serverInfo: { name: 'demo', title: 'Demo server', version: '1.0.0' },
          instructions: 'A tiny server with a few tools, notes as resources and one prompt.',
        }));
      }
      if (method === 'ping') return send(ok(id, {}));
      if (method === 'tools/list') return send(ok(id, { tools }));
      if (method === 'tools/call') {
        const result = call(params.name, params.arguments);
        if (!result) return send(fault(id, -32602, `Unknown tool: ${params.name}`));
        if (params.name === 'save_note') setTimeout(() => send({ jsonrpc: '2.0', method: 'notifications/resources/list_changed' }), 0);
        return send(ok(id, result));
      }
      if (method === 'resources/list') {
        return send(ok(id, { resources: [...notes.keys()].map((name) => ({ uri: `note://${name}`, name, mimeType: 'text/plain' })) }));
      }
      if (method === 'resources/templates/list') {
        return send(ok(id, { resourceTemplates: [{ uriTemplate: 'note://{name}', name: 'A note by name', mimeType: 'text/plain' }] }));
      }
      if (method === 'resources/read') {
        const name = String(params.uri ?? '').replace(/^note:\/\//, '');
        if (!notes.has(name)) return send(fault(id, -32002, `Resource not found: ${params.uri}`));
        return send(ok(id, { contents: [{ uri: params.uri, mimeType: 'text/plain', text: notes.get(name) }] }));
      }
      if (method === 'prompts/list') return send(ok(id, { prompts }));
      if (method === 'prompts/get') {
        if (params.name !== 'review') return send(fault(id, -32602, `Unknown prompt: ${params.name}`));
        const focus = params.arguments?.focus ? ` Pay most attention to ${params.arguments.focus}.` : '';
        return send(ok(id, {
          description: 'A code review request',
          messages: [{ role: 'user', content: { type: 'text', text: `Please review this code.${focus}\n\n${params.arguments?.code ?? ''}` } }],
        }));
      }
      if (method === 'logging/setLevel') return send(ok(id, {}));
      if (method === 'completion/complete') return send(ok(id, { completion: { values: [], hasMore: false } }));
      return send(fault(id, -32601, `Method not found: ${method}`));
    },
  };
};

const demoTransport = (_options, receive) => {
  const server = demoServer();
  let open = true;
  return {
    kind: 'demo',
    session: null,
    setVersion() {},
    async send(message) {
      if (!open) throw new McpError('The demo server is closed.');
      await new Promise((resolve) => setTimeout(resolve, 60 + Math.random() * 80));
      server.handle(message, (reply) => open && receive(reply));
    },
    listen() {},
    async close() {
      open = false;
    },
  };
};

export const TRANSPORTS = { http: streamableHttp, sse: legacySse, demo: demoTransport };

// ---- client ------------------------------------------------------------

/**
 * Connects to a server. onMessage(direction, message) sees every message:
 * direction is 'out' or 'in'. Server requests other than ping are answered
 * with method not found, since this client offers no sampling or roots.
 */
export const createClient = ({ url = '', transport = 'http', headers = {}, timeout = 60000, onMessage = () => {}, onNotification = () => {} } = {}) => {
  let next = 1;
  const pending = new Map();
  let info = null;

  const receive = (message) => {
    onMessage('in', message);
    if (message.unreadable !== undefined) return;
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const waiting = pending.get(message.id);
      if (!waiting) return;
      pending.delete(message.id);
      clearTimeout(waiting.timer);
      if (message.error) waiting.reject(new McpError(message.error.message ?? 'Request failed', message.error));
      else waiting.resolve(message.result);
      return;
    }
    if (message.method && message.id !== undefined) {
      const reply = message.method === 'ping'
        ? { jsonrpc: '2.0', id: message.id, result: {} }
        : { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `This client does not support ${message.method}` } };
      onMessage('out', reply);
      wire.send(reply).catch(() => {});
      return;
    }
    if (message.method) onNotification(message);
  };

  const make = TRANSPORTS[transport];
  if (!make) throw new McpError(`Unknown transport: ${transport}`);
  const wire = make({ url, headers }, receive);

  const request = (method, params) => {
    const id = next++;
    const message = { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new McpError(`No answer to ${method} after ${Math.round(timeout / 1000)} seconds`));
      }, timeout);
      pending.set(id, { resolve, reject, timer });
      onMessage('out', message);
      wire.send(message).catch((error) => {
        if (!pending.has(id)) return;
        pending.delete(id);
        clearTimeout(timer);
        reject(error);
      });
    });
  };

  const notify = async (method, params) => {
    const message = { jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) };
    onMessage('out', message);
    await wire.send(message);
  };

  return {
    get info() {
      return info;
    },
    get session() {
      return wire.session;
    },
    get transport() {
      return wire.kind;
    },
    async connect() {
      const result = await request('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      });
      info = result;
      wire.setVersion(result.protocolVersion ?? PROTOCOL_VERSION);
      await notify('notifications/initialized');
      wire.listen();
      return result;
    },
    request,
    notify,
    async listAll(method, key, params = {}) {
      const items = [];
      let cursor;
      for (let page = 0; page < 50; page += 1) {
        const result = await request(method, cursor ? { ...params, cursor } : params);
        items.push(...(result[key] ?? []));
        cursor = result.nextCursor;
        if (!cursor) break;
      }
      return items;
    },
    async close() {
      pending.forEach((waiting) => {
        clearTimeout(waiting.timer);
        waiting.reject(new McpError('Disconnected'));
      });
      pending.clear();
      await wire.close();
    },
  };
};

// ---- schemas -----------------------------------------------------------

const typeOf = (schema = {}) => {
  if (Array.isArray(schema.type)) return schema.type.find((type) => type !== 'null') ?? 'string';
  if (schema.type) return schema.type;
  if (schema.enum) return typeof schema.enum[0] === 'number' ? 'number' : 'string';
  if (schema.properties) return 'object';
  if (schema.items) return 'array';
  if (schema.anyOf || schema.oneOf) return typeOf((schema.anyOf ?? schema.oneOf).find((option) => option.type !== 'null'));
  return 'string';
};

/** The fields a form needs for an object schema, in the order they were declared. */
export const fieldsOf = (schema = {}) => {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    name,
    type: typeOf(property),
    title: property.title ?? name,
    description: property.description ?? '',
    required: required.has(name),
    options: property.enum ?? (property.anyOf ?? property.oneOf)?.map((option) => option.const).filter((value) => value !== undefined) ?? null,
    default: property.default,
    schema: property,
  }));
};

/** A value that satisfies a schema, for filling a form with something sensible. */
export const exampleFor = (schema = {}) => {
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  if (schema.examples?.length) return schema.examples[0];
  if (schema.enum?.length) return schema.enum[0];
  const type = typeOf(schema);
  if (type === 'object') {
    return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([name, property]) => [name, exampleFor(property)]));
  }
  if (type === 'array') return schema.items ? [exampleFor(schema.items)] : [];
  if (type === 'number' || type === 'integer') return schema.minimum ?? 0;
  if (type === 'boolean') return false;
  return '';
};

/** Checks arguments against the parts of a schema a form can get wrong. */
export const problemsWith = (schema = {}, value = {}, path = '') => {
  const problems = [];
  const type = typeOf(schema);
  const at = path || 'arguments';
  if (value === undefined || value === null) return problems;
  if (type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) return [`${at} should be an object`];
    for (const name of schema.required ?? []) {
      if (value[name] === undefined || value[name] === '') problems.push(`${path ? `${path}.` : ''}${name} is required`);
    }
    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      if (value[name] !== undefined) problems.push(...problemsWith(property, value[name], path ? `${path}.${name}` : name));
    }
  } else if (type === 'array') {
    if (!Array.isArray(value)) problems.push(`${at} should be a list`);
    else if (schema.items) value.forEach((item, index) => problems.push(...problemsWith(schema.items, item, `${at}[${index}]`)));
  } else if (type === 'integer') {
    if (!Number.isInteger(value)) problems.push(`${at} should be a whole number`);
  } else if (type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) problems.push(`${at} should be a number`);
  } else if (type === 'boolean') {
    if (typeof value !== 'boolean') problems.push(`${at} should be true or false`);
  } else if (type === 'string') {
    if (typeof value !== 'string') problems.push(`${at} should be text`);
    else if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) problems.push(`${at} does not match ${schema.pattern}`);
  }
  if (schema.enum && !schema.enum.includes(value)) problems.push(`${at} should be one of ${schema.enum.join(', ')}`);
  return problems;
};

/** Fills a resource template such as file://{path} with values. */
export const expandTemplate = (template, values = {}) =>
  template.replace(/\{([+#./;?&]?)([^}]+)\}/g, (_, operator, names) =>
    names
      .split(',')
      .map((name) => {
        const value = values[name.replace(/\*$/, '')] ?? '';
        return operator === '+' || operator === '#' ? encodeURI(value) : encodeURIComponent(value);
      })
      .join(','),
  );

/** The variable names in a resource template. */
export const templateNames = (template) =>
  [...template.matchAll(/\{[+#./;?&]?([^}]+)\}/g)].flatMap((match) => match[1].split(',').map((name) => name.replace(/\*$/, '')));
