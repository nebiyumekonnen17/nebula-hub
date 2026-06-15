const allowedOrigin = "https://nebiyumekonnen17.github.io";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Use GET." }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const appId = Deno.env.get("ADZUNA_APP_ID");
  const appKey = Deno.env.get("ADZUNA_APP_KEY");

  if (!appId || !appKey) {
    return new Response(JSON.stringify({ error: "Adzuna credentials are not configured." }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const input = new URL(req.url);
  const country = (input.searchParams.get("country") || "us").toLowerCase();
  const query = (input.searchParams.get("what") || "").slice(0, 180).trim();
  const where = (input.searchParams.get("where") || "").slice(0, 120).trim();
  const resultsPerPage = Math.min(Number(input.searchParams.get("results_per_page")) || 10, 20);

  if (!query) {
    return new Response(JSON.stringify({ error: "Missing search query." }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const upstream = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  upstream.searchParams.set("app_id", appId);
  upstream.searchParams.set("app_key", appKey);
  upstream.searchParams.set("content-type", "application/json");
  upstream.searchParams.set("results_per_page", String(resultsPerPage));
  upstream.searchParams.set("sort_by", "date");
  upstream.searchParams.set("what", query);

  if (where) {
    upstream.searchParams.set("where", where);
  }

  const response = await fetch(upstream.toString(), {
    headers: { Accept: "application/json" },
  });

  const data = await response.json().catch(() => ({}));

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: corsHeaders,
  });
});