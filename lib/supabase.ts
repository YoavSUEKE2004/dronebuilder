import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Component = {
  id: string;
  name: string;
  category: string;
  price: number;
  store_name: string;
  product_url: string;
  image_url: string;
  dimensions_mm: string;
  mounting_pattern: string;
  weight_g: number;
  shipping_days: number;
  shipping_cost: number;
  quality_score: number;
  created_at: string;
};

export type ElectricalSpec = {
  component_id: string;
  max_voltage_s: number | null;
  min_voltage_s: number | null;
  max_current_a: number | null;
  bec_output_v: number | null;
  protocol: string;
};

export type ComponentWithSpecs = Component & {
  electrical_specs: ElectricalSpec | null;
};

export type Builder = {
  id: string;
  user_id: string | null;
  bio: string;
  location: string;
  subscription_status: string;
  assembly_fee: number;
  rating: number;
  created_at: string;
};

export type FulfillmentType = 'kit' | 'builder';
export type BuildStatus = 'draft' | 'ordered' | 'assembling' | 'shipped' | 'delivered';

export type SelectedParts = Record<string, string | null>;
