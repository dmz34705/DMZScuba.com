export async function onRequest(context) {
  const incomingUrl = new URL(context.request.url);
  const tail = incomingUrl.pathname.replace(/^\/api\//, "");
  const target = new URL(`https://dmz-media-api.zacharylisowski55.workers.dev/api/${tail}`);
  target.search = incomingUrl.search;

  const headers = new Headers(context.request.headers);
  headers.set("host", "dmz-media-api.zacharylisowski55.workers.dev");

  const init = {
    method: context.request.method,
    headers,
    body: context.request.method === "GET" || context.request.method === "HEAD" ? undefined : context.request.body,
    redirect: "follow",
  };

  return fetch(target.toString(), init);
}
