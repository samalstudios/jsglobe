const CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2, inf: Infinity };

const FUNCTIONS = {
  abs: Math.abs, sqrt: Math.sqrt, cbrt: Math.cbrt, ln: Math.log, log: Math.log10, log2: Math.log2,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
  round: Math.round, sign: Math.sign, trunc: Math.trunc,
  min: Math.min, max: Math.max, hypot: Math.hypot, pow: Math.pow,
  fact: (n) => (n <= 1 ? 1 : Array.from({ length: n }, (unused, index) => index + 1).reduce((total, value) => total * value, 1)),
  deg: (radians) => (radians * 180) / Math.PI,
  rad: (degrees) => (degrees * Math.PI) / 180,
};

const tokenize = (input) => {
  const tokens = [];
  const source = input.replace(/\s+/g, '');
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/[0-9.]/.test(char)) {
      let number = '';
      while (index < source.length && /[0-9._eE]/.test(source[index])) {
        if ((source[index] === 'e' || source[index] === 'E') && !/[0-9]/.test(source[index + 1] ?? '') && source[index + 1] !== '-') break;
        number += source[index] === '_' ? '' : source[index];
        index += 1;
      }
      tokens.push({ type: 'number', value: Number(number) });
      continue;
    }
    if (/[a-zA-Z]/.test(char)) {
      let name = '';
      while (index < source.length && /[a-zA-Z0-9]/.test(source[index])) {
        name += source[index];
        index += 1;
      }
      tokens.push({ type: 'name', value: name.toLowerCase() });
      continue;
    }
    if ('+-*/^%(),!'.includes(char)) {
      tokens.push({ type: 'op', value: char });
      index += 1;
      continue;
    }
    throw new Error(`Unexpected character "${char}"`);
  }
  return tokens;
};

const evaluate = (input, variables = {}) => {
  const tokens = tokenize(input);
  let position = 0;

  const peek = () => tokens[position];
  const eat = (value) => {
    if (peek()?.type === 'op' && peek().value === value) {
      position += 1;
      return true;
    }
    return false;
  };

  const parseExpression = () => {
    let left = parseTerm();
    while (peek()?.type === 'op' && '+-'.includes(peek().value)) {
      const operator = tokens[position].value;
      position += 1;
      const right = parseTerm();
      left = operator === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = () => {
    let left = parseFactor();
    while (peek()?.type === 'op' && '*/%'.includes(peek().value)) {
      const operator = tokens[position].value;
      position += 1;
      const right = parseFactor();
      left = operator === '*' ? left * right : operator === '/' ? left / right : left % right;
    }
    return left;
  };

  const parseFactor = () => {
    const base = parseUnary();
    if (peek()?.type === 'op' && peek().value === '^') {
      position += 1;
      return base ** parseFactor();
    }
    return base;
  };

  const parseUnary = () => {
    if (eat('-')) return -parseUnary();
    if (eat('+')) return parseUnary();
    return parsePostfix();
  };

  const parsePostfix = () => {
    let value = parsePrimary();
    while (eat('!')) value = FUNCTIONS.fact(value);
    return value;
  };

  const parsePrimary = () => {
    const token = peek();
    if (!token) throw new Error('Unexpected end of expression');

    if (token.type === 'number') {
      position += 1;
      return token.value;
    }

    if (token.type === 'name') {
      position += 1;
      const name = token.value;
      if (eat('(')) {
        const args = [];
        if (!eat(')')) {
          do {
            args.push(parseExpression());
          } while (eat(','));
          if (!eat(')')) throw new Error('Missing closing parenthesis');
        }
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error(`Unknown function "${name}"`);
        return fn(...args);
      }
      if (name in variables) return variables[name];
      if (name in CONSTANTS) return CONSTANTS[name];
      throw new Error(`Unknown name "${name}"`);
    }

    if (eat('(')) {
      const value = parseExpression();
      if (!eat(')')) throw new Error('Missing closing parenthesis');
      return value;
    }

    throw new Error(`Unexpected token "${token.value}"`);
  };

  const result = parseExpression();
  if (position < tokens.length) throw new Error('Unexpected trailing input');
  return result;
};

export { evaluate, CONSTANTS, FUNCTIONS };
