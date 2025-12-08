import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ActivateRequest {
  salonId: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Отсутствует токен авторизации");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Отсутствуют переменные окружения Supabase");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Пользователь не авторизован");
    }

    const { salonId }: ActivateRequest = await req.json();

    if (!salonId || typeof salonId !== "number") {
      throw new Error("Некорректный salon_id");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error("Профиль пользователя не найден");
    }

    let orgId = profile.org_id;

    if (!orgId) {
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: `Организация ${user.email}`,
        })
        .select()
        .single();

      if (orgError || !newOrg) {
        throw new Error("Не удалось создать организацию");
      }

      orgId = newOrg.id;

      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ org_id: orgId })
        .eq("id", user.id);

      if (updateProfileError) {
        console.error("Failed to update profile with org_id:", updateProfileError);
      }
    }

    const { data: existingBranch, error: branchCheckError } = await supabase
      .from("branches")
      .select("id, org_id, name, marketplace_status")
      .eq("marketplace_salon_id", salonId)
      .maybeSingle();

    if (branchCheckError) {
      throw new Error("Ошибка проверки существующего филиала");
    }

    if (existingBranch) {
      if (existingBranch.org_id !== orgId) {
        throw new Error(
          `Филиал с salon_id ${salonId} уже привязан к другой организации`
        );
      }

      const { error: updateError } = await supabase
        .from("branches")
        .update({
          connection_type: "marketplace",
          marketplace_status: "trial",
        })
        .eq("id", existingBranch.id);

      if (updateError) {
        throw new Error("Не удалось обновить статус филиала");
      }

      return new Response(
        JSON.stringify({
          success: true,
          branchId: existingBranch.id,
          message: "Филиал успешно активирован",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: newBranch, error: createError } = await supabase
      .from("branches")
      .insert({
        org_id: orgId,
        name: `Филиал YCLIENTS #${salonId}`,
        marketplace_salon_id: salonId,
        connection_type: "marketplace",
        marketplace_status: "trial",
      })
      .select()
      .single();

    if (createError || !newBranch) {
      console.error("Branch creation error:", createError);
      throw new Error("Не удалось создать филиал");
    }

    const { error: settingsError } = await supabase
      .from("branch_settings")
      .insert({
        branch_id: newBranch.id,
        primary_tz: "Europe/Moscow",
        default_horizon: "week",
        default_time_grain: "day",
        sync_interval_minutes: 15,
        overload_threshold: 85,
        mobile_enabled: false,
        is_sync_enabled: true,
      });

    if (settingsError) {
      console.error("Settings creation error:", settingsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        branchId: newBranch.id,
        message: "Филиал успешно создан и активирован",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Marketplace activation error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Произошла ошибка",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});