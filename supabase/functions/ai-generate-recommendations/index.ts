import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { branchId, horizon, timeGrain } = await req.json();

    if (!branchId) {
      return new Response(
        JSON.stringify({ error: "branchId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [bookingsRes, staffRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("*")
        .eq("branch_id", branchId)
        .gte("starts_at_utc", startDate.toISOString()),
      supabase
        .from("staff")
        .select("*")
        .eq("branch_id", branchId)
        .eq("is_active", true),
    ]);

    const bookings = bookingsRes.data || [];
    const staff = staffRes.data || [];

    const staffLoad: Record<string, number> = {};
    staff.forEach((s) => {
      staffLoad[s.id] = 0;
    });

    bookings.forEach((booking) => {
      if (booking.staff_id && staffLoad[booking.staff_id] !== undefined) {
        staffLoad[booking.staff_id]++;
      }
    });

    const avgLoad = staff.length > 0 ? bookings.length / staff.length : 0;
    const recommendations = [];

    for (const [staffId, load] of Object.entries(staffLoad)) {
      const staffMember = staff.find((s) => s.id === staffId);
      if (!staffMember) continue;

      if (load > avgLoad * 1.3) {
        recommendations.push({
          type: "overload_warning",
          payload: {
            staffId,
            staffName: staffMember.name,
            load,
            avgLoad,
            suggestion: `Сотрудник ${staffMember.name} перегружен. Рекомендуется перераспределить нагрузку.`,
          },
          effect_estimate: {
            expectedLoadReduction: Math.round((load - avgLoad) * 100) / 100,
          },
        });
      } else if (load < avgLoad * 0.5 && load > 0) {
        recommendations.push({
          type: "underload_opportunity",
          payload: {
            staffId,
            staffName: staffMember.name,
            load,
            avgLoad,
            suggestion: `Сотрудник ${staffMember.name} недозагружен. Можно добавить дополнительные слоты.`,
          },
          effect_estimate: {
            potentialAdditionalBookings: Math.round((avgLoad - load) * 100) / 100,
          },
        });
      }
    }

    for (const rec of recommendations) {
      await supabase.from("ai_recommendations").insert({
        branch_id: branchId,
        type: rec.type,
        status: "pending",
        payload: rec.payload,
        effect_estimate: rec.effect_estimate,
      });
    }

    return new Response(
      JSON.stringify({ recommendations }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("AI recommendations error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
