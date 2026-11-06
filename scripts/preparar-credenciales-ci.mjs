import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';

if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_ENV) {
  throw new Error('Este script genera credenciales efímeras únicamente en GitHub Actions.');
}
for (const nombre of ['JWT_SECRET', 'QA_ADMIN_PASSWORD', 'QA_VENDEDOR_PASSWORD']) {
  const valor = randomBytes(32).toString('hex');
  console.log(`::add-mask::${valor}`);
  appendFileSync(process.env.GITHUB_ENV, `${nombre}=${valor}\n`);
}
console.log('Credenciales sintéticas generadas para esta ejecución.');
