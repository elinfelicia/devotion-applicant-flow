// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  // For the demo you can lock this to your deployed app's origin instead of "*".
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Service-role client. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
  // auto-injected into deployed edge functions — you don't set them by hand.
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // --- 1. Verify the caller is a logged-in admin ---
  // Passing the token explicitly makes getUser validate THAT user's token,
  // so the service key isn't bypassing the check here.
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const {
    data: { user },
    error: authErr,
  } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "admin") return json({ error: "Forbidden" }, 403);

  // --- 2. Parse and validate the body ---
  let body: {
    email?: string;
    password?: string;
    full_name?: string;
    role?: string;
    customer_id?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { email, password, full_name, role } = body;

  if (!email || !password) return json({ error: "email and password are required" }, 400);
  if (role !== "admin" && role !== "customer") {
    return json({ error: "role must be 'admin' or 'customer'" }, 400);
  }

  // Honor the role_customer_consistency check constraint:
  // admins must have customer_id = null, customers must have one.
  const customer_id = role === "admin" ? null : body.customer_id;
  if (role === "customer" && !customer_id) {
    return json({ error: "customer_id is required for a customer account" }, 400);
  }

  // --- 3. Create the auth user ---
  const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !authData.user) {
    return json({ error: createErr?.message ?? "Failed to create user" }, 400);
  }

  // --- 4. Insert the matching profile row ---
  const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
    id: authData.user.id,
    email,
    full_name,
    role,
    customer_id,
  });

  // Roll back the orphaned auth user if the profile insert fails, so we never
  // leave a login that has no profile.
  if (profileErr) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return json({ error: profileErr.message }, 500);
  }

  return json({ id: authData.user.id, email, role });
});
