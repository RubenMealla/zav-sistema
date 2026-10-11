import { readFileSync } from 'node:fs';

/**
 * Fuente única de la versión de publicación de ZAV API.
 * En desarrollo y tras compilar, el archivo package.json permanece
 * en el directorio raíz de apps/api.
 */
export const VERSION_API: string = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;
