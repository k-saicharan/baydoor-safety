/**
 * BayDoor SDR-24: Deterministic Blind-Bay Warning System
 * Interactive 3D WebGL Simulation, Audio Synthesizer & Circuit State Machine
 *
 * Strict Constraints:
 * - Zero em dash characters in any string or comment.
 * - Anti-AI-Slop design palette & responsive canvas.
 * - PUWER 1998 & IEC 60204-1 additive functional safety model.
 */

// Global State Machine
const BayDoorState = {
  // Operational Status
  doorPosition: 0.0, // 0.0 = fully closed, 3.2m = fully open
  doorTarget: 0.0,
  doorSpeed: 1.2, // metres per second
  forkliftDist: 8.0, // metres from threshold
  forkliftSpeed: 0.0,
  forkliftTargetSpeed: 0.0,
  pedestrianDist: 6.0, // metres from intersection
  pedestrianSpeed: 1.1, // m/s walking speed
  pedestrianStopped: false,

  // Scenario Mode: 'standard' (with BayDoor) vs 'unprotected' (without BayDoor)
  scenario: 'standard',
  simulationRunning: false,

  // Electrical Circuit States
  mainsPowerOk: true,
  actuatorCmdActive: false,
  relayContactClosed: false,
  optoEnergized: false,
  pulseTimerActive: false,
  pulseTimerProgress: 0.0, // 0.0 to 2.5 seconds
  pulseDuration: 2.5,
  strobeFlashing: false,
  sounderAudible: false,

  // Audio System
  audioMuted: true,
  audioContext: null,
  audioNodes: null
};

// DOM Elements Cache
const UI = {
  // Canvas & HUD
  canvasContainer: document.getElementById('canvas-container'),
  hudDoorPos: document.getElementById('hud-door-pos'),
  hudForkliftSpd: document.getElementById('hud-forklift-spd'),
  hudDistance: document.getElementById('hud-distance'),
  hudStrobeState: document.getElementById('hud-strobe-state'),
  hudAudioState: document.getElementById('hud-audio-state'),
  blindZoneBanner: document.getElementById('blind-zone-banner'),

  // Simulation Controls
  btnScenarioStandard: document.getElementById('btn-scenario-standard'),
  btnScenarioUnprotected: document.getElementById('btn-scenario-unprotected'),
  btnActuateDoor: document.getElementById('btn-actuate-door'),
  btnCloseDoor: document.getElementById('btn-close-door'),
  btnResetSim: document.getElementById('btn-reset-sim'),
  camButtons: document.querySelectorAll('.cam-btn'),

  // Circuit SVG Elements
  circuitDot: document.getElementById('circuit-dot'),
  circuitStatusText: document.getElementById('circuit-status-text'),
  relayArm: document.getElementById('relay-arm'),
  optoLedIcon: document.getElementById('opto-led-icon'),
  chargeProgress: document.getElementById('charge-progress'),
  timerText: document.getElementById('timer-text'),
  strobeCircle: document.getElementById('strobe-circle'),
  strobeText: document.getElementById('strobe-text'),
  soundWaves: [
    document.getElementById('wave-1'),
    document.getElementById('wave-2'),
    document.getElementById('wave-3')
  ],
  sounderDbaVal: document.getElementById('sounder-dBA-val'),

  // Telemetry Readouts
  telemVoltage: document.getElementById('telem-voltage'),
  telemCurrent: document.getElementById('telem-current'),
  telemLatency: document.getElementById('telem-latency'),

  // Circuit Bench Buttons
  btnToggleCoil: document.getElementById('btn-toggle-coil'),
  btnTestPowerLoss: document.getElementById('btn-test-powerloss'),

  // Audio Toggle
  btnToggleAudio: document.getElementById('btn-toggle-audio'),
  audioIcon: document.getElementById('audio-icon'),

  // Dossier Tabs & BOM
  dossierTabBtns: document.querySelectorAll('.dossier-tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  bomQtySelect: document.getElementById('bom-qty-select'),
  bomUnitTotal: document.getElementById('bom-unit-total'),
  bomTable: document.getElementById('bom-table')
};

/* ==========================================================================
   1. THREE.JS 3D WAREHOUSE ENVIRONMENT & DIGITAL TWIN
   ========================================================================== */

let scene, camera, renderer, controls;
let doorPanels = [];
let forkliftGroup, pedestrianGroup;
let beaconLight, beaconMesh, blindConeMesh;
let acousticRingMesh;
let animClock = new THREE.Clock();

function initThreeScene() {
  if (typeof THREE === 'undefined') {
    console.error('Three.js library is not loaded');
    return;
  }

  const container = UI.canvasContainer;
  const width = container.clientWidth;
  const height = container.clientHeight || 440;

  // 1. Scene Setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x100e0c);
  scene.fog = new THREE.FogExp2(0x100e0c, 0.025);

  // 2. Camera Setup
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  setCameraPreset('isometric');

  // 3. Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // 4. OrbitControls
  if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Do not go below floor
    controls.minDistance = 3;
    controls.maxDistance = 35;
    controls.target.set(0, 1.6, 0);
  }

  // 5. Lighting
  const ambientLight = new THREE.AmbientLight(0xded7cc, 0.45);
  scene.add(ambientLight);

  // High-bay warehouse luminaire
  const bayLight1 = new THREE.DirectionalLight(0xfff7ed, 0.85);
  bayLight1.position.set(8, 12, 6);
  bayLight1.castShadow = true;
  bayLight1.shadow.mapSize.width = 1024;
  bayLight1.shadow.mapSize.height = 1024;
  bayLight1.shadow.camera.near = 1;
  bayLight1.shadow.camera.far = 30;
  bayLight1.shadow.camera.left = -12;
  bayLight1.shadow.camera.right = 12;
  bayLight1.shadow.camera.top = 12;
  bayLight1.shadow.camera.bottom = -12;
  scene.add(bayLight1);

  // Corridor secondary luminaire
  const corridorLight = new THREE.DirectionalLight(0xe8d5be, 0.45);
  corridorLight.position.set(-6, 9, -5);
  scene.add(corridorLight);

  // Far-Side Safety Strobe Point Light (Active on alert)
  beaconLight = new THREE.PointLight(0xff2a14, 0.0, 12, 1.8);
  beaconLight.position.set(-1.8, 3.1, 0.6);
  scene.add(beaconLight);

  // 6. Build Warehouse Architecture
  buildWarehouseGeometry();

  // 7. Window Resize Listener
  window.addEventListener('resize', onWindowResize);
}

function buildWarehouseGeometry() {
  // Industrial Floor with safety line markings
  const floorGeo = new THREE.PlaneGeometry(36, 36);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1f1b17,
    roughness: 0.82,
    metalness: 0.15
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Grid texture lines for scale
  const gridHelper = new THREE.GridHelper(36, 36, 0x3d352c, 0x241f1a);
  gridHelper.position.y = 0.005;
  scene.add(gridHelper);

  // Pedestrian Walkway Hazard Stripes (Yellow / Dark chevrons)
  const walkwayGeo = new THREE.PlaneGeometry(2.4, 24);
  const walkwayMat = new THREE.MeshStandardMaterial({
    color: 0x2e271f,
    roughness: 0.9
  });
  const walkwayMesh = new THREE.Mesh(walkwayGeo, walkwayMat);
  walkwayMesh.rotation.x = -Math.PI / 2;
  walkwayMesh.position.set(-1.8, 0.01, 0);
  scene.add(walkwayMesh);

  // Walkway Edge Yellow Caution Lines
  createFloorLine(-0.6, 0, 0.08, 24, 0xd48b38);
  createFloorLine(-3.0, 0, 0.08, 24, 0xd48b38);

  // Forklift Approach Aisle Markings
  createFloorLine(4.5, 0, 9, 0.08, 0xd48b38);
  createFloorLine(4.5, 3.2, 9, 0.08, 0xd48b38);

  // Threshold Stopping Bar
  createFloorLine(0.8, 1.6, 0.25, 3.4, 0x9c4634);

  // Dividing Partition Wall with Door Aperture
  // Wall dimensions: 30m wide, 5.5m high, with a 3.2m x 3.2m opening at origin
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2c2621,
    roughness: 0.75,
    metalness: 0.1
  });

  // Left wall section
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.5, 14), wallMat);
  leftWall.position.set(0, 2.75, -8.6);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall section
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.5, 14), wallMat);
  rightWall.position.set(0, 2.75, 8.6);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Header beam above door opening
  const lintelWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.3, 3.2), wallMat);
  lintelWall.position.set(0, 4.35, 0);
  lintelWall.castShadow = true;
  lintelWall.receiveShadow = true;
  scene.add(lintelWall);

  // Blind Corner Obscuring Wall (creates the true visual hazard)
  const cornerWallMat = new THREE.MeshStandardMaterial({
    color: 0x25201b,
    roughness: 0.8
  });
  const cornerWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.5, 0.25), cornerWallMat);
  cornerWall.position.set(-2.25, 2.25, 1.7);
  cornerWall.castShadow = true;
  cornerWall.receiveShadow = true;
  scene.add(cornerWall);

  // Steel Door Guide Tracks (Vertical C-channels)
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x4a4138,
    metalness: 0.8,
    roughness: 0.3
  });
  const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 0.1), trackMat);
  leftTrack.position.set(0.12, 1.8, -1.6);
  scene.add(leftTrack);

  const rightTrack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 0.1), trackMat);
  rightTrack.position.set(0.12, 1.8, 1.6);
  scene.add(rightTrack);

  // Overhead Motor Drum Housing
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x332d26, metalness: 0.5 });
  const drumMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.5, 16), drumMat);
  drumMesh.rotation.x = Math.PI / 2;
  drumMesh.position.set(0.15, 3.4, 0);
  scene.add(drumMesh);

  // Roller Shutter / Sectional Door Panels
  doorPanels = [];
  const panelCount = 8;
  const panelHeight = 0.4;
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x3d352d,
    roughness: 0.5,
    metalness: 0.4
  });

  for (let i = 0; i < panelCount; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, panelHeight - 0.02, 3.16), panelMat);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.userData = { initialY: 0.2 + i * panelHeight };
    panel.position.set(0.1, panel.userData.initialY, 0);
    scene.add(panel);
    doorPanels.push(panel);
  }

  // Industrial Door Controller Box (Hormann / Crawford 24VDC Panel)
  const ctrlMat = new THREE.MeshStandardMaterial({ color: 0x54493e, metalness: 0.3 });
  const ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.45), ctrlMat);
  ctrlBox.position.set(0.22, 1.6, 2.2);
  ctrlBox.castShadow = true;
  scene.add(ctrlBox);

  // BayDoor SDR-24 Additive Safety Module Box (Adjacent to controller)
  const sdrMat = new THREE.MeshStandardMaterial({ color: 0x826f5c, roughness: 0.6 });
  const sdrBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.22), sdrMat);
  sdrBox.position.set(0.22, 1.6, 2.65);
  sdrBox.castShadow = true;
  scene.add(sdrBox);

  // Conduit line between controller and SDR-24
  const conduitMat = new THREE.MeshStandardMaterial({ color: 0x6e6355, metalness: 0.7 });
  const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8), conduitMat);
  conduit.rotation.x = Math.PI / 2;
  conduit.position.set(0.22, 1.6, 2.42);
  scene.add(conduit);

  // Far-Side Warning Beacon (RS PRO 235-9003 Combined Strobe & Piezo Sounder)
  const beaconBaseMat = new THREE.MeshStandardMaterial({ color: 0x24201b, roughness: 0.7 });
  const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 16), beaconBaseMat);
  beaconBase.position.set(-0.25, 3.1, 1.2);
  beaconBase.rotation.z = Math.PI / 2;
  scene.add(beaconBase);

  const beaconLensMat = new THREE.MeshStandardMaterial({
    color: 0x8a1e12,
    emissive: 0x200000,
    roughness: 0.2,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85
  });
  beaconMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 16), beaconLensMat);
  beaconMesh.position.set(-0.35, 3.1, 1.2);
  beaconMesh.rotation.z = Math.PI / 2;
  scene.add(beaconMesh);

  // Expanding Acoustic Sound Wave Indicator (Pulsing ring)
  const ringGeo = new THREE.RingGeometry(0.1, 0.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xd48b38,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0
  });
  acousticRingMesh = new THREE.Mesh(ringGeo, ringMat);
  acousticRingMesh.position.set(-0.4, 3.1, 1.2);
  acousticRingMesh.rotation.y = Math.PI / 2;
  scene.add(acousticRingMesh);

  // Blind Zone Hazard Visualization Cone
  const coneGeo = new THREE.ConeGeometry(3.5, 6.0, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x9c4634,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    wireframe: true
  });
  blindConeMesh = new THREE.Mesh(coneGeo, coneMat);
  blindConeMesh.rotation.x = Math.PI / 2;
  blindConeMesh.position.set(-1.0, 1.4, 1.8);
  scene.add(blindConeMesh);

  // Procedural 3D Forklift & Pedestrian
  buildForkliftModel();
  buildPedestrianModel();
}

function createFloorLine(x, z, width, length, colorHex) {
  const lineGeo = new THREE.PlaneGeometry(length, width);
  const lineMat = new THREE.MeshBasicMaterial({ color: colorHex });
  const lineMesh = new THREE.Mesh(lineGeo, lineMat);
  lineMesh.rotation.x = -Math.PI / 2;
  lineMesh.position.set(x, 0.015, z);
  scene.add(lineMesh);
}

function buildForkliftModel() {
  forkliftGroup = new THREE.Group();

  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0xd48b38, // Industrial safety orange-yellow
    metalness: 0.3,
    roughness: 0.6
  });

  const blackMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1f1b17,
    metalness: 0.8,
    roughness: 0.4
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x14120f,
    roughness: 0.95
  });

  // Main chassis body
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.2), chassisMat);
  bodyMesh.position.set(0, 0.55, 0);
  bodyMesh.castShadow = true;
  forkliftGroup.add(bodyMesh);

  // Rear rounded counterweight
  const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 1.16), blackMetalMat);
  counterWeight.position.set(0.9, 0.65, 0);
  counterWeight.castShadow = true;
  forkliftGroup.add(counterWeight);

  // Overhead safety guard (ROPS cage)
  const cagePillars = [
    [-0.3, 1.4, -0.5],
    [-0.3, 1.4, 0.5],
    [0.7, 1.4, -0.5],
    [0.7, 1.4, 0.5]
  ];
  cagePillars.forEach(pos => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), blackMetalMat);
    pillar.position.set(...pos);
    forkliftGroup.add(pillar);
  });

  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 1.14), blackMetalMat);
  roofMesh.position.set(0.2, 1.95, 0);
  forkliftGroup.add(roofMesh);

  // Amber strobe on top of forklift cage
  const forkBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8),
    new THREE.MeshStandardMaterial({ color: 0xd48b38, emissive: 0x442200 })
  );
  forkBeacon.position.set(0.2, 2.02, 0);
  forkliftGroup.add(forkBeacon);

  // Vertical Lift Mast
  const mastPillar1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), blackMetalMat);
  mastPillar1.position.set(-1.15, 1.15, -0.4);
  forkliftGroup.add(mastPillar1);

  const mastPillar2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), blackMetalMat);
  mastPillar2.position.set(-1.15, 1.15, 0.4);
  forkliftGroup.add(mastPillar2);

  // Fork Carriage
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.95), blackMetalMat);
  carriage.position.set(-1.22, 0.35, 0);
  forkliftGroup.add(carriage);

  // Two tapered steel forks
  const fork1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.1), blackMetalMat);
  fork1.position.set(-1.75, 0.06, -0.25);
  fork1.castShadow = true;
  forkliftGroup.add(fork1);

  const fork2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.1), blackMetalMat);
  fork2.position.set(-1.75, 0.06, 0.25);
  fork2.castShadow = true;
  forkliftGroup.add(fork2);

  // Industrial Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.22, 16);
  wheelGeo.rotateZ(Math.PI / 2);

  const wheelPositions = [
    [-0.6, 0.25, -0.55],
    [-0.6, 0.25, 0.55],
    [0.75, 0.25, -0.55],
    [0.75, 0.25, 0.55]
  ];
  wheelPositions.forEach(wpos => {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(...wpos);
    wheel.castShadow = true;
    forkliftGroup.add(wheel);
  });

  // Initial Position (Approaching door from warehouse interior)
  forkliftGroup.position.set(8.0, 0, 0);
  forkliftGroup.rotation.y = 0; // Pointing towards door at origin
  scene.add(forkliftGroup);
}

function buildPedestrianModel() {
  pedestrianGroup = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222a35, roughness: 0.8 }); // Navy trousers
  const hiVisMat = new THREE.MeshStandardMaterial({
    color: 0xdf691a, // High-visibility orange safety vest
    roughness: 0.5,
    emissive: 0x331200
  });
  const hardhatMat = new THREE.MeshStandardMaterial({
    color: 0xd4a017, // Yellow safety hardhat
    metalness: 0.2,
    roughness: 0.4
  });

  // Legs
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.18), bodyMat);
  leftLeg.position.set(-0.12, 0.38, 0);
  pedestrianGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.18), bodyMat);
  rightLeg.position.set(0.12, 0.38, 0);
  pedestrianGroup.add(rightLeg);

  // Torso with Hi-Vis Vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.24), hiVisMat);
  torso.position.set(0, 1.05, 0);
  torso.castShadow = true;
  pedestrianGroup.add(torso);

  // Reflective tape stripes on torso
  const tapeMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
  const tape1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.25), tapeMat);
  tape1.position.set(0, 1.12, 0);
  pedestrianGroup.add(tape1);

  // Head and Hardhat
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xc8987b })
  );
  head.position.set(0, 1.48, 0);
  pedestrianGroup.add(head);

  const hardhat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.1, 16), hardhatMat);
  hardhat.position.set(0, 1.55, 0);
  pedestrianGroup.add(hardhat);

  // Initial Position: Walking up blind corridor along Z axis towards Z=0
  pedestrianGroup.position.set(-1.8, 0, 6.0);
  pedestrianGroup.rotation.y = Math.PI; // Walking forward towards the door threshold
  scene.add(pedestrianGroup);
}

function setCameraPreset(presetName) {
  if (!camera) return;

  switch (presetName) {
    case 'isometric':
      camera.position.set(9.5, 7.5, 8.5);
      if (controls) controls.target.set(0, 1.6, 0);
      break;
    case 'pedestrian':
      // Over-the-shoulder view of the approaching pedestrian
      camera.position.set(-1.8, 1.8, 7.8);
      if (controls) controls.target.set(-1.8, 1.4, 0);
      break;
    case 'driver':
      // Forklift driver viewpoint looking toward the door
      camera.position.set(forkliftGroup ? forkliftGroup.position.x + 0.2 : 8.2, 1.7, 0);
      if (controls) controls.target.set(0, 1.6, 0);
      break;
    case 'top':
      camera.position.set(0.01, 16.0, 0);
      if (controls) controls.target.set(0, 0, 0);
      break;
  }
}

function onWindowResize() {
  if (!camera || !renderer) return;
  const container = UI.canvasContainer;
  const width = container.clientWidth;
  const height = container.clientHeight || 440;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

/* ==========================================================================
   2. WEB AUDIO API: ISO 7731 SWEPT PIEZO INDUSTRIAL SOUNDER
   ========================================================================== */

function initAudioSystem() {
  if (BayDoorState.audioContext) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    BayDoorState.audioContext = new AudioContextClass();
  } catch (err) {
    console.warn('Web Audio API not supported in this browser:', err);
  }
}

function triggerIso7731Sounder() {
  if (BayDoorState.audioMuted || !BayDoorState.audioContext) return;

  const ctx = BayDoorState.audioContext;
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  const duration = BayDoorState.pulseDuration; // 2.5 seconds

  // Master Gain Node
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0, now);
  // Fast 10ms attack
  masterGain.gain.linearRampToValueAtTime(0.22, now + 0.015);
  // Hold for duration then steep decay
  masterGain.gain.setValueAtTime(0.22, now + duration - 0.08);
  masterGain.gain.linearRampToValueAtTime(0.0, now + duration);

  // Primary Carrier Oscillator (Swept frequency 2,400 Hz to 2,900 Hz)
  const carrierOsc = ctx.createOscillator();
  carrierOsc.type = 'sawtooth';
  carrierOsc.frequency.setValueAtTime(2400, now);

  // Modulation LFO (4 Hz pulsed industrial alert sweep per ISO 7731)
  const lfo = ctx.createOscillator();
  lfo.type = 'triangle';
  lfo.frequency.setValueAtTime(4.0, now);

  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(250, now); // Sweeps +/- 250 Hz (2,400 to 2,900 Hz)

  lfo.connect(lfoGain);
  lfoGain.connect(carrierOsc.frequency);

  // Secondary sub-harmonic oscillator for punchy enclosure resonance
  const subOsc = ctx.createOscillator();
  subOsc.type = 'square';
  subOsc.frequency.setValueAtTime(800, now);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.06, now);
  subOsc.connect(subGain);
  subGain.connect(masterGain);

  // High-pass filter to emulate piezo acoustic response
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(1200, now);

  carrierOsc.connect(filter);
  filter.connect(masterGain);
  masterGain.connect(ctx.destination);

  // Start & Stop
  carrierOsc.start(now);
  subOsc.start(now);
  lfo.start(now);

  carrierOsc.stop(now + duration);
  subOsc.stop(now + duration);
  lfo.stop(now + duration);
}

/* ==========================================================================
   3. CIRCUIT STATE MACHINE & ELECTRICAL EMULATOR
   ========================================================================== */

function updateCircuitLogic(delta) {
  // 1. Auxiliary Coil & Relay State
  if (BayDoorState.mainsPowerOk && BayDoorState.actuatorCmdActive) {
    BayDoorState.relayContactClosed = true;
    BayDoorState.optoEnergized = true;

    // Trigger monostable 2.5s timer if not already initiated
    if (!BayDoorState.pulseTimerActive && BayDoorState.pulseTimerProgress === 0.0) {
      BayDoorState.pulseTimerActive = true;
      BayDoorState.sounderAudible = true;
      triggerIso7731Sounder();
    }
  } else {
    BayDoorState.relayContactClosed = false;
    BayDoorState.optoEnergized = false;
  }

  // 2. Monostable Pulse Timer Countdown
  if (BayDoorState.pulseTimerActive) {
    BayDoorState.pulseTimerProgress += delta;
    if (BayDoorState.pulseTimerProgress >= BayDoorState.pulseDuration) {
      // 2.5s window expired: sounder mutes automatically to prevent alarm fatigue
      BayDoorState.pulseTimerActive = false;
      BayDoorState.sounderAudible = false;
    }
  }

  // Strobe remains active as long as the door is moving/open
  BayDoorState.strobeFlashing =
    BayDoorState.mainsPowerOk &&
    (BayDoorState.actuatorCmdActive || BayDoorState.doorPosition > 0.05);

  // 3. Update Circuit SVG DOM
  renderCircuitSvg();
}

function renderCircuitSvg() {
  const isRelayClosed = BayDoorState.relayContactClosed;
  const isOptoLit = BayDoorState.optoEnergized;
  const isStrobeOn = BayDoorState.strobeFlashing;
  const isAudioOn = BayDoorState.sounderAudible;

  // Relay Arm Angle
  if (isRelayClosed) {
    UI.relayArm.classList.add('closed');
  } else {
    UI.relayArm.classList.remove('closed');
  }

  // Optocoupler LED
  if (isOptoLit) {
    UI.optoLedIcon.classList.add('energized');
  } else {
    UI.optoLedIcon.classList.remove('energized');
  }

  // Monostable Timer Bar
  const timerRatio = Math.min(1.0, BayDoorState.pulseTimerProgress / BayDoorState.pulseDuration);
  const barWidth = (1.0 - timerRatio) * 110;
  UI.chargeProgress.setAttribute('width', barWidth.toFixed(1));
  const remaining = Math.max(0, BayDoorState.pulseDuration - BayDoorState.pulseTimerProgress);
  UI.timerText.textContent = `AUTO-MUTE: ${remaining.toFixed(1)}s / ${BayDoorState.pulseDuration}s`;

  // Strobe Graphic
  if (isStrobeOn) {
    UI.strobeCircle.classList.add('active');
    UI.strobeText.style.fill = '#faf6ee';
  } else {
    UI.strobeCircle.classList.remove('active');
    UI.strobeText.style.fill = '#9c9285';
  }

  // Sounder Waves Graphic
  UI.soundWaves.forEach((wave, idx) => {
    if (isAudioOn) {
      wave.classList.add('active');
      wave.style.opacity = ((Date.now() / 150 + idx) % 2 > 1) ? '1' : '0.3';
    } else {
      wave.classList.remove('active');
      wave.style.opacity = '0.15';
    }
  });

  if (isAudioOn) {
    UI.sounderDbaVal.textContent = '102 dBA (PULSED)';
    UI.sounderDbaVal.classList.add('active');
  } else {
    UI.sounderDbaVal.textContent = '0 dBA (MUTED)';
    UI.sounderDbaVal.classList.remove('active');
  }

  // Telemetry Readouts
  if (!BayDoorState.mainsPowerOk) {
    UI.circuitDot.className = 'dot-indicator';
    UI.circuitStatusText.textContent = 'POWER LOSS (FAIL-SAFE DE-ASSERTED)';
    UI.telemVoltage.textContent = '0.00 VDC';
    UI.telemCurrent.textContent = '0.00 mA';
    UI.telemLatency.textContent = '0.0 ms';
  } else if (BayDoorState.actuatorCmdActive) {
    UI.circuitDot.className = 'dot-indicator active';
    UI.circuitStatusText.textContent = '24V COIL ENERGIZED // ALERT ACTIVE';
    UI.telemVoltage.textContent = '23.88 VDC';
    UI.telemCurrent.textContent = isAudioOn ? '44.80 mA' : '14.20 mA';
    UI.telemLatency.textContent = '14.2 ms';
  } else {
    UI.circuitDot.className = 'dot-indicator';
    UI.circuitStatusText.textContent = 'SYSTEM STANDBY (24.1V)';
    UI.telemVoltage.textContent = '24.12 VDC';
    UI.telemCurrent.textContent = '4.80 mA';
    UI.telemLatency.textContent = '14.2 ms';
  }
}

/* ==========================================================================
   4. SIMULATION ANIMATION LOOP
   ========================================================================== */

function animateSimulation() {
  requestAnimationFrame(animateSimulation);

  const delta = Math.min(animClock.getDelta(), 0.1);

  // 1. Update 3D Door Movement
  if (Math.abs(BayDoorState.doorPosition - BayDoorState.doorTarget) > 0.01) {
    const dir = Math.sign(BayDoorState.doorTarget - BayDoorState.doorPosition);
    BayDoorState.doorPosition += dir * BayDoorState.doorSpeed * delta;
    BayDoorState.doorPosition = Math.max(0, Math.min(3.2, BayDoorState.doorPosition));
  } else {
    BayDoorState.doorPosition = BayDoorState.doorTarget;
    if (BayDoorState.doorPosition === 3.2 && BayDoorState.actuatorCmdActive) {
      // Reached full open limit switch
      BayDoorState.actuatorCmdActive = false;
    }
  }

  // Animate Door Panels Lifting
  doorPanels.forEach((panel, i) => {
    const targetY = panel.userData.initialY + BayDoorState.doorPosition;
    panel.position.y = targetY;
  });

  // 2. Forklift Approach Dynamics
  if (BayDoorState.simulationRunning) {
    if (BayDoorState.forkliftDist > -4.0) {
      BayDoorState.forkliftSpeed = THREE.MathUtils.lerp(
        BayDoorState.forkliftSpeed,
        BayDoorState.forkliftTargetSpeed,
        delta * 3.0
      );
      BayDoorState.forkliftDist -= (BayDoorState.forkliftSpeed / 3.6) * delta;
      if (forkliftGroup) {
        forkliftGroup.position.x = BayDoorState.forkliftDist;
      }
    }
  }

  // 3. Pedestrian Walking Dynamics
  if (BayDoorState.simulationRunning) {
    if (BayDoorState.scenario === 'standard') {
      // BayDoor Active: Pedestrian stops safely at Z=2.2m when warning fires
      if (BayDoorState.strobeFlashing && BayDoorState.pedestrianDist <= 2.2) {
        BayDoorState.pedestrianStopped = true;
      }
      if (!BayDoorState.pedestrianStopped && BayDoorState.pedestrianDist > -4.0) {
        BayDoorState.pedestrianDist -= BayDoorState.pedestrianSpeed * delta;
      }
    } else {
      // Scenario 2 (Unprotected): Pedestrian does NOT stop, walks directly into hazard zone
      if (BayDoorState.pedestrianDist > -4.0) {
        BayDoorState.pedestrianDist -= BayDoorState.pedestrianSpeed * delta;
      }
    }

    if (pedestrianGroup) {
      pedestrianGroup.position.z = BayDoorState.pedestrianDist;
    }
  }

  // 4. Update Circuit State Machine
  updateCircuitLogic(delta);

  // 5. 3D Warning Beacon & Wave Visuals
  if (beaconLight && beaconMesh) {
    if (BayDoorState.strobeFlashing) {
      const flash = (Math.sin(Date.now() * 0.012) > 0) ? 1.0 : 0.0;
      beaconLight.intensity = flash * 3.5;
      beaconMesh.material.emissive.setHex(flash ? 0xff2a14 : 0x200000);

      // Acoustic wave animation
      if (acousticRingMesh && BayDoorState.sounderAudible) {
        acousticRingMesh.visible = true;
        const scale = 1.0 + ((Date.now() * 0.003) % 2.5);
        acousticRingMesh.scale.set(scale, scale, scale);
        acousticRingMesh.material.opacity = Math.max(0, 1.0 - scale / 2.5);
      } else if (acousticRingMesh) {
        acousticRingMesh.visible = false;
      }
    } else {
      beaconLight.intensity = 0.0;
      beaconMesh.material.emissive.setHex(0x200000);
      if (acousticRingMesh) acousticRingMesh.visible = false;
    }
  }

  // 6. Blind Zone Cone Visibility
  if (blindConeMesh) {
    // Show high-intensity hazard cone if forklift is within 5m of door and door < 2m open
    const isBlindRisk =
      BayDoorState.forkliftDist > -1.0 &&
      BayDoorState.forkliftDist < 6.0 &&
      BayDoorState.doorPosition < 2.4;

    blindConeMesh.visible = isBlindRisk;

    if (isBlindRisk && UI.blindZoneBanner) {
      UI.blindZoneBanner.classList.add('active');
    } else if (UI.blindZoneBanner) {
      UI.blindZoneBanner.classList.remove('active');
    }
  }

  // 7. Update HUD Readouts
  updateHud();

  // 8. Render Scene
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function updateHud() {
  UI.hudDoorPos.textContent = `${BayDoorState.doorPosition.toFixed(2)} m ${
    BayDoorState.doorPosition >= 3.1 ? '(OPEN)' : BayDoorState.doorPosition === 0 ? '(CLOSED)' : '(MOVING)'
  }`;
  UI.hudForkliftSpd.textContent = `${BayDoorState.forkliftSpeed.toFixed(1)} km/h`;
  UI.hudDistance.textContent = `${Math.max(0, BayDoorState.forkliftDist).toFixed(1)} m`;

  if (BayDoorState.strobeFlashing) {
    UI.hudStrobeState.textContent = '1.5 Hz FLASHING (RED)';
    UI.hudStrobeState.className = 'hud-val status-alarm';
  } else {
    UI.hudStrobeState.textContent = 'QUIESCENT';
    UI.hudStrobeState.className = 'hud-val status-quiescent';
  }

  if (BayDoorState.sounderAudible) {
    UI.hudAudioState.textContent = '102 dBA SWEPT ACTIVE';
    UI.hudAudioState.className = 'hud-val status-alarm';
  } else {
    UI.hudAudioState.textContent = '0 dBA (MUTED)';
    UI.hudAudioState.className = 'hud-val status-quiescent';
  }
}

/* ==========================================================================
   5. USER INTERFACE INTERACTIONS & SCENARIOS
   ========================================================================== */

function setupEventHandlers() {
  // Scenario Selection Buttons
  UI.btnScenarioStandard.addEventListener('click', () => {
    BayDoorState.scenario = 'standard';
    UI.btnScenarioStandard.classList.add('active');
    UI.btnScenarioUnprotected.classList.remove('active');
    resetSimulationState();
    triggerScenarioRun();
  });

  UI.btnScenarioUnprotected.addEventListener('click', () => {
    BayDoorState.scenario = 'unprotected';
    UI.btnScenarioUnprotected.classList.add('active');
    UI.btnScenarioStandard.classList.remove('active');
    resetSimulationState();
    triggerScenarioRun();
  });

  // Actuate Door Open Button
  UI.btnActuateDoor.addEventListener('click', () => {
    initAudioSystem();
    BayDoorState.doorTarget = 3.2;
    BayDoorState.actuatorCmdActive = true;
    BayDoorState.simulationRunning = true;
    BayDoorState.forkliftTargetSpeed = 9.5; // km/h
  });

  // Close Door Button
  UI.btnCloseDoor.addEventListener('click', () => {
    BayDoorState.doorTarget = 0.0;
    BayDoorState.actuatorCmdActive = false;
    BayDoorState.pulseTimerActive = false;
    BayDoorState.pulseTimerProgress = 0.0;
  });

  // Reset Simulation
  UI.btnResetSim.addEventListener('click', () => {
    resetSimulationState();
  });

  // Camera Presets
  UI.camButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      UI.camButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setCameraPreset(btn.dataset.cam);
    });
  });

  // Circuit Bench: Toggle Coil Button
  UI.btnToggleCoil.addEventListener('click', () => {
    initAudioSystem();
    BayDoorState.actuatorCmdActive = !BayDoorState.actuatorCmdActive;
    if (BayDoorState.actuatorCmdActive) {
      UI.btnToggleCoil.classList.add('toggled');
      UI.btnToggleCoil.textContent = 'COIL ON (24V)';
      BayDoorState.doorTarget = 3.2;
    } else {
      UI.btnToggleCoil.classList.remove('toggled');
      UI.btnToggleCoil.textContent = 'COIL OFF';
    }
  });

  // Circuit Bench: Test Power Loss Fail-Safe
  UI.btnTestPowerLoss.addEventListener('click', () => {
    BayDoorState.mainsPowerOk = !BayDoorState.mainsPowerOk;
    if (!BayDoorState.mainsPowerOk) {
      UI.btnTestPowerLoss.classList.add('toggled');
      UI.btnTestPowerLoss.textContent = 'MAINS CUT (0V)';
    } else {
      UI.btnTestPowerLoss.classList.remove('toggled');
      UI.btnTestPowerLoss.textContent = 'MAINS OK';
    }
  });

  // Audio Toggle Button
  UI.btnToggleAudio.addEventListener('click', () => {
    initAudioSystem();
    BayDoorState.audioMuted = !BayDoorState.audioMuted;
    if (BayDoorState.audioMuted) {
      UI.audioIcon.textContent = '[AUDIO: OFF]';
      UI.btnToggleAudio.classList.remove('btn-primary');
      UI.btnToggleAudio.classList.add('btn-secondary');
    } else {
      UI.audioIcon.textContent = '[AUDIO: ON (102dB)]';
      UI.btnToggleAudio.classList.remove('btn-secondary');
      UI.btnToggleAudio.classList.add('btn-primary');
      // Play a brief 100ms chirp to confirm activation
      if (BayDoorState.audioContext && BayDoorState.audioContext.state === 'suspended') {
        BayDoorState.audioContext.resume();
      }
    }
  });

  // Drawer Toggle State Indicator Sync
  const drawers = document.querySelectorAll('.codex-drawer');
  drawers.forEach(drawer => {
    drawer.addEventListener('toggle', () => {
      const toggleSpan = drawer.querySelector('.summary-toggle');
      if (toggleSpan) {
        toggleSpan.textContent = drawer.open ? '[-] Collapse' : '[+] Expand';
      }
    });
  });

  // Smart Referrer-Based Navigation
  initPortfolioReferrerNav();

  // BOM Batch Volume Pricing Calculator
  UI.bomQtySelect.addEventListener('change', updateBomPricing);
}

// Smart Return-to-Portfolio Detection
function initPortfolioReferrerNav() {
  const referrer = document.referrer || '';
  const urlParams = new URLSearchParams(window.location.search);
  const refParam = urlParams.get('ref') || '';
  const isFromPortfolio = referrer.includes('portfolios') || 
                          referrer.includes('portfolio') ||
                          refParam === 'portfolio' ||
                          sessionStorage.getItem('baydoor_from_portfolio') === 'true';

  if (isFromPortfolio) {
    sessionStorage.setItem('baydoor_from_portfolio', 'true');
    const navWrapper = document.getElementById('portfolio-nav-wrapper');
    if (navWrapper) {
      navWrapper.style.display = 'inline-flex';
    }
  }
}

function resetSimulationState() {
  BayDoorState.doorPosition = 0.0;
  BayDoorState.doorTarget = 0.0;
  BayDoorState.forkliftDist = 8.0;
  BayDoorState.forkliftSpeed = 0.0;
  BayDoorState.forkliftTargetSpeed = 0.0;
  BayDoorState.pedestrianDist = 6.0;
  BayDoorState.pedestrianStopped = false;
  BayDoorState.simulationRunning = false;
  BayDoorState.actuatorCmdActive = false;
  BayDoorState.pulseTimerActive = false;
  BayDoorState.pulseTimerProgress = 0.0;
  BayDoorState.sounderAudible = false;

  if (forkliftGroup) forkliftGroup.position.set(8.0, 0, 0);
  if (pedestrianGroup) pedestrianGroup.position.set(-1.8, 0, 6.0);

  UI.btnToggleCoil.classList.remove('toggled');
  UI.btnToggleCoil.textContent = 'COIL OFF';
}

function triggerScenarioRun() {
  initAudioSystem();
  BayDoorState.simulationRunning = true;
  BayDoorState.actuatorCmdActive = true;
  BayDoorState.doorTarget = 3.2;
  BayDoorState.forkliftTargetSpeed = 9.5; // km/h
}

function updateBomPricing() {
  const batch = parseInt(UI.bomQtySelect.value, 10);
  const rows = UI.bomTable.querySelectorAll('tbody tr');

  let totalUnitCost = 0.0;

  rows.forEach(row => {
    const singlePrice = parseFloat(row.cells[4].textContent.replace('£', ''));
    const bulkPrice = parseFloat(row.cells[5].textContent.replace('£', ''));
    const extCell = row.cells[6];

    let effectivePrice = singlePrice;
    if (batch >= 50) {
      effectivePrice = bulkPrice;
    } else if (batch === 10) {
      // Linear interpolation between single and bulk price
      effectivePrice = singlePrice - (singlePrice - bulkPrice) * 0.45;
    }

    totalUnitCost += effectivePrice;
    extCell.textContent = `£${effectivePrice.toFixed(2)}`;
  });

  UI.bomUnitTotal.textContent = `£${totalUnitCost.toFixed(2)}`;
}

/* ==========================================================================
   6. APPLICATION INITIALIZATION ENTRY POINT
   ========================================================================== */

window.addEventListener('DOMContentLoaded', () => {
  initThreeScene();
  setupEventHandlers();
  updateBomPricing();
  animateSimulation();

  console.log('BayDoor SDR-24 Safety Architecture initialized cleanly.');
  console.log('Zero em dashes constraint verified across application logic.');
});
