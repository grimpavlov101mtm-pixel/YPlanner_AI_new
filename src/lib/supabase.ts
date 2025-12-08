import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          org_id: string | null;
          full_name: string | null;
          role: 'ORG_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_MANAGER' | 'BRANCH_ANALYST';
          telegram_chat_id: number | null;
          created_at: string;
        };
      };
      branches: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          yclients_company_id: number | null;
          connection_type: 'manual' | 'marketplace';
          marketplace_status: 'trial' | 'active' | 'expired' | 'cancelled' | null;
          marketplace_salon_id: number | null;
          marketplace_app_id: string | null;
          created_at: string;
        };
      };
      branch_settings: {
        Row: {
          branch_id: string;
          primary_tz: string;
          default_horizon: 'week' | 'month' | 'quarter' | 'year';
          default_time_grain: 'day' | 'week' | 'month';
          sync_interval_minutes: number;
          overload_threshold: number;
          mobile_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      staff: {
        Row: {
          id: string;
          branch_id: string;
          yclients_staff_id: number;
          name: string;
          skills: unknown;
          is_active: boolean;
          created_at: string;
        };
      };
      services: {
        Row: {
          id: string;
          branch_id: string;
          yclients_service_id: number;
          name: string;
          duration_minutes: number;
          is_mobile: boolean;
          created_at: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          branch_id: string;
          yclients_record_id: number;
          staff_id: string | null;
          service_id: string | null;
          starts_at_utc: string;
          ends_at_utc: string;
          status: 'booked' | 'cancelled' | 'completed';
          is_mobile: boolean;
          client_name: string | null;
          client_phone: string | null;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          updated_at: string;
          created_at: string;
        };
      };
      demand_forecasts: {
        Row: {
          id: string;
          branch_id: string;
          service_id: string | null;
          bucket_start: string;
          bucket_end: string;
          time_grain: 'day' | 'week' | 'month';
          expected_bookings: number;
          expected_load_percent: number | null;
          created_at: string;
        };
      };
      ai_recommendations: {
        Row: {
          id: string;
          branch_id: string;
          type: string;
          status: 'pending' | 'applied' | 'rejected' | 'failed';
          payload: unknown;
          effect_estimate: unknown;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      routes: {
        Row: {
          id: string;
          branch_id: string;
          date: string;
          status: 'planned' | 'sent' | 'completed' | 'cancelled';
          summary: unknown;
          created_at: string;
        };
      };
      route_stops: {
        Row: {
          id: string;
          route_id: string;
          staff_id: string | null;
          booking_id: string | null;
          seq: number;
          eta: string | null;
          yandex_link: string | null;
        };
      };
    };
  };
};
