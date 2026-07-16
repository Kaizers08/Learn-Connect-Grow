import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const browserDir = join('dist', 'Edtech-Mentoring', 'browser');
const csr = join(browserDir, 'index.csr.html');
const index = join(browserDir, 'index.html');

if (!existsSync(csr)) {
  console.error('Missing build output:', csr);
  process.exit(1);
}

copyFileSync(csr, index);
console.log('Prepared Vercel static entry:', index);
