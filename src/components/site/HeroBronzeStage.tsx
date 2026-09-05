"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ASSET_BASE_URL =
  "https://api.getlayers.ai/storage/v1/object/public/public/assets/laocoon-59f84455c6";

type SparkDatum = {
  speedX: number;
  speedY: number;
  speedZ: number;
  swaySpeed: number;
  swayRadius: number;
  phase: number;
};

/** Contained cinematic bronze stage for the Grand Studio hero (not a full-page takeover). */
export function HeroBronzeStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const stage = wrap;

    const sparkCount = 220;
    const sparkData: SparkDatum[] = [];
    const clock = new THREE.Clock();

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let modelPivot: THREE.Group | undefined;
    let mixer: THREE.AnimationMixer | undefined;
    let sparkParticles: THREE.Points | undefined;
    let bgMaterial: THREE.ShaderMaterial | undefined;
    let rafId = 0;
    let disposed = false;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const shaderUniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uScroll: { value: 0.15 },
    };

    function size() {
      const w = stage.clientWidth || 640;
      const h = stage.clientHeight || 480;
      return { width: w, height: h };
    }

    function createBackgroundShader() {
      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;
      const fragmentShader = `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uMouse;
        uniform float uScroll;

        void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
          float aspect = uResolution.x / uResolution.y;
          float time = uTime * 0.08;
          float scroll = uScroll;

          vec2 warpedUv = uv;
          float scrollDeform = scroll * 5.0;
          warpedUv.x += sin(uv.y * 2.5 + time * 0.2 + scrollDeform) * 0.35;
          warpedUv.y += cos(uv.x * 2.5 - time * 0.15 - scrollDeform * 0.8) * 0.35;
          warpedUv.x += sin(uv.y * 1.2 - time * 0.1 - scrollDeform * 1.5) * 0.25;
          warpedUv.y += cos(uv.x * 1.2 + time * 0.18 + scrollDeform * 1.2) * 0.25;
          warpedUv += vec2(uMouse.x * aspect * 0.05, uMouse.y * 0.05);

          vec2 dir1 = vec2(cos(0.6), sin(0.6));
          vec2 dir2 = vec2(cos(-0.7), sin(-0.7));
          vec2 dir3 = vec2(cos(1.2), sin(1.2));
          float w1 = sin(dot(warpedUv, dir1) * 2.4 + time);
          float w2 = cos(dot(warpedUv, dir2) * 3.2 - time * 1.4 + w1 * 0.4);
          float w3 = sin(dot(warpedUv, dir3) * 4.0 + time * 1.8 + w2 * 0.5);
          float waveField = w1 * 0.50 + w2 * 0.35 + w3 * 0.15;

          float wideSheen = pow(max(0.0, 1.0 - abs(waveField - 0.1)), 2.5);
          float crispSpecular = pow(max(0.0, 1.0 - abs(waveField - 0.15)), 8.0);
          float crest = wideSheen * 0.5 + crispSpecular * 0.9;

          vec3 c0_shadow = vec3(0.0010, 0.0006, 0.0004);
          vec3 c0_wave1  = vec3(0.085, 0.040, 0.015);
          vec3 c0_wave2  = vec3(0.050, 0.022, 0.008);
          vec3 c0_crest  = vec3(0.45, 0.30, 0.18);
          vec3 c1_shadow = vec3(0.0004, 0.0006, 0.0012);
          vec3 c1_wave1  = vec3(0.015, 0.035, 0.065);
          vec3 c1_wave2  = vec3(0.008, 0.020, 0.045);
          vec3 c1_crest  = vec3(0.18, 0.35, 0.55);

          float t = smoothstep(0.0, 1.0, scroll);
          vec3 colShadow = mix(c0_shadow, c1_shadow, t);
          vec3 colWave1  = mix(c0_wave1, c1_wave1, t);
          vec3 colWave2  = mix(c0_wave2, c1_wave2, t);
          vec3 colCrest  = mix(c0_crest, c1_crest, t);

          vec3 color = colShadow;
          color = mix(color, colWave2, smoothstep(-0.6, 0.2, waveField));
          color = mix(color, colWave1, smoothstep(0.0, 0.8, waveField));
          color += colCrest * crest * 1.4;
          color *= 1.0 - dot(uv, uv) * 0.12;
          gl_FragColor = vec4(color, 1.0);
        }
      `;

      bgMaterial = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: shaderUniforms,
        depthWrite: false,
        depthTest: false,
      });
      const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), bgMaterial);
      bgMesh.position.set(0, 0, -8);
      bgMesh.renderOrder = -10;
      camera.add(bgMesh);
    }

    function createSparkTexture() {
      const texCanvas = document.createElement("canvas");
      texCanvas.width = 16;
      texCanvas.height = 16;
      const ctx = texCanvas.getContext("2d");
      if (!ctx) return new THREE.CanvasTexture(texCanvas);
      const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.25, "rgba(255,255,255,0.85)");
      gradient.addColorStop(0.6, "rgba(255,255,255,0.3)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 16, 16);
      return new THREE.CanvasTexture(texCanvas);
    }

    function createSparks() {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(sparkCount * 3);
      const colors = new Float32Array(sparkCount * 3);
      for (let i = 0; i < sparkCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 6.5;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 5.0 - 0.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 6.5;
        if (Math.random() < 0.6) {
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.4 + Math.random() * 0.15;
          colors[i * 3 + 2] = 0.05 + Math.random() * 0.1;
        } else {
          colors[i * 3] = 0.55 + Math.random() * 0.15;
          colors[i * 3 + 1] = 0.82 + Math.random() * 0.12;
          colors[i * 3 + 2] = 1.0;
        }
        sparkData.push({
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: 0.15 + Math.random() * 0.3,
          speedZ: (Math.random() - 0.5) * 0.4,
          swaySpeed: 0.5 + Math.random() * 1.5,
          swayRadius: 0.05 + Math.random() * 0.15,
          phase: Math.random() * Math.PI * 2,
        });
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      sparkParticles = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: 0.03,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          map: createSparkTexture(),
        })
      );
      scene.add(sparkParticles);
    }

    function loadModel() {
      new GLTFLoader().load(
        `${ASSET_BASE_URL}/bronze_horse.glb`,
        (gltf) => {
          if (disposed) return;
          const gltfModel = gltf.scene;
          modelPivot = new THREE.Group();
          scene.add(modelPivot);
          modelPivot.add(gltfModel);

          gltfModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              const mats = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
              for (const mat of mats) {
                if (!mat || !("roughness" in mat)) continue;
                const std = mat as THREE.MeshStandardMaterial;
                std.roughness = 0.42;
                std.metalness = 0.92;
                std.flatShading = false;
                if (std.map) std.map.anisotropy = 16;
              }
            }
          });

          if (gltf.animations?.length) {
            mixer = new THREE.AnimationMixer(gltfModel);
            gltf.animations.forEach((clip) => mixer?.clipAction(clip).play());
          }

          const boxInitial = new THREE.Box3().setFromObject(gltfModel);
          const sizeInitial = boxInitial.getSize(new THREE.Vector3());
          const maxDim = Math.max(sizeInitial.x, sizeInitial.y, sizeInitial.z);
          gltfModel.scale.setScalar(3.2 / (maxDim > 0.0001 ? maxDim : 1));
          gltfModel.updateMatrixWorld(true);
          const center = new THREE.Box3()
            .setFromObject(gltfModel)
            .getCenter(new THREE.Vector3());
          gltfModel.position.sub(center);
          modelPivot.position.y = -0.35;
        },
        undefined,
        (err) => console.error("Hero bronze model failed:", err)
      );
    }

    function onResize() {
      const { width, height } = size();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      shaderUniforms.uResolution.value.set(width, height);
    }

    function animate() {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const t = clock.getElapsedTime();
      mixer?.update(delta);

      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      if (modelPivot) {
        modelPivot.rotation.y = t * 0.18 + mouseX * 0.2;
        modelPivot.rotation.x = mouseY * 0.12;
      }

      if (sparkParticles) {
        const positions = sparkParticles.geometry.attributes.position
          .array as Float32Array;
        for (let i = 0; i < sparkCount; i++) {
          const idx = i * 3;
          const data = sparkData[i];
          positions[idx] += data.speedX * delta;
          positions[idx + 1] += data.speedY * delta;
          positions[idx + 2] += data.speedZ * delta;
          positions[idx] +=
            Math.sin(t * data.swaySpeed + data.phase) *
            data.swayRadius *
            delta;
          positions[idx + 2] +=
            Math.cos(t * data.swaySpeed + data.phase) *
            data.swayRadius *
            delta;
          if (
            positions[idx + 1] > 3 ||
            Math.abs(positions[idx]) > 3.5 ||
            Math.abs(positions[idx + 2]) > 3.5
          ) {
            positions[idx + 1] = -2.5;
            positions[idx] = (Math.random() - 0.5) * 3;
            positions[idx + 2] = (Math.random() - 0.5) * 3;
          }
        }
        sparkParticles.geometry.attributes.position.needsUpdate = true;
      }

      const orbit = t * 0.12;
      const radius = 4.0;
      camera.position.lerp(
        new THREE.Vector3(
          Math.sin(orbit) * radius,
          0.45 + Math.sin(t * 0.25) * 0.15,
          Math.cos(orbit) * radius
        ),
        0.04
      );
      camera.lookAt(0, -0.1, 0);

      shaderUniforms.uTime.value = t;
      shaderUniforms.uMouse.value.set(mouseX, -mouseY);
      shaderUniforms.uScroll.value = 0.12 + (Math.sin(t * 0.15) + 1) * 0.12;
      renderer.render(scene, camera);
    }

    const { width, height } = size();
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000");
    scene.fog = new THREE.FogExp2("#000000", 0.012);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.35, 4.0);
    scene.add(camera);
    createBackgroundShader();

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.1;

    scene.add(new THREE.AmbientLight("#ffffff", 0.12));
    const keyLight = new THREE.SpotLight("#ffffff", 16);
    keyLight.position.set(4, 6, 3);
    keyLight.angle = Math.PI / 4;
    keyLight.penumbra = 0.9;
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight("#e3f2ff", 8);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    const fill = new THREE.DirectionalLight("#fff3e6", 0.7);
    fill.position.set(-2, -4, 2);
    scene.add(fill);

    createSparks();
    loadModel();

    const onPointer = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      targetMouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      targetMouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };
    const ro = new ResizeObserver(() => onResize());
    ro.observe(stage);
    stage.addEventListener("pointermove", onPointer);
    onResize();
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      stage.removeEventListener("pointermove", onPointer);
      sparkParticles?.geometry.dispose();
      (sparkParticles?.material as THREE.Material | undefined)?.dispose();
      bgMaterial?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[4/5] sm:aspect-square lg:aspect-[5/6] w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#fff6ed]/80 backdrop-blur">
        Live 3D preview
      </div>
    </div>
  );
}
