const reproductor = document.getElementById('reproductor');
const opciones = document.querySelectorAll('.videoteca button[data-video]');

for (const opcion of opciones) {
  opcion.addEventListener('click', () => {
    for (const boton of opciones) {
      boton.setAttribute('aria-pressed', String(boton === opcion));
    }
    reproductor.title = 'Videoclip de ' + opcion.querySelector('strong').textContent;
    reproductor.src = 'https://www.youtube-nocookie.com/embed/' + opcion.dataset.video + '?autoplay=1&playsinline=1';
    reproductor.scrollIntoView({ block: 'nearest' });
    reproductor.focus({ preventScroll: true });
  });
}