import './soporte.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
const { formatearHoraQa } = await import('../src/lib/hora-qa.ts');

test('muestra Bolivia en 24 horas y conserva el ISO UTC incluso al cambiar de día', () => {
  const casos = [
    ['2026-10-12T19:07:05.000Z', '15:07:05'],
    ['2026-10-13T02:05:09.000Z', '22:05:09'],
    ['2026-10-13T04:00:00.000Z', '00:00:00'],
    ['2027-01-01T00:00:01.000Z', '20:00:01'],
  ];
  for (const [momento, esperado] of casos) {
    assert.equal(formatearHoraQa(momento), esperado);
    assert.equal(new Date(momento).toISOString(), momento);
  }
  assert.equal(formatearHoraQa('invalida'), '--:--:--');
});

test('la zona del dispositivo no cambia la hora de QA', () => {
  const modulo = new URL('../src/lib/hora-qa.ts', import.meta.url).href;
  for (const TZ of ['UTC', 'America/La_Paz', 'Asia/Tokyo', 'America/Los_Angeles']) {
    const resultado = execFileSync(process.execPath, ['--import', new URL('./soporte.mjs', import.meta.url).href, '--input-type=module', '-e',
      `import { formatearHoraQa } from ${JSON.stringify(modulo)}; process.stdout.write(formatearHoraQa('2026-10-13T04:00:00.000Z'));`,
    ], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(resultado, '00:00:00', TZ);
  }
});
