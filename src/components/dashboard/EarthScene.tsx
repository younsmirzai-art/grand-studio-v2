"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

/**
 * Stylized planet with procedurally generated continents.
 * Everything is shader-generated, so no external texture is fetched.
 */

// Value noise sampled in 3D against the sphere direction. Sampling in UV space
// instead would pinch at the poles and seam where u wraps from 1 back to 0.
const NOISE_3D = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm3(vec3 p) {
    float f = 0.0;
    f += 0.5000 * noise3(p); p *= 2.02;
    f += 0.2500 * noise3(p); p *= 2.03;
    f += 0.1250 * noise3(p); p *= 2.01;
    f += 0.0625 * noise3(p);
    return f / 0.9375;
  }
`;

// World-space varyings keep lighting consistent with the built-in
// `cameraPosition` uniform, which Three.js supplies in world space.
// Object space is kept separately so continents stay fixed to the rotating mesh.
const PLANET_VERTEX_SHADER = /* glsl */ `
  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vObjectPosition = position;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLANET_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uOceanColor;
  uniform vec3 uLandColor;
  uniform vec3 uAccentColor;
  uniform vec3 uGlowColor;
  uniform vec3 uLightDirection;

  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  ${NOISE_3D}

  void main() {
    vec3 sphereDirection = normalize(vObjectPosition);
    float continents = fbm3(sphereDirection * 2.2 + 11.0);

    float landmass = smoothstep(0.48, 0.53, continents);
    vec3 color = mix(uOceanColor, uLandColor, landmass);

    // Bright coastline band where land meets ocean.
    float coast = smoothstep(0.45, 0.49, continents) - smoothstep(0.49, 0.54, continents);
    color = mix(color, uAccentColor, coast * 0.65);

    // Scattered "city lights" clustered on landmasses. Uses fbm rather than a
    // single noise octave, which would show the value-noise grid as squares.
    float cities = smoothstep(0.62, 0.9, fbm3(sphereDirection * 16.0 + 3.0)) * landmass;
    color += uAccentColor * cities * 0.9;

    // Directional term so the planet reads as a sphere rather than a flat disc.
    // Floored well above zero so the night side never crushes to black.
    float diffuse = clamp(dot(vWorldNormal, normalize(uLightDirection)), 0.0, 1.0);
    color *= 0.5 + 0.8 * smoothstep(0.0, 0.85, diffuse);

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = pow(1.0 - clamp(dot(viewDirection, vWorldNormal), 0.0, 1.0), 3.0);
    color += uGlowColor * rim * 0.5;

    float pulse = sin(uTime * 0.5) * 0.04 + 0.96;
    color *= pulse;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const ATMOSPHERE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Rendered on the back faces of a slightly larger shell. Intensity is driven by
// how far the surface tilts away from the camera, so it reaches zero exactly at
// the shell's silhouette and the halo fades out instead of ending in a hard ring.
const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uInnerColor;
  uniform vec3 uOuterColor;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float facing = clamp(-dot(vWorldNormal, viewDirection), 0.0, 1.0);
    float intensity = pow(facing, 2.2) * 2.2;
    intensity = clamp(intensity, 0.0, 1.0);

    vec3 atmosphere = mix(uOuterColor, uInnerColor, facing);
    gl_FragColor = vec4(atmosphere * intensity, intensity);
  }
`;

function Planet() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOceanColor: { value: new THREE.Color("#0e1c47") },
      uLandColor: { value: new THREE.Color("#7C3AED") },
      uAccentColor: { value: new THREE.Color("#00D4FF") },
      uGlowColor: { value: new THREE.Color("#a78bfa") },
      uLightDirection: { value: new THREE.Vector3(0.45, 0.3, 0.9).normalize() },
    }),
    []
  );

  const atmosphereUniforms = useMemo(
    () => ({
      uInnerColor: { value: new THREE.Color("#7C3AED") },
      uOuterColor: { value: new THREE.Color("#00D4FF") },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.1;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={PLANET_VERTEX_SHADER}
          fragmentShader={PLANET_FRAGMENT_SHADER}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.35, 64, 64]} />
        <shaderMaterial
          uniforms={atmosphereUniforms}
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          vertexShader={ATMOSPHERE_VERTEX_SHADER}
          fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
        />
      </mesh>
    </group>
  );
}

function OrbitingParticles({ count = 150 }: { count?: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const particles = useMemo(() => {
    const items: Array<{
      position: [number, number, number];
      color: string;
    }> = [];
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = 1.4 + Math.random() * 0.8;

      items.push({
        position: [
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
        ],
        color: Math.random() > 0.5 ? "#7C3AED" : "#00D4FF",
      });
    }
    return items;
  }, [count]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.05;
      groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((particle, i) => (
        <mesh key={i} position={particle.position}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshBasicMaterial color={particle.color} />
        </mesh>
      ))}
    </group>
  );
}

const BASE_CAMERA_DISTANCE = 3.5;
/** Planet radius plus enough halo that the atmosphere is not clipped. */
const FRAMED_RADIUS = 1.3;

/**
 * Pulls the camera back on narrow viewports. The camera's `fov` is vertical, so
 * on portrait screens the planet overflows horizontally and reads as a blur.
 */
function useFramingDistance() {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  return useMemo(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const halfFovVertical = (perspectiveCamera.fov * Math.PI) / 360;
    const halfFovHorizontal = Math.atan(Math.tan(halfFovVertical) * (width / height));
    const required = FRAMED_RADIUS / Math.tan(halfFovHorizontal);
    return Math.max(BASE_CAMERA_DISTANCE, required);
  }, [camera, width, height]);
}

function CameraRig() {
  const camera = useThree((state) => state.camera);
  const pointer = useThree((state) => state.pointer);
  const distance = useFramingDistance();

  useFrame(() => {
    camera.position.x += (pointer.x * 0.3 - camera.position.x) * 0.05;
    camera.position.y += (pointer.y * 0.3 - camera.position.y) * 0.05;
    camera.position.z += (distance - camera.position.z) * 0.08;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export function EarthScene() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, BASE_CAMERA_DISTANCE], fov: 45 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Stars
            radius={100}
            depth={50}
            count={3000}
            factor={4}
            saturation={0.5}
            fade
            speed={0.5}
          />

          <ambientLight intensity={0.2} />
          <pointLight position={[5, 3, 5]} intensity={0.8} color="#00D4FF" />
          <pointLight position={[-5, -3, -5]} intensity={0.5} color="#7C3AED" />

          <Planet />
          <OrbitingParticles count={150} />
          <CameraRig />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default EarthScene;
