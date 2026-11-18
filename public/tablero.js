import { idPublicacion, mediosDePublicacion } from './medios.js';

const porId = id => document.getElementById(id);
const formulario = porId('nuevo');
const dialogo = porId('acceso');
let clave = sessionStorage.getItem('edicion') || '';
let editor = false;
let pines = [];
let hayMas = false;
let ocupado = false;
let arrastrado = null;
function avisar(texto) { porId('estado').textContent = texto; }
async function api(ruta, opciones = {}) {
  const headers = new Headers(opciones.headers);
  if (clave) headers.set('Authorization', 'Bearer ' + clave);
  const respuesta = await fetch('/api/' + ruta, { ...opciones, headers });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la operación.');
  return datos;
}
function establecerEdicion(valor) {
  editor = valor;
  formulario.hidden = !valor;
  porId('editar').textContent = valor ? 'Salir de edición' : 'Editar tablero';
}
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto) elemento.textContent = texto;
  return elemento;
}
function vinculo(url, texto, clase) {
  const a = crear('a', clase, texto);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
async function conEspera(operacion) {
  if (ocupado) return;
  ocupado = true;
  try { await operacion(); } catch (error) { avisar(error.message); }
  finally { ocupado = false; }
}
async function cargar(cantidad = 48) {
  let lista = [], pagina;
  do {
    pagina = await api('pines?desde=' + lista.length);
    lista.push(...pagina.pines);
  } while (pagina.hayMas && lista.length < cantidad);
  pines = lista;
  hayMas = pagina.hayMas;
  dibujar();
  avisar(lista.length ? '' : 'El tablero está listo para su primer pin.');
}
async function mover(id, destino) {
  if (!destino || destino === id) return;
  await conEspera(async () => {
    await api('orden', { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ id, destino }) });
    await cargar(pines.length);
    avisar('Orden guardado.');
  });
}
function controles(pin, indice) {
  const barra = crear('div','herramientas');
  for (const [etiqueta,rotulo,vecino] of [['↑','Mover antes',pines[indice-1]],['↓','Mover después',pines[indice+1]]]) {
    const boton = crear('button','secundario',etiqueta);
    boton.setAttribute('aria-label', rotulo);
    boton.title = rotulo;
    boton.disabled = !vecino;
    boton.onclick = () => mover(pin.id, vecino?.id);
    barra.append(boton);
  }
  const editar = crear('button','secundario','Editar');
  editar.onclick = () => conEspera(async () => {
    const titulo = prompt('Título del pin (hasta 120 caracteres)',pin.titulo || '');
    if (titulo === null) return;
    await api('pines/' + pin.id, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({titulo}) });
    await cargar(pines.length);
    avisar('Cambios guardados.');
  });
  barra.append(editar);
  const borrar = crear('button','secundario','Quitar');
  borrar.onclick = () => conEspera(async () => {
    if (!confirm('¿Quitar este pin del tablero?')) return;
    await api('pines/' + pin.id, { method:'DELETE' });
    await cargar(pines.length);
    avisar('Pin eliminado.');
  });
  barra.append(borrar);
  return barra;
}
function dibujar() {
  const muro = porId('pines');
  muro.replaceChildren();
  pines.forEach((pin, indice) => {
    const ficha = crear('article','pin');
    for (const [i, url] of pin.fotos.entries()) {
      if (/\.(?:mp4|webm)(?:\?|$)/i.test(url)) {
        const video = crear('video');
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.src = url;
        video.setAttribute('aria-label', pin.titulo || 'Video del tablero');
        ficha.append(video);
        continue;
      }
      const enFlickr = pin.enlace && new URL(pin.enlace).hostname === 'www.flickr.com';
      const a = vinculo(enFlickr ? pin.enlace : url, '', 'imagen');
      const imagen = crear('img');
      imagen.loading = 'lazy';
      imagen.referrerPolicy = 'no-referrer';
      imagen.src = url;
      imagen.alt = (pin.titulo || 'Foto del tablero') + (pin.fotos.length > 1 ? ' · ' + (i + 1) : '');
      imagen.onerror = () => { a.textContent = 'Abrir foto original ↗'; };
      a.append(imagen);
      ficha.append(a);
    }
    const detalle = crear('div','detalle');
    const titulo = pin.titulo || (pin.enlace ? new URL(pin.enlace).hostname : 'Foto');
    detalle.append(crear('h3','',titulo));
    if (pin.enlace) detalle.append(vinculo(pin.enlace, 'Abrir fuente ↗'));
    if (editor) {
      ficha.draggable = true;
      ficha.ondragstart = evento => { arrastrado = pin.id; evento.dataTransfer.setData('text/plain', pin.id); };
      ficha.ondragend = () => { arrastrado = null; muro.querySelectorAll('.arrastre').forEach(e => e.classList.remove('arrastre')); };
      ficha.ondragover = evento => { if (arrastrado) { evento.preventDefault(); ficha.classList.add('arrastre'); } };
      ficha.ondragleave = () => ficha.classList.remove('arrastre');
      ficha.ondrop = evento => { evento.preventDefault(); ficha.classList.remove('arrastre'); if (arrastrado) mover(arrastrado,pin.id); };
      detalle.append(controles(pin,indice));
    }
    ficha.append(detalle);
    muro.append(ficha);
  });
  porId('mas').hidden = !hayMas;
}
porId('mas').onclick = () => conEspera(async () => {
  const pagina = await api('pines?desde=' + pines.length);
  pines.push(...pagina.pines);
  hayMas = pagina.hayMas;
  dibujar();
});
porId('editar').onclick = () => {
  if (editor) {
    sessionStorage.removeItem('edicion');
    clave = '';
    establecerEdicion(false);
    dibujar();
  } else {
    porId('error-acceso').textContent = '';
    dialogo.showModal();
    porId('clave').focus();
  }
};
porId('cerrar').onclick = () => dialogo.close();
porId('sesion').onsubmit = async evento => {
  evento.preventDefault();
  clave = porId('clave').value.trim();
  try {
    await api('edicion');
    sessionStorage.setItem('edicion',clave);
    porId('clave').value = '';
    dialogo.close();
    establecerEdicion(true);
    dibujar();
  } catch (error) { clave = ''; porId('error-acceso').textContent = error.message; }
};
formulario.onsubmit = evento => {
  evento.preventDefault();
  conEspera(async () => {
    const datos = new FormData(formulario);
    const archivo = datos.get('archivo');
    if (Boolean(archivo.size) === Boolean(datos.get('enlace').trim())) throw new Error('Elegí una sola opción: pegar un enlace o subir una foto.');
    if (archivo.size > 1800000) throw new Error('La foto supera los 1,8 MB. Podés guardar el enlace al original.');
    if (!archivo.size) datos.delete('archivo');
    avisar('Guardando el pin…');
    if (!archivo.size) {
      const id = idPublicacion(new URL(datos.get('enlace')));
      if (id) {
        try {
          const r = await fetch('https://api.fxtwitter.com/status/' + id, {credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});
          if (r.ok) datos.set('medios',JSON.stringify(mediosDePublicacion((await r.json()).tweet)));
        } catch { /* El servidor también intenta resolver el enlace. */ }
      }
    }
    const resultado = await api('pines', { method:'POST', body: datos });
    formulario.reset();
    await cargar(pines.length || 48);
    avisar(resultado.aviso);
  });
};
if (clave) {
  try { await api('edicion'); establecerEdicion(true); }
  catch { clave = ''; sessionStorage.removeItem('edicion'); }
}
await conEspera(() => cargar());
