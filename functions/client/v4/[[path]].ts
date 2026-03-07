// Cloudflare Pages Function as a reverse proxy for Cloudflare API
// This avoids CORS errors when calling Cloudflare API directly from the browser

export const onRequest: PagesFunction = async (context) => {
  const { request, params } = context;
  const url = new URL(request.url);

  // path 会捕获 /client/v4 之后的所有路径部分
  const pathArr = (params.path as string[]) || [];
  const cfApiPath = pathArr.join("/");

  // 组装发往真实 Cloudflare API 的目标 URL
  const targetUrl = new URL(
    `https://api.cloudflare.com/client/v4/${cfApiPath}`,
  );
  // 把原请求的 Query 携带上
  targetUrl.search = url.search;

  // 复制出新的请求对象
  const newRequest = new Request(targetUrl.toString(), new Request(request));

  // 透传发往 Cloudflare 核心 API，并返回结果
  return fetch(newRequest);
};
