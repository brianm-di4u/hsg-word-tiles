// Runs the AI off the main thread: a Worker started from a Blob URL (works from file:// too), with the
// same code on the main thread as a fallback (no Worker, a failed start, or ?worker=0).
import { WORKER_SRC } from './worker-src.js';
import { chooseAction, bestHint } from './ai.js';

export const aiClient = { mode: 'none', worker: null, pending: new Map(), seq: 0, ready: null, dict: null, lex: null };

// dictB64 and lexData go to the worker; dict and lex (already built on the main thread) serve the fallback.
export function startAi(dictB64, lexData, local) {
  aiClient.dict = local.dict; aiClient.lex = local.lex;
  const noWorker = /[?&]worker=0\b/.test(location.search) || typeof Worker === 'undefined';
  if (!noWorker) {
    try {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      const w = new Worker(url);
      aiClient.worker = w;
      aiClient.mode = 'worker';
      w.onmessage = (ev) => { const p = aiClient.pending.get(ev.data.id); if (p) { aiClient.pending.delete(ev.data.id); p(ev.data); } };
      w.onerror = (e) => { e.preventDefault(); fallBack('worker error'); };
      aiClient.ready = call({ type: 'init', dict: dictB64, lex: lexData });
      return aiClient.ready;
    } catch (e) { /* fall through */ }
  }
  fallBack('no worker');
  return aiClient.ready;
}

function fallBack(why) {
  if (aiClient.worker) { try { aiClient.worker.terminate(); } catch (e) { /* gone */ } }
  aiClient.worker = null;
  aiClient.mode = 'main';
  aiClient.why = why;
  aiClient.ready = Promise.resolve();
  // anything still waiting on the worker is answered here
  for (const [id, p] of aiClient.pending) { aiClient.pending.delete(id); p({ type: 'retry', id }); }
}

function call(msg) {
  return new Promise((res) => {
    const id = ++aiClient.seq;
    aiClient.pending.set(id, res);
    aiClient.worker.postMessage({ ...msg, id });
  });
}

// Copy of the state with only what the AI reads (and a fresh rng it may advance).
const slim = (s) => ({ board: s.board, players: s.players.map((p) => ({ rack: p.rack, level: p.level })), cur: s.cur, bag: s.bag, featured: s.featured, rng: { ...s.rng } });

// Resolves { action, rngAi } for the current seat of s.
export async function aiMove(s, level) {
  await aiClient.ready;
  if (aiClient.mode === 'worker') {
    const r = await call({ type: 'move', state: slim(s), level });
    if (r.type !== 'retry') return r;
  }
  await new Promise((res) => setTimeout(res, 0)); // let the UI paint "thinking" first
  const st = slim(s);
  const r = chooseAction(aiClient.dict, aiClient.lex, st, { level });
  return { action: r.action, rngAi: st.rng.ai, nodes: r.nodes };
}

export async function aiHint(s) {
  await aiClient.ready;
  if (aiClient.mode === 'worker') {
    const r = await call({ type: 'hint', state: slim(s) });
    if (r.type !== 'retry') return r.move;
  }
  const m = bestHint(aiClient.dict, aiClient.lex, slim(s));
  return m ? { tiles: m.tiles, score: m.score, words: m.words } : null;
}
