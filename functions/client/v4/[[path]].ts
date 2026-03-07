// Cloudflare Pages Function as a reverse proxy for Cloudflare API
// This avoids CORS errors when calling Cloudflare API directly from the browser

export const onRequest = async (context: any) => {
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

  // 处理 OPTIONS 预检请求 (Preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // 透传发往 Cloudflare 核心 API
  const response = await fetch(newRequest);

  // 组装带 CORS 的新响应
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  newResponse.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  );
  newResponse.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  return newResponse;
};
