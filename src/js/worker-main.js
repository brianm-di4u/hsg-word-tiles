// The AI worker. Receives the packed dictionary and the lexicon once, builds its own DAWG, then answers
// move requests. Bundled into worker-src.js by tools/build-worker.mjs; the same code runs on the main
// thread when Workers are unavailable (aiclient.js).
import { loadDict } from './dict.js';
import { makeLexicon } from './lexicon.js';
import { chooseAction, hintChoices } from './ai.js';
import { dailyPar } from './par.js';

let dict = null, lex = null, ready = null;

self.onmessage = async (ev) => {
  const m = ev.data;
  if (m.type === 'init') {
    ready = (async () => { dict = await loadDict(m.dict); lex = makeLexicon(m.lex); })();
    await ready;
    self.postMessage({ type: 'ready', id: m.id });
    return;
  }
  await ready;
  const t0 = performance.now();
  if (m.type === 'move') {
    const s = m.state;
    const r = chooseAction(dict, lex, s, { level: m.level, persona: m.persona });
    self.postMessage({ type: 'move', id: m.id, action: r.action, rngAi: s.rng.ai, nodes: r.nodes, ms: performance.now() - t0 });
  } else if (m.type === 'hint') {
    self.postMessage({ type: 'hint', id: m.id, moves: hintChoices(dict, lex, m.state), ms: performance.now() - t0 });
  } else if (m.type === 'dailyPar') {
    const par = await dailyPar({ dict, lex }, m.date);
    self.postMessage({ type: 'dailyPar', id: m.id, date: m.date, par, ms: performance.now() - t0 });
  }
};
