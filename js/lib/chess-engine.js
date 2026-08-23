// A thinking chess engine that keeps the page responsive.
//
// The search runs in a worker where one can be started, and falls back to
// running in place otherwise, so the caller always gets a promise either way.
import { parseFen } from './chess.js';
import { pickMove, judgeMove } from './chess-ai.js';

export function createEngine() {
  let worker = null;
  let broken = false;
  let ticket = 0;
  const waiting = new Map();

  const start = () => {
    if (worker || broken) return worker;
    try {
      worker = new Worker(new URL('./chess-worker.js', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event) => {
        const { id, move, verdict, error } = event.data ?? {};
        const pending = waiting.get(id);
        if (!pending) return;
        waiting.delete(id);
        if (error) pending.reject(new Error(error));
        else pending.resolve(move !== undefined ? move : verdict);
      });
      worker.addEventListener('error', () => {
        // fall back for good rather than leaving callers hanging
        broken = true;
        waiting.forEach((pending) => pending.reject(new Error('the worker stopped')));
        waiting.clear();
        worker?.terminate();
        worker = null;
      });
    } catch {
      broken = true;
      worker = null;
    }
    return worker;
  };

  const ask = (payload, inPlace) => {
    const engine = start();
    if (!engine) {
      // Yield first, so the caller can paint a thinking state before the
      // main thread is taken over.
      return new Promise((resolve) => setTimeout(() => resolve(inPlace()), 0));
    }
    const id = (ticket += 1);
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      engine.postMessage({ id, ...payload });
    });
  };

  return {
    get inWorker() {
      return Boolean(worker) && !broken;
    },

    think(fen, level) {
      return ask({ kind: 'pick', fen, level }, () => pickMove(parseFen(fen), level));
    },

    judge(fen, move, depth = 2) {
      return ask({ kind: 'judge', fen, move, depth }, () => judgeMove(parseFen(fen), move, depth));
    },

    // Abandon anything in flight. The worker is replaced because a search
    // already under way cannot be interrupted from outside.
    stop() {
      if (!worker) return;
      waiting.forEach((pending) => pending.reject(Object.assign(new Error('stopped'), { name: 'AbortError' })));
      waiting.clear();
      worker.terminate();
      worker = null;
    },

    dispose() {
      waiting.clear();
      worker?.terminate();
      worker = null;
    },
  };
}
