import { WHITE, BLACK, applyMove, legalMoves, inCheck, isCheckmate, fileOf, rankOf } from './chess.js';

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece square tables, written from white's point of view, rank 8 first.
const TABLES = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0, 20, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
  kEnd: [
   -50,-40,-30,-20,-20,-30,-40,-50,
   -30,-20,-10,  0,  0,-10,-20,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-30,  0,  0,  0,  0,-30,-30,
   -50,-30,-30,-30,-30,-30,-30,-50,
  ],
};

const MATE = 100000;

const slot = (square, colour) => {
  const file = fileOf(square);
  const rank = rankOf(square);
  return colour === WHITE ? rank * 8 + file : (7 - rank) * 8 + file;
};

export function evaluate(state) {
  let score = 0;
  let heavy = 0;
  const men = [];

  for (let square = 0; square < 128; square += 1) {
    if (square & 0x88) continue;
    const piece = state.board[square];
    if (!piece) continue;
    const white = piece === piece.toUpperCase();
    const kind = piece.toLowerCase();
    if (kind === 'q' || kind === 'r') heavy += 1;
    men.push({ square, kind, white });
  }

  const endgame = heavy <= 2;
  for (const man of men) {
    const table = man.kind === 'k' && endgame ? TABLES.kEnd : TABLES[man.kind];
    const worth = VALUE[man.kind] + table[slot(man.square, man.white ? WHITE : BLACK)];
    score += man.white ? worth : -worth;
  }

  return state.turn === WHITE ? score : -score;
}

const captureScore = (state, move) => {
  const victim = state.board[move.to];
  if (!victim) return move.promotion ? VALUE[move.promotion] : 0;
  const attacker = state.board[move.from];
  return VALUE[victim.toLowerCase()] * 10 - VALUE[attacker.toLowerCase()];
};

const order = (state, moves) =>
  moves
    .map((move) => ({ move, rank: captureScore(state, move) }))
    .sort((a, b) => b.rank - a.rank)
    .map((entry) => entry.move);

function quiesce(state, alpha, beta, budget) {
  const stand = evaluate(state);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (budget <= 0) return alpha;

  const loud = legalMoves(state).filter((move) => state.board[move.to] || move.promotion);
  for (const move of order(state, loud)) {
    const { state: after } = applyMove(state, move);
    const score = -quiesce(after, -beta, -alpha, budget - 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// Fail soft: the true best score is returned, not the window bound, so the
// caller can compare sibling moves against each other.
function search(state, depth, alpha, beta, deadline) {
  if (Date.now() > deadline) return { score: evaluate(state), move: null, stopped: true };

  const moves = legalMoves(state);
  // A mate closer to the root keeps more of the remaining depth, so it scores
  // further from zero and the winning side prefers the quicker finish.
  if (!moves.length) return { score: inCheck(state) ? -(MATE + depth) : 0, move: null };
  if (depth === 0) return { score: quiesce(state, alpha, beta, 4), move: null };

  let bestScore = -Infinity;
  let best = null;
  let stopped = false;

  for (const move of order(state, moves)) {
    const { state: after } = applyMove(state, move);
    const reply = search(after, depth - 1, -beta, -alpha, deadline);
    if (reply.stopped) stopped = true;
    const score = -reply.score;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
    if (stopped) break;
  }

  return { score: bestScore, move: best, stopped };
}

export const LEVELS = {
  gentle: { depth: 1, wobble: 90, time: 400 },
  casual: { depth: 2, wobble: 40, time: 700 },
  steady: { depth: 3, wobble: 12, time: 1400 },
  sharp: { depth: 4, wobble: 0, time: 2000 },
  fierce: { depth: 5, wobble: 0, time: 3500 },
};

export function pickMove(state, level = 'steady') {
  const setup = LEVELS[level] ?? LEVELS.steady;
  const moves = legalMoves(state);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];

  const deadline = Date.now() + setup.time;
  let chosen = moves[0];
  const now = new Map();

  for (let depth = 1; depth <= setup.depth; depth += 1) {
    const scored = [];
    let ranOut = false;
    for (const move of order(state, moves)) {
      const { state: after } = applyMove(state, move);
      // every root move gets the full window so the scores can be compared
      const reply = search(after, depth - 1, -Infinity, Infinity, deadline);
      const score = -reply.score;
      if (depth === 1) now.set(move, score);
      scored.push({ move, score });
      if (Date.now() > deadline) {
        ranOut = true;
        break;
      }
    }
    if (scored.length < moves.length && depth > 1) break;
    if (!scored.length) break;

    // Two lines can win the same material a move apart and score the same, and
    // an engine that dithers looks lost. Among equals, take the one that gains
    // ground straight away.
    scored.sort((a, b) => b.score - a.score || (now.get(b.move) ?? 0) - (now.get(a.move) ?? 0));
    const top = scored[0].score;
    // a small band even at the sharpest level, so the tie break below can work
    const band = Math.max(setup.wobble, 25);
    const near = scored.filter((entry) => top - entry.score <= band);
    const bestNow = Math.max(...near.map((entry) => now.get(entry.move) ?? 0));
    const sharpest = near.filter((entry) => (now.get(entry.move) ?? 0) >= bestNow - Math.max(setup.wobble, 20));
    const pool = sharpest.length ? sharpest : near;
    chosen = pool[Math.floor(Math.random() * pool.length)].move;
    if (ranOut) break;
  }

  return chosen;
}

// How good was a move, compared with the best the engine can see?
export function judgeMove(before, move, depth = 3) {
  const moves = legalMoves(before);
  if (moves.length <= 1) return { loss: 0, verdict: 'forced', best: move };

  const deadline = Date.now() + 2500;
  let best = null;
  let bestScore = -Infinity;
  let playedScore = null;

  for (const option of order(before, moves)) {
    const { state: after } = applyMove(before, option);
    const reply = search(after, depth - 1, -Infinity, Infinity, deadline);
    const score = -reply.score;
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
    if (option.from === move.from && option.to === move.to && (option.promotion ?? null) === (move.promotion ?? null)) {
      playedScore = score;
    }
  }

  if (playedScore === null) return { loss: 0, verdict: 'unclear', best };
  const loss = Math.max(0, bestScore - playedScore);
  const verdict = loss < 20 ? 'good' : loss < 60 ? 'fine' : loss < 150 ? 'loose' : loss < 350 ? 'weak' : 'blunder';
  return { loss, verdict, best, bestScore, playedScore };
}
