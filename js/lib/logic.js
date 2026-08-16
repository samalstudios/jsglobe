export const GATES = {
  and: { label: 'AND', inputs: 2, wide: true, apply: (bits) => bits.every(Boolean) },
  or: { label: 'OR', inputs: 2, wide: true, apply: (bits) => bits.some(Boolean) },
  nand: { label: 'NAND', inputs: 2, wide: true, apply: (bits) => !bits.every(Boolean) },
  nor: { label: 'NOR', inputs: 2, wide: true, apply: (bits) => !bits.some(Boolean) },
  xor: { label: 'XOR', inputs: 2, wide: true, apply: (bits) => bits.filter(Boolean).length % 2 === 1 },
  xnor: { label: 'XNOR', inputs: 2, wide: true, apply: (bits) => bits.filter(Boolean).length % 2 === 0 },
  not: { label: 'NOT', inputs: 1, apply: (bits) => !bits[0] },
  buffer: { label: 'Buffer', inputs: 1, apply: (bits) => Boolean(bits[0]) },
};

export const SEGMENTS = {
  0: 'abcdef',
  1: 'bc',
  2: 'abdeg',
  3: 'abcdg',
  4: 'bcfg',
  5: 'acdfg',
  6: 'acdefg',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcdfg',
  10: 'abcefg',
  11: 'cdefg',
  12: 'adef',
  13: 'bcdeg',
  14: 'adefg',
  15: 'aefg',
};

const pinKey = (partId, pin) => `${partId}:${pin}`;

export const createLogic = () => {
  let parts = [];
  let nets = new Map();
  let values = new Map();
  let state = new Map();
  let ticks = 0;

  const build = (list, links) => {
    parts = list;
    values = new Map();
    nets = new Map();

    const parent = new Map();
    const find = (node) => {
      let root = node;
      while (parent.get(root) !== root) root = parent.get(root);
      return root;
    };
    const add = (id) => {
      if (!parent.has(id)) parent.set(id, id);
      return id;
    };

    parts.forEach((part) => {
      part.inputs.forEach((pin, index) => add(pinKey(part.id, `in${index}`)));
      part.outputs.forEach((pin, index) => add(pinKey(part.id, `out${index}`)));
    });

    links.forEach(({ from, to }) => {
      add(from);
      add(to);
      const a = find(from);
      const b = find(to);
      if (a !== b) parent.set(a, b);
    });

    parent.forEach((value, id) => nets.set(id, find(id)));

    const keep = new Map();
    parts.forEach((part) => {
      const previous = state.get(part.id);
      keep.set(part.id, previous ?? { q: false, count: 0, clock: false, phase: 0 });
    });
    state = keep;
  };

  const net = (partId, pin) => nets.get(pinKey(partId, pin)) ?? pinKey(partId, pin);
  const read = (partId, pin) => Boolean(values.get(net(partId, pin)));
  const write = (partId, pin, value) => values.set(net(partId, pin), Boolean(value));

  const combinational = () => {
    for (let pass = 0; pass < 24; pass += 1) {
      let changed = false;
      parts.forEach((part) => {
        if (part.kind === 'clock' || part.kind === 'toggle' || part.kind === 'high' || part.kind === 'low') return;

        if (part.kind === 'node') {
          const bit = read(part.id, 'in0');
          part.outputs.forEach((pin, index) => {
            const key = net(part.id, `out${index}`);
            if (Boolean(values.get(key)) !== bit) {
              values.set(key, bit);
              changed = true;
            }
          });
          return;
        }

        if (part.kind === 'decoder' || part.kind === 'mux' || part.kind === 'demux' || part.kind === 'encoder') {
          const put = (index, bit) => {
            const key = net(part.id, `out${index}`);
            if (Boolean(values.get(key)) !== bit) {
              values.set(key, bit);
              changed = true;
            }
          };

          if (part.kind === 'decoder') {
            const select = (read(part.id, 'in0') ? 1 : 0) + (read(part.id, 'in1') ? 2 : 0);
            const enable = read(part.id, 'in2');
            for (let line = 0; line < 4; line += 1) put(line, enable && select === line);
          } else if (part.kind === 'mux') {
            const select = (read(part.id, 'in4') ? 1 : 0) + (read(part.id, 'in5') ? 2 : 0);
            put(0, read(part.id, `in${select}`));
          } else if (part.kind === 'demux') {
            const select = (read(part.id, 'in1') ? 1 : 0) + (read(part.id, 'in2') ? 2 : 0);
            const data = read(part.id, 'in0');
            for (let line = 0; line < 4; line += 1) put(line, data && select === line);
          } else {
            let highest = -1;
            for (let line = 0; line < 4; line += 1) if (read(part.id, `in${line}`)) highest = line;
            put(0, highest >= 0 && (highest & 1) === 1);
            put(1, highest >= 0 && (highest & 2) === 2);
            put(2, highest >= 0);
          }
          return;
        }

        const gate = GATES[part.kind];
        if (!gate) return;
        const bits = part.inputs.map((pin, index) => read(part.id, `in${index}`) !== Boolean(part.inverted?.[index]));
        const next = gate.apply(bits);
        const key = net(part.id, 'out0');
        if (Boolean(values.get(key)) !== next) {
          values.set(key, next);
          changed = true;
        }
      });
      if (!changed) break;
    }
  };

  const sources = () => {
    parts.forEach((part) => {
      const memory = state.get(part.id);
      if (part.kind === 'high') write(part.id, 'out0', true);
      else if (part.kind === 'low') write(part.id, 'out0', false);
      else if (part.kind === 'toggle') write(part.id, 'out0', part.on);
      else if (part.kind === 'clock') {
        const period = Math.max(2, Math.round(60 / Math.max(0.2, part.value ?? 2)));
        memory.phase = (memory.phase + 1) % period;
        if (memory.phase === 0) memory.clock = !memory.clock;
        write(part.id, 'out0', memory.clock);
      }
    });
  };

  const sequential = () => {
    parts.forEach((part) => {
      const memory = state.get(part.id);
      if (part.kind === 'dff') {
        const clock = read(part.id, 'in1');
        const data = read(part.id, 'in0');
        if (clock && !memory.clock) memory.q = data;
        memory.clock = clock;
        write(part.id, 'out0', memory.q);
        write(part.id, 'out1', !memory.q);
      } else if (part.kind === 'tff') {
        const clock = read(part.id, 'in1');
        if (clock && !memory.clock && read(part.id, 'in0')) memory.q = !memory.q;
        memory.clock = clock;
        write(part.id, 'out0', memory.q);
      } else if (part.kind === 'counter') {
        const clock = read(part.id, 'in0');
        const reset = read(part.id, 'in1');
        if (reset) memory.count = 0;
        else if (clock && !memory.clock) memory.count = (memory.count + 1) % 16;
        memory.clock = clock;
        for (let bit = 0; bit < 4; bit += 1) write(part.id, `out${bit}`, Boolean((memory.count >> bit) & 1));
      }
    });
  };

  return {
    build,
    step() {
      ticks += 1;
      sources();
      combinational();
      sequential();
      combinational();
    },
    reset() {
      state.forEach((memory) => {
        memory.q = false;
        memory.count = 0;
        memory.clock = false;
        memory.phase = 0;
      });
      values = new Map();
      ticks = 0;
    },
    value: (partId, pin) => read(partId, pin),
    netOf: (partId, pin) => net(partId, pin),
    counterOf: (partId) => state.get(partId)?.count ?? 0,
    get ticks() {
      return ticks;
    },
  };
};
