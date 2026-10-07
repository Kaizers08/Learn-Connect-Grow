import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client using service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the user's JWT and get their ID
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token or user not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // ── Delete all user data from every table ──────────────────────────────

    // Learning materials
    await supabaseAdmin.from("material_progress").delete().eq("mentee_user_id", userId);
    await supabaseAdmin.from("material_progress").delete().in(
      "material_id",
      (await supabaseAdmin.from("learning_materials").select("id").eq("mentor_user_id", userId)).data?.map((m: any) => m.id) ?? []
    );
    await supabaseAdmin.from("learning_materials").delete().eq("mentor_user_id", userId);
    await supabaseAdmin.from("material_folders").delete().eq("mentor_user_id", userId);

    // Calendar
    await supabaseAdmin.from("calendar_events").delete().eq("user_id", userId);

    // Messages
    await supabaseAdmin.from("messages").delete().eq("sender_id", userId);
    await supabaseAdmin.from("messages").delete().eq("receiver_id", userId);

    // Connections
    await supabaseAdmin.from("connections").delete()
      .or(`mentee_user_id.eq.${userId},mentor_user_id.eq.${userId}`);

    // Feedback
    await supabaseAdmin.from("feedback_submissions").delete()
      .or(`mentor_user_id.eq.${userId},mentee_user_id.eq.${userId}`);

    // Profiles
    await supabaseAdmin.from("mentee_profiles").delete().eq("user_id", userId);
    await supabaseAdmin.from("mentor_profiles").delete().eq("user_id", userId);

    // Admin record (if any)
    await supabaseAdmin.from("admins").delete().eq("user_id", userId);

    // ── Delete the auth user itself ────────────────────────────────────────
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete auth user", details: deleteError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Account and all data deleted successfully." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
