// Copia os tokens do design system (design-system/*.css) para cada app. Corre: npm run ds:sync
// Com --check só verifica se as cópias estão em dia (útil em CI).
import fs from 'node:fs';

// A landing não usa Tailwind: leva só os tokens (as cores), não o theme.css.
const TARGETS = [
  { dir: 'student/styles', files: ['tokens.css', 'theme.css'] },
  { dir: 'app', files: ['tokens.css', 'theme.css'] },
  { dir: 'landing/styles', files: ['tokens.css'] },
];
const check = process.argv.includes('--check');
let stale = 0;
for (const { dir, files } of TARGETS) {
  for (const f of files) {
    const src = fs.readFileSync(`design-system/${f}`, 'utf8');
    const dst = `${dir}/ds-${f}`;
    const cur = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : null;
    if (cur === src) continue;
    if (check) { console.error(`desatualizado: ${dst}`); stale++; } else { fs.writeFileSync(dst, src); console.log(`atualizado: ${dst}`); }
  }
}
if (stale) process.exit(1);
