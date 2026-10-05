// Copia os tokens do design system (design-system/*.css) para cada app. Corre: npm run ds:sync
// Com --check só verifica se as cópias estão em dia (útil em CI).
import fs from 'node:fs';

const FILES = ['tokens.css', 'theme.css'];
const TARGETS = ['student/styles', 'app'];
const check = process.argv.includes('--check');
let stale = 0;
for (const dir of TARGETS) {
  for (const f of FILES) {
    const src = fs.readFileSync(`design-system/${f}`, 'utf8');
    const dst = `${dir}/ds-${f}`;
    const cur = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : null;
    if (cur === src) continue;
    if (check) { console.error(`desatualizado: ${dst}`); stale++; } else { fs.writeFileSync(dst, src); console.log(`atualizado: ${dst}`); }
  }
}
if (stale) process.exit(1);
