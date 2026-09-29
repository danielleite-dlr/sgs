// Compila e sobe o backend NestJS nas portas/env do E2E (sem depender de pnpm no PATH).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { BACKEND_DIR, OUTBOX_DIR, loadE2eEnv } from './e2e-env.mjs';

const env = loadE2eEnv();
const require = createRequire(join(BACKEND_DIR, 'package.json'));
const nestBin = require.resolve('@nestjs/cli/bin/nest.js');

const build = spawnSync(process.execPath, [nestBin, 'build'], {
  cwd: BACKEND_DIR,
  env,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

rmSync(OUTBOX_DIR, { recursive: true, force: true });
mkdirSync(OUTBOX_DIR, { recursive: true });

const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: BACKEND_DIR,
  env,
  stdio: 'inherit',
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => child.kill(sig));
}
child.on('exit', (code) => process.exit(code ?? 0));
