import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const INK = 0x07110e, LIME = 0xb8f632, MINT = 0x55e6b1, ORANGE = 0xff6b35;
const SHELL = 0x8c9b91, FACE = 0xdce7dd, TRIM = 0x33423c;
const ACCENTS = [LIME, MINT, LIME, MINT, ORANGE, MINT];

function makeLabelSprite(code, name, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(7,17,14,.82)';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = `#${accent.toString(16).padStart(6, '0')}`;
  ctx.globalAlpha = .55; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 152); ctx.globalAlpha = 1;
  ctx.fillStyle = `#${accent.toString(16).padStart(6, '0')}`;
  ctx.font = '700 64px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(code, 256, 74);
  ctx.fillStyle = '#dce7dd'; ctx.font = '600 34px sans-serif';
  ctx.fillText(name.toUpperCase(), 256, 126);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.05, 0.33, 1);
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

export function launchOpsRoom({ container, scenario, brief, events, phaseNames, money, onComplete, onExit }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.Fog(INK, 9, 26);

  const rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 60);
  camera.position.set(0, 3.1, 7.6);
  rig.add(camera);
  scene.add(rig);

  scene.add(new THREE.HemisphereLight(0x27362e, 0x040a07, 1.4));
  const key = new THREE.DirectionalLight(0xe8f5e0, 1.5);
  key.position.set(3, 6, 4); scene.add(key);
  const hubLight = new THREE.PointLight(LIME, 8, 9); hubLight.position.set(0, 2.4, 0); scene.add(hubLight);

  // Floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 48), new THREE.MeshStandardMaterial({ color: 0x0a1410, roughness: .9 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new THREE.GridHelper(30, 34, 0x1d2c24, 0x101c16);
  grid.position.y = 0.005; scene.add(grid);
  for (const [radius, opacity] of [[2.9, .5], [0.85, .8]]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.045, 64),
      new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  }

  // Coordinator
  const coordinator = buildBot(LIME, 1.15);
  scene.add(coordinator);
  const hubLabel = makeLabelSprite('HUB', 'Coordinator', LIME);
  hubLabel.position.set(0, 2.45, 0); scene.add(hubLabel);
  const hubAnchor = new THREE.Vector3(0, 1.15, 0);

  // Specialists (spawn later)
  const specialists = scenario.agents.map((agent, i) => {
    const angle = -Math.PI / 2 + (i + 0.5) * (Math.PI * 2 / scenario.agents.length);
    const accent = ACCENTS[i % ACCENTS.length];
    const bot = buildBot(accent, 0.8);
    bot.position.set(Math.cos(angle) * 2.9, 0, Math.sin(angle) * 2.9);
    bot.lookAt(0, 0, 0);
    bot.visible = false;
    scene.add(bot);
    const label = makeLabelSprite(agent[0], agent[1], accent);
    label.position.copy(bot.position).setY(1.95);
    label.visible = false;
    scene.add(label);
    const link = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([hubAnchor, bot.position.clone().setY(0.95)]),
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0 })
    );
    scene.add(link);
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 }));
    scene.add(pulse);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 4, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.copy(bot.position).setY(2);
    scene.add(beam);
    return { bot, label, link, pulse, beam, accent, spawnedAt: -1, active: false, offset: Math.random() };
  });

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
  scene.add(board);

  const rows = [];
  let phaseLabel = phaseNames[0], progress = 8, finished = false;

  function drawBoard() {
    const ctx = boardCtx;
    ctx.clearRect(0, 0, 1024, 576);
    ctx.fillStyle = 'rgba(6,14,11,.94)'; ctx.fillRect(0, 0, 1024, 576);
    ctx.strokeStyle = 'rgba(184,246,50,.5)'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, 1012, 564);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b8f632'; ctx.font = '700 30px sans-serif';
    ctx.fillText('SWARM OPERATIONS · LIVE', 40, 62);
    ctx.fillStyle = '#8d9992'; ctx.font = '600 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${brief.type.toUpperCase()} · ${money(brief.budget)}`, 984, 62);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(238,240,232,.16)'; ctx.beginPath(); ctx.moveTo(40, 86); ctx.lineTo(984, 86); ctx.stroke();
    let y = 136;
    for (const row of rows.slice(-6)) {
      ctx.fillStyle = row.warning ? '#ff966e' : '#55e6b1';
      ctx.font = '700 26px sans-serif';
      ctx.fillText(row.who.toUpperCase(), 40, y);
      ctx.fillStyle = '#c8d2ca'; ctx.font = '400 25px sans-serif';
      ctx.fillText(row.text.length > 62 ? row.text.slice(0, 61) + '…' : row.text, 240, y);
      y += 56;
    }
    ctx.fillStyle = finished ? '#b8f632' : '#eef0e8'; ctx.font = '700 30px sans-serif';
    ctx.fillText(finished ? 'PACKAGE APPROVED — YOUR LAUNCH PLAN IS READY' : phaseLabel, 40, 514);
    ctx.fillStyle = 'rgba(184,246,50,.18)'; ctx.fillRect(40, 532, 944, 12);
    ctx.fillStyle = '#b8f632'; ctx.fillRect(40, 532, 944 * progress / 100, 12);
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

  // WebXR session handling
  let xrSession = null;
  async function enterVR() {
    if (xrSession) return;
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      });
      xrSession = session;
      session.addEventListener('end', () => {
        xrSession = null;
        rig.position.set(0, 0, 0);
        camera.position.set(0, 3.1, 7.6);
        controls.enabled = true; controls.update();
        callbacks.onXRChange?.(false);
        if (finished) callbacks.onFinished?.();
      });
      const gl = renderer.getContext();
      session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, gl, {
          framebufferScaleFactor: XRWebGLLayer.getNativeFramebufferScaleFactor(session),
          antialias: true
        })
      });
      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
      controls.enabled = false;
      rig.position.set(0, 0, 4.4);
      callbacks.onXRChange?.(true);
    } catch (err) {
      console.warn('VR session failed', err);
      callbacks.onXRError?.(err);
    }
  }

  // Event timeline
  const EVENT_GAP = 1.45, START_DELAY = 1.3;
  let eventIndex = 0;
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();

  function fireEvent(i, elapsed) {
    const [who, text, pct] = events[i];
    rows.push({ who, text, warning: /critic/i.test(who) });
    progress = pct;
    phaseLabel = phaseNames[Math.min(i, phaseNames.length - 1)];
    if (i < specialists.length) {
      const s = specialists[i];
      s.spawnedAt = elapsed; s.active = true;
      s.bot.visible = true; s.label.visible = true;
      s.link.material.opacity = .3;
    }
    if (i === events.length - 1) {
      finished = true;
      setTimeout(() => {
        if (xrSession) { /* board shows completion; results shown after headset exit */ }
        else callbacks.onFinished?.();
      }, 1500);
    }
    drawBoard();
    callbacks.onEvent?.({ who, text, progress: pct, phase: phaseLabel, index: i });
  }

  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const elapsed = clock.elapsedTime;

    if (eventIndex < events.length && elapsed > START_DELAY + eventIndex * EVENT_GAP) {
      fireEvent(eventIndex, elapsed);
      eventIndex++;
    }

    coordinator.position.y = Math.sin(elapsed * 1.6) * 0.05;
    coordinator.rotation.y = Math.sin(elapsed * 0.5) * 0.25;
    hubLight.intensity = 7 + Math.sin(elapsed * 3) * 2;

    for (const s of specialists) {
      if (!s.active) continue;
      const since = elapsed - s.spawnedAt;
      const grow = Math.min(1, since / 0.6);
      const ease = 1 - Math.pow(1 - grow, 3);
      s.bot.scale.setScalar(0.8 * ease);
      s.bot.position.y = Math.sin(elapsed * 1.8 + s.offset * 6) * 0.045;
      s.beam.material.opacity = Math.max(0, 0.35 * (1 - since / 0.8));
      const t = (elapsed * 0.45 + s.offset) % 1;
      tmp.copy(hubAnchor).lerp(s.bot.position.clone().setY(0.95), t);
      s.pulse.position.copy(tmp);
      s.pulse.material.opacity = finished ? 0 : Math.sin(t * Math.PI) * 0.9;
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

  const callbacks = { onFinished: onComplete, onEvent: null, onXRChange: null, onXRError: null };

  return {
    callbacks,
    enterVR,
    async vrSupported() {
      try { return !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'); }
      catch { return false; }
    },
    isFinished: () => finished,
    dispose() {
      renderer.setAnimationLoop(null);
      if (xrSession) xrSession.end().catch(() => {});
      window.removeEventListener('resize', onResize);
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
