import * as THREE from "three";

/* ------------------------------------------------------------------
   CSE4204 | Computer Graphics Lab | Final Project (SI 7 — 3D Ludo)
   Requirements covered:
   1. Custom shaders            -> litVertexShader / litFragmentShader (board + dice)
   2. Lighting                  -> directional + ambient + point light,
                                   implemented both via THREE lights (board/pawns)
                                   and manually inside the custom shader (Blinn-Phong)
   3. Perspective projection    -> THREE.PerspectiveCamera
   4. Texture per object        -> canvas-generated board skins, dice pip faces,
                                   wood table texture
   5. Animation                 -> idle dice spin + tumble-and-settle roll animation
   6. Mouse & keyboard          -> keyboard orbits/zooms camera, click cycles board skin
   ------------------------------------------------------------------ */

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0c16);
scene.fog = new THREE.Fog(0x0c0c16, 9, 26);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

/* -------------------------- Lights -------------------------- */
const ambient = new THREE.AmbientLight(0xaebbff, 0.4);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
sun.position.set(6, 9, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 25;
sun.shadow.bias = -0.0015;
scene.add(sun);

const accent = new THREE.PointLight(0xff6fae, 0.9, 12, 2);
accent.position.set(-4, 3, -3);
scene.add(accent);

const lightUniforms = {
  uLightDir: { value: sun.position.clone().normalize() },
  uLightColor: { value: new THREE.Color(0xfff2d6) },
  uAmbientColor: { value: new THREE.Color(0xffffff).multiplyScalar(0.4) },
  uCameraPos: { value: camera.position.clone() },
  uTime: { value: 0 },
};

/* -------------------------- Custom shaders -------------------------- */
const litVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const boardFragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbientColor;
  uniform vec3 uCameraPos;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 40.0) * 0.35;

    vec4 tex = texture2D(map, vUv);
    float pulse = 0.06 * sin(uTime * 1.6) + 0.06;

    vec3 lit = tex.rgb * (uAmbientColor + uLightColor * diff);
    vec3 color = lit + vec3(spec) + tex.rgb * pulse;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const diceFragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbientColor;
  uniform vec3 uCameraPos;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 64.0) * 0.6;
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.15;

    vec4 tex = texture2D(map, vUv);
    vec3 lit = tex.rgb * (uAmbientColor + uLightColor * diff);
    vec3 color = lit + vec3(spec) + vec3(fresnel);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function makeLitMaterial(fragmentShader, texture) {
  return new THREE.ShaderMaterial({
    vertexShader: litVertexShader,
    fragmentShader,
    uniforms: THREE.UniformsUtils.merge([
      lightUniforms,
      { map: { value: texture } },
    ]),
  });
}

/* -------------------------- Canvas texture helpers -------------------------- */
function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const THEMES = {
  Classic: { bg: "#f4e9d8", red: "#e5484d", green: "#30a46c", yellow: "#f5c34d", blue: "#3b82c4", line: "#3a2f22", star: "#ffffff" },
  Neon:    { bg: "#28252c", red: "#ff2e88", green: "#2effc7", yellow: "#fff02e", blue: "#5271ff", line: "#efe9ff", star: "#ffffff" },
  Pastel:  { bg: "#faf7f2", red: "#ef7895", green: "#72cfa0", yellow: "#f4cf62", blue: "#78a9df", line: "#5a4d55", star: "#ffffff"},
  Walnut:  { bg: "#6b4a2f", red: "#c1442e", green: "#4f7f4a", yellow: "#d8a63d", blue: "#3f6a8c", line: "#241a10", star: "#f4e6c8" },
};
const themeNames = Object.keys(THEMES);

function drawBoard(ctx, size, t) {
  const cell = size / 15;
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = t.line;
  ctx.lineWidth = Math.max(1, size * 0.0018);
  for (let i = 0; i <= 15; i++) {
    const p = i * cell;
    ctx.beginPath(); ctx.moveTo(6 * cell, p); ctx.lineTo(9 * cell, p); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p, 6 * cell); ctx.lineTo(p, 9 * cell); ctx.stroke();
  }

  function homeYard(cx, cy, color) {
    const pad = cell * 0.5;
    const x = cx * cell + pad, y = cy * cell + pad, w = 6 * cell - pad * 2;
    ctx.fillStyle = color;
    roundRect(ctx, cx * cell, cy * cell, 6 * cell, 6 * cell, cell * 0.4);
    ctx.fill();
    ctx.fillStyle = t.bg;
    roundRect(ctx, x, y, w, w, cell * 0.3);
    ctx.fill();
    const inset = w * 0.24;
    const positions = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    positions.forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x + w / 2 + dx * inset, y + w / 2 + dy * inset, w * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = cell * 0.05;
      ctx.strokeStyle = t.bg;
      ctx.stroke();
    });
  }
  homeYard(0, 0, t.red);
  homeYard(9, 0, t.green);
  homeYard(0, 9, t.blue);
  homeYard(9, 9, t.yellow);

  function pathCell(col, row, color) {
    ctx.fillStyle = color;
    ctx.fillRect(col * cell + 1, row * cell + 1, cell - 2, cell - 2);
  }
  
  for (let i = 1; i <= 5; i++) pathCell(1 + i - 1 + 0, 6, t.red);      
  for (let r = 1; r <= 5; r++) pathCell(7, r, t.red);
  pathCell(1, 6, t.red);
  
  for (let c = 9; c <= 13; c++) pathCell(c, 7, t.green);
  pathCell(13, 1, t.green);
  
  for (let r = 9; r <= 13; r++) pathCell(7, r, t.yellow);
  pathCell(13, 8, t.yellow);
  
  for (let c = 1; c <= 5; c++) pathCell(c, 7, t.blue);
  pathCell(1, 13, t.blue);

  ctx.strokeStyle = t.line;
  for (let i = 0; i <= 15; i++) {
    const p = i * cell;
    ctx.beginPath(); ctx.moveTo(6 * cell, p); ctx.lineTo(9 * cell, p); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p, 6 * cell); ctx.lineTo(p, 9 * cell); ctx.stroke();
  }

  function star(col, row, color) {
    const cx = col * cell + cell / 2, cy = row * cell + cell / 2, r = cell * 0.32;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = (-Math.PI / 2) + i * (Math.PI * 2 / 5);
      const a2 = a1 + Math.PI / 5;
      ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
      ctx.lineTo(cx + Math.cos(a2) * r * 0.42, cy + Math.sin(a2) * r * 0.42);
    }
    ctx.closePath();
    ctx.fill();
  }
  star(6, 1, t.star); star(1, 8, t.star); star(8, 13, t.star); star(13, 6, t.star);
  star(2, 6, t.star); star(6, 12, t.star); star(12, 8, t.star); star(8, 2, t.star);

  const c0 = 6 * cell, c1 = 9 * cell, mid = size / 2;
  ctx.fillStyle = t.red;
  ctx.beginPath(); ctx.moveTo(c0, c0); ctx.lineTo(c1, c0); ctx.lineTo(mid, mid); ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.green;
  ctx.beginPath(); ctx.moveTo(c1, c0); ctx.lineTo(c1, c1); ctx.lineTo(mid, mid); ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.yellow;
  ctx.beginPath(); ctx.moveTo(c1, c1); ctx.lineTo(c0, c1); ctx.lineTo(mid, mid); ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.blue;
  ctx.beginPath(); ctx.moveTo(c0, c1); ctx.lineTo(c0, c0); ctx.lineTo(mid, mid); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = t.line;
  ctx.lineWidth = size * 0.012;
  ctx.strokeRect(size * 0.006, size * 0.006, size * 0.988, size * 0.988);
}

function buildBoardTexture(themeName) {
  const size = 1024;
  const canvasEl = makeCanvas(size);
  const ctx = canvasEl.getContext("2d");
  drawBoard(ctx, size, THEMES[themeName]);
  const tex = new THREE.CanvasTexture(canvasEl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildWoodTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  const grd = ctx.createLinearGradient(0, 0, size, size);
  grd.addColorStop(0, "#3c2415");
  grd.addColorStop(1, "#5a3a22");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = i % 2 === 0 ? "#26160c" : "#6b4527";
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const y = (i / 60) * size + (Math.random() - 0.5) * 8;
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 6);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

const PIP_LAYOUTS = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};

function buildDiceFaceTexture(number) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f7f3ea";
  roundRect(ctx, 6, 6, size - 12, size - 12, 26);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#c9412c";
  roundRect(ctx, 6, 6, size - 12, size - 12, 26);
  ctx.stroke();
  const pipColor = number === 1 ? "#c9412c" : "#20222b";
  PIP_LAYOUTS[number].forEach(([px, py]) => {
    ctx.beginPath();
    ctx.fillStyle = pipColor;
    ctx.arc(px * size, py * size, size * 0.075, 0, Math.PI * 2);
    ctx.fill();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const textureLoader = new THREE.TextureLoader();
/* -------------------------- Table -------------------------- */
const tableGeo = new THREE.CylinderGeometry(9, 9, 0.4, 64);

const tableTexture = textureLoader.load("background.png");
tableTexture.colorSpace = THREE.SRGBColorSpace;

const tableMat = new THREE.MeshStandardMaterial({
  map: tableTexture,
  roughness: 0.75,
  metalness: 0.05,
});

const table = new THREE.Mesh(tableGeo, tableMat);

table.position.y = -0.4;
table.receiveShadow = true;
scene.add(table);

/* -------------------------- Board -------------------------- */
let currentThemeIndex = -1; // -1 means custom image state

// Load your image texture

const customImgTex = textureLoader.load("ludo.jpg");
customImgTex.colorSpace = THREE.SRGBColorSpace;
customImgTex.anisotropy = 8;

const sideMat = new THREE.MeshStandardMaterial({ color: 0x2b1c10, roughness: 0.6 });
const boardTopMat = makeLitMaterial(boardFragmentShader, customImgTex); // initial map is your image
const boardGeo = new THREE.BoxGeometry(6.4, 0.35, 6.4);
const boardMaterials = [sideMat, sideMat, boardTopMat, sideMat, sideMat, sideMat];
const board = new THREE.Mesh(boardGeo, boardMaterials);
board.position.y = 0.0;
board.castShadow = true;
board.receiveShadow = true;
scene.add(board);

/* -------------------------- Pawns / guties (decorative, PBR-lit) -------------------------- */
const BOARD_WORLD_SIZE = 6.4; 

function cellToWorld(col, row) {
  return {
    x: (col / 15 - 0.5) * BOARD_WORLD_SIZE,
    z: (row / 15 - 0.5) * BOARD_WORLD_SIZE,
  };
}

function homeYardCirclePositions(cx, cy) {
  const pad = 0.5; 
  const w = 6 - pad * 2; 
  const inset = w * 0.24;
  const centerCol = cx + pad + w / 2;
  const centerRow = cy + pad + w / 2;
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) =>
    cellToWorld(centerCol + dx * inset, centerRow + dy * inset)
  );
}

// Build one pawn as base + stem + head, like a classic board-game piece
function createPawnMesh(color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 20), mat);
  base.position.y = 0.02;

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.08, 0.14, 20), mat);
  stem.position.y = 0.04 + 0.07;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), mat);
  head.position.y = 0.04 + 0.14 + 0.055;

  const pawn = new THREE.Group();
  pawn.add(base, stem, head);
  pawn.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
  return pawn;
}

const pawnColors = { Red: 0xe5484d, Green: 0x30a46c, Yellow: 0xf5c34d, Blue: 0x3b82c4 };
const homeYardOrigins = { Red: [0, 0], Green: [9, 0], Blue: [0, 9], Yellow: [9, 9] };
Object.entries(homeYardOrigins).forEach(([name, [cx, cy]]) => {
  homeYardCirclePositions(cx, cy).forEach(({ x, z }) => {
    const pawn = createPawnMesh(pawnColors[name]);
    pawn.position.set(x, 0.18, z);
    scene.add(pawn);
  });
});
/* -------------------------- Dice -------------------------- */
const faceNumbers = [1, 6, 2, 5, 3, 4];
const diceMaterials = faceNumbers.map((n) =>
  makeLitMaterial(diceFragmentShader, buildDiceFaceTexture(n))
);
const diceGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const dice = new THREE.Mesh(diceGeo, diceMaterials);
const DICE_VIEW_Y = 1.0; 
const DICE_REST_Y = 0.43; 
dice.position.set(0, DICE_VIEW_Y, 0);
dice.castShadow = true;
scene.add(dice);

const baseEulerForUpFace = {
  1: [0, 0, Math.PI / 2],
  2: [0, 0, 0],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [0, 0, Math.PI],
  6: [0, 0, -Math.PI / 2],
};
const restOrientations = [];
Object.entries(baseEulerForUpFace).forEach(([num, e]) => {
  const qBase = new THREE.Quaternion().setFromEuler(new THREE.Euler(...e));
  [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((yaw) => {
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const q = qYaw.clone().multiply(qBase);
    restOrientations.push({ number: Number(num), quaternion: q });
  });
});
dice.quaternion.copy(restOrientations[1].quaternion);

const diceLabel = document.getElementById("diceLabel");
let diceState = "idle";
let rollTimer = 0;
let rollTarget = restOrientations[1];
let settleFrom = new THREE.Quaternion();
let dropFromY = DICE_VIEW_Y;
let settleFromY = DICE_REST_Y;
let riseFromY = DICE_REST_Y;
const angularVel = new THREE.Vector3();

const DROP_TIME = 0.35;
const SETTLE_TIME = 0.8;
const HOLD_TIME = 0.4;
const RISE_TIME = 0.6;

function startRoll() {
  if (diceState !== "idle") return;
  diceState = "dropping";
  rollTimer = 0;
  dropFromY = dice.position.y;
  rollTarget = restOrientations[Math.floor(Math.random() * restOrientations.length)];
  angularVel.set(
    10 + Math.random() * 6,
    8 + Math.random() * 6,
    10 + Math.random() * 6
  );
  if(diceLabel) diceLabel.textContent = "Dice: rolling…";
}

/* -------------------------- Camera orbit (keyboard) -------------------------- */
const orbitTarget = new THREE.Vector3(0, 0.3, 0);
const spherical = new THREE.Spherical(9, Math.PI / 3.1, Math.PI / 4);
const keys = {};

function updateCameraFromSpherical() {
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.35, Math.PI / 2.15);
  spherical.radius = THREE.MathUtils.clamp(spherical.radius, 4, 16);
  const offset = new THREE.Vector3().setFromSpherical(spherical);
  camera.position.copy(orbitTarget).add(offset);
  camera.lookAt(orbitTarget);
}
updateCameraFromSpherical();

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "Space") {
    e.preventDefault();
    startRoll();
  }
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

function handleKeyboard(dt) {
  const rotSpeed = 1.4 * dt;
  const zoomSpeed = 6 * dt;
  if (keys["ArrowLeft"]) spherical.theta -= rotSpeed;
  if (keys["ArrowRight"]) spherical.theta += rotSpeed;
  if (keys["ArrowUp"]) spherical.phi -= rotSpeed;
  if (keys["ArrowDown"]) spherical.phi += rotSpeed;
  if (keys["KeyW"]) spherical.radius -= zoomSpeed;
  if (keys["KeyS"]) spherical.radius += zoomSpeed;
  updateCameraFromSpherical();
}

/* -------------------------- Mouse interaction (click board -> change skin) -------------------------- */
const themeLabel = document.getElementById("themeLabel");
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let pointerDownPos = null;

function cycleTheme() {
  currentThemeIndex++;
  
  if (currentThemeIndex >= themeNames.length) {
    currentThemeIndex = -1; // back to custom image
  }

  const oldTex = boardTopMat.uniforms.map.value;

  if (currentThemeIndex === -1) {
    boardTopMat.uniforms.map.value = customImgTex;
    if(themeLabel) themeLabel.textContent = "Skin: Bengali Ludo Skin";
  } else {
    const name = themeNames[currentThemeIndex];
    const newTex = buildBoardTexture(name);
    boardTopMat.uniforms.map.value = newTex;
    if(themeLabel) themeLabel.textContent = "Skin: " + name;
  }

  // memory cleanup (only dispose if it's not the image we loaded)
  if (oldTex !== customImgTex) {
    oldTex.dispose();
  }
}

canvas.addEventListener("pointerdown", (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointerup", (e) => {
  if (!pointerDownPos) return;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  pointerDownPos = null;
  if (Math.hypot(dx, dy) > 6) return; // treat as a drag, not a click

  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hit = raycaster.intersectObject(board, false)[0];
  if (hit) cycleTheme();
});

/* -------------------------- Resize -------------------------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* -------------------------- Animation loop -------------------------- */
const clock = new THREE.Clock();

function animateDice(dt) {
  switch (diceState) {
    case "dropping": {
      rollTimer += dt;
      const t = Math.min(rollTimer / DROP_TIME, 1);
      const fall = t * t; 
      dice.position.y = THREE.MathUtils.lerp(dropFromY, DICE_REST_Y, fall);
      dice.rotateX(angularVel.x * dt);
      dice.rotateY(angularVel.y * dt);
      dice.rotateZ(angularVel.z * dt);
      if (t >= 1) {
        diceState = "settling";
        rollTimer = 0;
        settleFrom.copy(dice.quaternion);
        settleFromY = dice.position.y;
      }
      break;
    }
    case "settling": {
      rollTimer += dt;
      const t = Math.min(rollTimer / SETTLE_TIME, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      dice.quaternion.slerpQuaternions(settleFrom, rollTarget.quaternion, eased);
      dice.position.y = THREE.MathUtils.lerp(settleFromY, DICE_REST_Y, eased);
      if (t >= 1) {
        diceState = "holding";
        rollTimer = 0;
        if(diceLabel) diceLabel.textContent = "Dice: " + rollTarget.number;
      }
      break;
    }
    case "holding": {
      rollTimer += dt;
      if (rollTimer > HOLD_TIME) {
        diceState = "rising";
        rollTimer = 0;
        riseFromY = dice.position.y;
      }
      break;
    }
    case "rising": {
      rollTimer += dt;
      const t = Math.min(rollTimer / RISE_TIME, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      dice.position.y = THREE.MathUtils.lerp(riseFromY, DICE_VIEW_Y, eased);
      if (t >= 1) diceState = "idle";
      break;
    }
    default: {
      dice.rotateY(0.4 * dt);
      break;
    }
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  handleKeyboard(dt);
  animateDice(dt);

  lightUniforms.uTime.value = elapsed;
  lightUniforms.uCameraPos.value.copy(camera.position);
  accent.intensity = 0.7 + Math.sin(elapsed * 1.3) * 0.2;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

const loadingEl = document.getElementById("loading");
if (loadingEl) {
  loadingEl.classList.add("hidden");
  setTimeout(() => loadingEl.remove(), 500);
}

tick();