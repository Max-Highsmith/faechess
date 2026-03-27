/**
 * Torus Chess – 3D Torus Renderer (Three.js)
 * Maps the 8×8 board onto an actual torus surface with OrbitControls.
 */

const Torus3DRenderer = (() => {
  const R = 5;         // major radius (center of torus to center of tube)
  const r = 2.2;       // minor radius (tube radius)
  const COLS = 8;      // files (phi direction, around the ring)
  const ROWS = 8;      // ranks (theta direction, around the tube)
  const SUBDIV = 6;    // subdivisions per cell for smooth curvature
  const BG_COLOR = 0x1a1a2e;
  const LIGHT_SQ = 0xd4c89a;
  const DARK_SQ = 0x6b5b3a;

  let scene, camera, renderer, controls;
  let cellMeshes = {};
  let pieceMeshes = {};
  let highlightMeshes = [];
  let lastMoveMeshes = [];
  let checkMeshes = [];
  let raycaster, mouse;
  let onCellClick = null;
  let boardState = {};
  let tooltip = null;
  let animId = null;

  // ── Torus surface math ──────────────────────────────────────────

  function torusPos(fileF, rankF) {
    const phi = (fileF / COLS) * Math.PI * 2;
    const theta = (rankF / ROWS) * Math.PI * 2;
    return {
      x: (R + r * Math.cos(theta)) * Math.cos(phi),
      y: r * Math.sin(theta),
      z: (R + r * Math.cos(theta)) * Math.sin(phi)
    };
  }

  function torusNormal(fileF, rankF) {
    const phi = (fileF / COLS) * Math.PI * 2;
    const theta = (rankF / ROWS) * Math.PI * 2;
    const nx = Math.cos(theta) * Math.cos(phi);
    const ny = Math.sin(theta);
    const nz = Math.cos(theta) * Math.sin(phi);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return new THREE.Vector3(nx / len, ny / len, nz / len);
  }

  function cellCenter(x, y) {
    return torusPos(x + 0.5, y + 0.5);
  }

  function cellNormal(x, y) {
    return torusNormal(x + 0.5, y + 0.5);
  }

  // tangent along phi direction (for orienting pieces)
  function torusTangentPhi(fileF, rankF) {
    const phi = (fileF / COLS) * Math.PI * 2;
    const theta = (rankF / ROWS) * Math.PI * 2;
    const tx = -(R + r * Math.cos(theta)) * Math.sin(phi);
    const ty = 0;
    const tz = (R + r * Math.cos(theta)) * Math.cos(phi);
    const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
    return new THREE.Vector3(tx / len, ty / len, tz / len);
  }

  // ── Cell geometry ───────────────────────────────────────────────

  function buildCellGeometry(fileIdx, rankIdx) {
    const positions = [];
    const normals = [];
    const indices = [];
    const n = SUBDIV + 1;

    for (let j = 0; j <= SUBDIV; j++) {
      for (let i = 0; i <= SUBDIV; i++) {
        const u = fileIdx + i / SUBDIV;
        const v = rankIdx + j / SUBDIV;
        const p = torusPos(u, v);
        const norm = torusNormal(u, v);
        positions.push(p.x, p.y, p.z);
        normals.push(norm.x, norm.y, norm.z);
      }
    }

    for (let j = 0; j < SUBDIV; j++) {
      for (let i = 0; i < SUBDIV; i++) {
        const a = j * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    return geo;
  }

  function buildBoard() {
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        const isLight = (x + y) % 2 === 0;
        const geo = buildCellGeometry(x, y);
        const mat = new THREE.MeshPhongMaterial({
          color: isLight ? LIGHT_SQ : DARK_SQ,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { x, y, type: 'cell' };
        scene.add(mesh);
        cellMeshes[`${x},${y}`] = mesh;
      }
    }
  }

  function buildGridLines() {
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x000000, opacity: 0.25, transparent: true
    });
    const steps = 64;

    // file boundaries
    for (let x = 0; x < COLS; x++) {
      const pts = [];
      for (let t = 0; t <= steps; t++) {
        const p = torusPos(x, (t / steps) * ROWS);
        pts.push(new THREE.Vector3(p.x, p.y, p.z));
      }
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts), lineMat
      ));
    }
    // rank boundaries
    for (let y = 0; y < ROWS; y++) {
      const pts = [];
      for (let t = 0; t <= steps; t++) {
        const p = torusPos((t / steps) * COLS, y);
        pts.push(new THREE.Vector3(p.x, p.y, p.z));
      }
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts), lineMat
      ));
    }
  }

  // ── Piece creation (classic style) ──────────────────────────────

  function createPieceMesh(piece) {
    const group = new THREE.Group();
    const isWhite = piece.color === 'w';

    const baseGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.15, 16);
    const baseMat = new THREE.MeshPhongMaterial({
      color: isWhite ? 0xf0e6d0 : 0x2a2a2a,
      specular: 0x333333, shininess: 30
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    group.add(base);

    let bodyGeo, bodyHeight;
    switch (piece.type) {
      case 'K':
        bodyGeo = new THREE.CylinderGeometry(0.15, 0.28, 0.7, 16);
        bodyHeight = 0.55;
        const crossV = new THREE.BoxGeometry(0.06, 0.25, 0.06);
        const crossH = new THREE.BoxGeometry(0.2, 0.06, 0.06);
        const crossMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xd4af37 : 0x888888 });
        const cv = new THREE.Mesh(crossV, crossMat); cv.position.y = 1.05; group.add(cv);
        const ch = new THREE.Mesh(crossH, crossMat); ch.position.y = 1.0; group.add(ch);
        break;
      case 'Q':
        bodyGeo = new THREE.CylinderGeometry(0.12, 0.28, 0.65, 16);
        bodyHeight = 0.52;
        const crownGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const crownMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xd4af37 : 0x888888 });
        const crown = new THREE.Mesh(crownGeo, crownMat); crown.position.y = 0.9; group.add(crown);
        break;
      case 'R':
        bodyGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.55, 16);
        bodyHeight = 0.45;
        const battGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const battMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xf0e6d0 : 0x2a2a2a });
        for (let i = 0; i < 4; i++) {
          const batt = new THREE.Mesh(battGeo, battMat);
          const angle = (i / 4) * Math.PI * 2;
          batt.position.set(Math.cos(angle) * 0.15, 0.78, Math.sin(angle) * 0.15);
          group.add(batt);
        }
        break;
      case 'B':
        bodyGeo = new THREE.CylinderGeometry(0.08, 0.26, 0.6, 16);
        bodyHeight = 0.5;
        const mitreGeo = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const mitreMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xf0e6d0 : 0x2a2a2a });
        const mitre = new THREE.Mesh(mitreGeo, mitreMat); mitre.position.y = 0.85; group.add(mitre);
        break;
      case 'N':
        bodyGeo = new THREE.CylinderGeometry(0.1, 0.26, 0.5, 16);
        bodyHeight = 0.45;
        const headGeo = new THREE.BoxGeometry(0.15, 0.3, 0.25);
        const headMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xf0e6d0 : 0x2a2a2a });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0.05, 0.78, 0); head.rotation.z = -0.3; group.add(head);
        break;
      case 'P':
        bodyGeo = new THREE.CylinderGeometry(0.1, 0.22, 0.35, 16);
        bodyHeight = 0.35;
        const ballGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const ballMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xf0e6d0 : 0x2a2a2a });
        const ball = new THREE.Mesh(ballGeo, ballMat); ball.position.y = 0.6; group.add(ball);
        break;
      default:
        bodyGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.5, 16);
        bodyHeight = 0.4;
    }

    const bodyMat = new THREE.MeshPhongMaterial({
      color: isWhite ? 0xf0e6d0 : 0x2a2a2a, specular: 0x333333, shininess: 30
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = bodyHeight / 2 + 0.18;
    group.add(body);

    const ringGeo = new THREE.TorusGeometry(0.3, 0.03, 8, 16);
    const ringMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xd4af37 : 0x5555aa });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
    group.add(ring);

    return group;
  }

  // ── Place piece on torus surface ────────────────────────────────

  function placePiece(group, x, y) {
    const c = cellCenter(x, y);
    const n = cellNormal(x, y);

    group.position.set(c.x, c.y, c.z);

    // Orient: rotate default up (0,1,0) to surface normal
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, n);
    group.quaternion.copy(quat);

    // Offset piece up along normal so base sits on surface
    group.position.addScaledVector(n, 0.02);
  }

  // ── Public API ──────────────────────────────────────────────────

  function init(container, clickCallback) {
    onCellClick = clickCallback;
    tooltip = document.getElementById('tooltip');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_COLOR);

    const w = window.innerWidth - 260;
    const h = window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    camera.position.set(0, 10, 14);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.marginLeft = '260px';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.display = 'none';
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 30;
    controls.update();

    // Lighting — ambient + two directional for inner/outer visibility
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const light1 = new THREE.DirectionalLight(0xffffff, 0.7);
    light1.position.set(10, 20, 10);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 0.35);
    light2.position.set(-10, -15, -10);
    scene.add(light2);

    // Accent light
    const accent = new THREE.PointLight(0x7fdbca, 0.3, 50);
    accent.position.set(0, 8, 0);
    scene.add(accent);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    buildBoard();
    buildGridLines();

    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    animate();
  }

  function show() {
    if (renderer) {
      renderer.domElement.style.display = 'block';
      onResize();
    }
  }

  function hide() {
    if (renderer) renderer.domElement.style.display = 'none';
  }

  function updatePieces(board) {
    // Remove old pieces
    for (const k of Object.keys(pieceMeshes)) {
      scene.remove(pieceMeshes[k]);
    }
    pieceMeshes = {};
    boardState = board;

    // Approximate cell arc length for scaling
    const cellArc = (2 * Math.PI * r) / ROWS;
    const scale = cellArc * 0.32;

    for (const k of Object.keys(board)) {
      const [x, y] = window.TorusGameModule.parseKey(k);
      const piece = board[k];
      const mesh = createPieceMesh(piece);
      mesh.scale.setScalar(scale);
      placePiece(mesh, x, y);

      mesh.traverse(child => {
        if (child.isMesh) {
          child.userData = { x, y, type: 'piece', piece };
        }
      });

      scene.add(mesh);
      pieceMeshes[k] = mesh;
    }
  }

  // ── Highlights ──────────────────────────────────────────────────

  function highlightCells(keys, type) {
    if (type === 'selected') {
      // Remove only selection highlights
      highlightMeshes = highlightMeshes.filter(m => {
        if (m.userData.hlType === 'selected') { scene.remove(m); return false; }
        return true;
      });
    } else {
      // Remove move highlights
      highlightMeshes = highlightMeshes.filter(m => {
        if (m.userData.hlType === 'move') { scene.remove(m); return false; }
        return true;
      });
    }

    for (const [x, y] of keys) {
      if (type === 'selected') {
        const geo = buildCellGeometry(x, y);
        const mat = new THREE.MeshPhongMaterial({
          color: 0x44aaff, transparent: true, opacity: 0.5,
          emissive: 0x44aaff, emissiveIntensity: 0.3,
          side: THREE.DoubleSide, depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { x, y, type: 'highlight', hlType: 'selected' };
        scene.add(mesh);
        highlightMeshes.push(mesh);
      } else {
        // Legal move indicator
        const c = cellCenter(x, y);
        const n = cellNormal(x, y);
        const hasCapture = boardState[window.TorusGameModule.key(x, y)];
        if (hasCapture) {
          // Capture ring
          const geo = new THREE.TorusGeometry(0.35, 0.06, 8, 24);
          const mat = new THREE.MeshPhongMaterial({
            color: 0x44ff88, transparent: true, opacity: 0.6,
            emissive: 0x44ff88, emissiveIntensity: 0.3
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(c.x + n.x * 0.08, c.y + n.y * 0.08, c.z + n.z * 0.08);
          // Orient ring to face along surface normal
          const up = new THREE.Vector3(0, 0, 1);
          mesh.quaternion.setFromUnitVectors(up, n);
          mesh.userData = { x, y, type: 'highlight', hlType: 'move' };
          scene.add(mesh);
          highlightMeshes.push(mesh);
        } else {
          // Move dot
          const geo = new THREE.SphereGeometry(0.15, 12, 12);
          const mat = new THREE.MeshPhongMaterial({
            color: 0x44ff88, transparent: true, opacity: 0.6,
            emissive: 0x44ff88, emissiveIntensity: 0.3
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(c.x + n.x * 0.18, c.y + n.y * 0.18, c.z + n.z * 0.18);
          mesh.userData = { x, y, type: 'highlight', hlType: 'move', baseOffset: 0.18 };
          scene.add(mesh);
          highlightMeshes.push(mesh);
        }
      }
    }
  }

  function highlightCheck(x, y) {
    clearCheck();
    const geo = buildCellGeometry(x, y);
    const mat = new THREE.MeshPhongMaterial({
      color: 0xff4444, transparent: true, opacity: 0.55,
      emissive: 0xff4444, emissiveIntensity: 0.4,
      side: THREE.DoubleSide, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { x, y, type: 'check' };
    scene.add(mesh);
    checkMeshes.push(mesh);
  }

  function clearCheck() {
    for (const m of checkMeshes) scene.remove(m);
    checkMeshes = [];
  }

  function clearHighlights() {
    for (const m of highlightMeshes) scene.remove(m);
    highlightMeshes = [];
    clearCheck();
  }

  function highlightLastMove(from, to) {
    clearLastMove();
    // "From" cell - orange overlay
    const geoFrom = buildCellGeometry(from[0], from[1]);
    const matFrom = new THREE.MeshPhongMaterial({
      color: 0xe07030, transparent: true, opacity: 0.4,
      emissive: 0xe07030, emissiveIntensity: 0.2,
      side: THREE.DoubleSide, depthWrite: false
    });
    const mFrom = new THREE.Mesh(geoFrom, matFrom);
    mFrom.userData = { type: 'lastMove' };
    scene.add(mFrom);
    lastMoveMeshes.push(mFrom);

    // "To" cell - yellow overlay
    const geoTo = buildCellGeometry(to[0], to[1]);
    const matTo = new THREE.MeshPhongMaterial({
      color: 0xffdd33, transparent: true, opacity: 0.45,
      emissive: 0xffdd33, emissiveIntensity: 0.2,
      side: THREE.DoubleSide, depthWrite: false
    });
    const mTo = new THREE.Mesh(geoTo, matTo);
    mTo.userData = { type: 'lastMove' };
    scene.add(mTo);
    lastMoveMeshes.push(mTo);
  }

  function clearLastMove() {
    for (const m of lastMoveMeshes) scene.remove(m);
    lastMoveMeshes = [];
  }

  // ── Raycasting & interaction ────────────────────────────────────

  function onMouseClick(event) {
    if (!onCellClick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const targets = [];
    scene.traverse(child => {
      if (child.isMesh && child.userData.type) targets.push(child);
    });
    const hits = raycaster.intersectObjects(targets);

    if (hits.length > 0) {
      const { x, y } = hits[0].object.userData;
      if (x !== undefined && y !== undefined) onCellClick(x, y);
    }
  }

  function onMouseMove(event) {
    if (!tooltip || !renderer) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const targets = [];
    scene.traverse(child => {
      if (child.isMesh && child.userData.type === 'piece') targets.push(child);
    });
    const hits = raycaster.intersectObjects(targets);

    if (hits.length > 0) {
      const ud = hits[0].object.userData;
      if (ud.piece) {
        const sym = window.TorusGameModule.PIECE_SYMBOLS[ud.piece.type][ud.piece.color];
        const name = window.TorusGameModule.PIECE_NAMES[ud.piece.type];
        const colorName = ud.piece.color === 'w' ? 'White' : 'Black';
        const coord = window.TorusGameModule.coordToNotation(ud.x, ud.y);
        tooltip.style.display = 'block';
        tooltip.style.left = (event.clientX + 12) + 'px';
        tooltip.style.top = (event.clientY - 8) + 'px';
        tooltip.textContent = `${sym} ${colorName} ${name} (${coord})`;
        return;
      }
    }
    tooltip.style.display = 'none';
  }

  function onResize() {
    if (!renderer || renderer.domElement.style.display === 'none') return;
    const w = window.innerWidth - 260;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    if (!renderer || renderer.domElement.style.display === 'none') return;

    controls.update();

    // Bob move-target dots
    const t = Date.now() * 0.003;
    for (const m of highlightMeshes) {
      if (m.userData.hlType === 'move' && m.userData.baseOffset !== undefined) {
        const { x, y, baseOffset } = m.userData;
        const c = cellCenter(x, y);
        const n = cellNormal(x, y);
        const off = baseOffset + Math.sin(t) * 0.06;
        m.position.set(c.x + n.x * off, c.y + n.y * off, c.z + n.z * off);
      }
    }

    renderer.render(scene, camera);
  }

  return {
    init, updatePieces, highlightCells, highlightCheck,
    clearHighlights, highlightLastMove, clearLastMove,
    show, hide
  };
})();

export default Torus3DRenderer;
window.Torus3DRenderer = Torus3DRenderer;
