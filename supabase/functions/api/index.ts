import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getJwtKey(secret: string) {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const supabaseUrl = Deno.env.get("SB_URL") || Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const jwtSecret = Deno.env.get("JWT_SECRET") || "";

if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
  console.error(
    "Missing SB_URL/SUPABASE_URL, SB_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY, or JWT_SECRET",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const fullPath = url.pathname;
  // Normalize path for Supabase edge functions and optional /api prefix.
  // Deployed requests look like: /functions/v1/<function-name>/<route>
  let routePath = fullPath;
  const functionsMatch = routePath.match(/^\/functions\/v1\/[^/]+/);
  if (functionsMatch) {
    routePath = routePath.slice(functionsMatch[0].length) || "/";
  } else if (routePath.startsWith("/api")) {
    routePath = routePath.slice(4) || "/";
  } else {
    // Some environments pass only "/<function-name>/..." without the /functions/v1 prefix.
    const parts = routePath.split("/").filter(Boolean);
    const routeStart = parts[1];
    const knownStarts = new Set([
      "tables",
      "validate-token",
      "orders",
      "restaurants",
      "sessions",
    ]);
    if (routeStart && knownStarts.has(routeStart)) {
      routePath = `/${parts.slice(1).join("/")}`;
    }
  }

  try {
    if (req.method === "POST" && routePath === "/validate-token") {
      const body = (await req.json().catch(() => ({}))) as { token?: string };
      const token = body.token;

      if (!token) return jsonResponse({ error: "Token required" }, 400);

      try {
        const key = await getJwtKey(jwtSecret);
        await verify(token, key);
      } catch (_err) {
        return jsonResponse({ error: "Invalid token" }, 401);
      }

      const { data: sessionData, error } = await supabase.rpc(
        "validate_table_session",
        { p_token: token },
      );

      if (
        error || !sessionData || sessionData.length === 0 ||
        !sessionData[0].is_valid
      ) {
        return jsonResponse({ error: "Session expired or invalid" }, 401);
      }

      const session = sessionData[0];

      const { data: restaurant, error: restError } = await supabase
        .from("restaurants")
        .select("id, name, slug, image_url")
        .eq("id", session.restaurant_id)
        .single();

      if (restError || !restaurant) {
        return jsonResponse({ error: "Restaurant not found" }, 404);
      }

      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("table_number, name")
        .eq("id", session.table_id)
        .limit(1)
        .maybeSingle();

      if (tableError || !table) {
        return jsonResponse({ error: "Table not found" }, 404);
      }

      const { data: menu, error: menuError } = await supabase.rpc(
        "get_menu_by_restaurant_slug",
        { restaurant_slug: restaurant.slug },
      );

      if (menuError) {
        return jsonResponse({ error: "Failed to load menu" }, 500);
      }

      await supabase
        .from("table_sessions")
        .update({ last_activity: new Date().toISOString() })
        .eq("id", session.session_id);

      return jsonResponse({
        session_id: session.session_id,
        restaurant,
        menu,
        table_number: table.table_number,
        table_name: table.name,
      });
    }

    if (
      req.method === "POST" &&
      routePath.startsWith("/tables/") &&
      routePath.endsWith("/generate-token")
    ) {
      if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
        return jsonResponse(
          {
            error: "Server misconfigured",
            has_url: Boolean(supabaseUrl),
            has_service_key: Boolean(supabaseServiceKey),
            has_jwt_secret: Boolean(jwtSecret),
          },
          500,
        );
      }

      const tableId = routePath.split("/")[2];
      const body = (await req.json().catch(() => ({}))) as {
        expiresIn?: string;
      };
      const expiresIn = body.expiresIn || "2m";

      const { data: table, error } = await supabase
        .from("tables")
        .select("id, restaurant_id")
        .eq("id", tableId)
        .limit(1)
        .maybeSingle();

      if (error || !table) {
        const { count, error: countError } = await supabase
          .from("tables")
          .select("id", { count: "exact", head: true });

        return jsonResponse(
          {
            error: "Table not found",
            db_error: error?.message ?? null,
            db_code: (error as any)?.code ?? null,
            tables_count: count ?? null,
            tables_count_error: countError?.message ?? null,
          },
          404,
        );
      }

      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt +
        (expiresIn === "2h"
          ? 7200
          : expiresIn === "1h"
          ? 3600
          : expiresIn === "2m"
          ? 120
          : 120);

      const key = await getJwtKey(jwtSecret);
      const token = await create(
        { alg: "HS256", typ: "JWT" },
        {
          restaurant_id: table.restaurant_id,
          table_id: tableId,
          issued_at: issuedAt,
          expires_at: expiresAt,
        },
        key,
      );

      const { data: session, error: sessionError } = await supabase.rpc(
        "create_table_session",
        {
          p_table_id: tableId,
          p_token: token,
          p_expires_at: new Date(expiresAt * 1000).toISOString(),
        },
      );

      if (sessionError) {
        return jsonResponse({ error: "Failed to create session" }, 500);
      }

      return jsonResponse({
        token,
        session_id: session,
        expires_in: expiresIn === "2h"
          ? 7200
          : expiresIn === "1h"
          ? 3600
          : expiresIn === "2m"
          ? 120
          : 120,
      });
    }

    if (req.method === "POST" && routePath === "/orders") {
      const body = (await req.json().catch(() => ({}))) as {
        session_id?: string;
        items?: Array<{ menu_item_id: string; quantity?: number }>;
        suggestion?: string | null;
      };

      if (!body.session_id || !Array.isArray(body.items)) {
        return jsonResponse({ error: "Invalid order data" }, 400);
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from("table_sessions")
        .select("id, active, expires_at, table_id")
        .eq("id", body.session_id)
        .single();

      if (
        sessionError || !sessionData || !sessionData.active ||
        new Date(sessionData.expires_at) < new Date()
      ) {
        return jsonResponse({ error: "Invalid session" }, 401);
      }

      const { data: tableData, error: tableError } = await supabase
        .from("tables")
        .select("restaurant_id")
        .eq("id", sessionData.table_id)
        .single();

      if (tableError || !tableData) {
        return jsonResponse({ error: "Failed to get restaurant info" }, 500);
      }

      const restaurantId = tableData.restaurant_id;

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentOrders, error: rateError } = await supabase
        .from("orders")
        .select("id")
        .eq("session_id", body.session_id)
        .gte("created_at", fiveMinutesAgo);

      if (rateError) {
        return jsonResponse({ error: "Rate limit check failed" }, 500);
      }

      if (recentOrders && recentOrders.length >= 5) {
        return jsonResponse({ error: "Too many orders, please wait" }, 429);
      }

      let total = 0;
      const orderItems: Array<{ menu_item_id: string; quantity: number; price: number }> =
        [];

      for (const item of body.items) {
        const { data: menuItem, error } = await supabase
          .from("menu_items")
          .select("id, price, available")
          .eq("id", item.menu_item_id)
          .single();

        if (error || !menuItem || !menuItem.available) {
          return jsonResponse({ error: `Invalid item: ${item.menu_item_id}` }, 400);
        }

        const quantityRaw = item.quantity ?? 1;
        const quantity = typeof quantityRaw === "string"
          ? Number(quantityRaw)
          : quantityRaw;
        if (!Number.isInteger(quantity) || quantity < 1) {
          return jsonResponse(
            { error: `Invalid quantity for item: ${item.menu_item_id}` },
            400,
          );
        }

        const price = menuItem.price;
        total += price * quantity;

        orderItems.push({
          menu_item_id: menuItem.id,
          quantity,
          price,
        });
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          session_id: body.session_id,
          restaurant_id: restaurantId,
          items: orderItems,
          suggestion: body.suggestion || null,
          total,
        })
        .select()
        .single();

      if (orderError) {
        return jsonResponse({ error: "Failed to create order" }, 500);
      }

      const itemsToInsert = orderItems.map((item) => ({
        order_id: order.id,
        ...item,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        return jsonResponse({ error: "Failed to add order items" }, 500);
      }

      await supabase
        .from("table_sessions")
        .update({ last_activity: new Date().toISOString() })
        .eq("id", body.session_id);

      return jsonResponse({ order_id: order.id, total, status: "pending" });
    }

    if (
      req.method === "GET" &&
      routePath.startsWith("/restaurants/") &&
      routePath.endsWith("/sessions")
    ) {
      const restaurantId = routePath.split("/")[2];
      const { data: sessions, error } = await supabase.rpc(
        "get_active_sessions",
        { p_restaurant_id: restaurantId },
      );

      if (error) {
        return jsonResponse({ error: "Failed to load sessions" }, 500);
      }

      return jsonResponse(sessions);
    }

    if (
      req.method === "GET" &&
      routePath.startsWith("/restaurants/") &&
      routePath.endsWith("/orders")
    ) {
      const restaurantId = routePath.split("/")[2];
      const { data: orders, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items(menu_items(name), quantity, price)
        `,
        )
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (error) {
        return jsonResponse({ error: "Failed to load orders" }, 500);
      }

      const enrichedOrders = await Promise.all(
        (orders || []).map(async (order: any) => {
          const { data: session, error: sessionError } = await supabase
            .from("table_sessions")
            .select("table_id, tables(table_number, name)")
            .eq("id", order.session_id)
            .single();

          if (sessionError) {
            return { ...order, table_sessions: null };
          }

          return { ...order, table_sessions: session };
        }),
      );

      return jsonResponse(enrichedOrders);
    }

    if (
      req.method === "POST" &&
      routePath.startsWith("/sessions/") &&
      routePath.endsWith("/close")
    ) {
      const sessionId = routePath.split("/")[2];
      const { data, error } = await supabase.rpc("close_table_session", {
        p_session_id: sessionId,
      });

      if (error || !data) {
        return jsonResponse({ error: "Failed to close session" }, 500);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse(
      {
        error: "Not found",
        method: req.method,
        fullPath,
        routePath,
      },
      404,
    );
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
