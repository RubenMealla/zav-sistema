import paqueteWeb from '../../package.json';

/**
 * Única fuente de la versión pública de ZAV Web.
 * Se actualiza en apps/web/package.json al publicar una nueva versión.
 */
export const VERSION_WEB: string = paqueteWeb.version;
