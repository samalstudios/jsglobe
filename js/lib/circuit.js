const THERMAL = 0.02585;

export const solveLinear = (matrix, vector) => {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-14) continue;
    if (pivot !== column) {
      const swap = rows[pivot];
      rows[pivot] = rows[column];
      rows[column] = swap;
    }
    const head = rows[column][column];
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column] / head;
      if (!factor) continue;
      for (let index = column; index <= size; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }

  return rows.map((row, index) => (Math.abs(row[index]) < 1e-14 ? 0 : row[size] / row[index]));
};

export const createCircuit = () => {
  let nodes = [];
  let parts = [];
  let ground = 0;
  let extras = [];
  let state = new Map();
  let voltages = [];
  let currents = new Map();
  let time = 0;
  let failed = false;

  const index = (node) => (node === ground ? -1 : node > ground ? node - 1 : node);

  const build = (partList, nodeCount, groundNode) => {
    parts = partList;
    nodes = new Array(nodeCount).fill(0);
    ground = groundNode;
    extras = parts.filter((part) => part.type === 'vsource' || part.type === 'inductor' || part.type === 'wire');
    state = new Map();
    parts.forEach((part) => state.set(part.id, { voltage: 0, current: 0 }));
    voltages = new Array(nodeCount).fill(0);
    currents = new Map();
    time = 0;
    failed = false;
  };

  const stamp = (dt, guess) => {
    const size = Math.max(0, nodes.length - 1) + extras.length;
    const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
    const vector = new Array(size).fill(0);
    const offset = Math.max(0, nodes.length - 1);

    const conductance = (a, b, value) => {
      const i = index(a);
      const j = index(b);
      if (i >= 0) matrix[i][i] += value;
      if (j >= 0) matrix[j][j] += value;
      if (i >= 0 && j >= 0) {
        matrix[i][j] -= value;
        matrix[j][i] -= value;
      }
    };

    const inject = (a, b, value) => {
      const i = index(a);
      const j = index(b);
      if (i >= 0) vector[i] += value;
      if (j >= 0) vector[j] -= value;
    };

    const branch = (slot, a, b, resistance, source) => {
      const row = offset + slot;
      const i = index(a);
      const j = index(b);
      if (i >= 0) {
        matrix[i][row] += 1;
        matrix[row][i] += 1;
      }
      if (j >= 0) {
        matrix[j][row] -= 1;
        matrix[row][j] -= 1;
      }
      matrix[row][row] -= resistance;
      vector[row] += source;
    };

    let slot = 0;
    parts.forEach((part) => {
      const memory = state.get(part.id) ?? { voltage: 0, current: 0 };
      if (part.type === 'resistor' || part.type === 'lamp') {
        conductance(part.a, part.b, 1 / Math.max(1e-9, part.value));
      } else if (part.type === 'switch') {
        conductance(part.a, part.b, part.closed ? 1e6 : 1e-12);
      } else if (part.type === 'capacitor') {
        const value = Math.max(1e-15, part.value) / dt;
        conductance(part.a, part.b, value);
        inject(part.a, part.b, value * memory.voltage);
      } else if (part.type === 'inductor') {
        const value = Math.max(1e-12, part.value) / dt;
        branch(slot, part.a, part.b, value, -value * memory.current);
        slot += 1;
      } else if (part.type === 'vsource') {
        const source = part.wave === 'sine' ? part.value * Math.sin(2 * Math.PI * (part.frequency ?? 50) * time) : part.value;
        branch(slot, part.a, part.b, 0, source);
        slot += 1;
      } else if (part.type === 'wire') {
        branch(slot, part.a, part.b, 0, 0);
        slot += 1;
      } else if (part.type === 'isource') {
        inject(part.b, part.a, part.value);
      } else if (part.type === 'npn' || part.type === 'pnp') {
        const sign = part.type === 'npn' ? 1 : -1;
        const beta = part.beta ?? 100;
        const reverse = 2;
        const saturation = 1e-14;
        const limit = (value) => Math.max(-4, Math.min(0.85, value));
        const vbe = limit(sign * (((guess[index(part.b)] ?? 0) - (guess[index(part.e)] ?? 0))));
        const vbc = limit(sign * (((guess[index(part.b)] ?? 0) - (guess[index(part.c)] ?? 0))));

        const expBe = Math.exp(Math.min(40, vbe / THERMAL));
        const expBc = Math.exp(Math.min(40, vbc / THERMAL));

        const ibe = (saturation / beta) * (expBe - 1);
        const ibc = (saturation / reverse) * (expBc - 1);
        const transport = saturation * (expBe - expBc);

        const gbe = Math.max(1e-12, (saturation / beta) * expBe / THERMAL);
        const gbc = Math.max(1e-12, (saturation / reverse) * expBc / THERMAL);
        const gf = Math.max(1e-12, (saturation * expBe) / THERMAL);
        const gr = Math.max(1e-12, (saturation * expBc) / THERMAL);

        const ic = transport - ibc;
        const ib = ibe + ibc;

        conductance(part.b, part.e, gbe);
        conductance(part.b, part.c, gbc);

        const b = index(part.b);
        const c = index(part.c);
        const e = index(part.e);
        if (c >= 0) {
          if (b >= 0) matrix[c][b] += sign * sign * (gf - gr);
          if (e >= 0) matrix[c][e] -= sign * sign * gf;
          if (c >= 0) matrix[c][c] += sign * sign * gr;
        }
        if (e >= 0) {
          if (b >= 0) matrix[e][b] -= sign * sign * (gf - gr);
          if (e >= 0) matrix[e][e] += sign * sign * gf;
          if (c >= 0) matrix[e][c] -= sign * sign * gr;
        }

        inject(part.e, part.c, sign * (ic - gf * vbe + gr * vbc));
        inject(part.b, part.e, sign * (-ibe + gbe * vbe));
        inject(part.b, part.c, sign * (-ibc + gbc * vbc));
        void ib;
      } else if (part.type === 'nmos' || part.type === 'pmos') {
        const sign = part.type === 'nmos' ? 1 : -1;
        const threshold = part.threshold ?? 1.8;
        const strength = part.strength ?? 0.02;
        const vgs = sign * ((guess[index(part.b)] ?? 0) - (guess[index(part.e)] ?? 0));
        const vds = sign * ((guess[index(part.c)] ?? 0) - (guess[index(part.e)] ?? 0));
        const overdrive = vgs - threshold;

        let drain = 0;
        let gm = 0;
        let gds = 1e-9;
        if (overdrive > 0) {
          if (vds < overdrive) {
            drain = strength * (overdrive * vds - (vds * vds) / 2);
            gm = strength * vds;
            gds = Math.max(1e-9, strength * (overdrive - vds));
          } else {
            drain = (strength / 2) * overdrive * overdrive;
            gm = strength * overdrive;
            gds = 1e-9;
          }
        }

        conductance(part.c, part.e, gds);
        const c = index(part.c);
        const e = index(part.e);
        const g = index(part.b);
        if (c >= 0 && g >= 0) matrix[c][g] += gm;
        if (c >= 0 && e >= 0) matrix[c][e] -= gm;
        if (e >= 0 && g >= 0) matrix[e][g] -= gm;
        if (e >= 0) matrix[e][e] += gm;

        inject(part.e, part.c, sign * (drain - gm * vgs - gds * vds));
      } else if (part.type === 'diode' || part.type === 'led') {
        const saturation = part.type === 'led' ? 1e-16 : 1e-12;
        const emission = part.type === 'led' ? 2.4 : 1.6;
        const ceiling = part.type === 'led' ? 2.6 : 1.2;
        const across = Math.max(-1, Math.min(ceiling, (guess[index(part.a)] ?? 0) - (guess[index(part.b)] ?? 0)));
        const exponent = Math.exp(Math.min(40, across / (emission * THERMAL)));
        const current = saturation * (exponent - 1);
        const slope = Math.max(1e-12, (saturation * exponent) / (emission * THERMAL));
        conductance(part.a, part.b, slope);
        inject(part.b, part.a, current - slope * across);
      }
    });

    return { matrix, vector, offset };
  };

  const step = (dt) => {
    let guess = voltages.map((value, node) => (node === ground ? 0 : value));
    let solution = [];
    const nonlinear = parts.some((part) =>
      ['diode', 'led', 'npn', 'pnp', 'nmos', 'pmos'].includes(part.type),
    );
    const passes = nonlinear ? 40 : 1;

    for (let pass = 0; pass < passes; pass += 1) {
      const packed = guess.filter((value, node) => node !== ground);
      const { matrix, vector, offset } = stamp(dt, packed);
      if (!matrix.length) return;
      solution = solveLinear(matrix, vector);
      if (solution.some((value) => !Number.isFinite(value))) {
        failed = true;
        return;
      }

      const next = new Array(nodes.length).fill(0);
      nodes.forEach((item, node) => {
        if (node === ground) return;
        next[node] = solution[index(node)] ?? 0;
      });

      const delta = Math.max(...next.map((value, node) => Math.abs(value - guess[node])), 0);
      guess = next;
      if (delta < 1e-7) break;
    }

    voltages = guess;
    currents = new Map();

    let slot = 0;
    const offset = Math.max(0, nodes.length - 1);
    parts.forEach((part) => {
      const across = (voltages[part.a] ?? 0) - (voltages[part.b] ?? 0);
      const memory = state.get(part.id) ?? { voltage: 0, current: 0 };
      let current = 0;
      if (part.type === 'resistor' || part.type === 'lamp') current = across / Math.max(1e-9, part.value);
      else if (part.type === 'switch') current = across * (part.closed ? 1e6 : 1e-12);
      else if (part.type === 'capacitor') current = (Math.max(1e-15, part.value) / dt) * (across - memory.voltage);
      else if (part.type === 'isource') current = part.value;
      else if (part.type === 'diode' || part.type === 'led') {
        const saturation = part.type === 'led' ? 1e-16 : 1e-12;
        const emission = part.type === 'led' ? 2.4 : 1.6;
        const ceiling = part.type === 'led' ? 2.6 : 1.2;
        const held = Math.max(-1, Math.min(ceiling, across));
        const exponent = Math.exp(Math.min(40, held / (emission * THERMAL)));
        const slope = Math.max(1e-12, (saturation * exponent) / (emission * THERMAL));
        current = saturation * (exponent - 1) + slope * (across - held);
      } else if (part.type === 'npn' || part.type === 'pnp' || part.type === 'nmos' || part.type === 'pmos') {
        current = 0;
      } else if (part.type === 'vsource' || part.type === 'inductor' || part.type === 'wire') {
        current = solution[offset + slot] ?? 0;
        slot += 1;
      }
      state.set(part.id, { voltage: across, current });
      currents.set(part.id, current);
    });

    time += dt;
  };

  return {
    build,
    step,
    reset() {
      parts.forEach((part) => state.set(part.id, { voltage: 0, current: 0 }));
      voltages = voltages.map(() => 0);
      currents = new Map();
      time = 0;
      failed = false;
    },
    get time() {
      return time;
    },
    get failed() {
      return failed;
    },
    voltage: (node) => voltages[node] ?? 0,
    current: (id) => currents.get(id) ?? 0,
  };
};
