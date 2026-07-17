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
  board.position.set(0, 3.35, -4.3);
  board.rotation.x = 0.06;
  world.add(board);

  sfx.startMusic();

  // Run state — nothing plays until begin() is called
  let specialists = [];
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
    ctx.fillText(timelineStart >= 0 ? 'SWARM OPERATIONS · LIVE' : 'SUPPLYSWARM OPS ROOM', 40, 62);
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
      ctx.fillStyle = '#626d84'; ctx.font = '600 20px sans-serif';
      ctx.fillText('TELL ME YOUR BUSINESS, BUDGET AND LOCATION', 512, 500);
      ctx.textAlign = 'left';
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

  const callbacks = { onFinished: onComplete, onEvent: null, onXRChange: null, onXRError: null, onHoldStart: null, onHoldEnd: null };

  // Hold-to-talk: press and hold the coordinator robot
  const raycaster = new THREE.Raycaster();
  const pointerVec = new THREE.Vector2();
  let holding = false;
  function onPointerDown(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerVec.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointerVec, camera);
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

  const AR_SCALE = 0.42; // tabletop-friendly miniature of the ops room

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
  function controllerHitsCoordinator(controller) {
    controllerRotation.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(controllerRotation);
    return raycaster.intersectObject(coordinator, true).length > 0;
  }
  const onSelectStart = event => {
    const controller = event.target;
    // In passthrough AR the first trigger/tap places the room on the surface.
    if (arMode && !arPlaced) { placeWorldAtReticle(); return; }
    if (controllerHitsCoordinator(controller)) {
      controller.userData.holdingCoordinator = true;
      sfx.play('hold', 0.55);
      callbacks.onHoldStart?.();
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
  const EVENT_GAP = 2.4; // long enough to read each exchange

  // The coordinator counts as a conversation participant too.
  const coordEntity = {
    isHub: true, bot: coordinator, accent: LIME,
    thoughts: ['Tracking spend across the whole swarm…', 'Merging shortlists into one package…', 'Waiting on specialist reports from Alibaba…'],
    thoughtIndex: 0, nextThoughtAt: Infinity
  };
  const bubbles = []; // { sprite, entity, start, until, kind }
  const talks = [];   // { from, to, line, mesh, start } — agent-to-agent pulses

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
        thoughts, thoughtIndex: 0, nextThoughtAt: Infinity, itemLines: [],
        home, basePos: home.clone(),
        moveTarget: null, returnAt: -1, faceTarget: null, nodUntil: -1,
        spawnedAt: -1, active: false, offset: Math.random()
      };
    });
  }

  function spawnSpecialist(s, elapsed) {
    if (s.active) return;
    s.spawnedAt = elapsed; s.active = true;
    s.nextThoughtAt = elapsed + 2 + s.offset * 4;
    s.bot.visible = true; s.label.visible = true;
    s.link.material.opacity = .3;
    sfx.play('spawn', 0.5);
  }

  function showBubble(entity, text, elapsed, kind = 'speech', duration = EVENT_GAP + 0.8, accent = null) {
    // One bubble per robot at a time; speech always wins over a thought.
    for (let b = bubbles.length - 1; b >= 0; b--) {
      if (bubbles[b].entity === entity) {
        if (kind === 'thought' && bubbles[b].kind === 'speech') return;
        scene.remove(bubbles[b].sprite);
        bubbles[b].sprite.material.map.dispose();
        bubbles[b].sprite.material.dispose();
        bubbles.splice(b, 1);
      }
    }
    const sprite = makeBubbleSprite(text, accent || entity.accent, kind);
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
    s.nextThoughtAt = elapsed + 4;
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
    rows.push({ who, to, text, warning: /critic/i.test(who) || kind === 'conflict' });
    progress = pct;
    phaseLabel = phaseNames[Math.min(phaseNames.length - 1, Math.floor(i / Math.max(1, events.length - 1) * (phaseNames.length - 1)))];

    // Guarantee everyone eventually beams in even if they never speak.
    if (i < specialists.length) spawnSpecialist(specialists[i], elapsed);

    const speaker = findEntity(who);
    const target = findEntity(to);
    if (speaker && !speaker.isHub) spawnSpecialist(speaker, elapsed);
    if (target && !target.isHub) spawnSpecialist(target, elapsed);

    // The speaker walks toward whoever it is addressing, faces them and talks.
    if (speaker && !speaker.isHub && target && target !== speaker) {
      const targetPos = entityPosition(target, new THREE.Vector3()).setY(0);
      speaker.moveTarget = speaker.home.clone().lerp(targetPos, target.isHub ? 0.45 : 0.42);
      speaker.faceTarget = targetPos.clone();
      speaker.returnAt = elapsed + EVENT_GAP + 0.6;
      if (!target.isHub) {
        target.faceTarget = speaker.home.clone();
        target.returnAt = elapsed + EVENT_GAP + 0.6;
        target.nodUntil = elapsed + 1.6;
      }
    }
    // Conflicts flash orange, memory recalls flash violet — the disagreement
    // and the remembering are legible at a glance, even across the room.
    const bubbleAccent = kind === 'conflict' ? ORANGE : kind === 'memory' ? 0xc4b5fd : null;
    if (speaker) showBubble(speaker, text, elapsed, 'speech', EVENT_GAP + 0.8, bubbleAccent);
    if (speaker && target && target !== speaker) startTalk(speaker, target, elapsed);

    if (i === events.length - 1) {
      finished = true;
      sfx.play('complete', 0.65);
      setTimeout(() => { if (!xrSession) callbacks.onFinished?.(); }, 1500);
    } else {
      sfx.play('event', 0.3);
    }
    drawBoard();
    callbacks.onEvent?.({ who, to, text, progress: pct, phase: phaseLabel, index: i, kind });
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

    if (timelineStart >= 0 && eventIndex < events.length && elapsed > timelineStart + eventIndex * EVENT_GAP) {
      fireEvent(eventIndex, elapsed);
      eventIndex++;
    }

    coordinator.position.y = Math.sin(elapsed * 1.6) * 0.05;
    coordinator.rotation.y = Math.sin(elapsed * 0.5) * 0.25;
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

    // Between spoken events, working agents surface their genuine reasoning
    // steps as thought bubbles (Qwen-authored in live mode).
    if (timelineStart >= 0 && !finished) {
      for (const s of specialists) {
        if (!s.active || elapsed < s.nextThoughtAt) continue;
        s.nextThoughtAt = elapsed + 5.5 + s.offset * 4;
        if (!bubbles.some(bubble => bubble.entity === s)) {
          showBubble(s, s.thoughts[s.thoughtIndex++ % s.thoughts.length], elapsed, 'thought', 3.4);
        }
      }
      if (elapsed >= coordEntity.nextThoughtAt) {
        coordEntity.nextThoughtAt = elapsed + 7;
        if (!bubbles.some(bubble => bubble.entity === coordEntity)) {
          showBubble(coordEntity, coordEntity.thoughts[coordEntity.thoughtIndex++ % coordEntity.thoughts.length], elapsed, 'thought', 3.4);
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
      if (life <= 0) {
        scene.remove(bubble.sprite);
        bubble.sprite.material.map.dispose();
        bubble.sprite.material.dispose();
        bubbles.splice(b, 1);
      }
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
        scene.remove(talk.line); scene.remove(talk.mesh);
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
      const bubble = makeBubbleSprite(`PHONE → ${target.isHub ? 'HUB' : target.name.toUpperCase()}: ${text}`, ORANGE);
      // Route through showBubble-equivalent bookkeeping with the orange accent.
      for (let b = bubbles.length - 1; b >= 0; b--) {
        if (bubbles[b].entity === target) {
          world.remove(bubbles[b].sprite);
          bubbles[b].sprite.material.map.dispose();
          bubbles[b].sprite.material.dispose();
          bubbles.splice(b, 1);
        }
      }
      world.add(bubble);
      bubbles.push({ sprite: bubble, entity: target, start: elapsed, until: elapsed + 4.2, kind: 'speech' });
      rows.push({ who: 'Phone', to: target.isHub ? 'Hub' : target.name, text: String(text).slice(0, 90), warning: false });
      drawBoard();
    },
    /** Start the swarm run. Call once, after the user has given their brief. */
    begin(scenario, timeline, newBrief) {
      if (timelineStart >= 0) return;
      specialists = buildSpecialists(scenario.agents);
      // Recalled swarm memory becomes the Coordinator's opening thoughts.
      if (Array.isArray(scenario.coordThoughts) && scenario.coordThoughts.length) {
        coordEntity.thoughts = [...scenario.coordThoughts, ...coordEntity.thoughts];
      }
      // Attribute sourced lines to their agent so tap-to-inspect shows real spend.
      for (const s of specialists) {
        s.itemLines = (scenario.items || []).filter(item =>
          String(item[7] || '').toLowerCase() === s.name.toLowerCase());
      }
      coordEntity.nextThoughtAt = timer.getElapsed() + 5;
      events = timeline;
      if (newBrief) briefLine = `${newBrief.type.toUpperCase()} · ${money(newBrief.budget)}`;
      statusText = '';
      timelineStart = timer.getElapsed() + 0.8;
      drawBoard();
    },
    setStatus(text) {
      if (timelineStart >= 0) return;
      statusText = String(text).toUpperCase();
      drawBoard();
    },
    setListening(value) {
      listening = Boolean(value);
      if (listening && timelineStart < 0) statusText = 'RELEASE WHEN YOU HAVE FINISHED SPEAKING';
      drawBoard();
    },
    dispose() {
      disposed = true;
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
