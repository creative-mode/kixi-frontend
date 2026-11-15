import assert from 'node:assert/strict';
import test from 'node:test';
import { isLocalVitalsHost, p75, summarizeVitals, VITAL_TARGETS, type VitalSample } from './vitals.ts';

test('p75 usa o mesmo método do orçamento de laboratório', () => {
  assert.equal(p75([]), 0);
  assert.equal(p75([2500]), 2500);
  assert.equal(p75([100, 200, 300, 400]), 300);
  assert.equal(p75([400, 100, 300, 200]), 300);
});

test('resume por rota, métrica e aparelho e diz o que cabe na meta', () => {
  const sample = (page: string, metric: VitalSample['metric'], value: number, device: VitalSample['device'] = 'mobile'): VitalSample =>
    ({ page, metric, value, device });
  const rows = summarizeVitals([
    sample('result', 'LCP', 2000),
    sample('result', 'LCP', 2600),
    sample('result', 'LCP', 2400),
    sample('result', 'LCP', 3000),
    sample('result', 'INP', 150),
    sample('result', 'LCP', 5000, 'desktop'),
  ]);

  const lcpMobile = rows.find((row) => row.page === 'result' && row.metric === 'LCP' && row.device === 'mobile');
  assert.deepEqual(lcpMobile, { page: 'result', metric: 'LCP', device: 'mobile', samples: 4, p75: 2600, good: false });
  assert.equal(rows.find((row) => row.metric === 'INP')?.good, true);
  assert.equal(rows.find((row) => row.device === 'desktop')?.good, false);
  assert.equal(VITAL_TARGETS.INP, 200);
  assert.equal(VITAL_TARGETS.LCP, 2500);
});

test('o painel local só abre em localhost ou rede privada', () => {
  for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.1.20', '172.16.0.5', '172.31.255.1', 'kixi.localhost']) {
    assert.equal(isLocalVitalsHost(host), true, host);
  }
  for (const host of ['kixi.creativemode.ao', '172.32.0.1', '8.8.8.8', 'example.com', '172.15.0.1']) {
    assert.equal(isLocalVitalsHost(host), false, host);
  }
});
