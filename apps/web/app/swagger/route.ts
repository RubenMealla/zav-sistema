export const dynamic = 'force-static';

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ZAV · Swagger API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html,body{margin:0;background:#f4f1ea;color:#292721;font-family:Arial,Helvetica,sans-serif}
    .zav-bar{position:sticky;top:0;z-index:1000;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 20px;background:#151512;color:#fff;border-bottom:3px solid #e45a2e}
    .zav-bar strong{font-size:18px}.zav-bar span{font-size:13px;color:#c9c5bc}.zav-bar a{color:#fff;text-decoration:none;border:1px solid #5a574f;padding:8px 12px;border-radius:5px}
    .zav-aviso{margin:16px auto 0;max-width:1180px;padding:12px 14px;border:1px solid #d6cdbf;border-left:4px solid #e45a2e;background:#fff;font-size:13px;line-height:1.5}
    .zav-aviso b{display:block;margin-bottom:3px}
    #swagger-ui{max-width:1220px;margin:0 auto}
    .swagger-ui .topbar{display:none}
    .swagger-ui .info{margin:24px 0 12px}
    .swagger-ui .scheme-container{box-shadow:none;border:1px solid #ddd7cd}
    .swagger-ui .btn.authorize{border-color:#e45a2e;color:#a63a1d}
  </style>
</head>
<body>
  <div class="zav-bar">
    <div><strong>ZAV · Swagger API</strong><br/><span>Prueba interactiva de endpoints y respuestas HTTP</span></div>
    <a href="/panel">Volver al panel</a>
  </div>
  <div class="zav-aviso">
    <b>Uso rápido</b>
    1) Ejecuta <code>POST /api/v1/auth/login</code> usando uno de los ejemplos. 2) Copia el <code>accessToken</code>. 3) Pulsa <b>Authorize</b> y pega solo el token. 4) Abre un endpoint y pulsa <b>Try it out</b>: los cuerpos y parámetros ya incluyen valores de ejemplo editables. 5) Cuando una operación requiera un UUID, sustituye el valor de ejemplo por el ID retornado en el paso anterior y pulsa <b>Execute</b>.<br/>
    Los casos 400, 401, 403, 404, 409 y 503 tienen ejemplos directos; el 500 transaccional se verifica mediante la suite E2E. No muestres contraseñas ni JWT en capturas de evidencia.
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.addEventListener('load', () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi-zav.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        persistAuthorization: false,
        requestSnippetsEnabled: true,
        docExpansion: 'list'
      });
    });
  </script>
</body>
</html>`;

export async function GET() {
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
