// Arranca landing, aluno, manager e o gateway com um só comando: npm run dev:all
import { spawn } from 'node:child_process';

const jobs = [
  ['landing', ['--prefix', 'landing', 'run', 'dev']],
  ['aluno', ['--prefix', 'student', 'run', 'dev']],
  ['manager', ['run', 'dev']],
];
const kids = jobs.map(([name, args]) => {
  const p = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const tag = (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`));
  p.stdout.on('data', tag);
  p.stderr.on('data', tag);
  return p;
});
const gw = spawn('node', ['scripts/gateway.mjs'], { stdio: 'inherit' });
const stop = () => [...kids, gw].forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
gw.on('exit', stop);
