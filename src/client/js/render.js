/**
 * Raumschach – Three.js Rendering & Interaction
 */

const BoardRenderer = (() => {
  const BOARD_SIZE = 5;
  const CELL_SIZE = 1.0;
  const LEVEL_GAP = 3.0;
  const BOARD_OFFSET = (BOARD_SIZE - 1) * CELL_SIZE / 2;

  let scene, camera, renderer, controls;
  let cellMeshes = {};
  let pieceMeshes = {};
  let highlightMeshes = [];
  let lastMoveMeshes = [];
  let raycaster, mouse;
  let onCellClick = null;
  let hoverKey = null;
  let tooltip = null;
  let currentSkin = 'classic';
  let viewMode = 'xy'; // 'xy' (row,col by layer), 'xz' (row,layer by col), 'yz' (col,layer by row)

  // Layer tint colors: red, orange, yellow, green, blue (bottom to top)
  const LAYER_TINTS = [
    new THREE.Color(0xff4444), // red
    new THREE.Color(0xff8c00), // orange
    new THREE.Color(0xffdd00), // yellow
    new THREE.Color(0x44cc44), // green
    new THREE.Color(0x4488ff), // blue
  ];
  const LAYER_TINT_STRENGTH = 0.18;

  function cellWorldPos(x, y, z) {
    let worldX, worldY, worldZ;

    switch (viewMode) {
      case 'xy': // Boards show (x, y), stacked by z (current default)
        worldX = x * CELL_SIZE - BOARD_OFFSET;
        worldY = z * LEVEL_GAP;
        worldZ = y * CELL_SIZE - BOARD_OFFSET;
        break;
      case 'xz': // Boards show (x, z), stacked by y
        worldX = x * CELL_SIZE - BOARD_OFFSET;
        worldY = y * LEVEL_GAP;
        worldZ = z * CELL_SIZE - BOARD_OFFSET;
        break;
      case 'yz': // Boards show (y, z), stacked by x
        worldX = y * CELL_SIZE - BOARD_OFFSET;
        worldY = x * LEVEL_GAP;
        worldZ = z * CELL_SIZE - BOARD_OFFSET;
        break;
      default:
        worldX = x * CELL_SIZE - BOARD_OFFSET;
        worldY = z * LEVEL_GAP;
        worldZ = y * CELL_SIZE - BOARD_OFFSET;
    }

    return new THREE.Vector3(worldX, worldY, worldZ);
  }

  // ── Skin: Classic ──────────────────────────────────────────────

  function createPieceMeshClassic(piece) {
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
      case 'U':
        bodyGeo = new THREE.CylinderGeometry(0.1, 0.26, 0.55, 16);
        bodyHeight = 0.47;
        const hornGeo = new THREE.ConeGeometry(0.06, 0.35, 8);
        const hornMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xd4af37 : 0x7777cc });
        const horn = new THREE.Mesh(hornGeo, hornMat); horn.position.y = 0.95; group.add(horn);
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
    body.castShadow = true;
    group.add(body);

    const ringGeo = new THREE.TorusGeometry(0.3, 0.03, 8, 16);
    const ringMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xd4af37 : 0x5555aa });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
    group.add(ring);

    return group;
  }

  // ── Skin: Minimal ─────────────────────────────────────────────

  function createPieceMeshMinimal(piece) {
    const group = new THREE.Group();
    const isWhite = piece.color === 'w';

    const discGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 24);
    const discMat = new THREE.MeshPhongMaterial({
      color: isWhite ? 0xf0e6d0 : 0x2a2a2a, specular: 0x222222, shininess: 20
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.1;
    group.add(disc);

    // Canvas label
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = isWhite ? '#2a2a2a' : '#f0e6d0';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(piece.type, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const labelGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const labelMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.16;
    group.add(label);

    const ringGeo = new THREE.TorusGeometry(0.36, 0.025, 8, 24);
    const ringMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xd4af37 : 0x5555aa });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.1;
    group.add(ring);

    return group;
  }

  // ── Skin: Abstract ─────────────────────────────────────────────

  function createPieceMeshAbstract(piece) {
    const group = new THREE.Group();
    const isWhite = piece.color === 'w';
    const mainColor = isWhite ? 0xf0e6d0 : 0x2a2a2a;
    const accentColor = isWhite ? 0xd4af37 : 0x5555aa;

    const config = {
      K: { r: 0.30, h: 0.90, accent: true, ar: 0.10, ay: 1.05 },
      Q: { r: 0.28, h: 0.85, accent: true, ar: 0.12, ay: 0.95 },
      R: { r: 0.28, h: 0.65, accent: false },
      B: { r: 0.22, h: 0.75, accent: true, ar: 0.07, ay: 0.88 },
      N: { r: 0.24, h: 0.70, accent: false },
      U: { r: 0.24, h: 0.72, accent: true, ar: 0.06, ay: 0.92 },
      P: { r: 0.20, h: 0.50, accent: false }
    }[piece.type] || { r: 0.25, h: 0.6, accent: false };

    const mat = new THREE.MeshPhongMaterial({
      color: mainColor, specular: 0x444444, shininess: 60
    });

    const sphereGeo = new THREE.SphereGeometry(config.r, 16, 16);
    const sphere = new THREE.Mesh(sphereGeo, mat);
    sphere.scale.y = config.h / config.r;
    sphere.position.y = config.h / 2 + 0.1;
    sphere.castShadow = true;
    group.add(sphere);

    if (config.accent) {
      const aGeo = new THREE.SphereGeometry(config.ar, 12, 12);
      const aMat = new THREE.MeshPhongMaterial({
        color: accentColor, emissive: accentColor, emissiveIntensity: 0.2
      });
      const aSphere = new THREE.Mesh(aGeo, aMat);
      aSphere.position.y = config.ay;
      group.add(aSphere);
    }

    const ringGeo = new THREE.TorusGeometry(config.r + 0.05, 0.025, 8, 16);
    const ringMat = new THREE.MeshPhongMaterial({ color: accentColor });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
    group.add(ring);

    return group;
  }

  // ── Skin: Greek Mythology ──────────────────────────────────────

  function createPieceMeshGreek(piece) {
    const group = new THREE.Group();
    const isWhite = piece.color === 'w';

    // Color scheme: White = Marble/Gold, Black = Bronze/Deep Blue
    const marbleColor = 0xf5f5dc;
    const goldColor = 0xd4af37;
    const bronzeColor = 0x8b4513;
    const darkBlueColor = 0x1a1a3e;

    const mainColor = isWhite ? marbleColor : bronzeColor;
    const accentColor = isWhite ? goldColor : darkBlueColor;

    switch (piece.type) {
      case 'K': // ZEUS - King of the Gods
        // Throne base
        const throneBase = new THREE.BoxGeometry(0.6, 0.15, 0.6);
        const throneBaseMat = new THREE.MeshPhongMaterial({
          color: accentColor, specular: 0x444444, shininess: 60
        });
        const throneBaseMesh = new THREE.Mesh(throneBase, throneBaseMat);
        throneBaseMesh.position.y = 0.1;
        group.add(throneBaseMesh);

        // Throne pillars (4 corners)
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const pillarGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8);
          const pillarMat = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 40 });
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(Math.cos(angle) * 0.22, 0.4, Math.sin(angle) * 0.22);
          group.add(pillar);
        }

        // Main body (seated figure)
        const bodyGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.45, 12);
        const bodyMat = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 40 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        group.add(body);

        // Crown/Head
        const headGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.y = 0.82;
        group.add(head);

        // Laurel crown
        const crownGeo = new THREE.TorusGeometry(0.13, 0.02, 8, 12);
        const crownMat = new THREE.MeshPhongMaterial({
          color: goldColor, emissive: goldColor, emissiveIntensity: 0.1
        });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.rotation.x = Math.PI / 2;
        crown.position.y = 0.88;
        group.add(crown);

        // Lightning bolt
        const boltGeo = new THREE.ConeGeometry(0.04, 0.35, 6);
        const boltMat = new THREE.MeshPhongMaterial({
          color: 0xffff66, emissive: 0xffff00, emissiveIntensity: 0.3
        });
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.set(0.18, 0.6, 0);
        bolt.rotation.z = -Math.PI / 6;
        group.add(bolt);
        break;

      case 'Q': // HERA - Queen of the Gods
        // Ornate base
        const queenBase = new THREE.CylinderGeometry(0.35, 0.4, 0.12, 16);
        const queenBaseMat = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 50 });
        const queenBaseMesh = new THREE.Mesh(queenBase, queenBaseMat);
        queenBaseMesh.position.y = 0.1;
        group.add(queenBaseMesh);

        // Dress/Robe (flowing)
        const robeGeo = new THREE.CylinderGeometry(0.12, 0.28, 0.55, 16);
        const robeMat = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 40 });
        const robe = new THREE.Mesh(robeGeo, robeMat);
        robe.position.y = 0.45;
        group.add(robe);

        // Upper body
        const qBodyGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.25, 12);
        const qBody = new THREE.Mesh(qBodyGeo, robeMat);
        qBody.position.y = 0.82;
        group.add(qBody);

        // Head
        const qHeadGeo = new THREE.SphereGeometry(0.1, 12, 12);
        const qHead = new THREE.Mesh(qHeadGeo, robeMat);
        qHead.position.y = 1.0;
        group.add(qHead);

        // Ornate crown with points
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const pointGeo = new THREE.ConeGeometry(0.03, 0.15, 6);
          const pointMat = new THREE.MeshPhongMaterial({
            color: goldColor, emissive: goldColor, emissiveIntensity: 0.1
          });
          const point = new THREE.Mesh(pointGeo, pointMat);
          point.position.set(Math.cos(angle) * 0.11, 1.13, Math.sin(angle) * 0.11);
          group.add(point);
        }

        // Peacock feather accent
        const featherGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const featherMat = new THREE.MeshPhongMaterial({
          color: isWhite ? 0x4169e1 : 0x00ced1,
          emissive: 0x000080, emissiveIntensity: 0.2
        });
        const feather = new THREE.Mesh(featherGeo, featherMat);
        feather.scale.set(0.5, 1, 0.5);
        feather.position.set(0.15, 0.95, 0);
        group.add(feather);
        break;

      case 'R': // TEMPLE - Greek Column/Architecture
        // Column base (wider)
        const colBaseGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.1, 12);
        const colBaseMat = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 30 });
        const colBase = new THREE.Mesh(colBaseGeo, colBaseMat);
        colBase.position.y = 0.08;
        group.add(colBase);

        // Fluted column shaft
        const colShaftGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.7, 16);
        const colShaft = new THREE.Mesh(colShaftGeo, colBaseMat);
        colShaft.position.y = 0.48;
        group.add(colShaft);

        // Add fluting detail (vertical grooves)
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const grooveGeo = new THREE.BoxGeometry(0.02, 0.7, 0.25);
          const grooveMat = new THREE.MeshPhongMaterial({
            color: isWhite ? 0xe0e0d0 : 0x6b4423, shininess: 20
          });
          const groove = new THREE.Mesh(grooveGeo, grooveMat);
          groove.position.set(Math.cos(angle) * 0.24, 0.48, Math.sin(angle) * 0.24);
          groove.lookAt(new THREE.Vector3(0, 0.48, 0));
          group.add(groove);
        }

        // Capital (ornate top)
        const capitalGeo = new THREE.CylinderGeometry(0.35, 0.24, 0.12, 12);
        const capitalMat = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 50 });
        const capital = new THREE.Mesh(capitalGeo, capitalMat);
        capital.position.y = 0.88;
        group.add(capital);

        // Architrave (top piece)
        const architraveGeo = new THREE.BoxGeometry(0.5, 0.08, 0.5);
        const architrave = new THREE.Mesh(architraveGeo, capitalMat);
        architrave.position.y = 0.98;
        group.add(architrave);
        break;

      case 'B': // ORACLE/PRIEST - Robed Figure with Staff
        // Base platform
        const oracleBaseGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.1, 12);
        const oracleBaseMat = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 40 });
        const oracleBase = new THREE.Mesh(oracleBaseGeo, oracleBaseMat);
        oracleBase.position.y = 0.08;
        group.add(oracleBase);

        // Flowing robe (tall and narrow)
        const oRobeGeo = new THREE.CylinderGeometry(0.08, 0.24, 0.65, 12);
        const oRobeMat = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 35 });
        const oRobe = new THREE.Mesh(oRobeGeo, oRobeMat);
        oRobe.position.y = 0.5;
        group.add(oRobe);

        // Head with hood
        const oHeadGeo = new THREE.SphereGeometry(0.09, 10, 10);
        const oHead = new THREE.Mesh(oHeadGeo, oRobeMat);
        oHead.position.y = 0.88;
        group.add(oHead);

        // Pointed hood
        const hoodGeo = new THREE.ConeGeometry(0.11, 0.2, 8);
        const hood = new THREE.Mesh(hoodGeo, oRobeMat);
        hood.position.y = 0.98;
        group.add(hood);

        // Oracle staff
        const staffGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6);
        const staffMat = new THREE.MeshPhongMaterial({
          color: isWhite ? 0x8b7355 : 0x4a4a4a, shininess: 20
        });
        const staff = new THREE.Mesh(staffGeo, staffMat);
        staff.position.set(0.15, 0.6, 0);
        group.add(staff);

        // Staff crystal top
        const crystalGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const crystalMat = new THREE.MeshPhongMaterial({
          color: isWhite ? 0x9370db : 0x4b0082,
          emissive: 0x8a2be2, emissiveIntensity: 0.3, transparent: true, opacity: 0.8
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.set(0.15, 1.0, 0);
        group.add(crystal);
        break;

      case 'N': // PEGASUS - Winged Horse
        // Horse body (lower)
        const horseBodyGeo = new THREE.BoxGeometry(0.2, 0.18, 0.35);
        const horseMat = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 35 });
        const horseBody = new THREE.Mesh(horseBodyGeo, horseMat);
        horseBody.position.y = 0.35;
        group.add(horseBody);

        // Four legs
        for (let i = 0; i < 4; i++) {
          const legGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.3, 6);
          const leg = new THREE.Mesh(legGeo, horseMat);
          const x = (i % 2) * 0.12 - 0.06;
          const z = Math.floor(i / 2) * 0.22 - 0.11;
          leg.position.set(x, 0.18, z);
          group.add(leg);
        }

        // Neck
        const neckGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8);
        const neck = new THREE.Mesh(neckGeo, horseMat);
        neck.position.set(0, 0.55, -0.15);
        neck.rotation.z = 0.3;
        group.add(neck);

        // Head
        const horseHeadGeo = new THREE.BoxGeometry(0.12, 0.15, 0.12);
        const horseHead = new THREE.Mesh(horseHeadGeo, horseMat);
        horseHead.position.set(0, 0.72, -0.2);
        group.add(horseHead);

        // Wings (left and right)
        for (let side = -1; side <= 1; side += 2) {
          const wingGeo = new THREE.BoxGeometry(0.25, 0.08, 0.18);
          const wingMat = new THREE.MeshPhongMaterial({
            color: isWhite ? 0xffffff : 0x2a2a4a,
            emissive: accentColor, emissiveIntensity: 0.1, shininess: 50
          });
          const wing = new THREE.Mesh(wingGeo, wingMat);
          wing.position.set(side * 0.18, 0.42, 0);
          wing.rotation.y = side * 0.3;
          wing.rotation.z = side * 0.4;
          group.add(wing);
        }

        // Mane
        const maneGeo = new THREE.BoxGeometry(0.08, 0.15, 0.06);
        const maneMat = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 40 });
        const mane = new THREE.Mesh(maneGeo, maneMat);
        mane.position.set(0, 0.65, -0.15);
        group.add(mane);
        break;

      case 'U': // CHIRON - Wise Centaur
        // Horse lower body
        const cBodyGeo = new THREE.BoxGeometry(0.22, 0.16, 0.32);
        const cMat = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 35 });
        const cBody = new THREE.Mesh(cBodyGeo, cMat);
        cBody.position.y = 0.28;
        group.add(cBody);

        // Four legs
        for (let i = 0; i < 4; i++) {
          const cLegGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.25, 6);
          const cLeg = new THREE.Mesh(cLegGeo, cMat);
          const x = (i % 2) * 0.13 - 0.065;
          const z = Math.floor(i / 2) * 0.2 - 0.1;
          cLeg.position.set(x, 0.15, z);
          group.add(cLeg);
        }

        // Human torso (rising from horse body)
        const torsoGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.35, 10);
        const torso = new THREE.Mesh(torsoGeo, cMat);
        torso.position.y = 0.6;
        group.add(torso);

        // Arms
        for (let side = -1; side <= 1; side += 2) {
          const armGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6);
          const arm = new THREE.Mesh(armGeo, cMat);
          arm.position.set(side * 0.12, 0.55, 0);
          arm.rotation.z = side * 0.5;
          group.add(arm);
        }

        // Head
        const cHeadGeo = new THREE.SphereGeometry(0.09, 10, 10);
        const cHead = new THREE.Mesh(cHeadGeo, cMat);
        cHead.position.y = 0.85;
        group.add(cHead);

        // Beard
        const beardGeo = new THREE.ConeGeometry(0.06, 0.12, 6);
        const beardMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0xc0c0c0 : 0x4a4a4a });
        const beard = new THREE.Mesh(beardGeo, beardMat);
        beard.position.y = 0.78;
        group.add(beard);

        // Wise staff with constellation
        const cStaffGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6);
        const cStaffMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0x8b7355 : 0x4a4a4a });
        const cStaff = new THREE.Mesh(cStaffGeo, cStaffMat);
        cStaff.position.set(-0.18, 0.6, 0);
        group.add(cStaff);

        // Star on staff
        const starGeo = new THREE.SphereGeometry(0.05, 6, 6);
        const starMat = new THREE.MeshPhongMaterial({
          color: 0xffffaa, emissive: 0xffff00, emissiveIntensity: 0.4
        });
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.set(-0.18, 0.95, 0);
        group.add(star);
        break;

      case 'P': // HOPLITE - Greek Warrior
        // Base/feet
        const hopBaseGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.08, 10);
        const hopBaseMat = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 40 });
        const hopBase = new THREE.Mesh(hopBaseGeo, hopBaseMat);
        hopBase.position.y = 0.06;
        group.add(hopBase);

        // Body (warrior in armor)
        const warriorGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.4, 10);
        const warriorMat = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 40 });
        const warrior = new THREE.Mesh(warriorGeo, warriorMat);
        warrior.position.y = 0.35;
        group.add(warrior);

        // Head
        const wHeadGeo = new THREE.SphereGeometry(0.08, 10, 10);
        const wHead = new THREE.Mesh(wHeadGeo, warriorMat);
        wHead.position.y = 0.62;
        group.add(wHead);

        // Corinthian helmet
        const helmetGeo = new THREE.SphereGeometry(0.09, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const helmetMat = new THREE.MeshPhongMaterial({
          color: isWhite ? 0xb8860b : 0x4a4a4a, shininess: 60
        });
        const helmet = new THREE.Mesh(helmetGeo, helmetMat);
        helmet.position.y = 0.66;
        group.add(helmet);

        // Helmet crest
        const crestGeo = new THREE.BoxGeometry(0.04, 0.15, 0.12);
        const crestMat = new THREE.MeshPhongMaterial({
          color: isWhite ? 0xdc143c : 0x8b0000
        });
        const crest = new THREE.Mesh(crestGeo, crestMat);
        crest.position.y = 0.75;
        group.add(crest);

        // Round shield (aspis)
        const shieldGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16);
        const shieldMat = new THREE.MeshPhongMaterial({
          color: isWhite ? 0xb8860b : 0x8b4513, shininess: 50
        });
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.rotation.x = Math.PI / 2;
        shield.position.set(-0.12, 0.35, 0.05);
        group.add(shield);

        // Shield emblem (lambda Λ symbol)
        const emblemGeo = new THREE.BoxGeometry(0.02, 0.12, 0.02);
        const emblemMat = new THREE.MeshPhongMaterial({ color: 0x8b0000 });
        const emblem1 = new THREE.Mesh(emblemGeo, emblemMat);
        emblem1.rotation.x = Math.PI / 2;
        emblem1.rotation.z = 0.4;
        emblem1.position.set(-0.12, 0.35, 0.09);
        group.add(emblem1);
        const emblem2 = new THREE.Mesh(emblemGeo, emblemMat);
        emblem2.rotation.x = Math.PI / 2;
        emblem2.rotation.z = -0.4;
        emblem2.position.set(-0.12, 0.35, 0.09);
        group.add(emblem2);

        // Spear
        const spearGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6);
        const spearMat = new THREE.MeshPhongMaterial({ color: isWhite ? 0x8b7355 : 0x3a3a3a });
        const spear = new THREE.Mesh(spearGeo, spearMat);
        spear.position.set(0.15, 0.5, 0);
        group.add(spear);

        // Spear tip
        const tipGeo = new THREE.ConeGeometry(0.03, 0.1, 6);
        const tipMat = new THREE.MeshPhongMaterial({ color: 0xc0c0c0, shininess: 70 });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(0.15, 0.85, 0);
        group.add(tip);
        break;

      default:
        // Fallback generic piece
        const defaultGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.5, 12);
        const defaultMat = new THREE.MeshPhongMaterial({ color: mainColor });
        const defaultMesh = new THREE.Mesh(defaultGeo, defaultMat);
        defaultMesh.position.y = 0.35;
        group.add(defaultMesh);
    }

    // Add Greek key pattern base ring to all pieces
    const greekKeyGeo = new THREE.TorusGeometry(0.35, 0.025, 6, 16);
    const greekKeyMat = new THREE.MeshPhongMaterial({
      color: accentColor, specular: 0x666666, shininess: 50
    });
    const greekKey = new THREE.Mesh(greekKeyGeo, greekKeyMat);
    greekKey.rotation.x = Math.PI / 2;
    greekKey.position.y = 0.04;
    group.add(greekKey);

    return group;
  }

  // ── Skin system ────────────────────────────────────────────────

  const Skins = {
    classic:  { createPieceMesh: createPieceMeshClassic },
    minimal:  { createPieceMesh: createPieceMeshMinimal },
    abstract: { createPieceMesh: createPieceMeshAbstract },
    greek:    { createPieceMesh: createPieceMeshGreek }
  };

  function setSkin(name) {
    if (Skins[name]) currentSkin = name;
  }

  function setViewMode(mode) {
    if (['xy', 'xz', 'yz'].includes(mode)) {
      viewMode = mode;
      buildBoards();

      // Update piece positions
      for (const k of Object.keys(pieceMeshes)) {
        const [x, y, z] = Raumschach.parseKey(k);
        const pos = cellWorldPos(x, y, z);
        pieceMeshes[k].position.copy(pos);
        pieceMeshes[k].position.y += 0.05;
      }

      // Update highlight positions
      for (const m of highlightMeshes) {
        const { x, y, z, type } = m.userData;
        const pos = cellWorldPos(x, y, z);
        m.position.copy(pos);
        if (type !== 'selected') m.position.y += 0.15;
      }

      // Update camera target
      controls.target.set(0, LEVEL_GAP * 2, 0);
      controls.update();
    }
  }

  // ── Init ───────────────────────────────────────────────────────

  function init(container, clickCallback) {
    onCellClick = clickCallback;
    tooltip = document.getElementById('tooltip');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(45, (window.innerWidth - 260) / window.innerHeight, 0.1, 200);
    camera.position.set(12, 14, 12);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth - 260, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.marginLeft = '260px';

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, LEVEL_GAP * 2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x7fdbca, 0.3, 50);
    pointLight.position.set(0, LEVEL_GAP * 5, 0);
    scene.add(pointLight);

    buildBoards();

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    animate();
  }

  function buildBoards() {
    // Clear existing meshes
    for (const k of Object.keys(cellMeshes)) {
      scene.remove(cellMeshes[k]);
    }
    cellMeshes = {};

    // Remove old platforms, labels, and lines
    scene.children = scene.children.filter(child =>
      !(child.userData && (child.userData.isLevelPlatform || child.userData.isLevelLabel || child.userData.isLevelLine || child.userData.isCoordLabel))
    );

    const stackDim = viewMode === 'xy' ? BOARD_SIZE : (viewMode === 'xz' ? BOARD_SIZE : BOARD_SIZE);

    for (let stackIdx = 0; stackIdx < stackDim; stackIdx++) {
      const platformGeo = new THREE.BoxGeometry(
        BOARD_SIZE * CELL_SIZE + 0.1, 0.05, BOARD_SIZE * CELL_SIZE + 0.1
      );
      // Platform tint: in xy mode stackIdx=z, in xz stackIdx=y, in yz stackIdx=x
      // We don't tint platforms by layer since they represent different axes per view
      const platformColor = new THREE.Color(0x222244);
      const platformMat = new THREE.MeshPhongMaterial({
        color: platformColor, transparent: true, opacity: 0.3
      });
      const platform = new THREE.Mesh(platformGeo, platformMat);
      platform.position.set(0, stackIdx * LEVEL_GAP - 0.06, 0);
      platform.userData = { isLevelPlatform: true };
      scene.add(platform);

      addLevelLabel(stackIdx);
      addCoordinateLabels(stackIdx);

      if (stackIdx < stackDim - 1) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-BOARD_OFFSET - 0.3, stackIdx * LEVEL_GAP, -BOARD_OFFSET - 0.3),
          new THREE.Vector3(-BOARD_OFFSET - 0.3, (stackIdx+1) * LEVEL_GAP, -BOARD_OFFSET - 0.3)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x334455, transparent: true, opacity: 0.3 });
        const line = new THREE.Line(lineGeo, lineMat);
        line.userData = { isLevelLine: true };
        scene.add(line);
      }

      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          // Map logical coordinates based on view mode
          let logX, logY, logZ;
          switch (viewMode) {
            case 'xy':
              logX = x; logY = y; logZ = stackIdx;
              break;
            case 'xz':
              logX = x; logY = stackIdx; logZ = y;
              break;
            case 'yz':
              logX = stackIdx; logY = x; logZ = y;
              break;
          }

          const isLight = (logX + logY + logZ) % 2 === 0;
          const baseColor = new THREE.Color(isLight ? 0xd4c89a : 0x6b5b3a);
          // Always tint by the actual z-layer, not the display stack
          const tintedColor = baseColor.lerp(LAYER_TINTS[logZ], LAYER_TINT_STRENGTH);
          const geo = new THREE.BoxGeometry(CELL_SIZE * 0.95, 0.1, CELL_SIZE * 0.95);
          const mat = new THREE.MeshPhongMaterial({
            color: tintedColor, transparent: true, opacity: 0.85
          });
          const mesh = new THREE.Mesh(geo, mat);

          const pos = cellWorldPos(logX, logY, logZ);
          mesh.position.copy(pos);
          mesh.userData = { x: logX, y: logY, z: logZ, type: 'cell' };
          mesh.receiveShadow = true;
          scene.add(mesh);
          cellMeshes[Raumschach.key(logX, logY, logZ)] = mesh;
        }
      }
    }
  }

  function addLevelLabel(stackIdx) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#7fdbca';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';

    let labelText;
    switch (viewMode) {
      case 'xy':
        labelText = 'Layer ' + String.fromCharCode(65 + stackIdx);
        break;
      case 'xz':
        labelText = 'Row ' + (stackIdx + 1);
        break;
      case 'yz':
        labelText = 'Col ' + String.fromCharCode(97 + stackIdx);
        break;
    }

    ctx.fillText(labelText, 64, 42);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.6 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(-BOARD_OFFSET - 1.5, stackIdx * LEVEL_GAP + 0.3, 0);
    sprite.scale.set(2, 1, 1);
    sprite.userData = { isLevelLabel: true };
    scene.add(sprite);
  }

  function createCoordSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8899aa';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.6 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.5, 0.5, 1);
    return sprite;
  }

  function addCoordinateLabels(stackIdx) {
    const levelY = stackIdx * LEVEL_GAP;

    for (let i = 0; i < BOARD_SIZE; i++) {
      // Horizontal axis labels (along worldX, at front edge of board)
      let hLabel;
      switch (viewMode) {
        case 'xy': hLabel = String.fromCharCode(97 + i); break; // a-e (column)
        case 'xz': hLabel = String.fromCharCode(97 + i); break; // a-e (column)
        case 'yz': hLabel = String(i + 1); break;                // 1-5 (row)
      }

      const hSprite = createCoordSprite(hLabel);
      hSprite.position.set(
        i * CELL_SIZE - BOARD_OFFSET,
        levelY,
        BOARD_OFFSET + 0.7
      );
      hSprite.userData = { isCoordLabel: true };
      scene.add(hSprite);

      // Vertical axis labels (along worldZ, at right edge of board)
      let vLabel;
      switch (viewMode) {
        case 'xy': vLabel = String(i + 1); break;                // 1-5 (row)
        case 'xz': vLabel = String.fromCharCode(65 + i); break;  // A-E (layer)
        case 'yz': vLabel = String.fromCharCode(65 + i); break;  // A-E (layer)
      }

      const vSprite = createCoordSprite(vLabel);
      vSprite.position.set(
        BOARD_OFFSET + 0.7,
        levelY,
        i * CELL_SIZE - BOARD_OFFSET
      );
      vSprite.userData = { isCoordLabel: true };
      scene.add(vSprite);
    }
  }

  // ── Piece rendering ────────────────────────────────────────────

  function updatePieces(board) {
    for (const k of Object.keys(pieceMeshes)) {
      scene.remove(pieceMeshes[k]);
    }
    pieceMeshes = {};

    for (const k of Object.keys(board)) {
      const piece = board[k];
      const [x, y, z] = Raumschach.parseKey(k);
      const mesh = Skins[currentSkin].createPieceMesh(piece);
      const pos = cellWorldPos(x, y, z);
      mesh.position.copy(pos);
      mesh.position.y += 0.05;

      mesh.traverse(child => {
        if (child.isMesh) {
          child.userData = { x, y, z, type: 'piece', piece };
        }
      });

      scene.add(mesh);
      pieceMeshes[k] = mesh;
    }
  }

  // ── Highlights ─────────────────────────────────────────────────

  function highlightCells(keys, type) {
    clearHighlights();
    for (const [x, y, z] of keys) {
      const geo = type === 'selected'
        ? new THREE.BoxGeometry(CELL_SIZE * 0.95, 0.15, CELL_SIZE * 0.95)
        : new THREE.SphereGeometry(0.15, 12, 12);
      const color = type === 'selected' ? 0x44aaff : 0x44ff88;
      const mat = new THREE.MeshPhongMaterial({
        color, transparent: true, opacity: type === 'selected' ? 0.5 : 0.6,
        emissive: color, emissiveIntensity: 0.3
      });
      const mesh = new THREE.Mesh(geo, mat);
      const pos = cellWorldPos(x, y, z);
      mesh.position.copy(pos);
      if (type !== 'selected') mesh.position.y += 0.15;
      mesh.userData = { x, y, z, type: 'highlight' };
      scene.add(mesh);
      highlightMeshes.push(mesh);
    }
  }

  function highlightCheck(x, y, z) {
    const geo = new THREE.BoxGeometry(CELL_SIZE * 0.95, 0.16, CELL_SIZE * 0.95);
    const mat = new THREE.MeshPhongMaterial({
      color: 0xff4444, transparent: true, opacity: 0.6,
      emissive: 0xff0000, emissiveIntensity: 0.4
    });
    const mesh = new THREE.Mesh(geo, mat);
    const pos = cellWorldPos(x, y, z);
    mesh.position.copy(pos);
    scene.add(mesh);
    highlightMeshes.push(mesh);
  }

  function clearHighlights() {
    for (const m of highlightMeshes) scene.remove(m);
    highlightMeshes = [];
  }

  function highlightLastMove(from, to) {
    clearLastMove();
    for (const [x, y, z] of [from, to]) {
      const geo = new THREE.BoxGeometry(CELL_SIZE * 0.95, 0.12, CELL_SIZE * 0.95);
      const mat = new THREE.MeshPhongMaterial({
        color: 0xccaa44, transparent: true, opacity: 0.35,
        emissive: 0xccaa44, emissiveIntensity: 0.15
      });
      const mesh = new THREE.Mesh(geo, mat);
      const pos = cellWorldPos(x, y, z);
      mesh.position.copy(pos);
      mesh.userData = { x, y, z, type: 'lastMove' };
      scene.add(mesh);
      lastMoveMeshes.push(mesh);
    }
  }

  function clearLastMove() {
    for (const m of lastMoveMeshes) scene.remove(m);
    lastMoveMeshes = [];
  }

  // ── Show/Hide for view toggle ──────────────────────────────────

  function show() {
    if (renderer && renderer.domElement) renderer.domElement.style.display = 'block';
  }

  function hide() {
    if (renderer && renderer.domElement) renderer.domElement.style.display = 'none';
  }

  // ── Input handling ─────────────────────────────────────────────

  function onMouseClick(event) {
    if (!onCellClick) return;
    mouse.x = ((event.clientX - 260) / (window.innerWidth - 260)) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const allMeshes = [];
    scene.traverse(child => { if (child.isMesh && child.userData.type) allMeshes.push(child); });
    const intersects = raycaster.intersectObjects(allMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const { x, y, z } = hit.userData;
      if (x !== undefined) onCellClick(x, y, z);
    }
  }

  function onMouseMove(event) {
    mouse.x = ((event.clientX - 260) / (window.innerWidth - 260)) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const allMeshes = [];
    scene.traverse(child => { if (child.isMesh && child.userData.type) allMeshes.push(child); });
    const intersects = raycaster.intersectObjects(allMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const { x, y, z, piece } = hit.userData;
      if (piece) {
        const sym = Raumschach.PIECE_SYMBOLS[piece.type][piece.color];
        const name = Raumschach.PIECE_NAMES[piece.type];
        const colorName = piece.color === 'w' ? 'White' : 'Black';
        const coord = Raumschach.coordToNotation(x, y, z);
        tooltip.style.display = 'block';
        tooltip.style.left = (event.clientX + 12) + 'px';
        tooltip.style.top = (event.clientY - 8) + 'px';
        tooltip.textContent = `${sym} ${colorName} ${name} (${coord})`;
      } else {
        tooltip.style.display = 'none';
      }
    } else {
      tooltip.style.display = 'none';
    }
  }

  function onResize() {
    camera.aspect = (window.innerWidth - 260) / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth - 260, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const t = Date.now() * 0.003;
    for (const m of highlightMeshes) {
      if (m.userData.type === 'highlight') {
        m.position.y = cellWorldPos(m.userData.x, m.userData.y, m.userData.z).y + 0.15 + Math.sin(t) * 0.05;
      }
    }

    renderer.render(scene, camera);
  }

  return {
    init, updatePieces, highlightCells, highlightCheck, clearHighlights,
    highlightLastMove, clearLastMove,
    cellWorldPos, setSkin, setViewMode, show, hide
  };
})();


export default BoardRenderer;
window.BoardRenderer = BoardRenderer;
