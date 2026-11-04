import test from 'node:test';
import assert from 'node:assert/strict';

// `GA_ID` lê-se ao importar: o ambiente e os globais do browser montam-se antes do import dinâmico.
process.env.NEXT_PUBLIC_GA_ID = 'G-TESTE';
const writes: string[] = [];
let jar = '_ga=GA1.1.123; _ga_ABC=GS1.1.456; kixi-tema=escuro';
const store = new Map<string, string>();
const events: string[] = [];
const win: Record<string, unknown> = {
  location: { hostname: 'www.kixi.ao' },
  dataLayer: [] as unknown[],
  dispatchEvent: (e: Event) => { events.push(e.type); return true; },
};
Object.assign(globalThis, {
  window: win,
  document: { get cookie() { return jar; }, set cookie(v: string) { writes.push(v); } },
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); events.push(`guardou:${v}:ga-disable=${String(win['ga-disable-G-TESTE'])}`); },
    removeItem: (k: string) => { store.delete(k); },
  },
});
const { CONSENT_EVENT, removePendingAnalyticsCommands, setAnalyticsEnabled, writeConsent } = await import('./consent.ts');
/** Um objeto `Arguments`, como o que o stub do `gtag` empurra para o `dataLayer`. */
function args(..._: unknown[]): IArguments {
  // eslint-disable-next-line prefer-rest-params
  return arguments;
}

test('a retirada remove só os comandos event/config ainda por consumir, no mesmo array', () => {
  const layer: unknown[] = [args('js', 1), args('config', 'G-TESTE'), args('event', 'cta_clique'), args('set', {}), { outro: true }];
  const same = layer;
  removePendingAnalyticsCommands(layer);
  assert.equal(layer, same);
  assert.deepEqual(layer.map((c) => (c && typeof c === 'object' && 'length' in c ? Array.from(c as ArrayLike<unknown>)[0] : 'obj')), ['js', 'set', 'obj']);
});

test('desligar trava o Google tag, purga o dataLayer e apaga só os cookies _ga, no host e nos domínios pai', () => {
  writes.length = 0;
  win.dataLayer = [args('event', 'page_view'), args('js', 1)];
  setAnalyticsEnabled(false);
  assert.equal(win['ga-disable-G-TESTE'], true);
  assert.equal(win.__kixiAnalyticsAllowed, false);
  assert.equal((win.dataLayer as unknown[]).length, 1);
  const apagados = new Set(writes.map((w) => w.split('=')[0]));
  assert.deepEqual([...apagados].sort(), ['_ga', '_ga_ABC']);
  for (const w of writes) assert.match(w, /expires=Thu, 01 Jan 1970/);
  assert.ok(writes.some((w) => w.includes('domain=.kixi.ao')), 'apaga também no domínio pai');
  assert.ok(writes.some((w) => !w.includes('domain=')), 'e sem domínio, como o GA os escreve');
});

test('ligar destrava sem tocar nos cookies', () => {
  writes.length = 0;
  setAnalyticsEnabled(true);
  assert.equal(win['ga-disable-G-TESTE'], false);
  assert.equal(win.__kixiAnalyticsAllowed, true);
  assert.deepEqual(writes, []);
});

test('escolher «só necessários» desliga antes de guardar a escolha e avisa a app', () => {
  events.length = 0;
  setAnalyticsEnabled(true);
  writeConsent('necessary');
  assert.deepEqual(events, ['guardou:necessary:ga-disable=true', CONSENT_EVENT]);
  jar = '';
});
