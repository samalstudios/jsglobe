// A 0x88 board: index is rank * 16 + file, and any index with a bit in 0x88 is off the board.
const OFF = 0x88;

export const WHITE = 'w';
export const BLACK = 'b';

const PAWN_PUSH = { w: -16, b: 16 };
const PAWN_START = { w: 6, b: 1 };
const PAWN_LAST = { w: 0, b: 7 };
const PAWN_TAKES = { w: [-17, -15], b: [15, 17] };

const STEPS = {
  n: [-33, -31, -18, -14, 14, 18, 31, 33],
  b: [-17, -15, 15, 17],
  r: [-16, -1, 1, 16],
  q: [-17, -16, -15, -1, 1, 15, 16, 17],
  k: [-17, -16, -15, -1, 1, 15, 16, 17],
};

const SLIDES = { b: true, r: true, q: true };

export const fileOf = (square) => square & 15;
export const rankOf = (square) => square >> 4;
export const onBoard = (square) => !(square & OFF);

export const squareName = (square) => `${'abcdefgh'[fileOf(square)]}${8 - rankOf(square)}`;
export const squareFrom = (name) => {
  const file = 'abcdefgh'.indexOf(name[0]);
  const rank = 8 - Number(name[1]);
  return file < 0 || rank < 0 || rank > 7 ? -1 : rank * 16 + file;
};

const isWhite = (piece) => piece && piece === piece.toUpperCase();
const colourOf = (piece) => (piece ? (isWhite(piece) ? WHITE : BLACK) : null);
const kindOf = (piece) => (piece ? piece.toLowerCase() : null);

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function parseFen(fen = START_FEN) {
  const [layout, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
  const board = new Array(128).fill(null);
  let square = 0;
  for (const symbol of layout) {
    if (symbol === '/') {
      square += 8;
      continue;
    }
    if (/\d/.test(symbol)) {
      square += Number(symbol);
      continue;
    }
    board[square] = symbol;
    square += 1;
  }
  return {
    board,
    turn: turn === 'b' ? BLACK : WHITE,
    castling: {
      K: castling.includes('K'),
      Q: castling.includes('Q'),
      k: castling.includes('k'),
      q: castling.includes('q'),
    },
    ep: ep && ep !== '-' ? squareFrom(ep) : -1,
    half: Number(half ?? 0),
    full: Number(full ?? 1),
  };
}

export function toFen(state) {
  let layout = '';
  for (let rank = 0; rank < 8; rank += 1) {
    let gap = 0;
    for (let file = 0; file < 8; file += 1) {
      const piece = state.board[rank * 16 + file];
      if (!piece) {
        gap += 1;
        continue;
      }
      if (gap) layout += gap;
      gap = 0;
      layout += piece;
    }
    if (gap) layout += gap;
    if (rank < 7) layout += '/';
  }
  const rights =
    `${state.castling.K ? 'K' : ''}${state.castling.Q ? 'Q' : ''}${state.castling.k ? 'k' : ''}${state.castling.q ? 'q' : ''}` || '-';
  return `${layout} ${state.turn} ${rights} ${state.ep >= 0 ? squareName(state.ep) : '-'} ${state.half} ${state.full}`;
}

export const cloneState = (state) => ({
  board: state.board.slice(),
  turn: state.turn,
  castling: { ...state.castling },
  ep: state.ep,
  half: state.half,
  full: state.full,
});

const ROOK_WAYS = [-16, 16, -1, 1];
const BISHOP_WAYS = [-17, -15, 15, 17];
const KNIGHT_WAYS = STEPS.n;
const KING_WAYS = STEPS.k;

// Walk outward from the square being asked about rather than scanning the whole
// board for every piece. Legality checks call this once per candidate move, so
// the difference decides how deep the search can go.
export function attacked(state, square, by) {
  const board = state.board;
  const white = by === WHITE;

  // a pawn attacking this square sits where it could have captured from
  for (const step of PAWN_TAKES[by]) {
    const from = square - step;
    if (from & OFF) continue;
    const piece = board[from];
    if (piece && (white ? piece === 'P' : piece === 'p')) return true;
  }

  for (const step of KNIGHT_WAYS) {
    const from = square + step;
    if (from & OFF) continue;
    const piece = board[from];
    if (piece && (white ? piece === 'N' : piece === 'n')) return true;
  }

  for (const step of KING_WAYS) {
    const from = square + step;
    if (from & OFF) continue;
    const piece = board[from];
    if (piece && (white ? piece === 'K' : piece === 'k')) return true;
  }

  for (const step of ROOK_WAYS) {
    let to = square + step;
    while (!(to & OFF)) {
      const piece = board[to];
      if (piece) {
        if (white ? piece === 'R' || piece === 'Q' : piece === 'r' || piece === 'q') return true;
        break;
      }
      to += step;
    }
  }

  for (const step of BISHOP_WAYS) {
    let to = square + step;
    while (!(to & OFF)) {
      const piece = board[to];
      if (piece) {
        if (white ? piece === 'B' || piece === 'Q' : piece === 'b' || piece === 'q') return true;
        break;
      }
      to += step;
    }
  }

  return false;
}

export function kingSquare(state, colour) {
  const wanted = colour === WHITE ? 'K' : 'k';
  for (let square = 0; square < 128; square += 1) {
    if (square & OFF) continue;
    if (state.board[square] === wanted) return square;
  }
  return -1;
}

export const inCheck = (state, colour = state.turn) => {
  const king = kingSquare(state, colour);
  return king >= 0 && attacked(state, king, colour === WHITE ? BLACK : WHITE);
};

function pushPawnMoves(state, from, colour, out) {
  const push = PAWN_PUSH[colour];
  const ahead = from + push;
  const promoting = rankOf(ahead) === PAWN_LAST[colour];

  if (onBoard(ahead) && !state.board[ahead]) {
    if (promoting) for (const piece of 'qrbn') out.push({ from, to: ahead, promotion: piece });
    else {
      out.push({ from, to: ahead });
      const twice = from + push * 2;
      if (rankOf(from) === PAWN_START[colour] && !state.board[twice]) out.push({ from, to: twice, double: true });
    }
  }

  for (const step of PAWN_TAKES[colour]) {
    const to = from + step;
    if (!onBoard(to)) continue;
    const target = state.board[to];
    if (target && colourOf(target) !== colour) {
      if (promoting) for (const piece of 'qrbn') out.push({ from, to, promotion: piece });
      else out.push({ from, to });
    } else if (!target && to === state.ep) {
      out.push({ from, to, enPassant: true });
    }
  }
}

export function pseudoMoves(state, colour = state.turn) {
  const out = [];
  for (let from = 0; from < 128; from += 1) {
    if (from & OFF) continue;
    const piece = state.board[from];
    if (!piece || colourOf(piece) !== colour) continue;
    const kind = kindOf(piece);

    if (kind === 'p') {
      pushPawnMoves(state, from, colour, out);
      continue;
    }

    for (const step of STEPS[kind]) {
      let to = from + step;
      while (onBoard(to)) {
        const target = state.board[to];
        if (!target) out.push({ from, to });
        else {
          if (colourOf(target) !== colour) out.push({ from, to });
          break;
        }
        if (!SLIDES[kind]) break;
        to += step;
      }
    }

    if (kind === 'k') {
      const rights = state.castling;
      const home = colour === WHITE ? 116 : 4;
      const foe = colour === WHITE ? BLACK : WHITE;
      if (from === home && !attacked(state, home, foe)) {
        const short = colour === WHITE ? rights.K : rights.k;
        const long = colour === WHITE ? rights.Q : rights.q;
        if (short && !state.board[home + 1] && !state.board[home + 2] && !attacked(state, home + 1, foe) && !attacked(state, home + 2, foe)) {
          out.push({ from, to: home + 2, castle: 'k' });
        }
        if (
          long &&
          !state.board[home - 1] &&
          !state.board[home - 2] &&
          !state.board[home - 3] &&
          !attacked(state, home - 1, foe) &&
          !attacked(state, home - 2, foe)
        ) {
          out.push({ from, to: home - 2, castle: 'q' });
        }
      }
    }
  }
  return out;
}

export function applyMove(state, move) {
  const next = cloneState(state);
  const piece = next.board[move.from];
  const colour = colourOf(piece);
  const kind = kindOf(piece);
  const captured = move.enPassant ? next.board[move.to - PAWN_PUSH[colour]] : next.board[move.to];

  next.board[move.to] = move.promotion ? (colour === WHITE ? move.promotion.toUpperCase() : move.promotion) : piece;
  next.board[move.from] = null;
  if (move.enPassant) next.board[move.to - PAWN_PUSH[colour]] = null;

  if (move.castle) {
    const home = colour === WHITE ? 116 : 4;
    if (move.castle === 'k') {
      next.board[home + 1] = next.board[home + 3];
      next.board[home + 3] = null;
    } else {
      next.board[home - 1] = next.board[home - 4];
      next.board[home - 4] = null;
    }
  }

  if (kind === 'k') {
    if (colour === WHITE) {
      next.castling.K = false;
      next.castling.Q = false;
    } else {
      next.castling.k = false;
      next.castling.q = false;
    }
  }
  const clearRook = (square) => {
    if (square === 119) next.castling.K = false;
    if (square === 112) next.castling.Q = false;
    if (square === 7) next.castling.k = false;
    if (square === 0) next.castling.q = false;
  };
  clearRook(move.from);
  clearRook(move.to);

  next.ep = move.double ? move.from + PAWN_PUSH[colour] : -1;
  next.half = kind === 'p' || captured ? 0 : state.half + 1;
  next.full = colour === BLACK ? state.full + 1 : state.full;
  next.turn = colour === WHITE ? BLACK : WHITE;

  return { state: next, captured };
}

export function legalMoves(state, colour = state.turn) {
  const out = [];
  for (const move of pseudoMoves(state, colour)) {
    const { state: after } = applyMove(state, move);
    if (!inCheck(after, colour)) out.push(move);
  }
  return out;
}

export const isCheckmate = (state) => inCheck(state) && legalMoves(state).length === 0;
export const isStalemate = (state) => !inCheck(state) && legalMoves(state).length === 0;

export function insufficientMaterial(state) {
  const pieces = [];
  for (let square = 0; square < 128; square += 1) {
    if (square & OFF) continue;
    const piece = state.board[square];
    if (piece && kindOf(piece) !== 'k') pieces.push({ kind: kindOf(piece), square });
  }
  if (!pieces.length) return true;
  if (pieces.length === 1 && (pieces[0].kind === 'n' || pieces[0].kind === 'b')) return true;
  if (pieces.length === 2 && pieces.every((entry) => entry.kind === 'b')) {
    const shade = (square) => (fileOf(square) + rankOf(square)) % 2;
    return shade(pieces[0].square) === shade(pieces[1].square);
  }
  return false;
}

export function moveToSan(state, move) {
  const piece = state.board[move.from];
  const kind = kindOf(piece);
  const target = move.enPassant ? 'p' : kindOf(state.board[move.to]);
  const { state: after } = applyMove(state, move);
  const suffix = isCheckmate(after) ? '#' : inCheck(after) ? '+' : '';

  if (move.castle) return `${move.castle === 'k' ? 'O-O' : 'O-O-O'}${suffix}`;

  if (kind === 'p') {
    const body = target
      ? `${'abcdefgh'[fileOf(move.from)]}x${squareName(move.to)}`
      : squareName(move.to);
    return `${body}${move.promotion ? `=${move.promotion.toUpperCase()}` : ''}${suffix}`;
  }

  const rivals = legalMoves(state).filter(
    (other) =>
      other.to === move.to &&
      other.from !== move.from &&
      kindOf(state.board[other.from]) === kind,
  );
  let hint = '';
  if (rivals.length) {
    const sameFile = rivals.some((other) => fileOf(other.from) === fileOf(move.from));
    const sameRank = rivals.some((other) => rankOf(other.from) === rankOf(move.from));
    if (!sameFile) hint = 'abcdefgh'[fileOf(move.from)];
    else if (!sameRank) hint = String(8 - rankOf(move.from));
    else hint = squareName(move.from);
  }
  return `${kind.toUpperCase()}${hint}${target ? 'x' : ''}${squareName(move.to)}${suffix}`;
}

export function sanToMove(state, san) {
  const clean = san.replace(/[+#!?]/g, '').trim();
  for (const move of legalMoves(state)) {
    if (moveToSan(state, move).replace(/[+#!?]/g, '') === clean) return move;
  }
  return null;
}

export const moveKey = (move) => `${squareName(move.from)}${squareName(move.to)}${move.promotion ?? ''}`;

export function perft(state, depth) {
  if (depth === 0) return 1;
  let total = 0;
  for (const move of legalMoves(state)) {
    const { state: after } = applyMove(state, move);
    total += perft(after, depth - 1);
  }
  return total;
}
