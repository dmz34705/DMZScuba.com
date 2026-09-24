export async function onRequest({ request }) {
  const url = new URL(request.url);
  url.hostname = 'dmz-account-sync-dev.zacharylisowski55.workers.dev';
  url.protocol = 'https:';
  url.port = '';
  return fetch(new Request(url, request));
}
