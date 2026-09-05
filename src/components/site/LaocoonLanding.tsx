"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "./laocoon-landing.css";

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

function splitTitlesIntoChars(root: HTMLElement) {
  const titles = root.querySelectorAll(".slide-title");
  titles.forEach((title) => {
    const text = title.innerHTML;
    let newHTML = "";
    let delayCounter = 0;
    const parts = text.split(/(<br\s*\/?>)/i);
    parts.forEach((part) => {
      if (part.toLowerCase().startsWith("<br")) {
        newHTML += part;
      } else {
        for (let i = 0; i < part.length; i++) {
          if (part[i] === " ") {
            newHTML += " ";
          } else {
            newHTML += `<span class="char" style="transition-delay: ${delayCounter * 0.035}s">${part[i]}</span>`;
            delayCounter++;
          }
        }
      }
    });
    title.innerHTML = newHTML;
  });
}

export function LaocoonLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const landingRoot = root;

    splitTitlesIntoChars(landingRoot);

    const sizes = { width: window.innerWidth, height: window.innerHeight };
    const clock = new THREE.Clock();
    const sparkCount = 450;
    const sparkData: SparkDatum[] = [];

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let gltfModel: THREE.Group | undefined;
    let modelPivot: THREE.Group | undefined;
    let mixer: THREE.AnimationMixer | undefined;
    let bgMaterial: THREE.ShaderMaterial | undefined;
    let sparkParticles: THREE.Points | undefined;
    let rafId = 0;
    let disposed = false;

    let currentScroll = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let outerCursorX = window.innerWidth / 2;
    let outerCursorY = window.innerHeight / 2;

    const shaderUniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uScroll: { value: 0 },
    };

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

        float hash(float n) { return fract(sin(n) * 43758.5453123); }
        float noise(in vec3 x) {
            vec3 p = floor(x);
            vec3 f = fract(x);
            f = f*f*(3.0-2.0*f);
            float n = p.x + p.y*57.0 + 113.0*p.z;
            return mix(mix(mix(hash(n+  0.0), hash(n+  1.0), f.x),
                           mix(hash(n+ 57.0), hash(n+ 58.0), f.x), f.y),
                       mix(mix(hash(n+113.0), hash(n+114.0), f.x),
                           mix(hash(n+170.0), hash(n+171.0), f.x), f.y), f.z);
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
            float aspect = uResolution.x / uResolution.y;

            float time = uTime * 0.08;
            float scroll = uScroll;

            float angle1 = 0.6;
            float angle2 = -0.7;
            float angle3 = 1.2;

            float freq1 = 2.4;
            float freq2 = 3.2;
            float freq3 = 4.0;

            vec2 warpedUv = uv;
            float scrollDeform = scroll * 5.0;

            warpedUv.x += sin(uv.y * 2.5 + time * 0.2 + scrollDeform) * 0.35;
            warpedUv.y += cos(uv.x * 2.5 - time * 0.15 - scrollDeform * 0.8) * 0.35;
            warpedUv.x += sin(uv.y * 1.2 - time * 0.1 - scrollDeform * 1.5) * 0.25;
            warpedUv.y += cos(uv.x * 1.2 + time * 0.18 + scrollDeform * 1.2) * 0.25;

            vec2 scrollDrift = vec2(scroll * 0.04, -scroll * 0.02);
            vec2 mouseShift = vec2(uMouse.x * aspect * 0.05, uMouse.y * 0.05);
            warpedUv += scrollDrift + mouseShift;

            vec2 dir1 = vec2(cos(angle1), sin(angle1));
            vec2 dir2 = vec2(cos(angle2), sin(angle2));
            vec2 dir3 = vec2(cos(angle3), sin(angle3));

            float w1 = sin(dot(warpedUv, dir1) * freq1 + time * 1.0);
            float w2 = cos(dot(warpedUv, dir2) * freq2 - time * 1.4 + w1 * 0.4);
            float w3 = sin(dot(warpedUv, dir3) * freq3 + time * 1.8 + w2 * 0.5);

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

            float vignette = 1.0 - dot(uv, uv) * 0.12;
            color *= vignette;

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

      const bgGeometry = new THREE.PlaneGeometry(30, 30);
      const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
      bgMesh.position.set(0.0, 0.0, -8.0);
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
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.25, "rgba(255, 255, 255, 0.85)");
      gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.3)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 16, 16);
      return new THREE.CanvasTexture(texCanvas);
    }

    function createSparks() {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(sparkCount * 3);
      const colors = new Float32Array(sparkCount * 3);

      for (let i = 0; i < sparkCount; i++) {
        const x = (Math.random() - 0.5) * 6.5;
        const y = (Math.random() - 0.5) * 5.0 - 0.5;
        const z = (Math.random() - 0.5) * 6.5;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

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

      const material = new THREE.PointsMaterial({
        size: 0.025,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        map: createSparkTexture(),
      });

      sparkParticles = new THREE.Points(geometry, material);
      scene.add(sparkParticles);
    }

    function loadModel() {
      const loader = new GLTFLoader();
      loader.load(
        `${ASSET_BASE_URL}/bronze_horse.glb`,
        (gltf) => {
          if (disposed) return;
          gltfModel = gltf.scene;
          modelPivot = new THREE.Group();
          scene.add(modelPivot);
          modelPivot.add(gltfModel);

          gltfModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              const material = mesh.material;
              const materials = Array.isArray(material) ? material : [material];
              for (const mat of materials) {
                if (!mat || !("roughness" in mat)) continue;
                const std = mat as THREE.MeshStandardMaterial;
                std.roughness = 0.42;
                std.metalness = 0.92;
                std.flatShading = false;
                if (std.map) {
                  std.map.anisotropy = 16;
                }
              }
            }
          });

          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(gltfModel);
            gltf.animations.forEach((clip) => {
              mixer?.clipAction(clip).play();
            });
          }

          const boxInitial = new THREE.Box3().setFromObject(gltfModel);
          const sizeInitial = boxInitial.getSize(new THREE.Vector3());
          const maxDim = Math.max(sizeInitial.x, sizeInitial.y, sizeInitial.z);
          const targetScale = 3.5 / (maxDim > 0.0001 ? maxDim : 1);
          gltfModel.scale.setScalar(targetScale);
          gltfModel.updateMatrixWorld(true);

          const boxScaled = new THREE.Box3().setFromObject(gltfModel);
          const centerScaled = boxScaled.getCenter(new THREE.Vector3());
          gltfModel.position.sub(centerScaled);
          modelPivot.position.y = -0.4;
        },
        undefined,
        (error) => {
          console.error("Error loading bronze horse model:", error);
        }
      );
    }

    function onWindowResize() {
      sizes.width = window.innerWidth;
      sizes.height = window.innerHeight;
      camera.aspect = sizes.width / sizes.height;
      camera.updateProjectionMatrix();
      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      shaderUniforms.uResolution.value.set(sizes.width, sizes.height);
    }

    function updateGridDots(scroll: number) {
      const dots = landingRoot.querySelectorAll(".grid-dot");
      dots.forEach((dot, i) => {
        const startY = (i * 17) % 80 + 10;
        let speed = 90 + (i * 55) % 180;
        if (i % 2 === 0) speed = -speed;
        let y = startY + scroll * speed;
        y = ((y % 100) + 100) % 100;
        (dot as HTMLElement).style.top = `${y}%`;
      });
    }

    function updateSlides(scroll: number) {
      const slide1 = document.getElementById("slide-1");
      const slide2 = document.getElementById("slide-2");
      const slide3 = document.getElementById("slide-3");
      const slide4 = document.getElementById("slide-4");

      for (let i = 1; i <= 4; i++) {
        const fill = document.getElementById(`dash-fill-${i}`);
        if (fill) {
          const start = (i - 1) * 0.25;
          const end = i * 0.25;
          let progress = (scroll - start) / (end - start);
          progress = Math.max(0, Math.min(1, progress));
          fill.style.height = `${progress * 100}%`;
        }
      }

      function isActive(val: number, start: number, end: number) {
        return val >= start && val <= end;
      }

      if (slide1) slide1.classList.toggle("active", isActive(scroll, -0.1, 0.12));
      if (slide2) {
        const active2 = isActive(scroll, 0.28, 0.4);
        slide2.classList.toggle("active", active2);
        const slide2Img = document.getElementById("slide-2-img");
        if (slide2Img) slide2Img.classList.toggle("active", active2);
      }
      if (slide3) slide3.classList.toggle("active", isActive(scroll, 0.56, 0.68));
      if (slide4) slide4.classList.toggle("active", isActive(scroll, 0.84, 1.05));
    }

    function setupNavigation() {
      const navLinks = landingRoot.querySelectorAll(".nav-link");
      const targetScrolls = [0.0, 0.34, 0.62, 0.94];
      navLinks.forEach((link, index) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const maxScroll =
            document.documentElement.scrollHeight - window.innerHeight;
          const targetY = maxScroll * targetScrolls[index];
          window.scrollTo({ top: targetY, behavior: "smooth" });
        });
      });
    }

    function animate() {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);
      const deltaTime = clock.getDelta();
      if (mixer) mixer.update(deltaTime);

      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const scrollTop =
        window.scrollY !== undefined
          ? window.scrollY
          : window.pageYOffset !== undefined
            ? window.pageYOffset
            : document.documentElement.scrollTop;
      const targetScroll = maxScroll > 0 ? scrollTop / maxScroll : 0;

      currentScroll += (targetScroll - currentScroll) * 0.025;
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      outerCursorX += (cursorX - outerCursorX) * 0.2;
      outerCursorY += (cursorY - outerCursorY) * 0.2;
      const cursorOuter = landingRoot.querySelector(
        ".cursor-outer"
      ) as HTMLElement | null;
      if (cursorOuter) {
        cursorOuter.style.left = `${outerCursorX}px`;
        cursorOuter.style.top = `${outerCursorY}px`;
      }

      if (modelPivot) {
        modelPivot.rotation.y = mouseX * 0.25;
        modelPivot.rotation.x = mouseY * 0.15;
      }

      if (sparkParticles) {
        const positions = sparkParticles.geometry.attributes.position
          .array as Float32Array;
        const time = clock.getElapsedTime();
        const scrollVelocity = Math.abs(targetScroll - currentScroll);
        const speedMultiplier = 1.0 + scrollVelocity * 9.0;
        const turbulence = scrollVelocity * 0.8;

        for (let i = 0; i < sparkCount; i++) {
          const idx = i * 3;
          const data = sparkData[i];
          positions[idx] += data.speedX * deltaTime * speedMultiplier;
          positions[idx + 1] += data.speedY * deltaTime * speedMultiplier;
          positions[idx + 2] += data.speedZ * deltaTime * speedMultiplier;

          const currentSway = data.swayRadius * (1.0 + turbulence * 4.0);
          positions[idx] +=
            Math.sin(time * data.swaySpeed + data.phase) *
            currentSway *
            deltaTime;
          positions[idx + 2] +=
            Math.cos(time * data.swaySpeed + data.phase) *
            currentSway *
            deltaTime;

          if (
            positions[idx + 1] > 3.0 ||
            Math.abs(positions[idx]) > 3.5 ||
            Math.abs(positions[idx + 2]) > 3.5
          ) {
            positions[idx + 1] = -2.5;
            positions[idx] = (Math.random() - 0.5) * 3.0;
            positions[idx + 2] = (Math.random() - 0.5) * 3.0;
          }
        }
        sparkParticles.geometry.attributes.position.needsUpdate = true;
      }

      const phi = currentScroll * Math.PI * 2.0;
      const y = 0.35 + Math.sin(currentScroll * Math.PI) * 0.8;
      const radius = 4.2 - Math.sin(currentScroll * Math.PI) * 0.6;
      const x = radius * Math.sin(phi);
      const z = radius * Math.cos(phi);

      const transitionProgress = Math.min(1.0, currentScroll / 0.28);
      const easeFactor = (Math.cos(transitionProgress * Math.PI) + 1.0) * 0.5;
      const lookAtXOffset = -0.9 * easeFactor;
      const targetLookAt = new THREE.Vector3(lookAtXOffset, -0.15, 0);
      const targetPos = new THREE.Vector3(x, y, z);
      camera.position.lerp(targetPos, 0.025);
      camera.lookAt(targetLookAt);

      shaderUniforms.uTime.value = clock.getElapsedTime();
      shaderUniforms.uMouse.value.set(mouseX, -mouseY);
      shaderUniforms.uScroll.value = currentScroll;

      updateSlides(currentScroll);
      updateGridDots(currentScroll);
      renderer.render(scene, camera);
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000");
    scene.fog = new THREE.FogExp2("#000000", 0.01);

    camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 100);
    camera.position.set(0, 0.2, 3.0);
    scene.add(camera);

    createBackgroundShader();

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.2;

    const ambientLight = new THREE.AmbientLight("#ffffff", 0.1);
    scene.add(ambientLight);

    const keyLight = new THREE.SpotLight("#ffffff", 18.0);
    keyLight.position.set(4, 6, 3);
    keyLight.angle = Math.PI / 4;
    keyLight.penumbra = 0.9;
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight("#e3f2ff", 10.0);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight("#fff3e6", 0.8);
    fillLight.position.set(-2, -4, 2);
    scene.add(fillLight);

    createSparks();
    loadModel();

    const onMouseMove = (event: MouseEvent) => {
      cursorX = event.clientX;
      cursorY = event.clientY;
      const cursorInner = landingRoot.querySelector(
        ".cursor-inner"
      ) as HTMLElement | null;
      if (cursorInner) {
        cursorInner.style.left = `${cursorX}px`;
        cursorInner.style.top = `${cursorY}px`;
      }
      targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = (event.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onWindowResize);
    onWindowResize();
    setupNavigation();
    updateSlides(0);
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onWindowResize);
      sparkParticles?.geometry.dispose();
      (sparkParticles?.material as THREE.Material | undefined)?.dispose();
      bgMaterial?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={rootRef} className="laocoon-landing">
      <div className="cursor-inner" />
      <div className="cursor-outer" />

      <div className="cinematic-container">
        <div className="main-header">
          <div className="brand">Laocoön</div>
          <nav className="header-nav">
            <a href="#slide-1" className="nav-link">
              Bronze
            </a>
            <span className="nav-dot" />
            <a href="#slide-2" className="nav-link">
              Marble
            </a>
            <span className="nav-dot" />
            <a href="#slide-3" className="nav-link">
              Fluid
            </a>
            <span className="nav-dot" />
            <a href="#slide-4" className="nav-link">
              Digital
            </a>
          </nav>
          <div className="header-actions">
            <Link href="/auth/signup" className="contact-btn">
              Contact <span className="btn-circle" />
            </Link>
          </div>
        </div>

        <div className="slide" id="slide-1">
          <h2 className="slide-title">
            Bronze <br />
            and Time
          </h2>
          <div className="desc-row">
            <p className="slide-desc col-1">
              A timeless material holding centuries of human history. Fluid in
              hot flames, eternal in its form. Each curve captures a tense,
              dramatic moment.
            </p>
            <p className="slide-desc col-2">
              Born of molten fire and creative will, it stands to bridge our
              ancient memory and modern vision. A fluid energy frozen in still,
              heavy bronze.
            </p>
          </div>
        </div>

        <div className="slide-image-mask" id="slide-2-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSET_BASE_URL}/1.png`} alt="Editorial Concept" />
        </div>

        <div className="slide" id="slide-2">
          <h2 className="slide-title">
            Marble <br />
            Emotion
          </h2>
          <p className="slide-desc">
            A sculpture frozen at the peak of human suffering and heroic
            struggle. Laocoön and his sons, bound by ruthless fate.
          </p>
        </div>

        <div className="slide" id="slide-3">
          <h2 className="slide-title">Liquid Metal</h2>
          <p className="slide-desc">
            Art that breathes. Mesmerizing waves of liquid bronze flow through
            space, reflecting every contour and tensed muscle of the ancient
            masterpiece.
          </p>
        </div>

        <div className="slide" id="slide-4">
          <h2 className="slide-title">
            Eternal <br />
            Moment
          </h2>
          <p className="slide-desc">
            Contemplating antique form through the lens of new dimensions. A
            classic masterpiece reborn in the currents of radiant digital
            matter.
          </p>
        </div>
      </div>

      <div className="grid-horizontal-line" />
      <div className="grid-lines">
        <div className="grid-line">
          <div className="grid-dot top" />
          <div className="grid-dot bottom" />
        </div>
        <div className="grid-line">
          <div className="grid-dot top" />
          <div className="grid-dot bottom" />
        </div>
        <div className="grid-line">
          <div className="grid-dot top" />
          <div className="grid-dot bottom" />
        </div>
        <div className="grid-line">
          <div className="grid-dot top" />
          <div className="grid-dot bottom" />
        </div>
        <div className="grid-line story-progress-container">
          <div className="grid-dot top" />
          <div className="grid-dot bottom" />
          <div className="story-dashes">
            <div className="story-dash">
              <div className="story-dash-fill" id="dash-fill-1" />
            </div>
            <div className="story-dash">
              <div className="story-dash-fill" id="dash-fill-2" />
            </div>
            <div className="story-dash">
              <div className="story-dash-fill" id="dash-fill-3" />
            </div>
            <div className="story-dash">
              <div className="story-dash-fill" id="dash-fill-4" />
            </div>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} id="webgl" />
    </div>
  );
}
