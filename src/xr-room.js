import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sfx } from './audio.js';

// "Night ops" palette — matches the web app: deep navy, amber signal, cobalt action.
const INK = 0x0d1424, AMBER = 0xe8a33d, COBALT = 0x5c7cff, CORAL = 0xff7a5c, TEALC = 0x46c8b4;
const SHELL = 0x93a0b5, FACE = 0xe8ecf4, TRIM = 0x39445c;
const ACCENTS = [COBALT, TEALC, AMBER, COBALT, CORAL, TEALC, AMBER];

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
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.xr.enabled = true;
  // Sharpness in VR: render at a higher framebuffer scale and disable fixed
  // foveation, which otherwise blurs everything away from the lens centre.
  renderer.xr.setFramebufferScaleFactor(1.2);
  renderer.xr.setFoveation(0);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.Fog(INK, 9, 26);

  const rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 60);
  camera.position.set(0, 3.1, 7.6);
  rig.add(camera);
  scene.add(rig);

  scene.add(new THREE.HemisphereLight(0x2a3450, 0x05070f, 1.4));
  const key = new THREE.DirectionalLight(0xe8ecf7, 1.5);
  key.position.set(3, 6, 4); scene.add(key);
  const hubLight = new THREE.PointLight(AMBER, 8, 9); hubLight.position.set(0, 2.4, 0); scene.add(hubLight);

  // Floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 48), new THREE.MeshStandardMaterial({ color: 0x0a101f, roughness: .9 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new THREE.GridHelper(30, 34, 0x232f4a, 0x141c30);
  grid.position.y = 0.005; scene.add(grid);
  for (const [radius, opacity] of [[2.9, .5], [0.85, .8]]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.045, 64),
      new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  }

  // Coordinator — the robot you hold and talk to
  const coordinator = buildBot(AMBER, 1.15);
  scene.add(coordinator);
  const hubLabel = makeLabelSprite('HUB', 'Coordinator', AMBER);
  hubLabel.position.set(0, 2.45, 0); scene.add(hubLabel);
  const hubAnchor = new THREE.Vector3(0, 1.15, 0);

  // Listening halo shown while the mic is open
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.7, 48),
    new THREE.MeshBasicMaterial({ color: TEALC, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05; scene.add(halo);

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

  // Floating join-code panel so headset users can read the code anywhere in the room
  let codeSprite = null;
  function showCodePanel(code) {
    if (codeSprite) { scene.remove(codeSprite); codeSprite.material.map.dispose(); codeSprite.material.dispose(); }
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 224;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(13,20,36,.88)'; ctx.fillRect(0, 0, 512, 224);
    ctx.strokeStyle = 'rgba(232,163,61,.65)'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, 502, 214);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8d97ad'; ctx.font = '700 30px sans-serif';
    ctx.fillText('JOIN ON MOBILE', 256, 62);
    ctx.fillStyle = '#e8a33d'; ctx.font = '700 104px sans-serif';
    ctx.fillText(code.split('').join(' '), 256, 172);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    codeSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    codeSprite.scale.set(1.5, 0.65, 1);
    codeSprite.position.set(2.1, 1.7, -1.4);
    scene.add(codeSprite);
  }

  // Run state — nothing plays until begin() is called
  let specialists = [];
  let events = [];
  let timelineStart = -1;
  let eventIndex = 0;
  let finished = false;
  let listening = false;
  let statusText = 'HOLD ME AND SPEAK — OR TYPE YOUR BRIEF BELOW';
  let briefLine = brief ? `${brief.type.toUpperCase()} · ${money(brief.budget)}` : 'AWAITING YOUR BRIEF';
  let sessionCode = null;
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
      ctx.fillStyle = listening ? '#46c8b4' : '#e8ecf4';
      ctx.font = '700 52px sans-serif';
      ctx.fillText(listening ? '● LISTENING…' : 'TALK TO ME', 512, 268);
      ctx.fillStyle = '#8d97ad'; ctx.font = '500 27px sans-serif';
      const lines = statusText.length > 52
        ? [statusText.slice(0, statusText.lastIndexOf(' ', 52)), statusText.slice(statusText.lastIndexOf(' ', 52) + 1)]
        : [statusText];
      lines.forEach((line, i) => ctx.fillText(line, 512, 330 + i * 38));
      ctx.fillStyle = '#626d84'; ctx.font = '600 20px sans-serif';
      ctx.fillText('TELL ME YOUR BUSINESS, BUDGET AND LOCATION', 512, 448);
      if (sessionCode) {
        ctx.fillStyle = '#e8a33d'; ctx.font = '700 30px sans-serif';
        ctx.fillText(`JOIN ON MOBILE · CODE  ${sessionCode.split('').join(' ')}`, 512, 512);
      }
      ctx.textAlign = 'left';
    } else {
      let y = 136;
      for (const row of rows.slice(-6)) {
        ctx.fillStyle = row.warning ? '#ff966e' : '#46c8b4';
        ctx.font = '700 26px sans-serif';
        ctx.fillText(row.who.toUpperCase(), 40, y);
        ctx.fillStyle = '#aab3c6'; ctx.font = '400 25px sans-serif';
        ctx.fillText(row.text.length > 62 ? row.text.slice(0, 61) + '…' : row.text, 240, y);
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
  const controllerRotation = new THREE.Matrix4();
  function controllerHitsCoordinator(controller) {
    controllerRotation.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(controllerRotation);
    return raycaster.intersectObject(coordinator, true).length > 0;
  }
  const onSelectStart = event => {
    const controller = event.target;
    if (!controllerHitsCoordinator(controller)) return;
    controller.userData.holdingCoordinator = true;
    sfx.play('hold', 0.55);
    callbacks.onHoldStart?.();
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
      new THREE.LineBasicMaterial({ color: COBALT, transparent: true, opacity: 0.5 })
    );
    ray.scale.z = 6;
    controller.add(ray);
    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);
    rig.add(controller);
    return controller;
  });
  async function enterVR() {
    if (xrSession) return;
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      });
      xrSession = session;
      session.addEventListener('end', () => {
        for (const controller of controllers) {
          if (controller.userData.holdingCoordinator) {
            controller.userData.holdingCoordinator = false;
            callbacks.onHoldEnd?.();
          }
        }
        xrSession = null;
        rig.position.set(0, 0, 0);
        camera.position.set(0, 3.1, 7.6);
        controls.enabled = true; controls.update();
        callbacks.onXRChange?.(false);
        if (finished) callbacks.onFinished?.();
      });
      // three.js creates its own base layer using the framebuffer scale factor
      // configured above — setting one manually here would fight it.
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

  const timer = new THREE.Timer();
  timer.connect(document);
  const tmp = new THREE.Vector3();
  const EVENT_GAP = 1.45;

  function buildSpecialists(agents) {
    return agents.map((agent, i) => {
      const angle = -Math.PI / 2 + (i + 0.5) * (Math.PI * 2 / agents.length);
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
  }

  function fireEvent(i, elapsed) {
    const [who, text, pct] = events[i];
    rows.push({ who, text, warning: /critic/i.test(who) });
    progress = pct;
    phaseLabel = phaseNames[Math.min(phaseNames.length - 1, Math.floor(i / Math.max(1, events.length - 1) * (phaseNames.length - 1)))];
    if (i < specialists.length) {
      const s = specialists[i];
      s.spawnedAt = elapsed; s.active = true;
      s.bot.visible = true; s.label.visible = true;
      s.link.material.opacity = .3;
      sfx.play('spawn', 0.5);
    } else {
      sfx.play('event', 0.3);
    }
    if (i === events.length - 1) {
      finished = true;
      sfx.play('complete', 0.65);
      setTimeout(() => { if (!xrSession) callbacks.onFinished?.(); }, 1500);
    }
    drawBoard();
    callbacks.onEvent?.({ who, text, progress: pct, phase: phaseLabel, index: i });
  }

  renderer.setAnimationLoop(timestamp => {
    timer.update(timestamp);
    const dt = timer.getDelta();
    const elapsed = timer.getElapsed();

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

  return {
    callbacks,
    enterVR,
    async vrSupported() {
      try { return !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'); }
      catch { return false; }
    },
    isRunning: () => timelineStart >= 0,
    isFinished: () => finished,
    /** Start the swarm run. Call once, after the user has given their brief. */
    begin(scenario, timeline, newBrief) {
      if (timelineStart >= 0) return;
      specialists = buildSpecialists(scenario.agents);
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
    setSessionCode(code) {
      sessionCode = String(code).toUpperCase();
      showCodePanel(sessionCode);
      drawBoard();
    },
    setListening(value) {
      listening = Boolean(value);
      if (listening && timelineStart < 0) statusText = 'RELEASE WHEN YOU HAVE FINISHED SPEAKING';
      drawBoard();
    },
    dispose() {
      renderer.setAnimationLoop(null);
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
