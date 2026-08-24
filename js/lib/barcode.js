export const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export const EAN_LEFT_ODD = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
export const EAN_LEFT_EVEN = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
export const EAN_RIGHT = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
export const EAN_PARITY = ['OOOOOO', 'OOEOEE', 'OOEEOE', 'OOEEEO', 'OEOOEE', 'OEEOOE', 'OEEEOO', 'OEOEOE', 'OEOEEO', 'OEEOEO'];

export const CODE39 = {
  0: '101001101101', 1: '110100101011', 2: '101100101011', 3: '110110010101', 4: '101001101011',
  5: '110100110101', 6: '101100110101', 7: '101001011011', 8: '110100101101', 9: '101100101101',
  A: '110101001011', B: '101101001011', C: '110110100101', D: '101011001011', E: '110101100101',
  F: '101101100101', G: '101010011011', H: '110101001101', I: '101101001101', J: '101011001101',
  K: '110101010011', L: '101101010011', M: '110110101001', N: '101011010011', O: '110101101001',
  P: '101101101001', Q: '101010110011', R: '110101011001', S: '101101011001', T: '101011011001',
  U: '110010101011', V: '100110101011', W: '110011010101', X: '100101101011', Y: '110010110101',
  Z: '100110110101', '-': '100101011011', '.': '110010101101', ' ': '100110101101', $: '100100100101',
  '/': '100100101001', '+': '100101001001', '%': '101001001001', '*': '100101101101',
};

export const checksum128 = (values) => values.reduce((total, value, index) => total + value * (index === 0 ? 1 : index), 0) % 103;

export const eanCheckDigit = (digits) => {
  const total = [...digits].reduce((sum, digit, index) => {
    const weight = digits.length === 12 ? (index % 2 === 0 ? 1 : 3) : index % 2 === 0 ? 3 : 1;
    return sum + Number(digit) * weight;
  }, 0);
  return (10 - (total % 10)) % 10;
};

export const widthsToBits = (widths) => {
  let bits = '';
  let ink = true;
  [...widths].forEach((width) => {
    bits += (ink ? '1' : '0').repeat(Number(width));
    ink = !ink;
  });
  return bits;
};

export const encodeCode128 = (text) => {
  if (/[^\x20-\x7e]/.test(text)) throw new Error('Code 128 here supports printable ASCII only');
  const values = [104];
  [...text].forEach((character) => values.push(character.charCodeAt(0) - 32));
  values.push(checksum128(values));
  values.push(106);
  return { bits: widthsToBits(values.map((value) => CODE128[value]).join('')), text };
};

export const encodeEan13 = (input) => {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 12) throw new Error('EAN-13 needs 12 or 13 digits');
  const body = digits.slice(0, 12);
  const check = digits.length >= 13 ? Number(digits[12]) : eanCheckDigit(body);
  if (digits.length >= 13 && check !== eanCheckDigit(body)) throw new Error(`Check digit should be ${eanCheckDigit(body)}`);

  const parity = EAN_PARITY[Number(body[0])];
  let bits = '101';
  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(body[index]);
    bits += parity[index - 1] === 'O' ? EAN_LEFT_ODD[digit] : EAN_LEFT_EVEN[digit];
  }
  bits += '01010';
  for (let index = 7; index < 12; index += 1) bits += EAN_RIGHT[Number(body[index])];
  bits += EAN_RIGHT[check];
  bits += '101';
  return { bits, text: `${body}${check}` };
};

export const encodeEan8 = (input) => {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7) throw new Error('EAN-8 needs 7 or 8 digits');
  const body = digits.slice(0, 7);
  const check = digits.length >= 8 ? Number(digits[7]) : eanCheckDigit(body);
  let bits = '101';
  for (let index = 0; index < 4; index += 1) bits += EAN_LEFT_ODD[Number(body[index])];
  bits += '01010';
  for (let index = 4; index < 7; index += 1) bits += EAN_RIGHT[Number(body[index])];
  bits += EAN_RIGHT[check];
  bits += '101';
  return { bits, text: `${body}${check}` };
};

export const encodeCode39 = (input) => {
  const text = input.toUpperCase();
  if ([...text].some((character) => !CODE39[character])) throw new Error('Code 39 supports A-Z, 0-9, space and - . $ / + %');
  return { bits: [...`*${text}*`].map((character) => CODE39[character]).join('0'), text };
};

const patternOf = (bits) => {
  const runs = [];
  let at = 0;
  while (at < bits.length) {
    let length = 1;
    while (at + length < bits.length && bits[at + length] === bits[at]) length += 1;
    runs.push(length);
    at += length;
  }
  return runs;
};

const EAN_DIGITS = [
  ...EAN_LEFT_ODD.map((bits, digit) => ({ digit, parity: 'O', runs: patternOf(bits) })),
  ...EAN_LEFT_EVEN.map((bits, digit) => ({ digit, parity: 'E', runs: patternOf(bits) })),
];
const EAN_RIGHT_DIGITS = EAN_RIGHT.map((bits, digit) => ({ digit, runs: patternOf(bits) }));
const CODE128_RUNS = CODE128.map((widths) => [...widths].map(Number));
const CODE39_RUNS = Object.entries(CODE39).map(([character, bits]) => ({ character, runs: patternOf(bits) }));

const ITF_RUNS = ['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn'];

export function runError(runs, pattern) {
  const seen = runs.reduce((sum, value) => sum + value, 0);
  const want = pattern.reduce((sum, value) => sum + value, 0);
  if (!seen || !want) return Infinity;
  const unit = seen / want;
  if (unit < 0.4) return Infinity;
  let worst = 0;
  for (let i = 0; i < pattern.length; i += 1) {
    const off = Math.abs(runs[i] - pattern[i] * unit) / unit;
    if (off > worst) worst = off;
  }
  return worst;
}

const bestOf = (runs, table, pick, limit = 0.7) => {
  let best = null;
  for (const entry of table) {
    const error = runError(runs, pick(entry));
    if (error < limit && (!best || error < best.error)) best = { entry, error };
  }
  return best;
};

const decodeEan = (runs, start) => {
  const guard = runs.slice(start, start + 3);
  if (guard.length < 3) return null;
  if (runError(guard, [1, 1, 1]) > 0.5) return null;
  const unit = (guard[0] + guard[1] + guard[2]) / 3;

  const readDigits = (at, count, table, pick) => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const chunk = runs.slice(at + i * 4, at + i * 4 + 4);
      if (chunk.length < 4) return null;
      const hit = bestOf(chunk, table, pick);
      if (!hit) return null;
      out.push(hit.entry);
    }
    return out;
  };

  for (const [digitsEachSide, label] of [[6, 'EAN-13'], [4, 'EAN-8']]) {
    const leftAt = start + 3;
    const left = readDigits(leftAt, digitsEachSide, EAN_DIGITS, (entry) => entry.runs);
    if (!left) continue;

    const middleAt = leftAt + digitsEachSide * 4;
    const middle = runs.slice(middleAt, middleAt + 5);
    if (middle.length < 5 || runError(middle, [1, 1, 1, 1, 1]) > 0.6) continue;

    const rightCount = label === 'EAN-13' ? 6 : 4;
    const rightAt = middleAt + 5;
    const right = readDigits(rightAt, rightCount, EAN_RIGHT_DIGITS, (entry) => entry.runs);
    if (!right) continue;

    const endAt = rightAt + rightCount * 4;
    const end = runs.slice(endAt, endAt + 3);
    if (end.length < 3 || runError(end, [1, 1, 1]) > 0.6) continue;

    if (label === 'EAN-8') {
      const body = [...left, ...right].map((entry) => entry.digit).join('');
      if (body.length !== 8) continue;
      if (eanCheckDigit(body.slice(0, 7)) !== Number(body[7])) continue;
      return { text: body, format: 'EAN-8', unit };
    }

    const parity = left.map((entry) => entry.parity).join('');
    const lead = EAN_PARITY.indexOf(parity);
    if (lead < 0) continue;
    const body = `${lead}${left.map((entry) => entry.digit).join('')}${right.map((entry) => entry.digit).join('')}`;
    if (body.length !== 13) continue;
    if (eanCheckDigit(body.slice(0, 12)) !== Number(body[12])) continue;
    const format = body[0] === '0' ? 'UPC-A' : 'EAN-13';
    return { text: format === 'UPC-A' ? body.slice(1) : body, format, unit };
  }
  return null;
};

const decodeCode128 = (runs, start) => {
  const first = runs.slice(start, start + 6);
  if (first.length < 6) return null;
  const startHit = bestOf(first, [103, 104, 105].map((value) => ({ value, runs: CODE128_RUNS[value] })), (entry) => entry.runs, 0.5);
  if (!startHit) return null;

  let mode = startHit.entry.value;
  const values = [mode];
  let at = start + 6;

  while (at + 6 <= runs.length) {
    const stop = runs.slice(at, at + 7);
    if (stop.length === 7 && runError(stop, CODE128_RUNS[106]) < 0.5) {
      const check = values.pop();
      if (check === undefined || checksum128(values) !== check) return null;

      let text = '';
      let set = values[0];
      let shift = null;
      for (const value of values.slice(1)) {
        const active = shift ?? set;
        shift = null;
        if (active === 105) {
          if (value < 100) text += String(value).padStart(2, '0');
          else if (value === 100 || value === 101) set = value === 100 ? 104 : 103;
          continue;
        }
        if (value < 96) {
          const code = active === 103 ? (value < 64 ? value + 32 : value - 64) : value + 32;
          text += String.fromCharCode(code);
          continue;
        }
        if (value === 98) shift = active === 103 ? 104 : 103;
        else if (value === 99) set = 105;
        else if (value === 100) set = 104;
        else if (value === 101) set = 103;
      }
      if (!text) return null;
      return { text, format: 'Code 128' };
    }

    const chunk = runs.slice(at, at + 6);
    if (chunk.length < 6) return null;
    const hit = bestOf(chunk, CODE128_RUNS.slice(0, 106).map((widths, value) => ({ value, runs: widths })), (entry) => entry.runs, 0.6);
    if (!hit) return null;
    values.push(hit.entry.value);
    at += 6;
    if (values.length > 200) return null;
  }
  return null;
};

const decodeCode39 = (runs, start) => {
  let at = start;
  const characters = [];
  while (at + 9 <= runs.length) {
    const chunk = runs.slice(at, at + 9);
    const hit = bestOf(chunk, CODE39_RUNS, (entry) => entry.runs, 0.6);
    if (!hit) break;
    characters.push(hit.entry.character);
    at += 10;
  }
  if (characters.length < 3) return null;
  if (characters[0] !== '*' || characters[characters.length - 1] !== '*') return null;
  const text = characters.slice(1, -1).join('');
  if (!text || text.includes('*')) return null;
  return { text, format: 'Code 39' };
};

const decodeItf = (runs, start) => {
  const guard = runs.slice(start, start + 4);
  if (guard.length < 4 || runError(guard, [1, 1, 1, 1]) > 0.5) return null;
  let at = start + 4;
  const digits = [];
  while (at + 10 <= runs.length) {
    const chunk = runs.slice(at, at + 10);
    const bars = [chunk[0], chunk[2], chunk[4], chunk[6], chunk[8]];
    const spaces = [chunk[1], chunk[3], chunk[5], chunk[7], chunk[9]];
    const readOne = (five) => {
      let best = null;
      for (let digit = 0; digit < 10; digit += 1) {
        const pattern = [...ITF_RUNS[digit]].map((mark) => (mark === 'w' ? 3 : 1));
        const error = runError(five, pattern);
        if (error < 0.7 && (!best || error < best.error)) best = { digit, error };
      }
      return best;
    };
    const one = readOne(bars);
    const two = readOne(spaces);
    if (!one || !two) break;
    digits.push(one.digit, two.digit);
    at += 10;
    if (digits.length > 80) break;
  }
  if (digits.length < 6 || digits.length % 2 !== 0) return null;
  return { text: digits.join(''), format: 'ITF' };
};

export function decodeBarcodeRuns(runs, startsDark) {
  const offset = startsDark ? 0 : 1;
  for (let start = offset; start < runs.length - 12; start += 2) {
    const found =
      decodeEan(runs, start) ||
      decodeCode128(runs, start) ||
      decodeCode39(runs, start) ||
      decodeItf(runs, start);
    if (found) return found;
  }
  return null;
}

export function runsFromLine(read, length) {
  const runs = [];
  let at = 0;
  while (at < length && !read(at)) at += 1;
  if (at >= length) return null;
  const from = at;
  let current = 1;
  let ink = true;
  for (let i = at + 1; i < length; i += 1) {
    const on = !!read(i);
    if (on === ink) current += 1;
    else {
      runs.push(current);
      current = 1;
      ink = on;
    }
  }
  runs.push(current);
  return { runs, from };
}

export function scanBarcodeBitmap(bitmap) {
  const { bits, width, height } = bitmap;
  const at = (x, y) => bits[y * width + x];

  const rows = [];
  for (let i = 1; i < 24; i += 1) rows.push(Math.floor((height * i) / 24));

  for (const y of rows) {
    const line = runsFromLine((x) => at(x, y), width);
    if (line && line.runs.length >= 12) {
      const found = decodeBarcodeRuns(line.runs, true);
      if (found) return { ...found, direction: 'row', line: y };
    }
  }

  for (const x of rows.map((value) => Math.floor((value * width) / height))) {
    if (x < 0 || x >= width) continue;
    const line = runsFromLine((y) => at(x, y), height);
    if (line && line.runs.length >= 12) {
      const found = decodeBarcodeRuns(line.runs, true);
      if (found) return { ...found, direction: 'column', line: x };
    }
  }

  return null;
}
