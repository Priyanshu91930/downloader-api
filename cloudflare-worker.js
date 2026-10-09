/**
 * Cloudflare Worker Proxy for Downloader API
 * 
 * Extended 30-second budget proxy that handles both API requests
 * (with chained Vercel retries) and Web frontend static assets.
 * 
 * Free Tier: 100,000 requests/day, 0 Credit Card required.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const vercelOrigin = (env && env.VERCEL_ORIGIN) || 'https://downloader-api-tau.vercel.app';
    
    // CORS headers for web frontend & mobile app
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint on worker
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', worker: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const targetUrl = `${vercelOrigin.replace(/\/+$/, '')}${url.pathname}${url.search}`;
    const isApiRoute = url.pathname.startsWith('/api/');

    // For static assets & HTML pages (non-API), do direct proxy pass-through
    if (!isApiRoute) {
      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: request.headers,
        });

        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      } catch (err) {
        return new Response('Failed to load page', { status: 502, headers: corsHeaders });
      }
    }

    // For API routes, perform up to 3 chained attempts within Cloudflare's 30s budget
    const maxAttempts = 3;
    let lastResponse = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 9500); // 9.5s per Vercel request

        const reqHeaders = new Headers(request.headers);
        reqHeaders.set('User-Agent', request.headers.get('User-Agent') || 'CloudflareWorkerProxy/1.0');
        if (!reqHeaders.get('Accept')) {
          reqHeaders.set('Accept', 'application/json');
        }

        const res = await fetch(targetUrl, {
          method: request.method,
          headers: reqHeaders,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          } else {
            const text = await res.text();
            return new Response(text, {
              status: 200,
              headers: { 'Content-Type': contentType || 'text/plain', ...corsHeaders },
            });
          }
        }
        
        lastResponse = res;
      } catch (err) {
        // Retry on timeout or network failure
      }
    }

    // Fallback response if all API attempts exhausted
    if (lastResponse) {
      try {
        const contentType = lastResponse.headers.get('content-type') || '';
        const body = await lastResponse.text();
        return new Response(body, {
          status: lastResponse.status,
          headers: { 'Content-Type': contentType || 'application/json', ...corsHeaders },
        });
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: { message: 'The media downloader took too long to respond.', statusCode: 504 },
      }),
      { status: 504, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  },
};
