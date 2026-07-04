export async function onRequest(context) {
  // context.env provides access to our environment variables
  // context.request is the incoming request
  // context.params.route is the array of path segments

  const { env, request, params } = context;

  // The path parts after /api/
  // e.g. for /api/news, route is ["news"]
  const routePath = params.route ? params.route.join('/') : '';
  
  // Reconstruct the target URL
  const targetUrl = new URL(request.url);
  
  // The base URL for our backend API (from Cloudflare dashboard env vars)
  const API_BASE_URL = env.API_BASE_URL || 'https://api.burmaduta.com';
  const API_KEY = env.API_KEY;

  if (!API_KEY) {
    return new Response('API_KEY environment variable is not configured on Cloudflare.', { status: 500 });
  }

  const backendUrl = `${API_BASE_URL}/api/${routePath}${targetUrl.search}`;

  // Create a new request to the backend with the API key attached
  const proxyRequest = new Request(backendUrl, request);
  proxyRequest.headers.set('X-API-Key', API_KEY);

  // Fetch from backend and return the response
  try {
    const response = await fetch(proxyRequest);
    return response;
  } catch (err) {
    return new Response(`Error proxying request: ${err.message}`, { status: 500 });
  }
}
