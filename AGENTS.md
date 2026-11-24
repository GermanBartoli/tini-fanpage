# Guía de tini-fanpage

El tablero público usa `public/tablero.js`, los medios se gestionan en `public/medios.js` y la sección de videoclips en `public/videoclips.js`. La API del Worker está en `servidor.js` y el esquema en `esquema.sql`.

Corré `node --check servidor.js`, `node --check public/tablero.js` y la misma comprobación sobre los módulos modificados. Verificá la vista pública y, con datos de prueba, la carga y el orden de pines en modo edición.

Consultá los pasos de publicación en [el flujo de GitHub Actions](.github/workflows/publicar.yml).
