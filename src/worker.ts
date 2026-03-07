export default {
  async fetch(request: Request, env: { ASSETS: any }, _ctx: any) {
    const url = new URL(request.url);

    // 1. 代理 /client/v4 请求到 Cloudflare API
    if (url.pathname.startsWith("/client/v4/")) {
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
      const targetUrl = new URL(
        `https://api.cloudflare.com${url.pathname}${url.search}`,
      );

      const newHeaders = new Headers();
      // Only copy safe headers, explicitly copy Authorization
      const authHeader = request.headers.get("Authorization");
      if (authHeader) {
        newHeaders.set("Authorization", authHeader);
      }
      const contentType = request.headers.get("Content-Type");
      if (contentType) {
        newHeaders.set("Content-Type", contentType);
      }

      const newRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        // Only attach body if it's not a GET/HEAD request
        body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
        redirect: "manual",
      });
      const response = await fetch(newRequest);

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
    }

    // 2. 将非 API 请求指向部署的静态资产目录
    try {
      let response = await env.ASSETS.fetch(request);

      // SPA Fallback: 如果静态资产没找到 (比如直接访问 /dashboard)，则回退到 index.html 交给前端 Vue Route 接管
      if (response.status === 404) {
        const indexRequest = new Request(new URL("/", request.url), request);
        response = await env.ASSETS.fetch(indexRequest);
      }

      return response;
    } catch (e) {
      return new Response("Not Found Asset", { status: 404 });
    }
  },
};
