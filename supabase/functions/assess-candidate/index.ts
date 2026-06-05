// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Separate client for auth verification so the service-role DB client
  // is never contaminated by the caller's user JWT.
  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the caller is a logged-in user (admin or customer)
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const {
    data: { user },
    error: authErr,
  } = await supabaseAuth.auth.getUser(token);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  if (!serviceRoleKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, 500);

  let body: { candidate_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { candidate_id } = body;
  if (!candidate_id) return json({ error: "candidate_id is required" }, 400);

  // Use raw PostgREST fetch with explicit service-role headers to bypass RLS
  const srHeaders = {
    "apikey": serviceRoleKey,
    "Authorization": `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    "Accept": "application/vnd.pgrst.object+json",
  };

  const candidateRes = await fetch(
    `${supabaseUrl}/rest/v1/candidates?id=eq.${candidate_id}&select=*`,
    { headers: srHeaders },
  );

  if (!candidateRes.ok) {
    const detail = await candidateRes.text();
    console.error("[assess-candidate] candidate fetch failed:", candidateRes.status, detail);
    return json({ error: "Candidate not found", detail }, 404);
  }

  const candidate = await candidateRes.json();

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return json({ error: "OPENAI_API_KEY is not configured" }, 500);

  // Fetch job
  const jobRes = await fetch(
    `${supabaseUrl}/rest/v1/jobs?id=eq.${candidate.job_id}&select=title,description`,
    { headers: { ...srHeaders, Accept: "application/vnd.pgrst.object+json" } },
  );
  const job = jobRes.ok ? await jobRes.json() : null;

  const jobTitle = job?.title ?? "Unknown position";
  const jobDescription = job?.description ?? null;

  const prompt = `You are an expert ATS (Applicant Tracking System) recruiter assistant. Assess the following candidate for the given job opening.

Candidate information:
- Name: ${candidate.name}
- Email: ${candidate.email ?? "Not provided"}
- LinkedIn: ${candidate.linkedin_url ?? "Not provided"}
- CV / Notes: ${candidate.notes ?? "Not provided"}

Job: ${jobTitle}${jobDescription ? `\nJob description: ${jobDescription}` : ""}

Return ONLY a valid JSON object with exactly these fields:
{
  "summary": "2–3 sentence overall assessment of the candidate's fit",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "concerns": ["concern 1", "concern 2"],
  "score": 7,
  "recommendation": "Proceed"
}

Rules:
- score is an integer from 1 (no fit) to 10 (perfect fit)
- recommendation must be exactly one of: "Proceed", "Maybe", or "Pass"
- If information is limited, base your assessment on what is available and note the gaps
- Return only the JSON object, no markdown, no prose`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text();
    console.error("[assess-candidate] OpenAI error:", err);
    return json({ error: `OpenAI error: ${openaiRes.status}` }, 502);
  }

  const openaiData = await openaiRes.json();
  const rawContent = openaiData.choices?.[0]?.message?.content;
  if (!rawContent) return json({ error: "Empty response from OpenAI" }, 502);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return json({ error: "OpenAI returned invalid JSON" }, 502);
  }

  // Persist the assessment so the UI can display it without re-running
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/candidates?id=eq.${candidate_id}`,
    {
      method: "PATCH",
      headers: { ...srHeaders, Accept: "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ ai_assessment: parsed }),
    },
  );

  if (!updateRes.ok) {
    const detail = await updateRes.text();
    console.error("[assess-candidate] DB update error:", detail);
    return json({ error: "Failed to save assessment", detail }, 500);
  }

  return json({ assessment: parsed });
});
