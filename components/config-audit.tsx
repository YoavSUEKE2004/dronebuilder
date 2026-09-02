'use client';

import { useMemo } from 'react';
import {
  ThumbsUp, AlertTriangle, XCircle, Brain, TrendingUp,
  Scale, Battery, Fan, Check, ArrowRight,
} from 'lucide-react';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';
import type { DetailedCompatibilityResult } from '@/lib/compatibilityEngine';
import { getFrameSize } from '@/lib/frameCompatibility';
import { cn } from '@/lib/utils';

type AuditItem = {
  label: string;
  rating: 'good' | 'warning' | 'error';
  message: string;
  suggestion?: string;
};

type Props = {
  selectedParts: SelectedParts;
  components: ComponentWithSpecs[];
  compatibility: DetailedCompatibilityResult;
};

export default function ConfigAudit({ selectedParts, components, compatibility }: Props) {
  const audit = useMemo(() => runAudit(selectedParts, components, compatibility), [selectedParts, components, compatibility]);

  const overallRating = audit.some((a) => a.rating === 'error')
    ? 'error'
    : audit.some((a) => a.rating === 'warning')
    ? 'warning'
    : 'good';

  const ratingConfig = {
    good: { icon: ThumbsUp, color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/30', label: 'Build Looks Good' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/30', label: 'Needs Improvement' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'from-red-500/20 to-red-500/5', border: 'border-red-500/30', label: 'Critical Issues' },
  };

  const config = ratingConfig[overallRating];
  const OverallIcon = config.icon;

  const selectedComponents = useMemo(() => {
    return Object.entries(selectedParts)
      .filter(([, id]) => id && id !== 'skip')
      .map(([cat, id]) => ({ category: cat, component: components.find((c) => c.id === id)! }))
      .filter((x) => x.component);
  }, [selectedParts, components]);

  const totalWeight = selectedComponents.reduce((sum, { component }) => sum + component.weight_g, 0);
  const totalPrice = selectedComponents.reduce((sum, { component }) => sum + Number(component.price) + Number(component.shipping_cost || 0), 0);

  return (
    <div
      className="flex flex-col flex-1 min-h-0 p-6 space-y-4"
      style={{ maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}
    >
      {/* Overall rating */}
      <div className={cn('rounded-2xl border bg-gradient-to-br p-5', config.bg, config.border)}>
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900/50', config.color)}>
            <OverallIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">AI Configuration Audit</h2>
            <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg bg-slate-900/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              <Scale className="w-3 h-3" /> Total Weight
            </div>
            <p className="text-lg font-bold text-slate-200">{totalWeight}g</p>
            <p className="text-[10px] text-slate-500">{totalWeight < 250 ? 'Sub-250g class' : 'Standard class'}</p>
          </div>
          <div className="rounded-lg bg-slate-900/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              <TrendingUp className="w-3 h-3" /> Total Cost
            </div>
            <p className="text-lg font-bold text-slate-200">${totalPrice.toFixed(2)}</p>
            <p className="text-[10px] text-slate-500">{selectedComponents.length}/9 parts</p>
          </div>
        </div>
      </div>

      {/* Audit items — scrollable */}
      <div className="space-y-2.5 min-h-0 flex-1 overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-500 pr-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-cyan-400" /> Engineering Analysis
        </h3>
        {audit.map((item, i) => {
          const itemConfig = item.rating === 'good'
            ? { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' }
            : item.rating === 'warning'
            ? { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20' }
            : { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
          const ItemIcon = itemConfig.icon;
          return (
            <div key={i} className={cn('rounded-lg border p-3', itemConfig.bg, itemConfig.border)}>
              <div className="flex items-start gap-2.5">
                <ItemIcon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', itemConfig.color)} />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-200">{item.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.message}</p>
                  {item.suggestion && (
                    <p className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
                      <ArrowRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-cyan-400" />
                      <span><span className="text-cyan-400 font-medium">Suggestion:</span> {item.suggestion}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bill of materials summary */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bill of Materials</h3>
        {selectedComponents.map(({ category, component }) => (
          <div key={category} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-800/40">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 uppercase">{category.replace('_', ' ')}</p>
              <p className="text-xs font-medium text-slate-200 truncate">{component.name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-semibold text-slate-300">${Number(component.price).toFixed(2)}</p>
              <p className="text-[9px] text-slate-500">+ ${Number(component.shipping_cost || 0).toFixed(2)} ship</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function runAudit(
  selectedParts: SelectedParts,
  components: ComponentWithSpecs[],
  compatibility: DetailedCompatibilityResult
): AuditItem[] {
  const items: AuditItem[] = [];
  const get = (cat: string) =>
    selectedParts[cat] ? components.find((c) => c.id === selectedParts[cat]) : undefined;

  const frame = get('frame');
  const motor = get('motor');
  const esc = get('esc');
  const prop = get('propeller');
  const battery = get('battery');
  const fc = get('flight_controller');
  const camera = get('camera');
  const vtx = get('vtx');
  const receiver = get('receiver');
  const goggles = get('goggles');
  const remote = get('remote');

  // 1. Weight-to-thrust ratio
  const totalWeight = Object.values(selectedParts)
    .filter(Boolean)
    .reduce((sum, id) => {
      const c = components.find((c) => c.id === id);
      return sum + (c ? c.weight_g : 0);
    }, 0);

  const motorKv = motor ? parseInt(motor.name.match(/(\d+)KV/)?.[1] || '0') : 0;
  const frameSize = getFrameSize(frame);

  if (motor && totalWeight > 0) {
    const motorCurrent = motor.electrical_specs?.max_current_a || 30;
    const estimatedThrustPerMotor = motorCurrent * 5;
    const totalThrust = estimatedThrustPerMotor * 4;
    const thrustRatio = totalThrust / totalWeight;

    if (thrustRatio >= 8) {
      items.push({
        label: 'Weight-to-Thrust Ratio',
        rating: 'good',
        message: `Thrust-to-weight ratio is ${thrustRatio.toFixed(1)}:1 — excellent for aggressive freestyle and racing.`,
      });
    } else if (thrustRatio >= 4) {
      items.push({
        label: 'Weight-to-Thrust Ratio',
        rating: 'warning',
        message: `Thrust-to-weight ratio is ${thrustRatio.toFixed(1)}:1 — adequate for cruising but may lack punch for aggressive maneuvers.`,
        suggestion: 'Consider lighter components or higher-KV motors for better agility.',
      });
    } else {
      items.push({
        label: 'Weight-to-Thrust Ratio',
        rating: 'error',
        message: `Thrust-to-weight ratio is only ${thrustRatio.toFixed(1)}:1 — the drone will feel sluggish and may struggle to maintain altitude.`,
        suggestion: 'Switch to higher-KV motors or reduce weight with a lighter frame/battery.',
      });
    }
  } else if (!motor) {
    items.push({ label: 'Weight-to-Thrust Ratio', rating: 'error', message: 'No motor selected — cannot calculate thrust ratio.' });
  }

  // 2. Power compatibility
  const errorIssues = compatibility.issues.filter((i) => i.level === 'error');
  if (errorIssues.length > 0) {
    items.push({
      label: 'Power Compatibility',
      rating: 'error',
      message: errorIssues[0].message,
      suggestion: 'Resolve all voltage and current mismatches before checkout.',
    });
  } else if (battery && esc && motor) {
    const bS = battery.electrical_specs?.max_voltage_s;
    const eS = esc.electrical_specs?.max_voltage_s;
    const mS = motor.electrical_specs?.max_voltage_s;
    if (bS && eS && mS && bS <= eS && bS <= mS) {
      items.push({
        label: 'Power Compatibility',
        rating: 'good',
        message: `Battery (${bS}S), ESC (${eS}S max), and motor (${mS}S max) are all within safe voltage limits.`,
      });
    }
  } else {
    items.push({ label: 'Power Compatibility', rating: 'warning', message: 'Select battery, ESC, and motor to verify power compatibility.' });
  }

  // 3. Propeller sizing match
  if (frame && prop) {
    const propMatch = prop.name.match(/(\d+(?:\.\d+)?)"\s*Props/);
    const propSize = propMatch ? parseFloat(propMatch[1]) : null;
    if (propSize != null && frameSize != null) {
      if (Math.abs(propSize - frameSize) <= 0.6) {
        items.push({
          label: 'Propeller Sizing Match',
          rating: 'good',
          message: `${propSize}" props are a perfect match for your ${frameSize}" frame.`,
        });
      } else if (Math.abs(propSize - frameSize) <= 1) {
        items.push({
          label: 'Propeller Sizing Match',
          rating: 'warning',
          message: `${propSize}" props are slightly mismatched with your ${frameSize}" frame.`,
          suggestion: `Consider ${frameSize}" props for optimal performance.`,
        });
      } else {
        items.push({
          label: 'Propeller Sizing Match',
          rating: 'error',
          message: `${propSize}" props are incompatible with your ${frameSize}" frame — they will not fit.`,
          suggestion: `Switch to ${frameSize}" propellers.`,
        });
      }
    }
  } else {
    items.push({ label: 'Propeller Sizing Match', rating: 'warning', message: 'Select a frame and propeller to check sizing.' });
  }

  // 4. Motor KV vs frame size
  if (motor && frameSize != null) {
    if (frameSize <= 3.5 && motorKv >= 3000) {
      items.push({ label: 'Motor KV vs Frame Size', rating: 'good', message: `${motorKv}KV is ideal for a ${frameSize}" micro frame — provides the high RPM needed for small props.` });
    } else if (frameSize >= 5 && frameSize < 7 && motorKv >= 2000 && motorKv <= 2800) {
      items.push({ label: 'Motor KV vs Frame Size', rating: 'good', message: `${motorKv}KV is well-matched for a ${frameSize}" freestyle frame.` });
    } else if (frameSize >= 7 && frameSize < 10 && motorKv >= 1000 && motorKv <= 1800) {
      items.push({ label: 'Motor KV vs Frame Size', rating: 'good', message: `${motorKv}KV provides the right balance of thrust and efficiency for a ${frameSize}" frame.` });
    } else if (frameSize >= 10 && motorKv <= 800) {
      items.push({ label: 'Motor KV vs Frame Size', rating: 'good', message: `${motorKv}KV low-RPM motors are perfect for a ${frameSize}" large frame with big props.` });
    } else {
      items.push({
        label: 'Motor KV vs Frame Size',
        rating: 'warning',
        message: `${motorKv}KV may not be optimal for a ${frameSize}" frame.`,
        suggestion: frameSize <= 3.5 ? 'Use 3000+ KV motors for micro frames.' : frameSize >= 10 ? 'Use 800KV or lower for large frames.' : 'Use 2000-2800KV for 5-7" frames.',
      });
    }
  }

  // 5. ESC thermal headroom
  if (motor && esc) {
    const motorCurrent = motor.electrical_specs?.max_current_a || 30;
    const escCurrent = esc.electrical_specs?.max_current_a || 45;
    const totalMotorCurrent = motorCurrent * 4;
    if (escCurrent >= totalMotorCurrent * 1.5) {
      items.push({ label: 'ESC Thermal Headroom', rating: 'good', message: `${escCurrent}A ESC has excellent thermal headroom over ${totalMotorCurrent}A combined motor draw.` });
    } else if (escCurrent >= totalMotorCurrent) {
      items.push({ label: 'ESC Thermal Headroom', rating: 'warning', message: `${escCurrent}A ESC barely covers ${totalMotorCurrent}A combined motor current — consider upgrading for safety.`, suggestion: `A ${Math.ceil(totalMotorCurrent * 1.3 / 10) * 10}A ESC would provide better thermal margin.` });
    } else {
      items.push({ label: 'ESC Thermal Headroom', rating: 'error', message: `${escCurrent}A ESC is underrated for ${totalMotorCurrent}A combined motor current — it may overheat.`, suggestion: `Upgrade to at least a ${Math.ceil(totalMotorCurrent * 1.2 / 10) * 10}A ESC.` });
    }
  }

  // 6. Flight controller compatibility
  if (fc && frame) {
    const fcMount = fc.mounting_pattern;
    const frameMount = frame.mounting_pattern;
    if (fcMount === frameMount) {
      items.push({ label: 'FC Mounting Pattern', rating: 'good', message: `Flight controller (${fcMount}) matches frame mounting pattern (${frameMount}).` });
    } else {
      items.push({ label: 'FC Mounting Pattern', rating: 'warning', message: `FC mount (${fcMount}) differs from frame (${frameMount}) — you may need an adapter plate.`, suggestion: `Select a ${frameMount}-mount FC for direct fit.` });
    }
  }

  // 7. UART port capacity check
  const fcUartCount = getFcUartCount(fc);
  const serialPeripherals: string[] = [];
  if (receiver && selectedParts.receiver !== 'skip') serialPeripherals.push('Receiver');
  if (vtx && selectedParts.vtx !== 'skip' && vtx.electrical_specs?.protocol && !['Analog', 'Digital'].includes(vtx.electrical_specs.protocol)) serialPeripherals.push('VTX (SmartAudio/Tramp)');
  if (receiver && selectedParts.receiver !== 'skip' && isSensor(receiver, 'gps')) serialPeripherals.push('GPS');
  if (receiver && selectedParts.receiver !== 'skip' && isSensor(receiver, 'lidar')) serialPeripherals.push('LiDAR');
  if (receiver && selectedParts.receiver !== 'skip' && isSensor(receiver, 'optical')) serialPeripherals.push('Optical Flow');
  if (receiver && selectedParts.receiver !== 'skip' && isSensor(receiver, 'current')) serialPeripherals.push('Current Sensor');

  if (fc && fcUartCount > 0 && serialPeripherals.length > 0) {
    if (serialPeripherals.length > fcUartCount) {
      items.push({
        label: 'UART Port Capacity',
        rating: 'error',
        message: `${serialPeripherals.length} serial peripherals requested (${serialPeripherals.join(', ')}) but ${fc.name} only has ${fcUartCount} UART ports available.`,
        suggestion: 'Reduce the number of serial sensors or upgrade to an F7/H7 flight controller with 6+ UARTs.',
      });
    } else if (serialPeripherals.length === fcUartCount) {
      items.push({
        label: 'UART Port Capacity',
        rating: 'warning',
        message: `${serialPeripherals.length} serial peripherals use all ${fcUartCount} UART ports on ${fc.name} — no room for future expansion.`,
        suggestion: 'Consider an FC with more UART ports if you plan to add more peripherals later.',
      });
    } else {
      items.push({
        label: 'UART Port Capacity',
        rating: 'good',
        message: `${serialPeripherals.length} serial peripherals fit within ${fcUartCount} UART ports on ${fc.name}.`,
      });
    }
  } else if (fc && serialPeripherals.length === 0) {
    items.push({ label: 'UART Port Capacity', rating: 'good', message: `${fc.name} has ${fcUartCount} UART ports available — no serial peripherals requested yet.` });
  }

  // 8. Remote-to-Receiver protocol check
  if (remote && receiver && selectedParts.remote !== 'skip' && selectedParts.receiver !== 'skip') {
    const remoteProto = remote.electrical_specs?.protocol || '';
    const rxProto = receiver.electrical_specs?.protocol || '';
    if (remoteProto && rxProto) {
      const protocolsMatch = doProtocolsMatch(remoteProto, rxProto);
      if (protocolsMatch) {
        items.push({ label: 'Remote & Receiver Protocol', rating: 'good', message: `${remote.name} (${remoteProto}) matches ${receiver.name} (${rxProto}).` });
      } else {
        items.push({
          label: 'Remote & Receiver Protocol',
          rating: 'error',
          message: `${remote.name} uses ${remoteProto} but ${receiver.name} uses ${rxProto} — they cannot bind.`,
          suggestion: `Select a receiver with ${remoteProto} protocol, or a remote that supports ${rxProto}.`,
        });
      }
    }
  } else if (remote && !receiver && selectedParts.remote !== 'skip') {
    items.push({ label: 'Remote & Receiver Protocol', rating: 'warning', message: 'Remote selected but no receiver chosen — select a matching receiver.' });
  }

  // 9. Goggles-to-Video link check
  if (goggles && selectedParts.goggles !== 'skip') {
    const gogglesProto = goggles.electrical_specs?.protocol || '';
    const isGogglesDigital = gogglesProto === 'Digital' || goggles.name.toLowerCase().includes('dji') || goggles.name.toLowerCase().includes('walksnail') || goggles.name.toLowerCase().includes('hdzero');
    const isGogglesAnalog = gogglesProto === 'Analog' || goggles.name.toLowerCase().includes('fat shark');

    if (vtx && selectedParts.vtx !== 'skip') {
      const vtxProto = vtx.electrical_specs?.protocol || '';
      const isVtxDigital = vtxProto === 'Digital' || vtx.name.toLowerCase().includes('o3') || vtx.name.toLowerCase().includes('walksnail') || vtx.name.toLowerCase().includes('hdzero');
      const isVtxAnalog = vtxProto === 'Analog' || vtx.name.toLowerCase().includes('analog');

      if (isGogglesDigital && isVtxAnalog) {
        items.push({
          label: 'Goggles & Video Link',
          rating: 'error',
          message: `${goggles.name} (digital) is incompatible with ${vtx.name} (analog VTX) — video feed will not display.`,
          suggestion: 'Select analog goggles (e.g. Fat Shark) or a digital VTX (e.g. DJI O3, Walksnail).',
        });
      } else if (isGogglesAnalog && isVtxDigital) {
        items.push({
          label: 'Goggles & Video Link',
          rating: 'error',
          message: `${goggles.name} (analog) is incompatible with ${vtx.name} (digital VTX) — video feed will not display.`,
          suggestion: 'Select digital goggles (e.g. DJI Goggles 2, HDZero) or an analog VTX.',
        });
      } else {
        items.push({ label: 'Goggles & Video Link', rating: 'good', message: `${goggles.name} and ${vtx.name} are on the same video link standard.` });
      }
    } else if (camera && selectedParts.camera !== 'skip') {
      const camProto = camera.electrical_specs?.protocol || '';
      const isCamDigital = camProto === 'Digital' || camera.name.toLowerCase().includes('o3') || camera.name.toLowerCase().includes('walksnail');
      const isCamAnalog = camProto === 'Analog';

      if (isGogglesDigital && isCamAnalog) {
        items.push({
          label: 'Goggles & Camera Video Link',
          rating: 'warning',
          message: `${goggles.name} (digital) may need a compatible VTX for ${camera.name} (analog camera).`,
          suggestion: 'Add a digital VTX or select analog goggles.',
        });
      } else if (isGogglesAnalog && isCamDigital) {
        items.push({
          label: 'Goggles & Camera Video Link',
          rating: 'warning',
          message: `${goggles.name} (analog) may not display ${camera.name} (digital camera) feed properly.`,
          suggestion: 'Select digital goggles or use an analog camera.',
        });
      } else {
        items.push({ label: 'Goggles & Camera Video Link', rating: 'good', message: `${goggles.name} and ${camera.name} are on the same video link standard.` });
      }
    }
  }

  return items;
}

function getFcUartCount(fc: ComponentWithSpecs | undefined): number {
  if (!fc) return 0;
  const name = fc.name.toLowerCase();
  if (name.includes('h7') || name.includes('f7')) return 6;
  if (name.includes('f4')) return 3;
  if (name.includes('f405')) return 3;
  return 4;
}

function isSensor(comp: ComponentWithSpecs, type: 'gps' | 'lidar' | 'optical' | 'current'): boolean {
  const n = comp.name.toLowerCase();
  if (type === 'gps') return n.includes('gps') || n.includes('m10') || n.includes('gnss') || n.includes('rescue');
  if (type === 'lidar') return n.includes('lidar') || n.includes('tfmini') || n.includes('rangefinder') || n.includes('altitude');
  if (type === 'optical') return n.includes('optical') || n.includes('flow');
  if (type === 'current') return n.includes('current') || n.includes('power sensor') || n.includes('power monitor');
  return false;
}

function doProtocolsMatch(remoteProto: string, rxProto: string): boolean {
  const normalize = (p: string) => p.toLowerCase().trim();
  const rp = normalize(remoteProto);
  const xp = normalize(rxProto);
  if (rp === xp) return true;
  if (rp === 'elrs' && xp === 'elrs') return true;
  if (rp === 'crsf' && (xp === 'elrs' || xp === 'crossfire' || xp === 'crsf')) return true;
  if (rp === 'crossfire' && (xp === 'elrs' || xp === 'crsf' || xp === 'crossfire')) return true;
  if (rp === 'frsky' && (xp === 'frsky' || xp === 'accst' || xp === 'access')) return true;
  if (rp === 'ibus' && (xp === 'ibus' || xp === 'flysky')) return true;
  if (rp === 'flysky' && (xp === 'ibus' || xp === 'flysky')) return true;
  return false;
}
