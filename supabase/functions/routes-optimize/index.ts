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

    const { branchId, date } = await req.json();

    if (!branchId || !date) {
      return new Response(
        JSON.stringify({ error: "branchId and date are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

    const { data: mobileBookings } = await supabase
      .from("bookings")
      .select(`
        id,
        staff_id,
        starts_at_utc,
        client_name,
        address,
        latitude,
        longitude,
        staff:staff_id (
          id,
          name
        )
      `)
      .eq("branch_id", branchId)
      .eq("is_mobile", true)
      .eq("status", "booked")
      .gte("starts_at_utc", startOfDay)
      .lte("starts_at_utc", endOfDay)
      .order("starts_at_utc");

    if (!mobileBookings || mobileBookings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No mobile bookings found for this date", routeId: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const staffRoutes: Record<string, any[]> = {};
    mobileBookings.forEach((booking) => {
      const staffId = booking.staff_id;
      if (!staffId) return;

      if (!staffRoutes[staffId]) {
        staffRoutes[staffId] = [];
      }
      staffRoutes[staffId].push(booking);
    });

    const { data: existingRoute, error: routeError } = await supabase
      .from("routes")
      .upsert({
        branch_id: branchId,
        date: date,
        status: "planned",
        summary: {
          stops: mobileBookings.length,
          distance: 0,
          staffCount: Object.keys(staffRoutes).length,
        },
      }, {
        onConflict: "branch_id,date",
      })
      .select()
      .single();

    if (routeError || !existingRoute) {
      throw new Error("Failed to create/update route");
    }

    await supabase
      .from("route_stops")
      .delete()
      .eq("route_id", existingRoute.id);

    let globalSeq = 1;
    for (const [staffId, bookings] of Object.entries(staffRoutes)) {
      bookings.sort((a, b) => new Date(a.starts_at_utc).getTime() - new Date(b.starts_at_utc).getTime());

      const coords = bookings
        .filter((b) => b.latitude && b.longitude)
        .map((b) => `${b.latitude},${b.longitude}`)
        .join("~");

      let yandexLink = "";
      if (coords) {
        yandexLink = `https://yandex.ru/maps/?rtext=${coords}&rtt=auto`;
      }

      for (const booking of bookings) {
        await supabase.from("route_stops").insert({
          route_id: existingRoute.id,
          staff_id: staffId,
          booking_id: booking.id,
          seq: globalSeq,
          eta: booking.starts_at_utc,
          yandex_link: yandexLink,
        });
        globalSeq++;
      }
    }

    return new Response(
      JSON.stringify({ routeId: existingRoute.id, routes: staffRoutes }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Routes optimization error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
