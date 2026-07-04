export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      // Proxy to backend
      const API_BASE_URL = env.API_BASE_URL;
      const API_KEY = env.API_KEY;
      
      if (!API_BASE_URL || !API_KEY) {
        return new Response('API environment variables are not configured.', { status: 500 });
      }
      
      const backendUrl = `${API_BASE_URL}${url.pathname}${url.search}`;
      const proxyReq = new Request(backendUrl, request);
      proxyReq.headers.set('X-API-Key', API_KEY);
      
      try {
        return await fetch(proxyReq);
      } catch (err) {
        return new Response(`Error proxying request: ${err.message}`, { status: 502 });
      }
    }
    
    // Otherwise serve the static assets
    return env.ASSETS.fetch(request);
  }
};
