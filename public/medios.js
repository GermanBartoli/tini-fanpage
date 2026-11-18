export function idPublicacion(url) {
  const host = url.hostname.replace(/^(www\.|mobile\.)/,'');
  if (!['x.com','twitter.com','fxtwitter.com','fixupx.com'].includes(host)) return null;
  return url.pathname.match(/^\/(?:i\/web|i|[a-z\d_]+)\/status\/(\d{1,22})(?:\/|$)/i)?.[1] || null;
}
export function medioOriginal(valor) {
  try {
    const u = new URL(valor);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (u.hostname === 'video.twimg.com' && u.pathname.endsWith('.mp4')) return u.origin + u.pathname;
    if (u.hostname !== 'pbs.twimg.com' || !u.pathname.startsWith('/media/')) return null;
    const [id,extension] = u.pathname.split('/').pop().split('.');
    const formato = extension || u.searchParams.get('format') || 'jpg';
    if (!/^[\w-]+$/.test(id) || !/^(jpe?g|png|webp|gif|avif)$/i.test(formato)) return null;
    return u.origin + '/media/' + id + '?format=' + formato.toLowerCase() + '&name=orig';
  } catch { return null; }
}
export function mediosDePublicacion(tweet) {
  const medios = tweet?.media;
  return [...new Set([...(medios?.photos || []), ...(medios?.videos || [])].map(m => medioOriginal(m.url)).filter(Boolean))];
}
