const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ',
  Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const SYMBOLS = {
  times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', leq: '≤', geq: '≥', neq: '≠',
  approx: '≈', equiv: '≡', propto: '∝', infty: '∞', partial: '∂', nabla: '∇',
  sum: '∑', prod: '∏', int: '∫', sqrt: '√', in: '∈', notin: '∉', subset: '⊂',
  cup: '∪', cap: '∩', forall: '∀', exists: '∃', rightarrow: '→', leftarrow: '←',
  Rightarrow: '⇒', leftrightarrow: '↔', therefore: '∴', degree: '°', angle: '∠',
  ne: '≠', le: '≤', ge: '≥', to: '→', ldots: '…', dots: '…',
};

const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const takeGroup = (source, at) => {
  if (source[at] !== '{') {
    return { body: source[at] ?? '', next: at + 1 };
  }
  let depth = 0;
  for (let i = at; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (!depth) return { body: source.slice(at + 1, i), next: i + 1 };
    }
  }
  return { body: source.slice(at + 1), next: source.length };
};

export function formulaToHtml(source) {
  let out = '';
  let at = 0;
  const text = String(source ?? '');

  while (at < text.length) {
    const character = text[at];

    if (character === '\\') {
      const name = /^[A-Za-z]+/.exec(text.slice(at + 1))?.[0] ?? '';
      if (name === 'frac') {
        const top = takeGroup(text, at + 1 + name.length);
        const bottom = takeGroup(text, top.next);
        out += `<span class="frac"><span class="over">${formulaToHtml(top.body)}</span><span class="under">${formulaToHtml(bottom.body)}</span></span>`;
        at = bottom.next;
        continue;
      }
      if (name === 'sqrt') {
        const body = takeGroup(text, at + 1 + name.length);
        out += `√<span class="root">${formulaToHtml(body.body)}</span>`;
        at = body.next;
        continue;
      }
      if (GREEK[name] || SYMBOLS[name]) {
        out += GREEK[name] ?? SYMBOLS[name];
        at += 1 + name.length;
        continue;
      }
      out += escapeHtml(character);
      at += 1;
      continue;
    }

    if (character === '^' || character === '_') {
      const body = takeGroup(text, at + 1);
      const tag = character === '^' ? 'sup' : 'sub';
      out += `<${tag}>${formulaToHtml(body.body)}</${tag}>`;
      at = body.next;
      continue;
    }

    if (character === '*') {
      out += '·';
      at += 1;
      continue;
    }

    out += escapeHtml(character);
    at += 1;
  }
  return out;
}

export const formulaToText = (source) =>
  formulaToHtml(source)
    .replace(/<span class="frac"><span class="over">([\s\S]*?)<\/span><span class="under">([\s\S]*?)<\/span><\/span>/g, '($1)/($2)')
    .replace(/<[^>]+>/g, '');

export const SAMPLES = [
  { label: 'Pythagoras', source: 'a^2 + b^2 = c^2' },
  { label: 'Quadratic', source: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { label: 'Euler', source: 'e^{i\\pi} + 1 = 0' },
  { label: 'Mass energy', source: 'E = mc^2' },
  { label: 'Sum', source: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
  { label: 'Rate', source: '\\Delta x = v_0 t + \\frac{1}{2}at^2' },
];
