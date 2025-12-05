import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
    };
    message: any;
    data: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();

    if (update.message?.text) {
      const text = update.message.text;
      const chatId = update.message.chat.id;

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: settings } = await supabase
        .from('integration_settings')
        .select('telegram_bot_token, branch_id')
        .not('telegram_bot_token', 'is', null)
        .limit(1)
        .maybeSingle();

      if (!settings?.telegram_bot_token) {
        console.error("No Telegram bot token found in settings");
        return new Response("OK", { status: 200 });
      }

      const botToken = settings.telegram_bot_token;

      if (text === "/start") {
        await sendTelegramMessage(
          botToken,
          chatId,
          "🤖 Добро пожаловать в YPlanner AI!\n\n" +
          "Я помогу вам управлять расписанием и записями.\n\n" +
          "📋 Доступные команды:\n" +
          "• /today - сводка на сегодня\n" +
          "• /week - сводка на неделю\n" +
          "• /stats - статистика\n" +
          "• /help - помощь"
        );
      } else if (text === "/help") {
        await sendTelegramMessage(
          botToken,
          chatId,
          "ℹ️ YPlanner AI - ваш ИИ-ассистент для управления расписанием.\n\n" +
          "Команды:\n" +
          "• /today - загрузка на сегодня\n" +
          "• /week - прогноз на неделю\n" +
          "• /stats - общая статистика\n" +
          "• /routes - оптимизация маршрутов\n" +
          "• /help - это сообщение"
        );
      } else if (text === "/today") {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('branch_id', settings.branch_id)
          .gte('starts_at_utc', new Date().toISOString().split('T')[0])
          .lt('starts_at_utc', new Date(Date.now() + 86400000).toISOString().split('T')[0]);

        const { data: staff } = await supabase
          .from('staff')
          .select('*')
          .eq('branch_id', settings.branch_id)
          .eq('is_active', true);

        const bookingsCount = bookings?.length || 0;
        const staffCount = staff?.length || 0;
        const avgLoad = staffCount > 0 ? Math.round((bookingsCount / staffCount) * 100 / 10) : 0;

        await sendTelegramMessage(
          botToken,
          chatId,
          `📊 Загрузка на сегодня:\n\n` +
          `📝 Записей: ${bookingsCount}\n` +
          `👥 Сотрудников: ${staffCount}\n` +
          `⚡ Средняя загрузка: ${avgLoad}%`
        );
      } else if (text === "/week") {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('branch_id', settings.branch_id)
          .gte('starts_at_utc', weekStart.toISOString())
          .lt('starts_at_utc', weekEnd.toISOString());

        await sendTelegramMessage(
          botToken,
          chatId,
          `📅 Прогноз на неделю:\n\n` +
          `📝 Всего записей: ${bookings?.length || 0}\n` +
          `📈 Тенденция: стабильная`
        );
      } else if (text === "/stats") {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('branch_id', settings.branch_id);

        const { data: staff } = await supabase
          .from('staff')
          .select('*')
          .eq('branch_id', settings.branch_id);

        const { data: services } = await supabase
          .from('services')
          .select('*')
          .eq('branch_id', settings.branch_id);

        await sendTelegramMessage(
          botToken,
          chatId,
          `📊 Общая статистика:\n\n` +
          `📝 Всего записей: ${bookings?.length || 0}\n` +
          `👥 Сотрудников: ${staff?.length || 0}\n` +
          `💼 Услуг: ${services?.length || 0}`
        );
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          "❓ Команда не распознана.\n\nИспользуйте /help для списка команд."
        );
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram API error:", data);
    }

    return data;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    throw error;
  }
}