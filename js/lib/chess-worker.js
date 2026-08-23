// The search runs here so a long think never freezes the page.
import { parseFen } from './chess.js';
import { pickMove, judgeMove } from './chess-ai.js';

self.addEventListener('message', (event) => {
  const { id, kind, fen, level, move, depth } = event.data ?? {};
  try {
    const state = parseFen(fen);
    if (kind === 'pick') {
      self.postMessage({ id, move: pickMove(state, level) });
      return;
    }
    if (kind === 'judge') {
      self.postMessage({ id, verdict: judgeMove(state, move, depth) });
      return;
    }
    self.postMessage({ id, error: `unknown request: ${kind}` });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
});
