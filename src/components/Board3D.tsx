import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Color, Piece, PieceType } from "@/game/engine";

export type Strike = {
  from: number;
  to: number;
  color: Color;
  type: PieceType;
  captured: PieceType | null;
  started: number;
};

export function fightMs(type: PieceType) {
  if (type === "R") return 2100;
  if (type === "G" || type === "A") return 1760;
  return 820;
}

const GREEN = "#187a42";
const RED = "#b4232c";
const GOLD = "#e6b23a";
const SKIN_W = "#f0cfa8";
const SKIN_B = "#c9926a";
const BEARD_W = "#0c3a24";
const BEARD_B = "#4a1218";

function cell(sq: number, orientation: Color): [number, number] {
  const file = sq % 8;
  const rank = Math.floor(sq / 8);
  const x = (orientation === "w" ? file : 7 - file) - 3.5;
  const z = 3.5 - (orientation === "w" ? rank : 7 - rank);
  return [x, z];
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function smooth(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function seg(t: number, a: number, b: number) {
  return clamp01((t - a) / (b - a));
}

function hitAt(type: PieceType) {
  if (type === "R") return 0.34;
  if (type === "A") return 0.74;
  if (type === "G") return 0.78;
  return 0.68;
}

function Paint({ color, gold = false }: { color: Color; gold?: boolean }) {
  return (
    <meshStandardMaterial
      color={gold ? GOLD : color === "w" ? GREEN : RED}
      metalness={gold ? 0.62 : 0.28}
      roughness={gold ? 0.28 : 0.38}
      emissive={gold ? "#6b4a10" : "#000"}
      emissiveIntensity={gold ? 0.22 : 0}
    />
  );
}

function Base({ color }: { color: Color }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.38, 0.42, 0.1, 22]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.3, 0.36, 0.045, 22]} />
        <Paint color={color} gold />
      </mesh>
    </group>
  );
}

function Pawn({ color }: { color: Color }) {
  return (
    <group>
      <Base color={color} />
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.11, 0.2, 0.4, 16]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.028, 8, 18]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0, 0.76, 0]}>
        <sphereGeometry args={[0.17, 16, 14]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <Paint color={color} gold />
      </mesh>
    </group>
  );
}

function Rook({ color }: { color: Color }) {
  const wheels = useRef<THREE.Group>(null);
  useFrame(() => {
    let node: THREE.Object3D | null = wheels.current;
    let spin = 0;
    while (node) {
      if (typeof node.userData.wheel === "number") {
        spin = node.userData.wheel;
        break;
      }
      node = node.parent;
    }
    const g = wheels.current;
    if (!g) return;
    for (const child of g.children) child.rotation.x = spin;
  });
  return (
    <group>
      <Base color={color} />
      <group ref={wheels}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.3, 0.14, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.07, 12]} />
            <meshStandardMaterial color="#3a2a18" metalness={0.45} roughness={0.4} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.62, 8]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.03, 6, 16]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.028, 6, 16]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 8]} />
        <Paint color={color} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.18, 0.98, Math.sin(a) * 0.18]}>
            <boxGeometry args={[0.12, 0.18, 0.12]} />
            <Paint color={color} />
          </mesh>
        );
      })}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.28, 6]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0.1, 1.3, 0]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.2, 0.1, 0.02]} />
        <meshStandardMaterial color={color === "w" ? "#d9ffe6" : "#ffd0d4"} />
      </mesh>
    </group>
  );
}

function Mantri({ color }: { color: Color }) {
  return (
    <group>
      <Base color={color} />
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.07, 0.2, 0.78, 16]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.03, 8, 18]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.11, 0.026, 8, 18]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0, 0.78, 0.02]}>
        <sphereGeometry args={[0.13, 14, 12]} />
        <Paint color={color} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.06, 0.8, 0.12]}>
          <torusGeometry args={[0.045, 0.014, 8, 14]} />
          <Paint color={color} gold />
        </mesh>
      ))}
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <Paint color={color} gold />
      </mesh>
    </group>
  );
}

function Knight({ color }: { color: Color }) {
  return (
    <group>
      <Base color={color} />
      <mesh position={[0, 0.36, -0.02]} scale={[0.85, 0.7, 1]}>
        <sphereGeometry args={[0.16, 14, 12]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.58, 0.1]} rotation={[0.7, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.13, 0.36, 12]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.82, 0.26]} rotation={[0.45, 0, 0]} scale={[0.7, 0.62, 1.25]}>
        <sphereGeometry args={[0.15, 14, 12]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.74, 0.4]} scale={[0.5, 0.42, 0.85]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <Paint color={color} />
      </mesh>
      {[0.07, -0.07].map((x) => (
        <mesh key={x} position={[x, 0.98, 0.18]} rotation={[0.15, 0, x > 0 ? 0.4 : -0.4]}>
          <coneGeometry args={[0.04, 0.16, 5]} />
          <Paint color={color} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.7 + i * 0.08, 0.02 - i * 0.04]} rotation={[-0.5, 0, 0]}>
          <coneGeometry args={[0.045, 0.12, 4]} />
          <Paint color={color} gold />
        </mesh>
      ))}
      {[0.07, -0.07].map((x) => (
        <mesh key={`e${x}`} position={[x, 0.84, 0.36]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#1a120c" />
        </mesh>
      ))}
      <mesh position={[0, 0.78, 0.32]} rotation={[0.5, 0, 0]}>
        <torusGeometry args={[0.07, 0.012, 6, 12]} />
        <Paint color={color} gold />
      </mesh>
    </group>
  );
}

function Elephant({ color }: { color: Color }) {
  const trunk = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.62, 0.28),
        new THREE.Vector3(0, 0.46, 0.42),
        new THREE.Vector3(0, 0.28, 0.46),
        new THREE.Vector3(0, 0.16, 0.34),
      ]),
    [],
  );
  return (
    <group>
      <Base color={color} />
      {[-0.16, 0.16].map((x) =>
        [-0.12, 0.14].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.32, z]}>
            <cylinderGeometry args={[0.055, 0.07, 0.32, 8]} />
            <Paint color={color} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.52, 0]} scale={[1.25, 0.78, 1.55]}>
        <sphereGeometry args={[0.2, 16, 12]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.02, 6, 14]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0, 0.66, 0.24]}>
        <sphereGeometry args={[0.14, 14, 12]} />
        <Paint color={color} />
      </mesh>
      {[0.2, -0.2].map((x) => (
        <mesh key={x} position={[x, 0.7, 0.12]} scale={[0.28, 0.85, 0.55]}>
          <sphereGeometry args={[0.2, 10, 8]} />
          <Paint color={color} />
        </mesh>
      ))}
      <mesh>
        <tubeGeometry args={[trunk, 12, 0.038, 6, false]} />
        <Paint color={color} />
      </mesh>
      {[0.06, -0.06].map((x) => (
        <mesh key={x} position={[x, 0.52, 0.32]} rotation={[1.15, 0, x > 0 ? -0.45 : 0.45]}>
          <coneGeometry args={[0.022, 0.16, 5]} />
          <Paint color={color} gold />
        </mesh>
      ))}
      <mesh position={[0, 0.82, 0.22]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <Paint color={color} gold />
      </mesh>
      {[0.05, -0.05].map((x) => (
        <mesh key={`eye${x}`} position={[x, 0.7, 0.36]}>
          <sphereGeometry args={[0.016, 6, 6]} />
          <meshStandardMaterial color="#1a120c" />
        </mesh>
      ))}
    </group>
  );
}

function Raja({ color }: { color: Color }) {
  const beard = color === "w" ? BEARD_W : BEARD_B;
  const skin = color === "w" ? SKIN_W : SKIN_B;
  return (
    <group>
      <Base color={color} />
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.42, 16]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.028, 6, 16]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0, 0.66, 0]} scale={[1.15, 0.45, 0.7]}>
        <sphereGeometry args={[0.16, 12, 10]} />
        <Paint color={color} />
      </mesh>
      <mesh position={[0, 0.84, 0]}>
        <sphereGeometry args={[0.16, 16, 14]} />
        <meshStandardMaterial color={skin} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.74, 0.08]} scale={[0.85, 0.7, 0.55]}>
        <sphereGeometry args={[0.12, 12, 10]} />
        <meshStandardMaterial color={beard} roughness={0.75} />
      </mesh>
      {[0.055, -0.055].map((x) => (
        <mesh key={x} position={[x, 0.88, 0.12]}>
          <sphereGeometry args={[0.018, 6, 6]} />
          <meshStandardMaterial color="#1a120c" />
        </mesh>
      ))}
      <mesh position={[0, 0.99, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.08, 10]} />
        <Paint color={color} gold />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.11, 1.12, Math.sin(a) * 0.11]}>
            <coneGeometry args={[0.04, 0.16, 5]} />
            <Paint color={color} gold />
          </mesh>
        );
      })}
      <mesh position={[0, 1.22, 0]}>
        <boxGeometry args={[0.03, 0.14, 0.03]} />
        <Paint color={color} gold />
      </mesh>
      <mesh position={[0, 1.26, 0]}>
        <boxGeometry args={[0.1, 0.03, 0.03]} />
        <Paint color={color} gold />
      </mesh>
    </group>
  );
}

function Body({ type, color }: { type: PieceType; color: Color }) {
  if (type === "P") return <Pawn color={color} />;
  if (type === "R") return <Rook color={color} />;
  if (type === "M") return <Mantri color={color} />;
  if (type === "A") return <Knight color={color} />;
  if (type === "G") return <Elephant color={color} />;
  return <Raja color={color} />;
}

function pose(strike: Strike, t: number, role: "attacker" | "victim", orientation: Color) {
  const [fx, fz] = cell(strike.from, orientation);
  const [tx, tz] = cell(strike.to, orientation);
  let x = tx;
  let z = tz;
  let y = 0;
  let rotX = 0;
  let rotZ = 0;
  let spin = 0;
  let yaw = 0;
  let sc = 1;
  const kind = strike.type;

  if (role === "attacker") {
    if (kind === "G") {
      const u = smooth(seg(t, 0.05, 0.82));
      x = mix(fx, tx, u);
      z = mix(fz, tz, u);
      const gallop = Math.sin(u * Math.PI * 4);
      y = Math.max(0, gallop) * 0.28;
      rotX = gallop * 0.28;
      if (t < 0.12) rotX = -0.35 * (t / 0.12);
      if (u > 0.72) {
        const leap = (u - 0.72) / 0.28;
        y = Math.sin(leap * Math.PI) * 1.15;
        rotX = mix(-0.2, 0.7, leap);
      }
      if (t > 0.86) {
        y = 0;
        rotX = (1 - seg(t, 0.86, 1)) * 0.35;
      }
    } else if (kind === "A") {
      if (t < 0.16) {
        x = fx;
        z = fz;
        rotX = -0.85 * (t / 0.16);
        y = 0.12 * (t / 0.16);
      } else {
        const u = smooth(seg(t, 0.16, 0.9));
        x = mix(fx, tx, u);
        z = mix(fz, tz, u);
        y = Math.sin(u * Math.PI) * 1.65;
        rotX = mix(-0.85, 0.4, u);
        rotZ = Math.sin(u * Math.PI) * 0.35;
      }
    } else if (kind === "R") {
      const u = smooth(seg(t, 0.4, 0.96));
      x = mix(fx, tx, u);
      z = mix(fz, tz, u);
      const travel = Math.hypot(tx - fx, tz - fz);
      spin = u * travel * 7;
      if (t < 0.14) rotX = -0.16 * (t / 0.14);
      else if (u > 0) rotX = Math.sin(t * 46) * 0.045;
    } else if (kind === "M") {
      const u = smooth(t);
      x = mix(fx, tx, u);
      z = mix(fz, tz, u);
      y = Math.sin(u * Math.PI) * 0.42;
      rotZ = Math.sin(u * Math.PI * 2) * 0.45;
      yaw = Math.sin(u * Math.PI) * 1.1;
    } else {
      const u = smooth(t);
      x = mix(fx, tx, u);
      z = mix(fz, tz, u);
      y = Math.sin(u * Math.PI) * (kind === "K" ? 0.16 : 0.48);
      rotX = Math.sin(u * Math.PI) * (kind === "K" ? 0.08 : 0.4);
    }
  } else if (strike.captured) {
    x = tx;
    z = tz;
    const hit = hitAt(kind);
    if (kind === "R" && t > 0.28 && t < 0.46) rotZ = 0.28;
    if (t > (kind === "R" ? 0.88 : hit)) {
      const k = seg(t, kind === "R" ? 0.88 : hit, 1);
      const len = Math.hypot(tx - fx, tz - fz) || 1;
      rotX = -k * 1.65;
      rotZ = k * 0.7;
      y = Math.sin(k * Math.PI) * 0.4 - k * 0.15;
      sc = Math.max(0, 1 - k * 1.05);
      x = tx + ((tx - fx) / len) * k * 0.5;
      z = tz + ((tz - fz) / len) * k * 0.5;
    }
  }
  return { x, z, y, rotX, rotZ, spin, yaw, sc };
}

function WarPiece({
  sq,
  type,
  color,
  orientation,
  strike,
  role,
}: {
  sq: number;
  type: PieceType;
  color: Color;
  orientation: Color;
  strike: Strike | null;
  role: "sit" | "attacker" | "victim";
}) {
  const body = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const face = color === "w" ? Math.PI : 0;
  const shown = role === "attacker" && strike ? strike.type : type;
  useFrame(() => {
    const g = body.current;
    if (!g) return;
    const [hx, hz] = cell(sq, orientation);
    let x = hx;
    let z = hz;
    let y = 0;
    let rotX = 0;
    let rotZ = 0;
    let extra = 0;
    let yaw = 0;
    let sc = 1;
    if (strike && role !== "sit") {
      const t = (performance.now() - strike.started) / fightMs(strike.type);
      const p = pose(strike, t, role, orientation);
      x = p.x;
      z = p.z;
      y = p.y;
      rotX = p.rotX;
      rotZ = p.rotZ;
      extra = p.spin;
      yaw = p.yaw;
      sc = p.sc;
    }
    g.position.set(x, y, z);
    g.rotation.set(rotX, face + yaw, rotZ);
    g.scale.setScalar(Math.max(sc, 0.001));
    g.visible = sc > 0.02;
    g.userData.wheel = extra;
    if (shadow.current) {
      shadow.current.position.set(x, 0.025, z);
      const lift = 1 - Math.min(0.65, y * 0.28);
      shadow.current.scale.setScalar(Math.max(0.05, sc * lift));
      shadow.current.visible = sc > 0.05;
    }
  });
  return (
    <group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} />
      </mesh>
      <group ref={body}>
        <Body type={shown} color={color} />
      </group>
    </group>
  );
}

const SHOTS = [
  { a: 0.06, b: 0.32, lift: 0.42, heavy: false },
  { a: 0.12, b: 0.4, lift: 0.55, heavy: false },
  { a: 0.18, b: 0.46, lift: 0.3, heavy: false },
  { a: 0.14, b: 0.48, lift: 0.7, heavy: true },
];

function Volley({ strike, orientation }: { strike: Strike | null; orientation: Color }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const live = strike?.type === "R";
    const t = live ? (performance.now() - strike.started) / fightMs(strike.type) : 0;
    SHOTS.forEach((shot, i) => {
      const g = refs.current[i];
      if (!g) return;
      const show = !!live && (shot.heavy ? !!strike?.captured : true) && t > shot.a && t < shot.b;
      g.visible = show;
      if (!show || !strike) return;
      const u = (t - shot.a) / (shot.b - shot.a);
      const [fx, fz] = cell(strike.from, orientation);
      const [tx, tz] = cell(strike.to, orientation);
      const x = mix(fx, tx, u);
      const z = mix(fz, tz, u);
      const y = 0.72 + Math.sin(u * Math.PI) * shot.lift;
      g.position.set(x, y, z);
      g.rotation.set(Math.cos(u * Math.PI) * 0.7, Math.atan2(tx - fx, tz - fz), 0);
    });
  });
  return (
    <group>
      {SHOTS.map((shot, i) => (
        <group key={i} ref={(node) => { refs.current[i] = node; }} visible={false}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <cylinderGeometry args={[shot.heavy ? 0.02 : 0.012, shot.heavy ? 0.028 : 0.012, shot.heavy ? 0.56 : 0.42, 6]} />
            <meshStandardMaterial color={shot.heavy ? GOLD : "#f4f0e4"} metalness={0.45} roughness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, shot.heavy ? 0.32 : 0.24]}>
            <coneGeometry args={[shot.heavy ? 0.05 : 0.03, shot.heavy ? 0.14 : 0.1, 6]} />
            <meshStandardMaterial color={shot.heavy ? "#f7f7f2" : GOLD} metalness={0.4} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Burst({ strike, orientation }: { strike: Strike | null; orientation: Color }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    if (!strike?.captured) {
      g.visible = false;
      return;
    }
    const t = (performance.now() - strike.started) / fightMs(strike.type);
    const hit = strike.type === "R" ? 0.9 : hitAt(strike.type);
    const k = (t - hit) / 0.32;
    g.visible = k > 0 && k < 1;
    if (!g.visible) return;
    const [x, z] = cell(strike.to, orientation);
    g.position.set(x, 0.4, z);
    g.children.forEach((child, i) => {
      const a = (i / g.children.length) * Math.PI * 2;
      const dist = k * (0.28 + (i % 3) * 0.12);
      child.position.set(Math.cos(a) * dist, Math.sin(k * Math.PI) * 0.6, Math.sin(a) * dist);
      child.scale.setScalar(Math.max(0.05, 1 - k));
    });
  });
  return (
    <group ref={ref} visible={false}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.045, 6, 6]} />
          <meshStandardMaterial color={i % 2 ? GOLD : "#fff6d8"} emissive={GOLD} emissiveIntensity={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function Rig({ strike }: { strike: Strike | null }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = 1.16;
  }, [gl]);
  useFrame(() => {
    let shake = 0;
    if (strike?.captured) {
      const t = (performance.now() - strike.started) / fightMs(strike.type);
      const hit = strike.type === "R" ? 0.9 : hitAt(strike.type);
      if (t > hit && t < hit + 0.14) shake = (1 - (t - hit) / 0.14) * 0.12;
    }
    camera.position.set(0.35 + shake, 11.7, 10.9);
    camera.lookAt(0, 0, 0.15);
  });
  return null;
}

function Label({ text, position }: { text: string; position: [number, number, number] }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    if (!g) return null;
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = "#f6e7c4";
    g.font = "700 72px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 64, 68);
    const map = new THREE.CanvasTexture(c);
    map.needsUpdate = true;
    return map;
  }, [text]);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.38, 0.38]} />
      <meshBasicMaterial map={tex} transparent />
    </mesh>
  );
}

export function Board3D({
  board,
  orientation,
  squares,
  selected,
  targets,
  last,
  checkSq,
  flight,
  interactive,
  turn,
  onSelect,
  onMove,
}: {
  board: (Piece | null)[];
  orientation: Color;
  squares: { light: string; dark: string };
  selected: number | null;
  targets: number[];
  last: { from: number; to: number } | null;
  checkSq: number;
  flight: Strike | null;
  interactive: boolean;
  turn: Color;
  onSelect: (sq: number | null) => void;
  onMove: (from: number, to: number) => void;
}) {
  const targetSet = useMemo(() => new Set(targets), [targets]);
  function tap(sq: number) {
    if (!interactive) return;
    const piece = board[sq];
    if (piece && piece.color === turn) onSelect(sq);
    else if (selected != null && targetSet.has(sq)) onMove(selected, sq);
    else onSelect(null);
  }
  return (
    <div className="board board-3d">
      <Canvas
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 38, near: 0.1, far: 50, position: [0.35, 11.7, 10.9] }}
      >
        <Rig strike={flight} />
        <hemisphereLight args={["#fff4e0", "#3a2a1c", 0.7]} />
        <ambientLight intensity={0.34} />
        <directionalLight position={[5, 12, 7]} intensity={1.55} />
        <directionalLight position={[-5, 6, -3]} intensity={0.4} />
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[9.4, 0.32, 9.4]} />
          <meshStandardMaterial color="#4e3018" roughness={0.78} />
        </mesh>
        <mesh position={[0, -0.01, 0]}>
          <boxGeometry args={[8.15, 0.08, 8.15]} />
          <meshStandardMaterial color="#c6a15a" metalness={0.35} roughness={0.45} />
        </mesh>
        {Array.from({ length: 64 }, (_, sq) => {
          const [x, z] = cell(sq, orientation);
          const file = sq % 8;
          const rank = Math.floor(sq / 8);
          const dark = (file + rank) % 2 === 0;
          const marked = last && (last.from === sq || last.to === sq);
          const checked = checkSq === sq;
          const picked = selected === sq;
          return (
            <mesh
              key={sq}
              position={[x, 0.04, z]}
              onClick={(e) => {
                e.stopPropagation();
                tap(sq);
              }}
            >
              <boxGeometry args={[0.96, 0.08, 0.96]} />
              <meshStandardMaterial
                color={
                  checked ? "#c4493a" : picked ? "#f0d78a" : marked ? (dark ? "#b7a36a" : "#f7f0cf") : dark ? squares.dark : squares.light
                }
                roughness={0.84}
              />
            </mesh>
          );
        })}
        {targets.map((sq) => {
          const [x, z] = cell(sq, orientation);
          const hit = board[sq] != null;
          return (
            <mesh
              key={`t${sq}`}
              position={[x, 0.09, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(e) => {
                e.stopPropagation();
                tap(sq);
              }}
            >
              <ringGeometry args={hit ? [0.28, 0.38, 22] : [0, 0.11, 16]} />
              <meshBasicMaterial color={hit ? GOLD : "#f7f3e6"} transparent opacity={0.92} />
            </mesh>
          );
        })}
        {board.map((piece, sq) =>
          piece ? (
            <group
              key={`${sq}-${piece.type}-${piece.color}`}
              onClick={(e) => {
                e.stopPropagation();
                tap(sq);
              }}
            >
              <WarPiece
                sq={sq}
                type={piece.type}
                color={piece.color}
                orientation={orientation}
                strike={flight && flight.to === sq && flight.color === piece.color ? flight : null}
                role={flight && flight.to === sq && flight.color === piece.color ? "attacker" : "sit"}
              />
            </group>
          ) : null,
        )}
        {flight?.captured && (
          <WarPiece
            sq={flight.to}
            type={flight.captured}
            color={flight.color === "w" ? "b" : "w"}
            orientation={orientation}
            strike={flight}
            role="victim"
          />
        )}
        <Volley strike={flight} orientation={orientation} />
        <Burst strike={flight} orientation={orientation} />
        {"abcdefgh".split("").map((ch, i) => {
          const file = orientation === "w" ? i : 7 - i;
          return <Label key={ch} text={ch} position={[file - 3.5, 0.09, 4.22]} />;
        })}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => {
          const rank = orientation === "w" ? i : 7 - i;
          return <Label key={n} text={String(n)} position={[-4.22, 0.09, 3.5 - rank]} />;
        })}
      </Canvas>
    </div>
  );
}
