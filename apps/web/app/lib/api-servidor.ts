// URL única de la API para las solicitudes realizadas por el servidor Next.js.
export const API_BASE_URL =
  process.env.API_BASE_URL?.trim().replace(/\/+$/, '') ||
  (process.env.NODE_ENV === 'production'
    ? 'https://zav-api-2026.onrender.com'
    : 'http://localhost:3001');
