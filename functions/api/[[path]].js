export async function onRequest(context) {
  const incomingUrl = new URL(context.request.url);
  const tail = incomingUrl.pathname.replace(/^\/api\//, "");
  const target = new URL(`https://dmz-media-api.zacharylisowski55.workers.dev/api/${tail}`);
  target.search = incomingUrl.search;

  const proxyRequest = new Request(target.toString(), context.request);
  return fetch(proxyRequest);
}
