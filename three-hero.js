// Westview Science Olympiad — solid metallic atom that DISSOLVES & re-forms into
// other shapes as you scroll (atom → helix → ring → globe → atom), while drifting
// around the page. Real metallic spheres (no particle fuzz); staggered shrink/grow
// transition so it melts away and re-materializes smoothly.
import * as THREE from "three";

const canvas = document.getElementById("bg3d");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas && window.WebGLRenderingContext) {
  try { init(); } catch (e) { console.warn("3D background disabled:", e); }
}

function init() {
  const N = 54;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // studio gradient env → real metallic reflections
  try {
    const c = document.createElement("canvas"); c.width = 16; c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, "#eceaf0"); g.addColorStop(0.55, "#d8d4cc"); g.addColorStop(1, "#3a3a40");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 64);
    const env = new THREE.CanvasTexture(c); env.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = env;
  } catch (e) {}

  scene.add(new THREE.DirectionalLight(0xffffff, 2.6).translateX(6).translateY(8).translateZ(7));
  const fill = new THREE.DirectionalLight(0xffffff, 1.0); fill.position.set(-5, 2, 4); scene.add(fill);
  const rim = new THREE.PointLight(0xE8B73A, 22, 60); rim.position.set(-6, -3, 5); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const molecule = new THREE.Group();
  scene.add(molecule);

  // ---------- shape layouts ----------
  const alloc = () => new Float32Array(N * 3);
  const put = (a, i, x, y, z) => { a[i*3]=x; a[i*3+1]=y; a[i*3+2]=z; };
  const D = 2.5;
  const dirs8 = [[D,0,0],[-D,0,0],[0,D,0],[0,-D,0],[0,0,D],[0,0,-D],[D*.7,D*.7,D*.7],[-D*.7,-D*.7,-D*.7]];

  function atomShape() {                 // clean: core + 8 atoms, rest hidden at core
    const a = alloc(); put(a, 0, 0, 0, 0);
    for (let j = 0; j < 8; j++) put(a, j+1, dirs8[j][0], dirs8[j][1], dirs8[j][2]);
    for (let i = 9; i < N; i++) put(a, i, 0, 0, 0);
    return a;
  }
  function helixShape() {
    const a = alloc(), turns = 3, H = 7, r = 1.8;
    for (let i = 0; i < N; i++) { const f = i/(N-1), th = f*Math.PI*2*turns, y = (f-0.5)*H, ph = (i%2)?Math.PI:0; put(a, i, Math.cos(th+ph)*r, y, Math.sin(th+ph)*r); }
    return a;
  }
  function ringShape() {
    const a = alloc(), R = 3.0;
    for (let i = 0; i < N; i++) { const u = (i/N)*Math.PI*2; put(a, i, Math.cos(u)*R, Math.sin(u*3)*0.4, Math.sin(u)*R); }
    return a;
  }
  function globeShape() {
    const a = alloc(), R = 3.0, g = Math.PI*(3-Math.sqrt(5));
    for (let i = 0; i < N; i++) { const y = 1-(i/(N-1))*2, rad = Math.sqrt(Math.max(0,1-y*y)), th = g*i; put(a, i, Math.cos(th)*rad*R, y*R, Math.sin(th)*rad*R); }
    return a;
  }
  const shapes = [atomShape(), helixShape(), ringShape(), globeShape(), atomShape()];
  const isAtom = (si) => si === 0 || si === shapes.length - 1;

  // per-instance scales for the atom state vs the open shapes
  const sAtom = new Float32Array(N), sOpen = new Float32Array(N);
  for (let i = 0; i < N; i++) { sAtom[i] = i === 0 ? 1.3 : (i <= 8 ? 0.62 : 0.0); sOpen[i] = i === 0 ? 0.6 : 0.48; }
  const scaleFor = (si, i) => isAtom(si) ? sAtom[i] : sOpen[i];

  // per-instance dissolve stagger → a wave that sweeps across the form, so it
  // disintegrates progressively (reads as "dissolving", not "scaling down")
  const STAGWIN = 0.45;
  const stagger = new Float32Array(N);
  for (let i = 0; i < N; i++) stagger[i] = (i / (N - 1)) * STAGWIN;

  // ---------- solid metallic spheres ----------
  const sphere = new THREE.SphereGeometry(1, 26, 26);
  const mat = new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.22, envMapIntensity: 1.25 });
  const mesh = new THREE.InstancedMesh(sphere, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const cGold = new THREE.Color(0xD9B23A), cDark = new THREE.Color(0x34343c), cSilver = new THREE.Color(0xb7b7c2);
  for (let i = 0; i < N; i++) mesh.setColorAt(i, i === 0 ? cGold : (i <= 8 ? cDark : cSilver));
  molecule.add(mesh);

  // ---------- bonds + orbit rings (atom state only; fade during morph) ----------
  const matBond = new THREE.MeshStandardMaterial({ color: 0xCBA94B, metalness: 0.85, roughness: 0.32, transparent: true, opacity: 1 });
  const bonds = new THREE.Group();
  const bondStag = [];
  dirs8.forEach((p, j) => {
    const v = new THREE.Vector3(p[0], p[1], p[2]); const len = v.length();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, len, 14), matBond);
    b.userData.mid = v.clone().multiplyScalar(0.5);
    b.position.copy(b.userData.mid);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), v.clone().normalize());
    bonds.add(b);
    bondStag.push((j / (dirs8.length - 1)) * 0.4);
  });
  molecule.add(bonds);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xC9A227, transparent: true, opacity: 0.18 });
  const rings = new THREE.Group();
  [[0.4,0],[-0.5,Math.PI/3]].forEach(([rx,rz]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.016, 12, 110), ringMat);
    ring.rotation.set(rx, 0, rz); rings.add(ring);
  });
  molecule.add(rings);

  // ---------- morph (with dissolve) ----------
  const dummy = new THREE.Object3D();
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  function applyShape(p) {
    const last = shapes.length - 1;
    const seg = p * last;
    const i = Math.min(Math.floor(seg), last - 1);
    const t = seg - i;
    const A = shapes[i], B = shapes[i + 1];
    for (let k = 0; k < N; k++) {
      const ti = clamp01((t - stagger[k]) / (1 - STAGWIN));
      const e = smooth(ti);
      let x = A[k*3]   + (B[k*3]   - A[k*3])   * e;
      let y = A[k*3+1] + (B[k*3+1] - A[k*3+1]) * e;
      let z = A[k*3+2] + (B[k*3+2] - A[k*3+2]) * e;
      const dip = Math.abs(2 * ti - 1);          // 1 at the shapes, 0 mid-morph
      const dissolve = 0.06 + 0.94 * dip;        // spheres melt to ~6% then re-form
      const puff = (1 - dip) * 0.4;              // gentle outward evaporation
      const r = Math.sqrt(x*x + y*y + z*z);
      if (r > 0.4) { const f = (r + puff) / r; x *= f; y *= f; z *= f; }
      dummy.position.set(x, y, z);
      const baseS = scaleFor(i, k) + (scaleFor(i + 1, k) - scaleFor(i, k)) * e;
      dummy.scale.setScalar(Math.max(0.0001, baseS * dissolve));
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // how "atom" we are right now (1 at an atom keyframe)
    const w = smooth(Math.max(0, 1 - Math.min(seg, Math.abs(seg - last))));
    // bonds MELT: shrink + retract toward the core on a stagger, so the sticks
    // dissolve inward instead of dismantling as rigid rods
    bonds.visible = w > 0.02;
    if (bonds.visible) {
      matBond.opacity = w;
      for (let j = 0; j < bonds.children.length; j++) {
        const bd = clamp01((w - bondStag[j]) / (1 - 0.4));
        const m = bonds.children[j];
        m.scale.setScalar(Math.max(0.0001, bd));
        m.position.copy(m.userData.mid).multiplyScalar(0.15 + 0.85 * bd);
      }
    }
    // orbit rings shrink toward center as they fade
    rings.visible = w > 0.02;
    rings.scale.setScalar(0.3 + 0.7 * w);
    ringMat.opacity = 0.18 * w;
  }

  // ---------- scroll keyframes: the molecule's journey down the page ----------
  const KEYS = [
    [ 7.2,  0.1, -0.8, 0.85],
    [-6.8,  0.2,  0.0, 0.95],
    [ 4.4,  0.0, -1.0, 1.05],
    [ 0.0,  0.0,  2.2, 1.45],
    [ 7.2,  0.0, -0.8, 0.85],
    [-7.0, -1.0, -1.2, 0.78],
  ];
  const lerp = (a, b, t) => a + (b - a) * t;
  function sampleKey(p) {
    const seg = p * (KEYS.length - 1);
    const i = Math.min(Math.floor(seg), KEYS.length - 2);
    const e = smooth(seg - i);
    const A = KEYS[i], B = KEYS[i + 1];
    return [lerp(A[0],B[0],e), lerp(A[1],B[1],e), lerp(A[2],B[2],e), lerp(A[3],B[3],e)];
  }

  let tmx = 0, tmy = 0, mx = 0, my = 0;
  window.addEventListener("pointermove", (e) => { tmx = e.clientX/window.innerWidth-0.5; tmy = e.clientY/window.innerHeight-0.5; }, { passive: true });

  function resize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener("resize", resize);
  document.body.dataset.webgl = "on";

  const clock = new THREE.Clock();
  let cx = 7.2, cy = 0.1, cz = -0.8, cs = 0.85, pCur = 0;
  function frame() {
    const t = clock.getElapsedTime();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
    pCur += (p - pCur) * 0.08;             // eased → smooth dissolve/morph

    applyShape(pCur);
    const [tx, ty, tz, ts] = sampleKey(pCur);
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06; cz += (tz - cz) * 0.06; cs += (ts - cs) * 0.06;
    molecule.position.set(cx, cy, cz);
    molecule.scale.setScalar(cs);
    molecule.rotation.y = t * 0.18 + pCur * Math.PI * 4;
    molecule.rotation.x = Math.sin(t * 0.4) * 0.12 + pCur * 0.5;

    mx += (tmx - mx) * 0.04; my += (tmy - my) * 0.04;
    camera.position.x = mx * 2.2; camera.position.y = -my * 1.4;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);
  if (reduce) { cancelAnimationFrame(raf); applyShape(0); renderer.render(scene, camera); }
}
