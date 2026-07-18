import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sfx } from './audio.js';

const INK = 0x0d1424, LIME = 0xe8a33d, MINT = 0x5c7cff, ORANGE = 0xff7a5c;
const SHELL = 0x93a0b5, FACE = 0xe8ecf4, TRIM = 0x39445c;
const ACCENTS = [MINT, 0x46c8b4, LIME, MINT, ORANGE, 0x46c8b4, LIME];

function makeLabelSprite(code, name, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(13,20,36,.82)';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = `#${accent.toString(16).padStart(6, '0')}`;
  ctx.globalAlpha = .55; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 152); ctx.globalAlpha = 1;
  ctx.fillStyle = `#${accent.toString(16).padStart(6, '0')}`;
  ctx.font = '700 64px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(code, 256, 74);
  ctx.fillStyle = '#e8ecf4'; ctx.font = '600 34px sans-serif';
  ctx.fillText(name.toUpperCase(), 256, 126);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.05, 0.33, 1);
  return sprite;
}

function makeBubbleSprite(text, accent, kind = 'speech') {
  const thought = kind === 'thought';
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = 232;
  const ctx = canvas.getContext('2d');
  // Wrap into up to 3 lines
  const words = String(text).split(' ');
  const lines = [''];
  for (const word of words) {
    const candidate = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (candidate.length > 30 && lines[lines.length - 1]) {
      if (lines.length === 3) { lines[2] = lines[2].slice(0, 28) + '…'; break; }
      lines.push(word);
    } else {
      lines[lines.length - 1] = candidate;
    }
  }
  const accentCss = `#${accent.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = thought ? 'rgba(13,20,36,.84)' : 'rgba(13,20,36,.92)';
  ctx.beginPath(); ctx.roundRect(8, 8, 752, thought ? 186 : 216, thought ? 60 : 26); ctx.fill();
  ctx.strokeStyle = accentCss; ctx.globalAlpha = thought ? .45 : .8; ctx.lineWidth = thought ? 4 : 5;
  if (thought) ctx.setLineDash([16, 12]);
  ctx.beginPath(); ctx.roundRect(8, 8, 752, thought ? 186 : 216, thought ? 60 : 26); ctx.stroke();
  ctx.setLineDash([]);
  if (thought) {
    // Trailing "thought" dots toward the robot's head
    for (const [x, y, r] of [[120, 216, 9], [90, 228, 6]]) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = thought ? '#9fb0c6' : '#e8ecf4';
  ctx.font = thought ? 'italic 500 36px sans-serif' : '600 40px sans-serif';
  ctx.textAlign = 'center';
  const boxHeight = thought ? 186 : 216;
  const startY = (boxHeight + 16) / 2 - (lines.length - 1) * 26 + 12;
  lines.forEach((line, i) => ctx.fillText(line, 384, startY + i * 50));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(thought ? 1.65 : 1.9, thought ? 0.5 : 0.57, 1);
  return sprite;
}

// Wrap a string to at most `max` lines of ~`width` chars, ellipsising overflow.
function wrapLines(text, width, max) {
  const words = String(text).split(' ');
  const lines = [''];
  for (const word of words) {
    const candidate = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (candidate.length > width && lines[lines.length - 1]) {
      if (lines.length === max) { lines[max - 1] = lines[max - 1].slice(0, width - 1) + '…'; break; }
      lines.push(word);
    } else {
      lines[lines.length - 1] = candidate;
    }
  }
  return lines;
}

// Header sprite that sits above a set of choice panels — who is asking + the
// question itself, so a human-in-the-loop prompt reads clearly in VR.
function makeChoiceTitleSprite(headline, question, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 300;
  const ctx = canvas.getContext('2d');
  const accentCss = `#${accent.toString(16).padStart(6, '0')}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = accentCss; ctx.font = '700 40px sans-serif';
  ctx.fillText(headline.toUpperCase(), 512, 58);
  ctx.fillStyle = '#e8ecf4'; ctx.font = '700 56px sans-serif';
  const lines = wrapLines(question, 34, 2);
  lines.forEach((line, i) => ctx.fillText(line, 512, 140 + i * 66));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.2, 0.94, 1);
  return sprite;
}

// A single selectable choice panel (an option button, or the mode-picker card).
function makeChoiceOptionSprite(label, sub, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 236;
  const ctx = canvas.getContext('2d');
  const accentCss = `#${accent.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = 'rgba(13,20,36,.95)';
  ctx.beginPath(); ctx.roundRect(8, 8, 496, 220, 30); ctx.fill();
  ctx.strokeStyle = accentCss; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(8, 8, 496, 220, 30); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8ecf4'; ctx.font = '700 48px sans-serif';
  const lines = wrapLines(label, 15, 2);
  const baseY = sub ? (lines.length === 1 ? 110 : 86) : (lines.length === 1 ? 132 : 108);
  lines.forEach((line, i) => ctx.fillText(line, 256, baseY + i * 54));
  if (sub) { ctx.fillStyle = accentCss; ctx.font = '600 28px sans-serif'; ctx.fillText(sub, 256, 196); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.5, 0.69, 1);
  return sprite;
}

function buildBot(accent, scale = 1) {
  const bot = new THREE.Group();
  const trim = new THREE.MeshStandardMaterial({ color: TRIM, roughness: .6 });
  const glow = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4, roughness: .3 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.33, 0.52, 24), new THREE.MeshStandardMaterial({ color: SHELL, roughness: .55, metalness: .15 }));
  torso.position.y = 0.86; bot.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 22), new THREE.MeshStandardMaterial({ color: FACE, roughness: .4 }));
  head.scale.set(1, .88, .94); head.position.y = 1.42; bot.add(head);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), glow);
    eye.scale.set(1, 1.5, .7); eye.position.set(side * 0.11, 1.46, 0.245); bot.add(eye);
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 12), trim);
    ear.rotation.z = Math.PI / 2; ear.position.set(side * 0.31, 1.42, 0); bot.add(ear);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.3, 4, 10), trim);
    arm.position.set(side * 0.36, 0.9, 0); arm.rotation.z = side * 0.16; bot.add(arm);
  }

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.02), trim);
  mouth.position.set(0, 1.325, 0.27); bot.add(mouth);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), trim);
  stem.position.y = 1.75; bot.add(stem);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), glow);
  tip.position.y = 1.85; bot.add(tip);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), glow);
  core.position.set(0, 0.92, 0.28); bot.add(core);

  const hover = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 24),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  hover.rotation.x = -Math.PI / 2; hover.position.y = 0.36; bot.add(hover);

  bot.scale.setScalar(scale);
  return bot;
}

export function launchOpsRoom({ container, brief, phaseNames, money, onComplete, onExit }) {
  // alpha:true lets the camera passthrough show through in immersive-ar.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.xr.enabled = true;
  // Sharpness in VR/AR: render at a higher framebuffer scale and disable fixed
  // foveation, which otherwise blurs everything away from the lens centre.
  renderer.xr.setFramebufferScaleFactor(1.2);
  renderer.xr.setFoveation(0);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  const inkColor = new THREE.Color(INK);
  const inkFog = new THREE.Fog(INK, 9, 26);
  scene.background = inkColor;
  scene.fog = inkFog;

  // Everything the swarm owns lives in one group so passthrough AR can shrink
  // the whole ops room and set it down on a real detected surface.
  const world = new THREE.Group();
  scene.add(world);

  const rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 60);
  camera.position.set(0, 3.1, 7.6);
  rig.add(camera);
  scene.add(rig);

  scene.add(new THREE.HemisphereLight(0x2a3450, 0x05070f, 1.4));
  const key = new THREE.DirectionalLight(0xe8ecf7, 1.5);
  key.position.set(3, 6, 4); scene.add(key);
  const hubLight = new THREE.PointLight(LIME, 8, 9); hubLight.position.set(0, 2.4, 0); world.add(hubLight);

  // Virtual floor — hidden in passthrough AR where the real room is the floor.
  const ground = new THREE.Group();
  world.add(ground);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 48), new THREE.MeshStandardMaterial({ color: 0x0a101f, roughness: .9 }));
  floor.rotation.x = -Math.PI / 2; ground.add(floor);
  const grid = new THREE.GridHelper(30, 34, 0x232f4a, 0x141c30);
  grid.position.y = 0.005; ground.add(grid);
  for (const [radius, opacity] of [[2.9, .5], [0.85, .8]]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.045, 64),
      new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01;
    ring.userData.keepInAR = true; world.add(ring);
  }

  // Set dressing: cargo pallets modelled in Blender and baked to GLB
  // (public/models/supply-props.glb) — scattered outside the agent ring so the
  // room reads as a working supply depot. Purely decorative; failures ignored.
  let disposed = false;
  new GLTFLoader().load('/models/supply-props.glb', gltf => {
    if (disposed) return;
    for (const [x, z, rot, s] of [[4.7, -2.3, 0.7, 1], [-4.5, -2.7, 2.4, 0.85], [3.7, 4.0, -1.8, 0.9], [-3.5, 4.4, 0.4, 1.05]]) {
      const props = gltf.scene.clone(true);
      props.position.set(x, 0, z);
      props.rotation.y = rot;
      props.scale.setScalar(s);
      world.add(props);
    }
  }, undefined, () => {});

  // Coordinator — the robot you hold and talk to
  const coordinator = buildBot(LIME, 1.15);
  world.add(coordinator);
  const hubLabel = makeLabelSprite('HUB', 'Coordinator', LIME);
  hubLabel.position.set(0, 2.45, 0); world.add(hubLabel);
  const hubAnchor = new THREE.Vector3(0, 1.15, 0);

  // Listening halo shown while the mic is open
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.7, 48),
    new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05; world.add(halo);

  // Phone-link code, rendered inside the 3D scene so it is readable from inside
  // an immersive VR/AR session (the DOM chip is invisible there). Floats above
  // the coordinator — the robot the user holds and looks at — and always faces
  // the viewer. Hidden until the session registers and a code arrives.
  let phoneCode = '';
  const codeHost = (typeof window !== 'undefined' && window.location?.host) || '';
  const codeCanvas = document.createElement('canvas');
  codeCanvas.width = 640; codeCanvas.height = 224;
  const codeCtx = codeCanvas.getContext('2d');
  const codeTexture = new THREE.CanvasTexture(codeCanvas);
  codeTexture.colorSpace = THREE.SRGBColorSpace;
  const codeSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: codeTexture, transparent: true, depthWrite: false }));
  codeSprite.scale.set(1.35, 0.47, 1);
  // Upper-left corner, above the board — well clear of the coordinator's speech
  // bubbles that used to overlay it when it floated dead centre.
  const CODE_BASE_Y = 4.35;
  codeSprite.position.set(-3.9, CODE_BASE_Y, -2.2);
  codeSprite.visible = false;
  world.add(codeSprite);

  // In-scene playback-speed control. A DOM slider is invisible inside an
  // immersive session, so the speed toggle lives in the 3D world: point a
  // controller at it and select (or tap/click on desktop) to cycle the pace.
  const SPEEDS = [
    { label: 'SLOW', scale: 2.1 },
    { label: 'NORMAL', scale: 1.35 },
    { label: 'FAST', scale: 0.8 }
  ];
  let speedIndex = 1; // NORMAL — matches paceScale's default
  const speedCanvas = document.createElement('canvas');
  speedCanvas.width = 512; speedCanvas.height = 200;
  const speedCtx = speedCanvas.getContext('2d');
  const speedTexture = new THREE.CanvasTexture(speedCanvas);
  speedTexture.colorSpace = THREE.SRGBColorSpace;
  const speedButton = new THREE.Sprite(new THREE.SpriteMaterial({ map: speedTexture, transparent: true, depthWrite: false }));
  speedButton.scale.set(1.15, 0.45, 1);
  // Lower-RIGHT front: clear of the left-hand board and (on desktop/mobile) the
  // bottom-left HUD feed, while staying easy to point a controller at in VR.
  speedButton.position.set(2.6, 0.9, 2.0);
  world.add(speedButton);

  function drawSpeedButton() {
    const ctx = speedCtx;
    ctx.clearRect(0, 0, 512, 200);
    ctx.fillStyle = 'rgba(13,20,36,.92)';
    ctx.beginPath(); ctx.roundRect(6, 6, 500, 188, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(232,163,61,.65)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(6, 6, 500, 188, 26); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8d97ad'; ctx.font = '600 26px sans-serif';
    ctx.fillText('PLAYBACK SPEED', 256, 56);
    ctx.fillStyle = '#e8a33d'; ctx.font = '700 66px sans-serif';
    ctx.fillText(`▸ ${SPEEDS[speedIndex].label}`, 256, 120);
    ctx.fillStyle = '#626d84'; ctx.font = '500 22px sans-serif';
    ctx.fillText('TAP / SELECT TO CHANGE', 256, 166);
    speedTexture.needsUpdate = true;
  }
  drawSpeedButton();

  function cycleSpeed() {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    paceScale = SPEEDS[speedIndex].scale;
    drawSpeedButton();
    sfx.play('event', 0.35);
  }

  // --- In-scene choice panels (mode picker + agent questions) --------------
  // A modal-ish set of selectable panels the user can point-and-select in VR
  // or click on desktop. One code path serves both the "full autonomy vs check
  // in with me" picker and the agents' clarifying questions.
  let choicePanels = [];        // { sprite, value, onPick }
  let choiceTitleSprite = null;
  let choiceModal = false;      // modal choices swallow other interactions
  let choiceResolve = null;
  let choiceDefault = null;

  function disposeSprite(sprite) {
    sprite.removeFromParent();
    sprite.material.map?.dispose();
    sprite.material.dispose();
  }

  function clearChoice() {
    for (const panel of choicePanels) disposeSprite(panel.sprite);
    choicePanels = [];
    if (choiceTitleSprite) { disposeSprite(choiceTitleSprite); choiceTitleSprite = null; }
  }

  // Resolve the open choice (a pick, or a dismissal with the default value).
  function settleChoice(value) {
    const resolve = choiceResolve;
    choiceResolve = null; choiceModal = false;
    clearChoice();
    resolve?.(value);
  }

  /**
   * Open a choice: a title header + one selectable panel per option, arranged
   * in an arc in front of the coordinator, facing the viewer. Resolves with the
   * picked option's value (or `defaultValue` if dismissed).
   */
  function openChoice({ headline, question, options, modal = true, defaultValue = null }) {
    clearChoice();
    choiceModal = modal;
    choiceDefault = defaultValue;
    choiceTitleSprite = makeChoiceTitleSprite(headline, question, LIME);
    choiceTitleSprite.position.set(0, 2.85, 2.7);
    world.add(choiceTitleSprite);
    const n = options.length;
    const spacing = Math.min(1.62, 6.4 / Math.max(1, n));
    options.forEach((option, i) => {
      const accent = option.skip ? 0x8d97ad : ACCENTS[i % ACCENTS.length];
      const sprite = makeChoiceOptionSprite(option.label, option.sub, accent);
      const x = (i - (n - 1) / 2) * spacing;
      sprite.position.set(x, 1.78, 2.75);
      world.add(sprite);
      choicePanels.push({ sprite, value: option.value, onPick: () => { sfx.play('event', 0.4); settleChoice(option.value); } });
    });
    return new Promise(resolve => { choiceResolve = resolve; });
  }

  // Try to resolve a click/select against the open choice panels. Returns true
  // if the interaction was consumed (a pick, or a modal swallow).
  function handleChoiceHit() {
    if (!choicePanels.length) return false;
    for (const panel of choicePanels) {
      if (raycaster.intersectObject(panel.sprite).length) { panel.onPick(); return true; }
    }
    if (choiceModal) return true;      // modal: ignore anything but a valid pick
    settleChoice(choiceDefault);       // non-modal: a click elsewhere dismisses
    return false;                      // let that click fall through to normal handling
  }

  function drawPhoneCode() {
    const ctx = codeCtx;
    ctx.clearRect(0, 0, 640, 224);
    ctx.fillStyle = 'rgba(13,20,36,.9)';
    ctx.beginPath(); ctx.roundRect(6, 6, 628, 212, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(90,212,194,.7)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(6, 6, 628, 212, 22); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5ad4c2'; ctx.font = '700 34px sans-serif';
    ctx.fillText('PHONE LINK', 320, 58);
    ctx.fillStyle = '#e8ecf4'; ctx.font = '700 92px sans-serif';
    ctx.fillText(phoneCode, 320, 148);
    ctx.fillStyle = '#8d97ad'; ctx.font = '600 24px sans-serif';
    ctx.fillText(`${codeHost}/connect`, 320, 194);
    codeTexture.needsUpdate = true;
  }

  // Status board
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024; boardCanvas.height = 576;
  const boardCtx = boardCanvas.getContext('2d');
  const boardTexture = new THREE.CanvasTexture(boardCanvas);
  boardTexture.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.91),
    new THREE.MeshBasicMaterial({ map: boardTexture, transparent: true })
  );
  // Sit the board up and to the LEFT, angled back toward the viewer, so the
  // coordinator (dead centre) no longer blocks the line of sight to it — the
  // user glances up-left to read the ops board.
  board.position.set(-3.9, 3.15, -2.7);
  board.rotation.set(0.05, 0.62, 0);
  world.add(board);

  sfx.startMusic();

  // Run state — nothing plays until begin() is called
  let specialists = [];
  let teamRevealed = false;   // roster beamed in during planning, before the timeline
  let revealQueue = [];       // pending one-by-one specialist entrances
  let events = [];
  let timelineStart = -1;
  let eventIndex = 0;
  let finished = false;
  let listening = false;
  let statusText = 'HOLD ME AND SPEAK — OR TYPE YOUR BRIEF BELOW';
  let briefLine = brief ? `${brief.type.toUpperCase()} · ${money(brief.budget)}` : 'AWAITING YOUR BRIEF';
  const rows = [];
  let phaseLabel = 'AWAITING YOUR BRIEF', progress = 0;

  function drawBoard() {
    const ctx = boardCtx;
    ctx.clearRect(0, 0, 1024, 576);
    ctx.fillStyle = 'rgba(13,20,36,.94)'; ctx.fillRect(0, 0, 1024, 576);
    ctx.strokeStyle = 'rgba(232,163,61,.5)'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, 1012, 564);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8a33d'; ctx.font = '700 30px sans-serif';
    const boardTitle = finished && summary ? 'MISSION COMPLETE · LAUNCH PLAN'
      : timelineStart >= 0 ? 'SWARM OPERATIONS · LIVE' : 'SUPPLYSWARM OPS ROOM';
    ctx.fillText(boardTitle, 40, 62);
    ctx.fillStyle = '#8d97ad'; ctx.font = '600 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(briefLine, 984, 62);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(232,236,244,.16)'; ctx.beginPath(); ctx.moveTo(40, 86); ctx.lineTo(984, 86); ctx.stroke();
    if (timelineStart < 0) {
      // Idle: invite the user to talk to the coordinator
      ctx.textAlign = 'center';
      ctx.fillStyle = listening ? '#5ad4c2' : '#e8ecf4';
      ctx.font = '700 52px sans-serif';
      ctx.fillText(listening ? '● LISTENING…' : 'TALK TO ME', 512, 268);
      ctx.fillStyle = '#8d97ad'; ctx.font = '500 27px sans-serif';
      const lines = statusText.length > 52
        ? [statusText.slice(0, statusText.lastIndexOf(' ', 52)), statusText.slice(statusText.lastIndexOf(' ', 52) + 1)]
        : [statusText];
      lines.forEach((line, i) => ctx.fillText(line, 512, 330 + i * 38));
      if (phoneCode) {
        // Pairing happens here — show the phone-link code big on the board.
        ctx.fillStyle = '#5ad4c2'; ctx.font = '700 26px sans-serif';
        ctx.fillText(`PHONE LINK  ${phoneCode}  ·  ${codeHost}/connect`, 512, 448);
      }
      ctx.fillStyle = '#626d84'; ctx.font = '600 20px sans-serif';
      ctx.fillText('TELL ME YOUR BUSINESS, BUDGET AND LOCATION', 512, 500);
      ctx.textAlign = 'left';
    } else if (finished && summary) {
      // Results view: the completed work, readable from inside VR.
      let y = 132;
      const shown = (summary.items || []).slice(0, 5);
      for (const [title, price] of shown) {
        ctx.fillStyle = '#e8ecf4'; ctx.font = '600 26px sans-serif';
        const label = String(title);
        ctx.fillText(label.length > 44 ? label.slice(0, 43) + '…' : label, 40, y);
        ctx.fillStyle = '#5ad4c2'; ctx.font = '700 26px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(money(price), 984, y);
        ctx.textAlign = 'left';
        y += 44;
      }
      if ((summary.itemCount || 0) > shown.length) {
        ctx.fillStyle = '#8d97ad'; ctx.font = '500 22px sans-serif';
        ctx.fillText(`+ ${summary.itemCount - shown.length} more line${summary.itemCount - shown.length === 1 ? '' : 's'} in the full plan`, 40, y);
        y += 40;
      }
      ctx.strokeStyle = 'rgba(232,236,244,.16)'; ctx.beginPath(); ctx.moveTo(40, y - 14); ctx.lineTo(984, y - 14); ctx.stroke();
      ctx.fillStyle = '#e8a33d'; ctx.font = '700 34px sans-serif';
      ctx.fillText(`LANDED TOTAL ${money(summary.total)} OF ${money(summary.budget)}`, 40, y + 28);
      ctx.fillStyle = summary.valid ? '#5ad4c2' : '#ff966e'; ctx.font = '700 24px sans-serif';
      ctx.fillText(summary.valid ? '✓ INSIDE BUDGET' : '! OVER BUDGET — RISK FLAGGED', 40, y + 62);
      ctx.fillStyle = '#8d97ad'; ctx.font = '600 22px sans-serif';
      ctx.fillText(`${summary.liveLinks || 0} LIVE ALIBABA LISTING${summary.liveLinks === 1 ? '' : 'S'} · ${summary.itemCount || 0} ITEMS`, 40, y + 94);
      ctx.fillStyle = '#626d84'; ctx.font = '600 20px sans-serif';
      ctx.fillText('SELECT “VIEW LAUNCH PLAN” FOR THE FULL REPORT + PDF — ALSO ON YOUR PAIRED PHONE', 40, 548);
    } else {
      let y = 136;
      for (const row of rows.slice(-6)) {
        ctx.fillStyle = row.warning ? '#ff966e' : '#5ad4c2';
        ctx.font = '700 22px sans-serif';
        const speaker = `${row.who}${row.to ? ` → ${row.to}` : ''}`.toUpperCase();
        ctx.fillText(speaker.length > 22 ? speaker.slice(0, 21) + '…' : speaker, 40, y);
        ctx.fillStyle = '#aab3c6'; ctx.font = '400 24px sans-serif';
        ctx.fillText(row.text.length > 56 ? row.text.slice(0, 55) + '…' : row.text, 330, y);
        y += 56;
      }
      ctx.fillStyle = finished ? '#e8a33d' : '#e8ecf4'; ctx.font = '700 30px sans-serif';
      ctx.fillText(finished ? 'PACKAGE APPROVED — YOUR LAUNCH PLAN IS READY' : phaseLabel, 40, 514);
      ctx.fillStyle = 'rgba(232,163,61,.18)'; ctx.fillRect(40, 532, 944, 12);
      ctx.fillStyle = '#e8a33d'; ctx.fillRect(40, 532, 944 * progress / 100, 12);
    }
    boardTexture.needsUpdate = true;
  }
  drawBoard();

  // Desktop controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.25, 0);
  controls.enableDamping = true;
  controls.minDistance = 2.2; controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.update();

  const callbacks = { onFinished: onComplete, onEvent: null, onXRChange: null, onXRError: null, onHoldStart: null, onHoldEnd: null, onViewPlan: null };

  // Hold-to-talk: press and hold the coordinator robot
  const raycaster = new THREE.Raycaster();
  const pointerVec = new THREE.Vector2();
  let holding = false;
  function onPointerDown(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerVec.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointerVec, camera);
    // An open choice (mode picker / agent question) intercepts clicks first.
    if (choicePanels.length) { if (handleChoiceHit()) return; }
    if (viewButton?.visible && raycaster.intersectObject(viewButton).length) {
      callbacks.onViewPlan?.();
      return;
    }
    if (speedButton.visible && raycaster.intersectObject(speedButton).length) {
      cycleSpeed();
      return;
    }
    if (raycaster.intersectObject(coordinator, true).length) {
      holding = true;
      controls.enabled = false;
      sfx.play('hold', 0.55);
      callbacks.onHoldStart?.();
      e.preventDefault();
      return;
    }
    // Tap a specialist robot to inspect its role, spend and current work.
    for (const s of specialists) {
      if (s.active && raycaster.intersectObject(s.bot, true).length) {
        inspectSpecialist(s);
        return;
      }
    }
  }
  function onPointerUp() {
    if (!holding) return;
    holding = false;
    if (!renderer.xr.isPresenting) controls.enabled = true;
    sfx.play('release', 0.5);
    callbacks.onHoldEnd?.();
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // WebXR session handling — in VR, point at the coordinator and hold trigger.
  let xrSession = null;
  let arMode = false;
  let arPlaced = false;
  let hitTestSource = null;

  // Passthrough AR placement reticle — follows real surfaces via WebXR hit-test
  // (plane-detection is requested so Quest-class devices snap to real planes).
  const reticle = new THREE.Group();
  const reticleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.18, 40),
    new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  reticleRing.rotation.x = -Math.PI / 2;
  const reticleDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.03, 20),
    new THREE.MeshBasicMaterial({ color: MINT, side: THREE.DoubleSide })
  );
  reticleDot.rotation.x = -Math.PI / 2;
  reticle.add(reticleRing, reticleDot);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const AR_SCALE = 0.27; // tabletop-friendly miniature — sits comfortably on a desk in front of you

  function placeWorldAtReticle() {
    if (!reticle.visible) return false;
    const position = new THREE.Vector3();
    reticle.matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
    world.position.copy(position);
    world.scale.setScalar(AR_SCALE);
    // Turn the room to face the viewer standing at the headset position.
    camera.getWorldPosition(tmp);
    world.rotation.y = Math.atan2(tmp.x - position.x, tmp.z - position.z);
    world.visible = true;
    arPlaced = true;
    reticle.visible = false;
    if (timelineStart < 0) {
      statusText = 'HOLD THE COORDINATOR TRIGGER AND SPEAK';
      drawBoard();
    }
    return true;
  }

  function resetWorldTransform() {
    world.position.set(0, 0, 0);
    world.rotation.set(0, 0, 0);
    world.scale.setScalar(1);
    world.visible = true;
    ground.visible = true;
    scene.background = inkColor;
    scene.fog = inkFog;
    reticle.visible = false;
    arMode = false;
    arPlaced = false;
    if (hitTestSource) { hitTestSource.cancel?.(); hitTestSource = null; }
  }
  const controllerRotation = new THREE.Matrix4();
  function setControllerRay(controller) {
    controllerRotation.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(controllerRotation);
  }
  function controllerHitsCoordinator(controller) {
    setControllerRay(controller);
    return raycaster.intersectObject(coordinator, true).length > 0;
  }
  const onSelectStart = event => {
    const controller = event.target;
    // In passthrough AR the first trigger/tap places the room on the surface.
    if (arMode && !arPlaced) { placeWorldAtReticle(); return; }
    // An open choice (mode picker / agent question) intercepts selection first.
    if (choicePanels.length) { setControllerRay(controller); if (handleChoiceHit()) return; }
    if (controllerHitsCoordinator(controller)) {
      controller.userData.holdingCoordinator = true;
      sfx.play('hold', 0.55);
      callbacks.onHoldStart?.();
      return;
    }
    // Pointing at the VIEW PLAN button and pulling the trigger opens results.
    if (viewButton?.visible && raycaster.intersectObject(viewButton).length) {
      callbacks.onViewPlan?.();
      return;
    }
    // Pointing at the speed toggle cycles Slow / Normal / Fast.
    if (speedButton.visible && raycaster.intersectObject(speedButton).length) {
      cycleSpeed();
      return;
    }
    // In VR, pointing at a specialist and pulling the trigger inspects it.
    for (const s of specialists) {
      if (s.active && raycaster.intersectObject(s.bot, true).length) {
        inspectSpecialist(s);
        return;
      }
    }
  };
  const onSelectEnd = event => {
    const controller = event.target;
    if (!controller.userData.holdingCoordinator) return;
    controller.userData.holdingCoordinator = false;
    sfx.play('release', 0.5);
    callbacks.onHoldEnd?.();
  };
  const controllers = [0, 1].map(index => {
    const controller = renderer.xr.getController(index);
    const ray = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0.5 })
    );
    ray.scale.z = 6;
    controller.add(ray);
    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);
    rig.add(controller);
    return controller;
  });
  function onSessionEnd() {
    for (const controller of controllers) {
      if (controller.userData.holdingCoordinator) {
        controller.userData.holdingCoordinator = false;
        callbacks.onHoldEnd?.();
      }
    }
    xrSession = null;
    resetWorldTransform();
    rig.position.set(0, 0, 0);
    camera.position.set(0, 3.1, 7.6);
    controls.enabled = true; controls.update();
    callbacks.onXRChange?.(false);
    if (finished) callbacks.onFinished?.();
  }

  async function enterVR() {
    if (xrSession) return;
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      });
      xrSession = session;
      session.addEventListener('end', onSessionEnd);
      // three.js creates its own base layer using the framebuffer scale factor
      // configured above — setting one manually here would fight it and force
      // the (blurrier) native default back on.
      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
      controls.enabled = false;
      rig.position.set(0, 0, 4.4);
      if (timelineStart < 0) {
        statusText = 'HOLD YOUR CONTROLLER TRIGGER AND SPEAK';
        drawBoard();
      }
      callbacks.onXRChange?.(true);
    } catch (err) {
      console.warn('VR session failed', err);
      callbacks.onXRError?.(err);
    }
  }

  // Passthrough AR: the real room shows through, WebXR hit-test (backed by
  // plane detection where available) finds real surfaces, and the first
  // trigger/tap sets the miniature ops room down on one of them.
  async function enterAR() {
    if (xrSession) return;
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['local-floor', 'plane-detection', 'anchors', 'hand-tracking']
      });
      xrSession = session;
      arMode = true;
      arPlaced = false;
      session.addEventListener('end', onSessionEnd);
      renderer.xr.setReferenceSpaceType('local');
      await renderer.xr.setSession(session);
      // Camera passthrough replaces the virtual room shell.
      scene.background = null;
      scene.fog = null;
      ground.visible = false;
      world.visible = false;
      controls.enabled = false;
      rig.position.set(0, 0, 0);
      const viewerSpace = await session.requestReferenceSpace('viewer');
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      if (timelineStart < 0) statusText = 'POINT AT A SURFACE AND PULL THE TRIGGER TO PLACE ME';
      drawBoard();
      callbacks.onXRChange?.(true);
    } catch (err) {
      console.warn('AR session failed', err);
      resetWorldTransform();
      callbacks.onXRError?.(err);
    }
  }

  const timer = new THREE.Timer();
  timer.connect(document);
  const tmp = new THREE.Vector3();
  const tmpDest = new THREE.Vector3();
  // Playback pacing. Each timeline line dwells BASE_GAP seconds, scaled by the
  // user-chosen paceScale (Slow/Normal/Fast) so the dialogue is actually
  // readable. Conflicts and memory recalls linger longer — the disagreement is
  // the story, so it should sit long enough to read.
  const BASE_GAP = 2.6;
  let paceScale = 1.35;   // start a touch slower than "normal" so lines read
  let lastGap = BASE_GAP; // dwell chosen for the current line (drives bubble life)
  let nextEventAt = -1;   // absolute time the next timeline event fires
  function gapFor(index) {
    const kind = events[index]?.[4] || 'talk';
    const emphasis = (kind === 'conflict') ? 1.9 : kind === 'memory' ? 1.5 : kind === 'think' ? 0.85 : 1;
    return BASE_GAP * paceScale * emphasis;
  }
  // VR legibility: never more than this many bubbles in the room at once —
  // one conversation to follow, plus at most one background thought.
  const MAX_BUBBLES = 2;
  const AMBIENT_THOUGHT_GAP = 6.5;

  // The coordinator counts as a conversation participant too.
  const coordEntity = {
    isHub: true, bot: coordinator, accent: LIME,
    thoughts: ['Tracking spend across the whole swarm…', 'Merging shortlists into one package…', 'Waiting on specialist reports from Alibaba…'],
    thoughtIndex: 0
  };
  const bubbles = []; // { sprite, entity, start, until, kind }
  const talks = [];   // { from, to, line, mesh, start } — agent-to-agent pulses
  let nextAmbientThoughtAt = Infinity;
  let ambientThoughtIndex = 0;
  // Completion state — set via begin()'s summary so the finale can present
  // the finished work inside the room (issue: no way to see results in VR).
  let summary = null;
  let finaleAt = -1;
  let viewButton = null;
  let viewButtonAt = -1;

  function entityPosition(entity, out) {
    if (entity.isHub) return out.set(0, 1.15, 0);
    return out.copy(entity.bot.position).setY(0.95);
  }

  function findEntity(name) {
    const n = String(name || '').toLowerCase().trim();
    if (!n) return null;
    const specialist = specialists.find(s => s.name.toLowerCase() === n || s.code.toLowerCase() === n);
    if (specialist) return specialist;
    if (n.includes('coordinator') || n === 'swarm' || n === 'hub' || n.includes('cost')) return coordEntity;
    return null;
  }

  function buildSpecialists(agents) {
    return agents.map((agent, i) => {
      const angle = -Math.PI / 2 + (i + 0.5) * (Math.PI * 2 / agents.length);
      const accent = ACCENTS[i % ACCENTS.length];
      const bot = buildBot(accent, 0.8);
      const home = new THREE.Vector3(Math.cos(angle) * 2.9, 0, Math.sin(angle) * 2.9);
      bot.position.copy(home);
      bot.lookAt(0, 0, 0);
      bot.visible = false;
      world.add(bot);
      const label = makeLabelSprite(agent[0], agent[1], accent);
      label.position.copy(bot.position).setY(1.95);
      label.visible = false;
      world.add(label);
      const link = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([hubAnchor, bot.position.clone().setY(0.95)]),
        new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0 })
      );
      world.add(link);
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 }));
      world.add(pulse);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 4, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
      );
      beam.position.copy(bot.position).setY(2);
      world.add(beam);
      const focus = String(agent[2] || 'my category');
      const thoughts = Array.isArray(agent[3]) && agent[3].length ? agent[3] : [
        `Scanning Alibaba for ${focus.toLowerCase()}…`,
        'Comparing unit prices and MOQ terms…',
        'Attaching evidence to my shortlist…'
      ];
      // The agent's recalled memory joins its thought rotation, so what it
      // remembers from past missions is visible while it works.
      const memory = (Array.isArray(agent[4]) ? agent[4] : [])
        .map(line => `Remembering: ${String(line).slice(0, 82)}`);
      thoughts.unshift(...memory.slice(0, 2));
      return {
        bot, label, link, pulse, beam, accent,
        code: String(agent[0] || ''), name: String(agent[1] || ''), focus,
        thoughts, thoughtIndex: 0, itemLines: [],
        home, basePos: home.clone(),
        moveTarget: null, returnAt: -1, faceTarget: null, nodUntil: -1,
        spawnedAt: -1, active: false, departAt: -1, offset: Math.random()
      };
    });
  }

  function spawnSpecialist(s, elapsed) {
    if (s.active) return;
    s.spawnedAt = elapsed; s.active = true;
    s.bot.visible = true; s.label.visible = true;
    s.link.material.opacity = .3;
    sfx.play('spawn', 0.5);
  }

  function findSpecialist(agent) {
    const code = String(agent[0] || '').toLowerCase();
    const name = String(agent[1] || '').toLowerCase();
    return specialists.find(s => s.code.toLowerCase() === code || s.name.toLowerCase() === name);
  }

  // Does the already-revealed roster match the final plan's agents? (Same run =
  // same order and codes, so we can reuse the beamed-in robots.)
  function sameRoster(agents) {
    if (!teamRevealed || !Array.isArray(agents) || specialists.length !== agents.length) return false;
    return agents.every((agent, i) =>
      String(agent[0]) === specialists[i].code && String(agent[1]) === specialists[i].name);
  }

  function disposeSpecialists() {
    for (const s of specialists) {
      for (let b = bubbles.length - 1; b >= 0; b--) if (bubbles[b].entity === s) removeBubble(b);
      for (const obj of [s.bot, s.label, s.link, s.pulse, s.beam]) {
        obj.removeFromParent();
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => { m?.map?.dispose?.(); m?.dispose?.(); });
      }
    }
    specialists = [];
    revealQueue = [];
  }

  // Once the real searches return, refresh the reused robots with each agent's
  // genuine Qwen reasoning steps and recalled memory for their thought bubbles.
  function refreshSpecialists(agents) {
    for (const agent of agents) {
      const s = findSpecialist(agent);
      if (!s) continue;
      const genuine = (Array.isArray(agent[3]) ? agent[3] : []).map(String).filter(Boolean).slice(0, 3);
      const memory = (Array.isArray(agent[4]) ? agent[4] : [])
        .map(line => `Remembering: ${String(line).slice(0, 82)}`).slice(0, 2);
      if (genuine.length || memory.length) {
        s.thoughts = [...memory, ...(genuine.length ? genuine : s.thoughts)];
        s.thoughtIndex = 0;
      }
    }
  }

  function removeBubble(index) {
    const bubble = bubbles[index];
    bubble.sprite.removeFromParent();
    bubble.sprite.material.map.dispose();
    bubble.sprite.material.dispose();
    bubbles.splice(index, 1);
  }

  function showBubble(entity, text, elapsed, kind = 'speech', duration = BASE_GAP + 0.8, accent = null) {
    // One bubble per robot at a time; speech always wins over a thought.
    for (let b = bubbles.length - 1; b >= 0; b--) {
      if (bubbles[b].entity === entity) {
        if (kind === 'thought' && bubbles[b].kind === 'speech') return;
        removeBubble(b);
      }
    }
    // Only one robot speaks at a time — a new speech bubble retires the
    // previous speaker's so the VR user always knows where to look.
    if (kind === 'speech') {
      for (let b = bubbles.length - 1; b >= 0; b--) {
        if (bubbles[b].kind === 'speech') removeBubble(b);
      }
    }
    while (bubbles.length >= MAX_BUBBLES) {
      const oldestThought = bubbles.findIndex(bubble => bubble.kind === 'thought');
      removeBubble(oldestThought >= 0 ? oldestThought : 0);
    }
    const sprite = makeBubbleSprite(text, accent ?? entity.accent, kind);
    world.add(sprite);
    bubbles.push({ sprite, entity, start: elapsed, until: elapsed + duration, kind });
  }

  // Tap (or point-and-select in VR) any robot to inspect what it is doing.
  function inspectSpecialist(s) {
    const elapsed = timer.getElapsed();
    camera.getWorldPosition(tmp);
    s.faceTarget = new THREE.Vector3(tmp.x, 0, tmp.z);
    s.returnAt = elapsed + 2.6;
    s.nodUntil = elapsed + 1.2;
    const spent = s.itemLines.reduce((sum, item) => sum + (Number(item[2]) || 0), 0);
    const statLine = s.itemLines.length
      ? ` · ${s.itemLines.length} line${s.itemLines.length === 1 ? '' : 's'} sourced · £${spent.toLocaleString('en-GB')}`
      : '';
    showBubble(s, `${s.name}: ${s.focus}${statLine}`, elapsed, 'speech', 3);
  }

  function startTalk(from, to, elapsed) {
    const a = entityPosition(from, new THREE.Vector3());
    const b = entityPosition(to, new THREE.Vector3());
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a, b]),
      new THREE.LineBasicMaterial({ color: from.accent, transparent: true, opacity: 0.55 })
    );
    world.add(line);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 8),
      new THREE.MeshBasicMaterial({ color: from.accent, transparent: true, opacity: 0.95 })
    );
    world.add(mesh);
    talks.push({ from, to, line, mesh, start: elapsed });
  }

  function fireEvent(i, elapsed) {
    const [who, text, pct, to, kind = 'talk'] = events[i];
    const isThought = kind === 'think';
    progress = pct;
    phaseLabel = phaseNames[Math.min(phaseNames.length - 1, Math.floor(i / Math.max(1, events.length - 1) * (phaseNames.length - 1)))];

    // Guarantee everyone eventually beams in even if they never speak.
    if (i < specialists.length) spawnSpecialist(specialists[i], elapsed);

    // Dwell for this line — conflicts linger, so a price dispute is readable.
    lastGap = gapFor(i);
    const dwell = lastGap + 0.8;

    const speaker = findEntity(who);
    const target = findEntity(to);
    if (speaker && !speaker.isHub) spawnSpecialist(speaker, elapsed);
    if (target && !target.isHub) spawnSpecialist(target, elapsed);

    if (isThought) {
      // Working step: the agent thinks over its own head — the board stays
      // reserved for actual dialogue between agents.
      if (speaker) showBubble(speaker, text, elapsed, 'thought', dwell);
    } else {
      rows.push({ who, to, text, warning: /critic/i.test(who) || kind === 'conflict' });
      // The speaker walks toward whoever it is addressing, faces them and talks.
      if (speaker && !speaker.isHub && target && target !== speaker) {
        const targetPos = entityPosition(target, new THREE.Vector3()).setY(0);
        speaker.moveTarget = speaker.home.clone().lerp(targetPos, target.isHub ? 0.45 : 0.42);
        speaker.faceTarget = targetPos.clone();
        speaker.returnAt = elapsed + dwell;
        if (!target.isHub) {
          target.faceTarget = speaker.home.clone();
          target.returnAt = elapsed + dwell;
          target.nodUntil = elapsed + 1.6;
        }
      }
      // Conflicts flash orange, memory recalls flash violet — disagreement
      // and remembering are legible at a glance, even across the room. A
      // conflict line is prefixed so the dispute reads as a dispute.
      const bubbleAccent = kind === 'conflict' ? ORANGE : kind === 'memory' ? 0xc4b5fd : null;
      const shown = kind === 'conflict' ? `⚡ ${text}` : text;
      if (speaker) showBubble(speaker, shown, elapsed, 'speech', dwell, bubbleAccent);
      if (speaker && target && target !== speaker) startTalk(speaker, target, elapsed);
    }

    if (i === events.length - 1) {
      finished = true;
      sfx.play('complete', 0.65);
      finaleAt = elapsed + 1.6;
      setTimeout(() => { if (!xrSession) callbacks.onFinished?.(); }, 1500);
    } else {
      sfx.play('event', 0.3);
    }
    drawBoard();
    callbacks.onEvent?.({ who, to, text, progress: pct, phase: phaseLabel, index: i, kind });
  }

  // Mission-complete finale: the specialists beam away one by one, then the
  // hub presents the finished work — the results board plus a VIEW PLAN
  // button — so the outcome is visible without leaving VR.
  function beginFinale(elapsed) {
    for (let b = bubbles.length - 1; b >= 0; b--) {
      if (bubbles[b].kind === 'thought') removeBubble(b);
    }
    specialists.forEach((s, i) => { if (s.active) s.departAt = elapsed + 0.4 + i * 0.28; });
    const liveNote = summary?.liveLinks ? ` ${summary.liveLinks} live Alibaba listing${summary.liveLinks === 1 ? '' : 's'} verified.` : '';
    showBubble(coordEntity, `Mission complete — specialists standing down.${liveNote} Your launch plan is on the board.`, elapsed, 'speech', 7);
    viewButtonAt = elapsed + 0.4 + specialists.length * 0.28 + 0.8;
    drawBoard();
  }

  function spawnViewButton() {
    if (!viewButton) {
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 160;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(232,163,61,.95)';
      ctx.beginPath(); ctx.roundRect(6, 6, 628, 148, 30); ctx.fill();
      ctx.strokeStyle = '#0d1424'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(6, 6, 628, 148, 30); ctx.stroke();
      ctx.fillStyle = '#0d1424'; ctx.font = '800 56px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('VIEW LAUNCH PLAN ↗', 320, 88);
      ctx.font = '600 26px sans-serif';
      ctx.fillText('FULL REPORT · ALIBABA LINKS · PDF', 320, 130);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      viewButton = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.425),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
      );
      viewButton.position.set(0, 1.02, 1.75);
      world.add(viewButton);
    }
    viewButton.visible = true;
    sfx.play('spawn', 0.4);
  }

  renderer.setAnimationLoop((timestamp, frame) => {
    timer.update(timestamp);
    const dt = timer.getDelta();
    const elapsed = timer.getElapsed();

    // Passthrough AR surface detection: track the latest hit-test pose until
    // the user places the room.
    if (arMode && !arPlaced && frame && hitTestSource) {
      const hits = frame.getHitTestResults(hitTestSource);
      const referenceSpace = renderer.xr.getReferenceSpace();
      const pose = hits.length && referenceSpace ? hits[0].getPose(referenceSpace) : null;
      if (pose) {
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }

    // Staggered team entrance during planning: each specialist beams in on its
    // own beat and flashes a "searching" thought so the swarm assembles visibly
    // while the real Alibaba searches run.
    while (revealQueue.length && elapsed >= revealQueue[0].revealAt) {
      const s = revealQueue.shift();
      if (!s.active) {
        spawnSpecialist(s, elapsed);
        const thought = s.thoughts?.[0] || `Searching Alibaba for ${s.focus.toLowerCase()}…`;
        showBubble(s, thought, elapsed, 'thought', 3.8);
      }
    }

    if (timelineStart >= 0 && eventIndex < events.length && elapsed >= nextEventAt) {
      fireEvent(eventIndex, elapsed);
      eventIndex++;
      nextEventAt = elapsed + lastGap; // pace-scaled dwell before the next line
    }

    if (finaleAt >= 0 && elapsed >= finaleAt) { finaleAt = -1; beginFinale(elapsed); }
    if (viewButtonAt >= 0 && elapsed >= viewButtonAt) { viewButtonAt = -1; spawnViewButton(); }
    if (viewButton?.visible) {
      viewButton.position.y = 1.02 + Math.sin(elapsed * 2.1) * 0.045;
      camera.getWorldPosition(tmp);
      viewButton.lookAt(tmp.x, viewButton.position.y, tmp.z);
    }

    coordinator.position.y = Math.sin(elapsed * 1.6) * 0.05;
    coordinator.rotation.y = Math.sin(elapsed * 0.5) * 0.25;
    if (codeSprite.visible) codeSprite.position.y = CODE_BASE_Y + Math.sin(elapsed * 1.4) * 0.04;
    hubLight.intensity = listening ? 13 + Math.sin(elapsed * 9) * 4 : 7 + Math.sin(elapsed * 3) * 2;
    if (listening) {
      halo.material.opacity = 0.5 + Math.sin(elapsed * 7) * 0.3;
      const pulseScale = 1 + Math.sin(elapsed * 7) * 0.12;
      halo.scale.setScalar(pulseScale);
    } else if (halo.material.opacity > 0) {
      halo.material.opacity = Math.max(0, halo.material.opacity - dt * 2);
    }

    for (const s of specialists) {
      if (!s.active) continue;
      // Departure: beam flash, rise and shrink away once the mission is done.
      if (s.departAt >= 0 && elapsed >= s.departAt) {
        const t = elapsed - s.departAt;
        const shrink = Math.max(0, 1 - t / 0.9);
        s.bot.scale.setScalar(0.8 * shrink);
        s.bot.position.set(s.basePos.x, (1 - shrink) * 2.4, s.basePos.z);
        s.beam.material.opacity = t < 0.35 ? (t / 0.35) * 0.5 : Math.max(0, 0.5 * (1 - (t - 0.35) / 0.7));
        s.link.material.opacity = 0.3 * shrink;
        s.label.material.opacity = shrink;
        s.label.position.set(s.basePos.x, 1.95 + (1 - shrink) * 2.4, s.basePos.z);
        s.pulse.material.opacity = 0;
        if (shrink <= 0 && s.beam.material.opacity <= 0) {
          s.active = false;
          s.bot.visible = false;
          s.label.visible = false;
          for (let b = bubbles.length - 1; b >= 0; b--) {
            if (bubbles[b].entity === s) removeBubble(b);
          }
          sfx.play('release', 0.3);
        }
        continue;
      }
      const since = elapsed - s.spawnedAt;
      const grow = Math.min(1, since / 0.6);
      const ease = 1 - Math.pow(1 - grow, 3);
      const nod = elapsed < s.nodUntil ? 1 + Math.max(0, Math.sin((s.nodUntil - elapsed) * 9)) * 0.05 : 1;
      s.bot.scale.setScalar(0.8 * ease * nod);

      // Walk: toward a conversation partner while speaking, otherwise drift near home.
      const conversing = s.moveTarget && elapsed < s.returnAt;
      tmpDest.copy(conversing ? s.moveTarget : s.home);
      if (!conversing && !finished) {
        tmpDest.x += Math.sin(elapsed * 0.4 + s.offset * 7) * 0.2;
        tmpDest.z += Math.cos(elapsed * 0.33 + s.offset * 5) * 0.2;
      }
      s.basePos.lerp(tmpDest, 1 - Math.exp(-dt * 2.6));
      const bob = Math.sin(elapsed * 1.8 + s.offset * 6) * 0.045;
      s.bot.position.set(s.basePos.x, bob, s.basePos.z);

      // Face the agent being spoken to, otherwise the coordinator.
      const facing = s.faceTarget && elapsed < s.returnAt + 0.8 ? s.faceTarget : hubAnchor;
      s.bot.lookAt(facing.x, s.bot.position.y, facing.z);

      // Label and hub link follow the walking bot.
      s.label.position.set(s.basePos.x, 1.95 + bob, s.basePos.z);
      const linkPositions = s.link.geometry.attributes.position;
      linkPositions.setXYZ(1, s.bot.position.x, 0.95, s.bot.position.z);
      linkPositions.needsUpdate = true;

      s.beam.material.opacity = Math.max(0, 0.35 * (1 - since / 0.8));
      const t = (elapsed * 0.45 + s.offset) % 1;
      tmp.copy(hubAnchor).lerp(s.bot.position.clone().setY(0.95), t);
      s.pulse.position.copy(tmp);
      s.pulse.material.opacity = finished ? 0 : Math.sin(t * Math.PI) * 0.9;
    }

    // Between spoken events, ONE agent at a time surfaces its genuine
    // reasoning as a thought bubble (Qwen-authored in live mode) — a single
    // rotating slot rather than every robot thinking at once.
    if (timelineStart >= 0 && !finished && elapsed >= nextAmbientThoughtAt) {
      nextAmbientThoughtAt = elapsed + AMBIENT_THOUGHT_GAP;
      const thinkers = [...specialists.filter(s => s.active && s.departAt < 0), coordEntity];
      if (bubbles.length < MAX_BUBBLES && !bubbles.some(bubble => bubble.kind === 'thought')) {
        const thinker = thinkers[ambientThoughtIndex++ % thinkers.length];
        if (thinker.thoughts?.length && !bubbles.some(bubble => bubble.entity === thinker)) {
          showBubble(thinker, thinker.thoughts[thinker.thoughtIndex++ % thinker.thoughts.length], elapsed, 'thought', 3.4);
        }
      }
    }

    // Speech bubbles hover above whoever is talking, then fade out.
    for (let b = bubbles.length - 1; b >= 0; b--) {
      const bubble = bubbles[b];
      const holder = bubble.entity;
      if (holder.isHub) bubble.sprite.position.set(0, 2.9, 0);
      else bubble.sprite.position.set(holder.basePos.x, 2.45, holder.basePos.z);
      const life = bubble.until - elapsed;
      const fadeIn = Math.min(1, (elapsed - bubble.start) / 0.25);
      bubble.sprite.material.opacity = life < 0.5 ? Math.max(0, life / 0.5) : fadeIn;
      if (life <= 0) removeBubble(b);
    }

    // Agent-to-agent message pulses travel between the two talking robots.
    for (let k = talks.length - 1; k >= 0; k--) {
      const talk = talks[k];
      const t = (elapsed - talk.start) / 1.1;
      const a = entityPosition(talk.from, new THREE.Vector3());
      const b = entityPosition(talk.to, tmp);
      const linePositions = talk.line.geometry.attributes.position;
      linePositions.setXYZ(0, a.x, a.y, a.z);
      linePositions.setXYZ(1, b.x, b.y, b.z);
      linePositions.needsUpdate = true;
      talk.line.material.opacity = Math.max(0, 0.55 * (1 - t * 0.6));
      talk.mesh.position.copy(a).lerp(b, Math.min(1, t));
      talk.mesh.material.opacity = t >= 1 ? Math.max(0, 0.95 * (1 - (t - 1) * 4)) : 0.95;
      if (t > 1.4) {
        talk.line.removeFromParent(); talk.mesh.removeFromParent();
        talk.line.geometry.dispose(); talk.line.material.dispose();
        talk.mesh.geometry.dispose(); talk.mesh.material.dispose();
        talks.splice(k, 1);
      }
    }

    if (!renderer.xr.isPresenting) controls.update();
    renderer.render(scene, camera);
  });

  function onResize() {
    if (renderer.xr.isPresenting) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    callbacks,
    enterVR,
    enterAR,
    async vrSupported() {
      try { return !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'); }
      catch { return false; }
    },
    async arSupported() {
      try { return !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar'); }
      catch { return false; }
    },
    isRunning: () => timelineStart >= 0,
    isFinished: () => finished,
    /** A request sent from a paired phone — the target robot reacts visibly. */
    relayRequest(toName, text) {
      const elapsed = timer.getElapsed();
      const normalized = String(toName || 'Hub');
      const target = findEntity(normalized) || coordEntity;
      if (!target.isHub && !target.active) spawnSpecialist(target, elapsed);
      if (!target.isHub) {
        camera.getWorldPosition(tmp);
        target.faceTarget = new THREE.Vector3(tmp.x, 0, tmp.z);
        target.returnAt = elapsed + 3;
        target.nodUntil = elapsed + 1.6;
      }
      showBubble(target, `PHONE → ${target.isHub ? 'HUB' : target.name.toUpperCase()}: ${text}`, elapsed, 'speech', 4.2, ORANGE);
      rows.push({ who: 'Phone', to: target.isHub ? 'Hub' : target.name, text: String(text).slice(0, 90), warning: false });
      drawBoard();
    },
    /** Coordinator "thinking" bubble while Qwen designs the team (pre-run). */
    hubThink(text) {
      if (timelineStart >= 0) return;
      showBubble(coordEntity, String(text), timer.getElapsed(), 'thought', 3.2);
    },
    /**
     * Ask the user, in-scene, how the swarm should work. Resolves true for
     * "check in with me" (human-in-the-loop) or false for full autonomy.
     * Non-modal: starting a brief without choosing defaults to autonomy.
     */
    chooseMode() {
      return openChoice({
        headline: 'Before we start',
        question: 'How should the swarm work?',
        modal: false,
        defaultValue: false,
        options: [
          { label: 'Full autonomy', sub: 'agents decide everything', value: false },
          { label: 'Check in with me', sub: 'agents ask you questions', value: true }
        ]
      });
    },
    /**
     * Put one of the Coordinator's clarifying questions to the user in-scene.
     * Resolves with the chosen option string, or null if they let the agents
     * decide. Modal — the swarm waits on the answer.
     */
    askQuestion(question) {
      const headline = question.agent ? `${question.agent} asks` : 'The swarm asks';
      const options = [
        ...(question.options || []).map(option => ({ label: option, value: option })),
        { label: 'Let the agents decide', sub: 'skip', value: null, skip: true }
      ];
      statusText = 'ANSWER THE SWARM — OR LET THE AGENTS DECIDE';
      drawBoard();
      return openChoice({ headline, question: question.question, options, modal: true, defaultValue: null });
    },
    /** Close any open choice (e.g. the mode picker) with its default value. */
    dismissChoice() { if (choicePanels.length) settleChoice(choiceDefault); },
    /**
     * Beam the specialist team in one-by-one while they search Alibaba, before
     * the full plan is ready. Called with the roster streamed from the server
     * the moment the Coordinator designs it.
     */
    revealTeam(agents) {
      if (timelineStart >= 0 || teamRevealed || !Array.isArray(agents) || !agents.length) return;
      teamRevealed = true;
      specialists = buildSpecialists(agents);
      const now = timer.getElapsed();
      // Stagger the entrances so they arrive one after another, not in a clump.
      specialists.forEach((s, i) => { s.revealAt = now + 0.6 + i * 0.85; });
      revealQueue = specialists.map(s => s).sort((a, b) => a.revealAt - b.revealAt);
      statusText = '';
      drawBoard();
    },
    /** Start the swarm run. Call once, after the user has given their brief. */
    begin(scenario, timeline, newBrief, runSummary) {
      if (timelineStart >= 0) return;
      if (choicePanels.length) settleChoice(choiceDefault); // clear any open prompt
      if (sameRoster(scenario.agents)) {
        // The team already beamed in during planning — reuse those robots and
        // top them up with the genuine reasoning the searches produced.
        refreshSpecialists(scenario.agents);
      } else {
        if (teamRevealed) disposeSpecialists();
        specialists = buildSpecialists(scenario.agents);
      }
      teamRevealed = false;
      revealQueue = [];
      // Recalled swarm memory becomes the Coordinator's opening thoughts.
      if (Array.isArray(scenario.coordThoughts) && scenario.coordThoughts.length) {
        coordEntity.thoughts = [...scenario.coordThoughts, ...coordEntity.thoughts];
      }
      // Attribute sourced lines to their agent so tap-to-inspect shows real spend.
      for (const s of specialists) {
        s.itemLines = (scenario.items || []).filter(item =>
          String(item[7] || '').toLowerCase() === s.name.toLowerCase());
      }
      summary = runSummary || null;
      events = timeline;
      if (newBrief) briefLine = `${newBrief.type.toUpperCase()} · ${money(newBrief.budget)}`;
      statusText = '';
      timelineStart = timer.getElapsed() + 0.8;
      nextEventAt = timelineStart; // first line fires the moment the timeline opens
      nextAmbientThoughtAt = timelineStart + 4;
      drawBoard();
    },
    setStatus(text) {
      if (timelineStart >= 0) return;
      statusText = String(text).toUpperCase();
      drawBoard();
    },
    /** Show the phone-pairing code inside the room (visible in VR/AR). */
    setPhoneCode(code) {
      phoneCode = String(code || '').toUpperCase();
      if (phoneCode) { drawPhoneCode(); codeSprite.visible = true; }
      else { codeSprite.visible = false; }
      drawBoard();
    },
    setListening(value) {
      listening = Boolean(value);
      if (listening && timelineStart < 0) statusText = 'RELEASE WHEN YOU HAVE FINISHED SPEAKING';
      drawBoard();
    },
    dispose() {
      disposed = true;
      if (choiceResolve) settleChoice(choiceDefault); // resolve any awaiter
      sfx.stopMusic();
      renderer.setAnimationLoop(null);
      if (hitTestSource) { hitTestSource.cancel?.(); hitTestSource = null; }
      if (xrSession) xrSession.end().catch(() => {});
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      for (const controller of controllers) {
        controller.removeEventListener('selectstart', onSelectStart);
        controller.removeEventListener('selectend', onSelectEnd);
      }
      timer.dispose();
      controls.dispose();
      scene.traverse(obj => {
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => { m?.map?.dispose?.(); m?.dispose?.(); });
      });
      renderer.dispose();
      renderer.domElement.remove();
      onExit?.();
    }
  };
}
