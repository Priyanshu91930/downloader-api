/**
 * Cloudflare Worker Proxy for Downloader API
 * 
 * Solves Vercel's 10-second timeout limit by chaining retries
 * within Cloudflare's generous 30-second wall-clock fetch budget.
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

    // Forward path & query params to Vercel backend
    const targetUrl = `${vercelOrigin.replace(/\/+$/, '')}${url.pathname}${url.search}`;
    
    // Perform up to 3 chained attempts within Cloudflare's 30-second budget
    const maxAttempts = 3;
    let lastResponse = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8500); // 8.5s per Vercel request

        const res = await fetch(targetUrl, {
          method: request.method,
          headers: {
            'User-Agent': request.headers.get('User-Agent') || 'CloudflareWorkerProxy/1.0',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }
        
        lastResponse = res;
      } catch (err) {
        // Retry on timeout or server error
      }
    }

    // Fallback response if all attempts exhausted
    if (lastResponse) {
      try {
        const body = await lastResponse.text();
        return new Response(body, {
          status: lastResponse.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
