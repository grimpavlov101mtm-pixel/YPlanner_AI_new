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

    const { branchId } = await req.json();

    if (!branchId) {
      return new Response(
        JSON.stringify({ error: "branchId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: branch } = await supabase
      .from("branches")
      .select("id, name, yclients_company_id")
      .eq("id", branchId)
      .single();

    if (!branch) {
      return new Response(
        JSON.stringify({ error: "Branch not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!branch.yclients_company_id) {
      return new Response(
        JSON.stringify({ error: "yClients company ID not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings } = await supabase
      .from("integration_settings")
      .select("yclients_partner_token, yclients_user_token")
      .eq("branch_id", branchId)
      .maybeSingle();

    if (!settings || !settings.yclients_partner_token) {
      return new Response(
        JSON.stringify({ error: "yClients integration not configured. Please add Partner Token." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.yclients_user_token) {
      return new Response(
        JSON.stringify({ error: "User Token is required for syncing records. Please add it in Integration Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = `Bearer ${settings.yclients_partner_token}, User ${settings.yclients_user_token}`;
    console.log("Auth header format:", authHeader.substring(0, 50) + "...");

    const results = {
      staff: { count: 0, status: "error", error: null },
      services: { count: 0, status: "error", error: null },
      bookings: { count: 0, status: "error", error: null },
    };

    try {
      results.staff.count = await syncStaff(supabase, branch, authHeader);
      results.staff.status = "success";
      await logSyncStatus(supabase, branchId, "staff", "success", results.staff.count, null);
    } catch (error) {
      console.error("Error syncing staff:", error);
      results.staff.error = error.message;
      await logSyncStatus(supabase, branchId, "staff", "error", 0, error.message);
    }

    try {
      results.services.count = await syncServices(supabase, branch, authHeader);
      results.services.status = "success";
      await logSyncStatus(supabase, branchId, "services", "success", results.services.count, null);
    } catch (error) {
      console.error("Error syncing services:", error);
      results.services.error = error.message;
      await logSyncStatus(supabase, branchId, "services", "error", 0, error.message);
    }

    try {
      results.bookings.count = await syncBookings(supabase, branch, authHeader);
      results.bookings.status = "success";
      await logSyncStatus(supabase, branchId, "bookings", "success", results.bookings.count, null);
    } catch (error) {
      console.error("Error syncing bookings:", error);
      results.bookings.error = error.message;
      await logSyncStatus(supabase, branchId, "bookings", "error", 0, error.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        staff: results.staff.count,
        services: results.services.count,
        bookings: results.bookings.count,
        details: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function logSyncStatus(
  supabase: any,
  branchId: string,
  syncType: string,
  status: string,
  syncedCount: number,
  errorMessage: string | null
) {
  await supabase.from("sync_status").insert({
    branch_id: branchId,
    sync_type: syncType,
    status: status,
    synced_count: syncedCount,
    error_message: errorMessage,
  });
}

async function syncStaff(supabase: any, branch: any, authHeader: string): Promise<number> {
  const url = `https://api.yclients.com/api/v1/company/${branch.yclients_company_id}/staff`;
  console.log("Fetching staff from:", url);

  const response = await fetch(url, {
    headers: {
      "Authorization": authHeader,
      "Accept": "application/vnd.yclients.v2+json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Staff API error response:", errorText);
    throw new Error(`yClients staff API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("Staff API response:", JSON.stringify(result).substring(0, 200));

  if (result && result.success === false) {
    console.error("Staff API success=false:", result.meta);
    throw new Error(
      `yClients staff API error: success=false - ${
        result.meta?.message || "Unknown error"
      }`
    );
  }

  const staffList = Array.isArray(result.data) ? result.data : (result.data ? Object.values(result.data) : []);
  console.log(`Found ${staffList.length} staff members`);
  console.log("Staff list sample:", JSON.stringify(staffList[0] || {}));

  let syncedCount = 0;

  for (const staffMember of staffList) {
    if (!staffMember || !staffMember.id) continue;

    const payload = {
      branch_id: branch.id,
      yclients_staff_id: staffMember.id,
      name: staffMember.name || "Unknown",
      is_active:
        staffMember.is_active !== undefined
          ? !!staffMember.is_active
          : true,
    };

    const { error } = await supabase
      .from("staff")
      .upsert(payload, {
        onConflict: "branch_id,yclients_staff_id",
      });

    if (!error) {
      syncedCount++;
    } else {
      console.error(`Error upserting staff ${staffMember.id}:`, error);
      throw new Error(
        `Failed to upsert staff ${staffMember.id}: ${
          (error as any).message || JSON.stringify(error)
        }`
      );
    }
  }

  return syncedCount;
}

async function syncServices(supabase: any, branch: any, authHeader: string): Promise<number> {
  const url = `https://api.yclients.com/api/v1/company/${branch.yclients_company_id}/services`;
  console.log("Fetching services from:", url);

  const response = await fetch(url, {
    headers: {
      "Authorization": authHeader,
      "Accept": "application/vnd.yclients.v2+json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Services API error response:", errorText);
    throw new Error(`yClients services API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("Services API response:", JSON.stringify(result).substring(0, 200));

  if (result && result.success === false) {
    console.error("Services API success=false:", result.meta);
    throw new Error(
      `yClients services API error: success=false - ${
        result.meta?.message || "Unknown error"
      }`
    );
  }

  const servicesList = Array.isArray(result.data) ? result.data : (result.data ? Object.values(result.data) : []);
  console.log(`Found ${servicesList.length} services`);
  console.log("Services list sample:", JSON.stringify(servicesList[0] || {}));

  let syncedCount = 0;

  for (const service of servicesList) {
    if (!service || !service.id) continue;

    const payload = {
      branch_id: branch.id,
      yclients_service_id: service.id,
      name: service.title || service.name || "Unknown Service",
      duration_minutes: service.seance_length || service.duration || 60,
      is_mobile: !!(service.is_mobile || service.online || false),
    };

    const { error } = await supabase
      .from("services")
      .upsert(payload, {
        onConflict: "branch_id,yclients_service_id",
      });

    if (!error) {
      syncedCount++;
    } else {
      console.error(`Error upserting service ${service.id}:`, error);
      throw new Error(
        `Failed to upsert service ${service.id}: ${
          (error as any).message || JSON.stringify(error)
        }`
      );
    }
  }

  return syncedCount;
}

async function syncBookings(supabase: any, branch: any, authHeader: string): Promise<number> {
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const url = `https://api.yclients.com/api/v1/records/${branch.yclients_company_id}?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}`;
  console.log("Fetching bookings from:", url);

  const response = await fetch(url, {
    headers: {
      "Authorization": authHeader,
      "Accept": "application/vnd.yclients.v2+json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Bookings API error response:", errorText);

    if (response.status === 403) {
      throw new Error(
        `yClients records API error: 403 - ${errorText}. ` +
        `Скорее всего, User Token не имеет прав на просмотр записей для этой компании. ` +
        `Проверьте в YClients права пользователя (раздел "Пользователи" → "Права доступа" → доступ к расписанию/API) ` +
        `или сгенерируйте User Token для пользователя с полными правами.`
      );
    }

    throw new Error(`yClients records API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("Bookings API response:", JSON.stringify(result).substring(0, 200));

  if (result && result.success === false) {
    console.error("Bookings API success=false:", result.meta);
    throw new Error(
      `yClients records API error: success=false - ${
        result.meta?.message || "Unknown error"
      }`
    );
  }

  const records = result.data || [];
  console.log(`Found ${records.length} bookings`);

  let syncedCount = 0;

  for (const record of records) {
    const staffId = record.staff_id ? await findStaffId(supabase, branch.id, record.staff_id) : null;

    let serviceId = null;
    if (record.services && record.services.length > 0) {
      serviceId = await findServiceId(supabase, branch.id, record.services[0].id);
    }

    let status = "booked";
    if (record.attendance === -1) {
      status = "cancelled";
    } else if (record.attendance === 1) {
      status = "completed";
    }

    const seanceLength = record.seance_length || 60;
    const startTime = new Date(record.datetime);
    const endTime = new Date(startTime.getTime() + seanceLength * 60 * 1000);

    const { error } = await supabase
      .from("bookings")
      .upsert({
        branch_id: branch.id,
        yclients_record_id: record.id,
        staff_id: staffId,
        service_id: serviceId,
        starts_at_utc: startTime.toISOString(),
        ends_at_utc: endTime.toISOString(),
        status: status,
        is_mobile: false,
        client_name: record.client?.name || null,
        client_phone: record.client?.phone || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "branch_id,yclients_record_id",
      });

    if (!error) {
      syncedCount++;
    } else {
      console.error(`Error upserting booking ${record.id}:`, error);
    }
  }

  return syncedCount;
}

async function findStaffId(supabase: any, branchId: string, yclientsStaffId: number): Promise<string | null> {
  const { data } = await supabase
    .from("staff")
    .select("id")
    .eq("branch_id", branchId)
    .eq("yclients_staff_id", yclientsStaffId)
    .maybeSingle();

  return data?.id || null;
}

async function findServiceId(supabase: any, branchId: string, yclientsServiceId: number): Promise<string | null> {
  const { data } = await supabase
    .from("services")
    .select("id")
    .eq("branch_id", branchId)
    .eq("yclients_service_id", yclientsServiceId)
    .maybeSingle();

  return data?.id || null;
}
