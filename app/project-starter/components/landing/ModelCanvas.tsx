"use client";

import { ContactShadows, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentRef,
  type RefObject,
} from "react";
import { Box3, MathUtils, Vector3, type Mesh, type PerspectiveCamera } from "three";

const MODEL_URL = "/models/landing2.glb";

const FOV = 22;
const MIN_POLAR = MathUtils.degToRad(72);
const MAX_POLAR = MathUtils.degToRad(83);
const START_ELEVATION = MathUtils.degToRad(12);
/** Share of the frame the model may fill at its widest/tallest orbit position. */
const FILL = 0.96;
const MAX_SAMPLES = 4000;
const FIT_ELEVATIONS = [Math.PI / 2 - MAX_POLAR, START_ELEVATION, Math.PI / 2 - MIN_POLAR];
const FIT_AZIMUTHS = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);

/** Each sampled vertex in camera axes (toward camera, right, up) for every allowed orbit angle. */
function toViewSpace(samples: number[]) {
  const views = FIT_ELEVATIONS.length * FIT_AZIMUTHS.length;
  const count = samples.length / 3;
  const toward = new Float32Array(views * count);
  const right = new Float32Array(views * count);
  const up = new Float32Array(views * count);
  let k = 0;
  for (const e of FIT_ELEVATIONS) {
    const sinE = Math.sin(e);
    const cosE = Math.cos(e);
    for (const a of FIT_AZIMUTHS) {
      const sinA = Math.sin(a);
      const cosA = Math.cos(a);
      for (let i = 0; i < samples.length; i += 3, k++) {
        const x = samples[i];
        const y = samples[i + 1];
        const z = samples[i + 2];
        toward[k] = x * sinA * cosE + y * sinE + z * cosA * cosE;
        right[k] = x * cosA - z * sinA;
        up[k] = -x * sinA * sinE + y * cosE - z * cosA * sinE;
      }
    }
  }
  return { toward, right, up };
}

type ViewSpace = ReturnType<typeof toViewSpace>;

/**
 * Smallest camera distance at which every sampled vertex fits the frame at every
 * allowed orbit angle, plus the vertical center (in tan units) of that silhouette.
 * Horizontal fit is symmetric (the scene is round); vertical fit uses the real
 * top and bottom extents so the visible scene, not its bounding box, is centered.
 */
function fitView({ toward, right, up }: ViewSpace, tanH: number, tanV: number) {
  let horizontal = 0;
  let symmetric = 0;
  let nearest = 0;
  for (let i = 0; i < toward.length; i++) {
    horizontal = Math.max(horizontal, toward[i] + Math.abs(right[i]) / tanH);
    symmetric = Math.max(symmetric, toward[i] + Math.abs(up[i]) / tanV);
    nearest = Math.max(nearest, toward[i]);
  }

  const extents = (d: number) => {
    let top = -Infinity;
    let bottom = Infinity;
    for (let i = 0; i < toward.length; i++) {
      const t = up[i] / (d - toward[i]);
      if (t > top) top = t;
      if (t < bottom) bottom = t;
    }
    return { top, bottom };
  };

  let lo = nearest * 1.001 + 1e-6;
  let hi = symmetric;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    const { top, bottom } = extents(mid);
    if (top - bottom <= 2 * tanV) hi = mid;
    else lo = mid;
  }

  const distance = Math.max(horizontal, hi);
  const { top, bottom } = extents(distance);
  return { distance, centerTan: (top + bottom) / 2 };
}

useGLTF.preload(MODEL_URL);

type Controls = ComponentRef<typeof OrbitControls>;

/** Rectangle (canvas pixels) the model should be fitted into. */
export type ModelFrame = { x: number; y: number; width: number; height: number };

type FramedModelProps = {
  controlsRef: RefObject<Controls | null>;
  frame: ModelFrame | null;
  onReady: () => void;
};

function FramedModel({ controlsRef, frame, onReady }: FramedModelProps) {
  const { scene } = useGLTF(MODEL_URL);
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);

  // Center, footprint radius, and a vertex sample (relative to center) for exact framing.
  const bounds = useMemo(() => {
    scene.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    const meshes: Mesh[] = [];
    let total = 0;
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      meshes.push(mesh);
      total += mesh.geometry.attributes.position.count;
    });
    const stride = Math.max(1, Math.floor(total / MAX_SAMPLES));
    const point = new Vector3();
    const samples: number[] = [];
    let radius = 0;
    for (const mesh of meshes) {
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).sub(center);
        radius = Math.max(radius, Math.hypot(point.x, point.z));
        if (i % stride === 0) samples.push(point.x, point.y, point.z);
      }
    }
    return { center, height: box.max.y - box.min.y, radius, view: toViewSpace(samples) };
  }, [scene]);

  useLayoutEffect(() => {
    if (!width || !height) return;
    const box = frame ?? { x: 0, y: 0, width, height };
    const tanV = Math.tan(MathUtils.degToRad(camera.fov) / 2);
    const frameTanV = FILL * tanV * (box.height / height);
    const frameTanH = FILL * tanV * (box.width / height);
    const { distance, centerTan } = fitView(bounds.view, frameTanH, frameTanV);
    // Pixels the silhouette's center sits above the optical axis.
    const silhouetteLift = (centerTan / tanV) * (height / 2);

    camera.position.set(
      0,
      Math.sin(START_ELEVATION) * distance,
      Math.cos(START_ELEVATION) * distance,
    );
    camera.near = distance / 100;
    camera.far = distance * 10;
    // Off-axis projection: the silhouette lands on the frame center, wherever it sits.
    const shiftX = box.x + box.width / 2 - width / 2;
    const shiftY = box.y + box.height / 2 + silhouetteLift - height / 2;
    camera.setViewOffset(width, height, -shiftX, -shiftY, width, height);
    camera.updateProjectionMatrix();

    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
      controls.saveState();
    } else {
      camera.lookAt(0, 0, 0);
    }
    invalidate();
    onReady();
  }, [bounds, camera, width, height, frame, controlsRef, invalidate, onReady]);

  const { center, height: modelHeight, radius } = bounds;

  return (
    <>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={scene} />
      </group>
      <ContactShadows
        position={[0, -modelHeight / 2 + modelHeight * 0.002, 0]}
        scale={radius * 2.6}
        far={modelHeight * 0.5}
        blur={2.6}
        opacity={0.3}
        resolution={512}
        frames={1}
        color="#172447"
      />
    </>
  );
}

type ModelCanvasProps = {
  frame: ModelFrame | null;
  onReady: () => void;
  onProgress: (percent: number) => void;
  onInteract: () => void;
  resetSignal: number;
};

export default function ModelCanvas({
  frame,
  onReady,
  onProgress,
  onInteract,
  resetSignal,
}: ModelCanvasProps) {
  const controlsRef = useRef<Controls>(null);
  const { progress } = useProgress();

  useEffect(() => {
    onProgress(Math.round(progress));
  }, [progress, onProgress]);

  useEffect(() => {
    if (resetSignal > 0) controlsRef.current?.reset();
  }, [resetSignal]);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ fov: FOV, position: [0, 1, 10] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={1.05} />
      <directionalLight position={[6, 8, 5]} intensity={1.35} />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#e8e1fa" />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        minPolarAngle={MIN_POLAR}
        maxPolarAngle={MAX_POLAR}
        onStart={onInteract}
      />
      <Suspense fallback={null}>
        <FramedModel controlsRef={controlsRef} frame={frame} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
