import type { ComponentWithSpecs, SelectedParts } from './supabase';
import { getFrameSize } from './frameCompatibility';

export type PerformanceEstimate = {
  flightTimeHover: number;
  flightTimeAggressive: number;
  thrustToWeightRatio: number;
  speedRating: number;
  agilityRating: number;
  stabilityRating: number;
  videoQuality: 'Analog' | 'Digital HD' | 'Unknown';
  totalWeightG: number;
  estimatedMaxSpeed: number;
  batteryCapacityMah: number;
  motorKv: number;
};

function getPart(selectedParts: SelectedParts, components: ComponentWithSpecs[], category: string): ComponentWithSpecs | undefined {
  const id = selectedParts[category];
  return id && id !== 'skip' ? components.find((c) => c.id === id) : undefined;
}

function extractMah(name: string): number {
  const match = name.match(/(\d+)\s*mah/i);
  return match ? parseInt(match[1], 10) : 1500;
}

function extractKv(name: string): number {
  const match = name.match(/(\d{3,5})\s*kv/i);
  return match ? parseInt(match[1], 10) : 2400;
}

export function calculatePerformance(
  selectedParts: SelectedParts,
  components: ComponentWithSpecs[]
): PerformanceEstimate {
  const frame = getPart(selectedParts, components, 'frame');
  const motor = getPart(selectedParts, components, 'motor');
  const esc = getPart(selectedParts, components, 'esc');
  const fc = getPart(selectedParts, components, 'flight_controller');
  const battery = getPart(selectedParts, components, 'battery');
  const propeller = getPart(selectedParts, components, 'propeller');
  const camera = getPart(selectedParts, components, 'camera');
  const vtx = getPart(selectedParts, components, 'vtx');
  const receiver = getPart(selectedParts, components, 'receiver');

  // Total weight
  const partWeights = [frame, motor, esc, fc, battery, propeller, camera, vtx, receiver];
  const totalWeightG = partWeights.reduce((sum, p) => sum + (p ? Number(p.weight_g) || 0 : 0), 0);
  // Motor weight is per-motor, multiply by 4
  const motorWeight = motor ? Number(motor.weight_g) || 0 : 0;
  const propWeight = propeller ? Number(propeller.weight_g) || 0 : 0;
  const adjustedWeight = totalWeightG + motorWeight * 3 + propWeight * 3;

  // Battery
  const batteryMah = battery ? extractMah(battery.name) : 1500;
  const batteryS = battery?.electrical_specs?.max_voltage_s || 4;
  const nominalVoltage = batteryS * 3.7;

  // Motor thrust estimation (grams per motor)
  const motorKv = motor ? extractKv(motor.name) : 2400;
  const motorAmps = motor?.electrical_specs?.max_current_a || 30;
  const frameSize = getFrameSize(frame) || 5;
  const propSize = propeller ? parseFloat(propeller.name.match(/(\d+(?:\.\d+)?)"\s*Props/)?.[1] || '5') : 5;

  // Rough thrust: KV * voltage * prop_size factor
  const thrustPerMotorG = Math.min(motorKv * nominalVoltage * 0.015 * (propSize / 5), 250);
  const totalThrustG = thrustPerMotorG * 4;
  const thrustToWeightRatio = adjustedWeight > 0 ? totalThrustG / adjustedWeight : 0;

  // Current draw estimates
  const hoverCurrent = Math.max(totalThrustG * 0.005, 4);
  const aggressiveCurrent = Math.max(totalThrustG * 0.015, 15);

  // Flight time = (capacity_mah / 1000) * (voltage / avg_current) * 60 * efficiency
  const efficiency = 0.8;
  const flightTimeHover = (batteryMah / 1000) * (nominalVoltage / hoverCurrent) * 60 * efficiency;
  const flightTimeAggressive = (batteryMah / 1000) * (nominalVoltage / aggressiveCurrent) * 60 * efficiency;

  // Speed estimate (mph) based on thrust-to-weight and prop size
  const estimatedMaxSpeed = Math.round(Math.min(thrustToWeightRatio * 12 * (5 / Math.max(propSize, 1)), 120));

  // Ratings (1-10 scale)
  const agilityRating = Math.min(Math.round(thrustToWeightRatio * 1.5), 10);
  const stabilityRating = Math.min(Math.round(7 + (fc ? fc.quality_score - 5 : 0)), 10);
  const speedRating = Math.min(Math.round(estimatedMaxSpeed / 10), 10);

  // Video quality
  let videoQuality: PerformanceEstimate['videoQuality'] = 'Unknown';
  if (camera) {
    const isDigital = isDigitalVideo(camera);
    videoQuality = isDigital ? 'Digital HD' : 'Analog';
  }

  return {
    flightTimeHover: Math.round(flightTimeHover * 10) / 10,
    flightTimeAggressive: Math.round(flightTimeAggressive * 10) / 10,
    thrustToWeightRatio: Math.round(thrustToWeightRatio * 10) / 10,
    speedRating,
    agilityRating,
    stabilityRating,
    videoQuality,
    totalWeightG: Math.round(adjustedWeight),
    estimatedMaxSpeed,
    batteryCapacityMah: batteryMah,
    motorKv,
  };
}

function isDigitalVideo(comp: ComponentWithSpecs): boolean {
  const name = comp.name.toLowerCase();
  const proto = comp.electrical_specs?.protocol?.toLowerCase() || '';
  return name.includes('dji') || name.includes('walksnail') || name.includes('hd zero') ||
    name.includes('caddx') || proto === 'digital' || name.includes('o3');
}
