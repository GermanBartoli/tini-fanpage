import { idPublicacion, medioOriginal, mediosDePublicacion } from './public/medios.js';

const tabla = 'tini_pines';
const maxFoto = 1800000;
const maxCuerpo = maxFoto + 16384;
const encoder = new TextEncoder();

function json(datos, status = 200) {
  return Response.json(datos, { status, headers: { 'Cache-Control': 'no-store' } });
}
function fallo(mensaje, estado) {
  throw new Response(JSON.stringify({ error: mensaje }), {
    status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
async function esEditor(pedido, entorno) {
  const clave = pedido.headers.get('Authorization')?.match(/^Bearer (.{1,160})$/)?.[1];
  if (!clave || !entorno.CLAVE_EDICION) return false;
  const hash = valor => crypto.subtle.digest('SHA-256', encoder.encode(valor));
  const [recibida, esperada] = await Promise.all([hash(clave), hash(entorno.CLAVE_EDICION)]);
  return crypto.subtle.timingSafeEqual(recibida, esperada);
}
function enlaceSeguro(valor) {
  try {
    const url = new URL(valor);
    if (url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 3000) return url;
  } catch { /* El formulario informa el error. */ }
  fallo('Ingresá un enlace HTTPS válido.', 400);
}
async function resolverEnlace(valor, sugeridos) {
  const url = enlaceSeguro(valor);
  const id = idPublicacion(url);
  if (id) {
    const enlace = 'https://x.com/i/status/' + id;
    let fotos;
    try {
      const datos = JSON.parse(sugeridos || '[]');
      if (!Array.isArray(datos) || datos.length > 64) fallo('Adjuntos inválidos.',400);
      fotos = [...new Set(datos.map(medioOriginal).filter(Boolean))];
    } catch { fallo('Adjuntos inválidos.',400); }
    if (!fotos.length) {
      try {
        const respuesta = await fetch('https://api.fxtwitter.com/status/' + id, {
          signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json', 'User-Agent':'Fanpage/1.0' }
        });
        if (respuesta.ok) fotos = mediosDePublicacion((await respuesta.json()).tweet);
      } catch { /* Se conserva el enlace aunque X no entregue los adjuntos. */ }
    }
    return { enlace, fotos, aviso: fotos.length ? '' : 'Enlace guardado. Podés volver a pegarlo para actualizar los adjuntos.' };
  }
  const foto = medioOriginal(url.href) || (/\.(?:png|jpe?g|webp|gif|avif|mp4|webm)$/i.test(url.pathname) ? url.href : null);
  return { enlace: url.href, fotos: foto ? [foto] : [], aviso: '' };
}
function tipoFoto(bytes) {
  const coincide = (firma, inicio = 0) => firma.every((n, i) => bytes[i + inicio] === n);
  if (coincide([255,216,255])) return 'image/jpeg';
  if (coincide([137,80,78,71,13,10,26,10])) return 'image/png';
  if (coincide([82,73,70,70]) && coincide([87,69,66,80], 8)) return 'image/webp';
  if (coincide([71,73,70,56]) && [55,57].includes(bytes[4]) && bytes[5] === 97) return 'image/gif';
  fallo('Elegí una foto JPG, PNG, WebP o GIF.', 400);
}
async function guardar(pedido, db) {
  const longitud = Number(pedido.headers.get('content-length'));
  if (!longitud || longitud > maxCuerpo) fallo('El archivo puede pesar hasta 1,8 MB. Para fotos más grandes, pegá el enlace.', 413);
  const datos = await pedido.formData();
  const titulo = String(datos.get('titulo') ?? '').trim().slice(0,120);
  const archivo = datos.get('archivo');
  let id = crypto.randomUUID();
  let contenido = null, tipo = null, enlace = null, fotos = [], aviso = '';
  if (archivo && typeof archivo !== 'string' && archivo.size) {
    if (archivo.size > maxFoto) fallo('El archivo supera los 1,8 MB.', 413);
    contenido = await archivo.arrayBuffer();
    tipo = tipoFoto(new Uint8Array(contenido));
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256',contenido));
    const hex = [...hash.slice(0,16)].map(n => n.toString(16).padStart(2,'0')).join('');
    id = [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
    fotos = ['/api/fotos/' + id];
  } else {
    ({ enlace, fotos, aviso } = await resolverEnlace(datos.get('enlace'),datos.get('medios')));
  }
  // La escritura comprueba los medios existentes dentro de la misma sentencia.
  const resultado = await db.prepare(`WITH entrada AS (SELECT ? AS id, ? AS enlace, ? AS medios),
    unicos AS (SELECT DISTINCT j.value AS url FROM entrada e, json_each(e.medios) j WHERE NOT EXISTS (
      SELECT 1 FROM ${tabla} p, json_each(p.fotos) f WHERE f.value = j.value
      AND (e.enlace IS NULL OR p.enlace IS NOT e.enlace)))
    INSERT INTO ${tabla} (id,titulo,enlace,fotos,contenido,tipo,orden)
    SELECT id, ?, enlace, (SELECT json_group_array(url) FROM unicos), ?, ?,
      (SELECT COALESCE(MAX(orden),0)+1 FROM ${tabla}) FROM entrada
    WHERE medios='[]' OR EXISTS (SELECT 1 FROM unicos)
    ON CONFLICT(enlace) DO UPDATE SET fotos=CASE WHEN excluded.fotos <> '[]' THEN excluded.fotos ELSE fotos END,
      titulo=CASE WHEN excluded.titulo <> '' THEN excluded.titulo ELSE titulo END
    ON CONFLICT(id) DO NOTHING`)
    .bind(id,enlace,JSON.stringify(fotos),titulo,contenido,tipo).run();
  return json({ aviso: resultado.meta.changes ? aviso || 'Pin guardado.' : 'Ese contenido ya está en el tablero.' });
}
async function mover(pedido, db) {
  const { id, destino } = await pedido.json();
  if (typeof id !== 'string' || typeof destino !== 'string') fallo('Elegí dos pines del tablero.', 400);
  const resultado = await db.prepare(`WITH limites AS MATERIALIZED (
    SELECT a.orden AS origen, b.orden AS fin FROM ${tabla} a, ${tabla} b WHERE a.id=? AND b.id=?
  ) UPDATE ${tabla} SET orden=CASE WHEN id=? THEN fin WHEN origen<fin THEN orden-1 ELSE orden+1 END
    FROM limites WHERE orden BETWEEN MIN(origen,fin) AND MAX(origen,fin)`).bind(id,destino,id).run();
  if (!resultado.meta.changes) fallo('El tablero cambió. Actualizá la página.',409);
  return json({ aviso: 'Orden guardado.' });
}
export default {
  async fetch(pedido, entorno) {
    const url = new URL(pedido.url);
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      url.protocol = 'https:';
      return Response.redirect(url.href, 308);
    }
    if (!url.pathname.startsWith('/api/')) return entorno.ASSETS.fetch(pedido);
    const db = entorno.DB;
    try {
      if (pedido.method === 'GET' && url.pathname === '/api/pines') {
        const desde = Math.max(0, Number.parseInt(url.searchParams.get('desde'),10) || 0);
        const { results } = await db.prepare(`SELECT id,titulo,enlace,fotos FROM ${tabla} ORDER BY orden,id LIMIT 49 OFFSET ?`).bind(desde).all();
        return json({ pines: results.slice(0,48).map(p => ({ ...p, fotos: JSON.parse(p.fotos) })), hayMas: results.length > 48 });
      }
      const foto = /^\/api\/fotos\/([a-f\d-]{36})$/.exec(url.pathname);
      if (foto && pedido.method === 'GET') {
        const fila = await db.prepare(`SELECT contenido,tipo FROM ${tabla} WHERE id=? AND contenido IS NOT NULL`).bind(foto[1]).first();
        if (!fila) fallo('Foto no encontrada.',404);
        return new Response(new Uint8Array(fila.contenido), { headers: { 'Content-Type': fila.tipo, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'private, max-age=3600' } });
      }
      if (!(await esEditor(pedido, entorno))) fallo('Ingresá la clave de edición de este tablero.',401);
      if (pedido.method === 'GET' && url.pathname === '/api/edicion') return json({ autorizado: true });
      if (pedido.method === 'POST' && url.pathname === '/api/pines') return await guardar(pedido, db);
      if (pedido.method === 'PATCH' && url.pathname === '/api/orden') return await mover(pedido, db);
      const pin = /^\/api\/pines\/([a-f\d-]{36})$/.exec(url.pathname);
      if (pin && pedido.method === 'PATCH') {
        const { titulo } = await pedido.json();
        if (typeof titulo !== 'string' || titulo.length > 120) fallo('El título admite hasta 120 caracteres.',400);
        const cambio = await db.prepare(`UPDATE ${tabla} SET titulo=? WHERE id=?`).bind(titulo.trim(),pin[1]).run();
        if (!cambio.meta.changes) fallo('Pin no encontrado.',404);
        return json({ aviso:'Cambios guardados.' });
      }
      if (pin && pedido.method === 'DELETE') {
        await db.prepare(`DELETE FROM ${tabla} WHERE id=?`).bind(pin[1]).run();
        return json({ aviso: 'Pin eliminado.' });
      }
      fallo('Ruta no encontrada.',404);
    } catch (error) {
      if (error instanceof Response) return error;
      console.error('Error al procesar el tablero', error.name);
      return json({ error: 'No se pudo completar la operación. Volvé a intentar.' },500);
    }
  }
};
