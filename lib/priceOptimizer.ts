import type { ComponentWithSpecs, SelectedParts } from './supabase';

export type OptimizationConfig = {
  name: 'Cheapest Deal' | 'Fastest Delivery' | 'Top Quality';
  description: string;
  parts: Record<string, ComponentWithSpecs>;
  totalPrice: number;
  deliveryDays: number;
  avgQuality: number;
};

const REQUIRED_CATEGORIES = [
  'frame',
  'motor',
  'esc',
  'flight_controller',
  'propeller',
  'battery',
  'camera',
  'vtx',
  'receiver',
];

/**
 * Compute total delivery lead time based on the highest shipping_days among
 * all selected components in a configuration.
 */
export function computeDeliveryDays(parts: ComponentWithSpecs[]): number {
  if (parts.length === 0) return 0;
  return Math.max(...parts.map((p) => p.shipping_days));
}

/**
 * Group selected parts and output three recommended configurations:
 * 1. "Cheapest Deal" — lowest total price per category
 * 2. "Fastest Delivery" — fewest shipping days per category
 * 3. "Top Quality" — highest quality score per category
 *
 * Each configuration picks one component per category using its optimization
 * criterion. The currently selected parts seed the "current" configuration
 * so the UI can compare against it.
 */
export function generateRecommendations(
  selected: SelectedParts,
  components: ComponentWithSpecs[]
): {
  current: OptimizationConfig | null;
  recommendations: OptimizationConfig[];
} {
  const byCategory = (cat: string) => components.filter((c) => c.category === cat);

  // Current selection
  const currentParts: Record<string, ComponentWithSpecs> = {};
  for (const cat of REQUIRED_CATEGORIES) {
    const id = selected[cat];
    if (id) {
      const comp = components.find((c) => c.id === id);
      if (comp) currentParts[cat] = comp;
    }
  }
  const current =
    Object.keys(currentParts).length > 0
      ? buildConfig('Cheapest Deal', currentParts, 'Current selection')
      : null;

  const recommendations: OptimizationConfig[] = [];

  // 1. Cheapest Deal
  const cheapestParts: Record<string, ComponentWithSpecs> = {};
  for (const cat of REQUIRED_CATEGORIES) {
    const options = byCategory(cat);
    if (options.length === 0) continue;
    const cheapest = options.reduce((min, c) =>
      Number(c.price) < Number(min.price) ? c : min
    );
    cheapestParts[cat] = cheapest;
  }
  if (Object.keys(cheapestParts).length > 0) {
    recommendations.push(buildConfig('Cheapest Deal', cheapestParts, 'Lowest total price across all categories'));
  }

  // 2. Fastest Delivery
  const fastestParts: Record<string, ComponentWithSpecs> = {};
  for (const cat of REQUIRED_CATEGORIES) {
    const options = byCategory(cat);
    if (options.length === 0) continue;
    const fastest = options.reduce((best, c) =>
      c.shipping_days < best.shipping_days ? c : best
    );
    fastestParts[cat] = fastest;
  }
  if (Object.keys(fastestParts).length > 0) {
    recommendations.push(buildConfig('Fastest Delivery', fastestParts, 'Shortest shipping lead time'));
  }

  // 3. Top Quality
  const topQualityParts: Record<string, ComponentWithSpecs> = {};
  for (const cat of REQUIRED_CATEGORIES) {
    const options = byCategory(cat);
    if (options.length === 0) continue;
    const best = options.reduce((top, c) =>
      c.quality_score > top.quality_score ? c : top
    );
    topQualityParts[cat] = best;
  }
  if (Object.keys(topQualityParts).length > 0) {
    recommendations.push(buildConfig('Top Quality', topQualityParts, 'Highest quality score across all categories'));
  }

  return { current, recommendations };
}

function buildConfig(
  name: OptimizationConfig['name'],
  parts: Record<string, ComponentWithSpecs>,
  description: string
): OptimizationConfig {
  const partList = Object.values(parts);
  const totalPrice = partList.reduce((sum, p) => sum + Number(p.price) + Number(p.shipping_cost || 0), 0);
  const deliveryDays = computeDeliveryDays(partList);
  const avgQuality =
    partList.length > 0
      ? partList.reduce((sum, p) => sum + p.quality_score, 0) / partList.length
      : 0;

  return {
    name,
    description,
    parts,
    totalPrice,
    deliveryDays,
    avgQuality: Math.round(avgQuality * 10) / 10,
  };
}
