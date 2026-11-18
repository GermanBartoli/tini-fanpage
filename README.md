# TINI

Fanpage independiente con un tablero público de fotos y enlaces. [Abrir la página](https://tini-fanpage.bartoligerman497.workers.dev/).

## Usar el tablero

Entrá en **Editar tablero** con la clave de esta página. Pegá un enlace HTTPS o subí una foto JPG, PNG, WebP o GIF de hasta 1,8 MB. Las fotos subidas conservan sus bytes originales. Arrastrá los pines para cambiar el orden o usá las flechas en el celular. Para salir, elegí **Salir de edición**.

Para X/Twitter, la página y el servidor consultan el identificador de la publicación pública en FxTwitter y guarda las fotos originales y los videos disponibles. Si el servicio no entrega fotos, se conserva el enlace. Volver a pegar la publicación actualiza los adjuntos disponibles. La edición del título, el orden y el borrado requieren la clave. Los enlaces de X se normalizan por ID, los adjuntos por URL original y las fotos subidas se identifican por su contenido.

## Datos y publicación

La aplicación usa la tabla `tini_pines` de la base compartida `bd-general` por medio del enlace D1 `DB`. La tabla contiene el enlace, el título, las fotos y el orden. Para una foto subida contiene además el archivo original y su tipo. El servidor limita todas sus consultas a esta tabla.

El esquema se aplica con `wrangler d1 execute bd-general --remote --file esquema.sql`. Configurá `CLAVE_EDICION` como secreto del Worker. GitHub Actions publica desde `main` con Wrangler y el secreto de repositorio `CLOUDFLARE_API_TOKEN`. La carpeta pública es `public`. Para probar localmente, aplicá el mismo esquema con `--local`, definí la clave en `.dev.vars` y ejecutá `wrangler dev`.
