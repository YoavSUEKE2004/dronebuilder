'use client';

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';

type Props = {
  selectedParts: SelectedParts;
  components: ComponentWithSpecs[];
};

// ============================================================
// MODEL MAPPER — maps selected part IDs to GLTF model paths
// or falls back to procedural meshes
// ============================================================

const MODEL_BASE = '/models/';

const CATEGORY_MODEL_FILES: Record<string, string> = {
  frame: 'frame.glb',
  motor: 'motor.glb',
  esc: 'esc.glb',
  flight_controller: 'flight-controller.glb',
  propeller: 'propeller.glb',
  battery: 'battery.glb',
  camera: 'camera.glb',
  vtx: 'vtx.glb',
  receiver: 'receiver.glb',
};

/**
 * Maps a selected component to a 3D model path.
 * Returns null if no GLTF asset exists — callers should
 * fall back to the procedural mesh builders.
 */
export function getModelPath(component: ComponentWithSpecs): string | null {
  const fileName = CATEGORY_MODEL_FILES[component.category];
  if (!fileName) return null;
  return `${MODEL_BASE}${fileName}`;
}

/**
 * Returns the full asset map for all currently selected parts.
 * Each entry includes the component, its model path (or null
 * for procedural fallback), and the category key.
 */
export function getSelectedModelMap(
  selectedParts: SelectedParts,
  components: ComponentWithSpecs[]
): Array<{ category: string; component: ComponentWithSpecs; modelPath: string | null }> {
  const result: Array<{ category: string; component: ComponentWithSpecs; modelPath: string | null }> = [];
  for (const [category, id] of Object.entries(selectedParts)) {
    if (!id || id === 'skip') continue;
    const comp = components.find((c) => c.id === id);
    if (!comp) continue;
    result.push({ category, component: comp, modelPath: getModelPath(comp) });
  }
  return result;
}

export default function Drone3DCanvas({ selectedParts, components }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const partsRef = useRef<Record<string, THREE.Object3D>>({});
  const [autoRotate, setAutoRotate] = useState(true);

  const getComponent = (cat: string) =>
    selectedParts[cat] ? components.find((c) => c.id === selectedParts[cat]) : undefined;

  // Stable init — no autoRotate dependency to avoid re-creating the scene
  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);
    scene.fog = new THREE.Fog(0x0a0e14, 4, 10);

    const camAspect = (mount.clientWidth || 1) / (mount.clientHeight || 1);
    const camera = new THREE.PerspectiveCamera(45, camAspect, 0.1, 100);
    camera.position.set(2.8, 2.2, 2.8);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      return;
    }
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting setup — studio-style
    const ambient = new THREE.AmbientLight(0x3a4a5a, 0.5);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0x00d4ff, 0.9);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xff6b35, 0.35);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x00ff88, 0.6, 12);
    rimLight.position.set(0, -3, 0);
    scene.add(rimLight);

    // Environment — grid floor + reflective ground
    const gridHelper = new THREE.GridHelper(8, 32, 0x1a3a5c, 0x0d1f30);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(8, 8);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Main drone group
    const droneGroup = new THREE.Group();
    scene.add(droneGroup);
    sceneRef.current = droneGroup;

    // Mouse controls
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotY = 0.5;
    let rotX = 0.3;
    let targetRotY = 0.5;
    let targetRotX = 0.3;

    const handleDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const handleMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      targetRotY += dx * 0.01;
      targetRotX = Math.max(-0.5, Math.min(1.2, targetRotX + dy * 0.01));
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const handleUp = () => { isDragging = false; };

    renderer.domElement.addEventListener('mousedown', handleDown);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dist = camera.position.length();
      const newDist = Math.max(1.5, Math.min(6, dist + e.deltaY * 0.003));
      camera.position.normalize().multiplyScalar(newDist);
    };
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotateRef.current && !isDragging) {
        targetRotY += 0.004;
      }
      rotY += (targetRotY - rotY) * 0.1;
      rotX += (targetRotX - rotX) * 0.1;
      droneGroup.rotation.y = rotY;
      droneGroup.rotation.x = rotX;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Use a ref for autoRotate to avoid re-running the init effect
  const autoRotateRef = useRef(true);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  // Update parts when selection changes
  useEffect(() => {
    if (!sceneRef.current) return;
    const droneGroup = sceneRef.current;

    try {

    // Clear old parts
    Object.values(partsRef.current).forEach((obj) => {
      try { droneGroup.remove(obj); } catch {}
      disposeObject(obj);
    });
    partsRef.current = {};

    const frame = getComponent('frame');
    const frameSize = frame ? parseFrameSize(frame.dimensions_mm) : 220;
    const scale = Math.max(0.5, (frameSize / 220));
    const armLen = 0.154 * scale;

    // Frame
    if (frame) {
      try {
        const frameMesh = buildRealisticFrame(frameSize);
        frameMesh.name = 'frame_mesh';
        droneGroup.add(frameMesh);
        partsRef.current['frame'] = frameMesh;
      } catch {}
    }

    // Motors
    const motor = getComponent('motor');
    if (motor) {
      try {
        const motorPositions: [number, number, number][] = [
          [armLen, 0, armLen],
          [-armLen, 0, armLen],
          [armLen, 0, -armLen],
          [-armLen, 0, -armLen],
        ];
        const motorSize = parseMotorSize(motor.name);
        motorPositions.forEach((pos, i) => {
          const m = buildRealisticMotor(motorSize, i % 2 === 0, scale);
          m.position.set(...pos);
          m.name = `motor_${i}`;
          droneGroup.add(m);
          partsRef.current[`motor_${i}`] = m;
        });
      } catch {}
    }

    // Propellers
    const prop = getComponent('propeller');
    if (prop && motor) {
      try {
        const propSize = parsePropSize(prop.name);
        const motorPositions: [number, number, number][] = [
          [armLen, 0, armLen],
          [-armLen, 0, armLen],
          [armLen, 0, -armLen],
          [-armLen, 0, -armLen],
        ];
        motorPositions.forEach((pos, i) => {
          const p = buildRealisticPropeller(propSize, i % 2 === 0, scale);
          p.position.set(pos[0], pos[1] + 0.025 * scale, pos[2]);
          p.name = `prop_${i}`;
          droneGroup.add(p);
          partsRef.current[`prop_${i}`] = p;
        });
      } catch {}
    }

    // ESC stack
    const esc = getComponent('esc');
    if (esc) {
      try {
        const e = buildRealisticESC(esc);
        e.position.set(0, 0, 0.02);
        e.name = 'esc_mesh';
        droneGroup.add(e);
        partsRef.current['esc'] = e;
      } catch {}
    }

    // Flight controller
    const fc = getComponent('flight_controller');
    if (fc) {
      try {
        const f = buildRealisticFC(fc);
        f.position.set(0, 0, 0.06);
        f.name = 'fc_mesh';
        droneGroup.add(f);
        partsRef.current['fc'] = f;
      } catch {}
    }

    // Battery
    const battery = getComponent('battery');
    if (battery) {
      try {
        const b = buildRealisticBattery(battery);
        b.position.set(0, 0, 0.12);
        b.name = 'battery_mesh';
        droneGroup.add(b);
        partsRef.current['battery'] = b;
      } catch {}
    }

    // Camera
    const cameraComp = getComponent('camera');
    if (cameraComp) {
      try {
        const isDigital = cameraComp.electrical_specs?.protocol === 'Digital';
        const c = buildRealisticCamera(isDigital);
        c.position.set(0, 0.11, 0.04);
        c.name = 'camera_mesh';
        droneGroup.add(c);
        partsRef.current['camera'] = c;
      } catch {}
    }

    // VTX
    const vtx = getComponent('vtx');
    if (vtx) {
      try {
        const v = buildRealisticVTX(vtx);
        v.position.set(0, -0.1, 0.05);
        v.name = 'vtx_mesh';
        droneGroup.add(v);
        partsRef.current['vtx'] = v;
      } catch {}
    }

    // Receiver
    const receiver = getComponent('receiver');
    if (receiver) {
      try {
        const r = buildRealisticReceiver();
        r.position.set(0.1, 0, 0.05);
        r.name = 'receiver_mesh';
        droneGroup.add(r);
        partsRef.current['receiver'] = r;
      } catch {}
    }
    } catch {}
  }, [selectedParts, components]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full min-h-[400px] cursor-grab active:cursor-grabbing" />

      {/* Minimal bottom-right controls only */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <button
          onClick={() => setAutoRotate((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 backdrop-blur-md border border-slate-700/50 text-slate-200 hover:bg-slate-700/80 transition-colors"
        >
          {autoRotate ? 'Pause' : 'Rotate'}
        </button>
        <div className="text-xs text-slate-400 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 px-3 py-1.5 rounded-lg">
          Drag · Scroll to zoom
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS — parse real component attributes for accurate scaling
// ============================================================

function parseFrameSize(dim: string): number {
  const match = dim.match(/(\d+)mm/);
  return match ? parseInt(match[1]) : 220;
}

function parseMotorSize(name: string): number {
  const match = name.match(/(\d{4,5})\s*\d{3,4}KV/);
  if (match) return parseInt(match[1]);
  const sizeMatch = name.match(/(\d{2})mm/);
  return sizeMatch ? parseInt(sizeMatch[1]) : 23;
}

function parsePropSize(name: string): number {
  const match = name.match(/(\d+(?:\.\d+)?)"\s*Props/);
  return match ? parseFloat(match[1]) : 5;
}

// ============================================================
// MATERIALS — carbon fiber, metal, plastic textures
// ============================================================

function carbonFiberMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.85,
    roughness: 0.25,
  });
}

function brushedAluminumMaterial(color = 0x2a2a3e): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.9,
    roughness: 0.15,
  });
}

function mattePlasticMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.7,
  });
}

function glassMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.95,
    roughness: 0.05,
    emissive: color,
    emissiveIntensity: 0.3,
  });
}

// ============================================================
// GEOMETRY BUILDERS — realistic component meshes
// ============================================================

function buildRealisticFrame(sizeMm: number): THREE.Object3D {
  const group = new THREE.Group();
  group.name = 'frame_mesh';
  const scale = Math.max(0.5, sizeMm / 220);
  const plateSize = 0.08 * scale;

  // Bottom plate — carbon fiber
  const bottomGeo = new THREE.BoxGeometry(plateSize, 0.008, plateSize);
  const bottom = new THREE.Mesh(bottomGeo, carbonFiberMaterial());
  bottom.castShadow = true;
  bottom.receiveShadow = true;
  group.add(bottom);

  // Top plate
  const topGeo = new THREE.BoxGeometry(plateSize * 0.85, 0.006, plateSize * 0.85);
  const top = new THREE.Mesh(topGeo, carbonFiberMaterial());
  top.position.y = 0.08;
  top.castShadow = true;
  group.add(top);

  // Standoffs — 4 aluminum posts
  const standoffGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.08, 8);
  const standoffMat = brushedAluminumMaterial(0x888899);
  const standoffOffset = plateSize * 0.4;
  for (let i = 0; i < 4; i++) {
    const standoff = new THREE.Mesh(standoffGeo, standoffMat);
    const sx = i < 2 ? standoffOffset : -standoffOffset;
    const sz = i % 2 === 0 ? standoffOffset : -standoffOffset;
    standoff.position.set(sx, 0.04, sz);
    standoff.castShadow = true;
    group.add(standoff);
  }

  // Arms — carbon fiber, X-pattern
  const armLen = 0.154 * scale;
  const armGeo = new THREE.BoxGeometry(0.014, 0.008, armLen);
  const armMat = carbonFiberMaterial();
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.castShadow = true;
    const angle = (Math.PI / 4) + (Math.PI / 2) * i;
    arm.position.set(Math.cos(angle) * armLen / 2, -0.004, Math.sin(angle) * armLen / 2);
    arm.rotation.y = angle;
    group.add(arm);
  }

  // Motor mount pads at arm tips
  for (let i = 0; i < 4; i++) {
    const padGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.006, 20);
    const pad = new THREE.Mesh(padGeo, mattePlasticMaterial(0x333344));
    const angle = (Math.PI / 4) + (Math.PI / 2) * i;
    pad.position.set(Math.cos(angle) * armLen, 0.003, Math.sin(angle) * armLen);
    pad.castShadow = true;
    group.add(pad);
  }

  // Battery strap — orange silicone
  const strapGeo = new THREE.BoxGeometry(plateSize * 1.1, 0.003, 0.015);
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0xff6b35,
    metalness: 0.1,
    roughness: 0.8,
  });
  const strap = new THREE.Mesh(strapGeo, strapMat);
  strap.position.set(0, 0.085, 0);
  group.add(strap);

  return group;
}

function buildRealisticMotor(sizeMm: number, cw: boolean, frameScale: number): THREE.Object3D {
  const group = new THREE.Group();
  // Scale motor to frame: larger frames get proportionally larger motors,
  // but clamp so motors never exceed the arm tip pad radius (0.016 * frameScale)
  const motorBaseScale = Math.max(0.35, Math.min(1.0, frameScale * 0.7));
  const statorScale = Math.max(0.5, Math.min(1.0, (sizeMm / 23) * motorBaseScale));

  // Stator base — dark steel
  const baseGeo = new THREE.CylinderGeometry(0.012 * statorScale, 0.010 * statorScale, 0.010 * statorScale, 24);
  const base = new THREE.Mesh(baseGeo, brushedAluminumMaterial(0x2a2a3e));
  base.castShadow = true;
  group.add(base);

  // Bell — colored aluminum with cooling fins
  const bellGeo = new THREE.CylinderGeometry(0.014 * statorScale, 0.012 * statorScale, 0.010 * statorScale, 24);
  const bellColor = cw ? 0x00d4ff : 0xff6b35;
  const bellMat = new THREE.MeshStandardMaterial({
    color: bellColor,
    metalness: 0.8,
    roughness: 0.2,
    emissive: bellColor,
    emissiveIntensity: 0.15,
  });
  const bell = new THREE.Mesh(bellGeo, bellMat);
  bell.position.y = 0.010 * statorScale;
  bell.castShadow = true;
  group.add(bell);

  // Cooling fins on bell
  for (let i = 0; i < 8; i++) {
    const finGeo = new THREE.BoxGeometry(0.001, 0.010 * statorScale, 0.003 * statorScale);
    const fin = new THREE.Mesh(finGeo, bellMat);
    const angle = (Math.PI * 2 / 8) * i;
    fin.position.set(Math.cos(angle) * 0.013 * statorScale, 0.010 * statorScale, Math.sin(angle) * 0.013 * statorScale);
    fin.rotation.y = angle;
    group.add(fin);
  }

  // Shaft — polished steel
  const shaftGeo = new THREE.CylinderGeometry(0.002 * statorScale, 0.002 * statorScale, 0.010 * statorScale, 12);
  const shaftMat = brushedAluminumMaterial(0xccccdd);
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = 0.020 * statorScale;
  group.add(shaft);

  // Shaft nut — hex
  const nutGeo = new THREE.CylinderGeometry(0.004 * statorScale, 0.004 * statorScale, 0.002 * statorScale, 6);
  const nut = new THREE.Mesh(nutGeo, brushedAluminumMaterial(0xaaaaaa));
  nut.position.y = 0.025 * statorScale;
  group.add(nut);

  // Motor wires — 3 thin cables
  for (let i = 0; i < 3; i++) {
    const wireGeo = new THREE.CylinderGeometry(0.0008 * statorScale, 0.0008 * statorScale, 0.015 * statorScale, 6);
    const wireColors = [0x0000ff, 0xff0000, 0xffff00];
    const wireMat = new THREE.MeshStandardMaterial({ color: wireColors[i], metalness: 0.2, roughness: 0.8 });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.set((i - 1) * 0.004 * statorScale, -0.012 * statorScale, 0);
    wire.rotation.x = 0.3;
    group.add(wire);
  }

  return group;
}

function buildRealisticPropeller(sizeInches: number, cw: boolean, frameScale: number): THREE.Object3D {
  const group = new THREE.Group();
  const radius = (sizeInches / 5) * 0.065 * Math.max(0.4, frameScale);

  // Hub
  const hubGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.008, 12);
  const hubMat = mattePlasticMaterial(0x333333);
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.castShadow = true;
  group.add(hub);

  // 3 blades with airfoil shape
  for (let i = 0; i < 3; i++) {
    const bladeGroup = new THREE.Group();

    // Blade — tapered shape using a custom geometry
    const bladeGeo = new THREE.BoxGeometry(radius, 0.0015, 0.014);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      metalness: 0.4,
      roughness: 0.4,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.x = radius / 2;
    blade.rotation.z = cw ? -0.15 : 0.15; // pitch angle
    blade.castShadow = true;
    bladeGroup.add(blade);

    bladeGroup.rotation.y = (Math.PI * 2 / 3) * i;
    group.add(bladeGroup);
  }

  // Rotation direction indicator
  group.userData.cw = cw;
  return group;
}

function buildRealisticESC(esc: ComponentWithSpecs): THREE.Object3D {
  const group = new THREE.Group();
  const amps = esc.electrical_specs?.max_current_a || 45;
  const sizeScale = Math.min(1.3, 0.8 + (amps / 80));

  // PCB board — dark green
  const boardGeo = new THREE.BoxGeometry(0.04 * sizeScale, 0.005, 0.04 * sizeScale);
  const boardMat = new THREE.MeshStandardMaterial({
    color: 0x0a3a1a,
    metalness: 0.3,
    roughness: 0.6,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.castShadow = true;
  group.add(board);

  // Heat sink — aluminum fins
  for (let i = 0; i < 5; i++) {
    const finGeo = new THREE.BoxGeometry(0.003, 0.006, 0.03 * sizeScale);
    const fin = new THREE.Mesh(finGeo, brushedAluminumMaterial(0xaaaaaa));
    fin.position.set((i - 2) * 0.007, 0.005, 0);
    fin.castShadow = true;
    group.add(fin);
  }

  // Capacitors — 2 cylindrical
  for (let i = 0; i < 2; i++) {
    const capGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.012, 12);
    const capMat = mattePlasticMaterial(0x1a1a2e);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(i === 0 ? -0.012 : 0.012, 0.008, 0.012 * sizeScale);
    cap.castShadow = true;
    group.add(cap);
  }

  return group;
}

function buildRealisticFC(fc: ComponentWithSpecs): THREE.Object3D {
  const group = new THREE.Group();

  // PCB board
  const boardGeo = new THREE.BoxGeometry(0.038, 0.004, 0.038);
  const boardMat = new THREE.MeshStandardMaterial({
    color: 0x0a2a1a,
    metalness: 0.3,
    roughness: 0.6,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.castShadow = true;
  group.add(board);

  // Main MCU chip
  const chipGeo = new THREE.BoxGeometry(0.014, 0.003, 0.014);
  const chipMat = mattePlasticMaterial(0x1a1a1a);
  const chip = new THREE.Mesh(chipGeo, chipMat);
  chip.position.y = 0.003;
  group.add(chip);

  // Gyro/IMU chip — smaller
  const imuGeo = new THREE.BoxGeometry(0.006, 0.002, 0.006);
  const imu = new THREE.Mesh(imuGeo, mattePlasticMaterial(0x222222));
  imu.position.set(0.01, 0.003, 0.01);
  group.add(imu);

  // Status LED
  const ledGeo = new THREE.SphereGeometry(0.002, 8, 8);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff44,
    emissiveIntensity: 1.0,
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0.015, 0.004, -0.015);
  group.add(led);

  // USB-C port
  const usbGeo = new THREE.BoxGeometry(0.008, 0.003, 0.004);
  const usbMat = brushedAluminumMaterial(0x999999);
  const usb = new THREE.Mesh(usbGeo, usbMat);
  usb.position.set(-0.02, 0.002, 0);
  group.add(usb);

  // Pin headers — 2 rows
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 8; col++) {
      const pinGeo = new THREE.CylinderGeometry(0.0005, 0.0005, 0.004, 4);
      const pin = new THREE.Mesh(pinGeo, brushedAluminumMaterial(0xffd700));
      pin.position.set((col - 3.5) * 0.004, 0.004, row === 0 ? 0.015 : -0.015);
      group.add(pin);
    }
  }

  return group;
}

function buildRealisticBattery(battery: ComponentWithSpecs): THREE.Object3D {
  const group = new THREE.Group();
  const sCount = battery.electrical_specs?.max_voltage_s || 4;
  const sizeScale = Math.min(1.5, 0.8 + (sCount / 6) * 0.7);

  // Main pack — dark LiPo
  const packGeo = new THREE.BoxGeometry(0.04 * sizeScale, 0.03 * sizeScale, 0.065 * sizeScale);
  const packMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.2,
    roughness: 0.8,
  });
  const pack = new THREE.Mesh(packGeo, packMat);
  pack.castShadow = true;
  group.add(pack);

  // Label strip — colored by S-count
  const stripColors: Record<number, number> = { 2: 0x00ff00, 3: 0xffff00, 4: 0xff6b35, 6: 0xff0000 };
  const stripColor = stripColors[sCount] || 0xff6b35;
  const stripGeo = new THREE.BoxGeometry(0.041 * sizeScale, 0.006, 0.03 * sizeScale);
  const stripMat = new THREE.MeshStandardMaterial({
    color: stripColor,
    emissive: stripColor,
    emissiveIntensity: 0.15,
    metalness: 0.2,
    roughness: 0.6,
  });
  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.position.y = 0.008 * sizeScale;
  pack.add(strip);

  // XT60 connector
  const xt60Geo = new THREE.BoxGeometry(0.012, 0.01, 0.014);
  const xt60Mat = mattePlasticMaterial(0xffd700);
  const xt60 = new THREE.Mesh(xt60Geo, xt60Mat);
  xt60.position.set(0, 0, 0.04 * sizeScale);
  pack.add(xt60);

  // Balance lead
  const leadGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.02, 6);
  const leadMat = mattePlasticMaterial(0x222222);
  const lead = new THREE.Mesh(leadGeo, leadMat);
  lead.position.set(0.01, 0, 0.038 * sizeScale);
  lead.rotation.x = Math.PI / 2;
  pack.add(lead);

  return group;
}

function buildRealisticCamera(isDigital: boolean): THREE.Object3D {
  const group = new THREE.Group();

  // Camera body — aluminum housing
  const bodyGeo = new THREE.BoxGeometry(0.022, 0.022, 0.022);
  const bodyMat = brushedAluminumMaterial(0x333344);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // Lens housing
  const lensHousingGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.008, 20);
  const lensHousingMat = brushedAluminumMaterial(0x2a2a3e);
  const lensHousing = new THREE.Mesh(lensHousingGeo, lensHousingMat);
  lensHousing.rotation.x = Math.PI / 2;
  lensHousing.position.z = 0.014;
  lensHousing.castShadow = true;
  group.add(lensHousing);

  // Lens glass — colored by type
  const lensColor = isDigital ? 0x00d4ff : 0x88ccff;
  const lensGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.004, 20);
  const lens = new THREE.Mesh(lensGeo, glassMaterial(lensColor));
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.018;
  group.add(lens);

  // Sensor PCB — small board behind body
  const sensorGeo = new THREE.BoxGeometry(0.018, 0.003, 0.014);
  const sensorMat = new THREE.MeshStandardMaterial({ color: 0x0a2a1a, metalness: 0.3, roughness: 0.6 });
  const sensor = new THREE.Mesh(sensorGeo, sensorMat);
  sensor.position.z = -0.016;
  group.add(sensor);

  // Mount bracket
  const mountGeo = new THREE.BoxGeometry(0.004, 0.02, 0.004);
  const mount = new THREE.Mesh(mountGeo, brushedAluminumMaterial(0x666677));
  mount.position.y = -0.015;
  group.add(mount);

  return group;
}

function buildRealisticVTX(vtx: ComponentWithSpecs): THREE.Object3D {
  const group = new THREE.Group();

  // VTX board
  const boardGeo = new THREE.BoxGeometry(0.026, 0.006, 0.02);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, metalness: 0.5, roughness: 0.5 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.castShadow = true;
  group.add(board);

  // Heat shield
  const shieldGeo = new THREE.BoxGeometry(0.024, 0.004, 0.016);
  const shieldMat = brushedAluminumMaterial(0x888899);
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.y = 0.005;
  group.add(shield);

  // Antenna — SMA base + dipole whip
  const smaBaseGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.006, 12);
  const smaMat = brushedAluminumMaterial(0xaaaaaa);
  const smaBase = new THREE.Mesh(smaBaseGeo, smaMat);
  smaBase.position.y = 0.01;
  group.add(smaBase);

  // Antenna whip — flexible orange
  const whipGeo = new THREE.CylinderGeometry(0.0015, 0.001, 0.045, 8);
  const whipMat = new THREE.MeshStandardMaterial({
    color: 0xff6b35,
    metalness: 0.1,
    roughness: 0.8,
    emissive: 0xff3300,
    emissiveIntensity: 0.1,
  });
  const whip = new THREE.Mesh(whipGeo, whipMat);
  whip.position.y = 0.035;
  group.add(whip);

  // Antenna tip — round
  const tipGeo = new THREE.SphereGeometry(0.005, 12, 12);
  const tip = new THREE.Mesh(tipGeo, whipMat);
  tip.position.y = 0.058;
  group.add(tip);

  return group;
}

function buildRealisticReceiver(): THREE.Object3D {
  const group = new THREE.Group();

  // Receiver board — tiny green PCB
  const boardGeo = new THREE.BoxGeometry(0.016, 0.003, 0.012);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x0a2a1a, metalness: 0.3, roughness: 0.6 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.castShadow = true;
  group.add(board);

  // Chip
  const chipGeo = new THREE.BoxGeometry(0.005, 0.002, 0.005);
  const chip = new THREE.Mesh(chipGeo, mattePlasticMaterial(0x111111));
  chip.position.y = 0.003;
  group.add(chip);

  // 2 dipole antennas
  for (let i = 0; i < 2; i++) {
    const antGeo = new THREE.CylinderGeometry(0.0008, 0.0008, 0.035, 6);
    const antMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.6, roughness: 0.4 });
    const ant = new THREE.Mesh(antGeo, antMat);
    ant.position.set(i === 0 ? -0.005 : 0.005, 0.02, 0);
    ant.rotation.z = i === 0 ? 0.15 : -0.15;
    group.add(ant);

    // Antenna tip
    const tipGeo = new THREE.SphereGeometry(0.002, 6, 6);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff44, emissiveIntensity: 0.5 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(i === 0 ? -0.008 : 0.008, 0.038, 0);
    group.add(tip);
  }

  return group;
}

// ============================================================
// DISPOSAL — prevent memory leaks
// ============================================================

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
