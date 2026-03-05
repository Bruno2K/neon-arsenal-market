import { Router } from "express";
import { openApiSpec } from "../docs/openapi.js";

const router = Router();

/**
 * GET /docs
 * Serves Swagger UI (via CDN) pre-loaded with the OpenAPI spec.
 * No extra npm packages required.
 */
router.get("/docs", (_req, res) => {
  const specJson = JSON.stringify(openApiSpec, null, 2);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Neon Arsenal Market — API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        spec: ${specJson},
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
        deepLinking: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`);
});

/**
 * GET /docs/json
 * Returns raw OpenAPI spec as JSON (useful for code generation tooling).
 */
router.get("/docs/json", (_req, res) => {
  res.json(openApiSpec);
});

export const docsRoutes = router;
