// 3D Scroll & Interactive WebGL Experience with Three.js
(function () {
  'use strict';

  let scene, camera, renderer;
  let objectsGroup, particleSystem;
  let heroTorus, ringMesh1, ringMesh2, floatingPoly, pedestalGroup;
  let ambientLight, dirLight1, dirLight2, pointLight;
  let scrollProgress = 0;
  let targetScrollProgress = 0;
  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let isMobile = false;

  // Showroom 3D Interactive Turntable
  let showroomTurntableGroup, showroomMesh;
  let showroomRotation = 0;
  let showroomDrag = { isDragging: false, startX: 0, currentRotation: 0 };

  function initThree() {
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) return;

    if (typeof THREE === 'undefined') {
      console.warn('Three.js not yet loaded, retrying...');
      setTimeout(initThree, 100);
      return;
    }

    isMobile = window.innerWidth < 768;

    // Scene
    scene = new THREE.Scene();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    scene.fog = new THREE.FogExp2(isDark ? 0x121411 : 0xf5f2eb, 0.035);

    // Camera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.25 : 1.05;

    // Lights
    ambientLight = new THREE.AmbientLight(isDark ? 0x2e352d : 0xfff8ee, isDark ? 1.8 : 1.4);
    scene.add(ambientLight);

    dirLight1 = new THREE.DirectionalLight(0xffecd2, 2.2);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    dirLight2 = new THREE.DirectionalLight(0xc8b082, 1.2);
    dirLight2.position.set(-6, -5, -4);
    scene.add(dirLight2);

    pointLight = new THREE.PointLight(0xd46a43, 2, 20);
    pointLight.position.set(0, 0, 4);
    scene.add(pointLight);

    // Groups
    objectsGroup = new THREE.Group();
    scene.add(objectsGroup);

    // 1. Hero Torus Sculpture (Refined contemporary fashion emblem)
    const torusGeo = new THREE.TorusKnotGeometry(1.35, 0.32, 128, 32, 2, 3);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xc49b56,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: false
    });
    heroTorus = new THREE.Mesh(torusGeo, torusMat);
    heroTorus.position.set(2.4, 0.2, 0);
    heroTorus.scale.set(1, 1, 1);
    objectsGroup.add(heroTorus);

    // 2. Luxury Architectural Ring 1
    const ringGeo1 = new THREE.TorusGeometry(2.4, 0.04, 16, 100);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x1d211b,
      metalness: 0.9,
      roughness: 0.2
    });
    ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.position.set(2.4, 0.2, -0.5);
    ringMesh1.rotation.x = Math.PI / 3;
    objectsGroup.add(ringMesh1);

    // 3. Floating Dotted Outer Ring
    const ringGeo2 = new THREE.TorusGeometry(3.1, 0.02, 16, 100);
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0xd46a43,
      metalness: 0.5,
      roughness: 0.4
    });
    ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.position.set(2.4, 0.2, -1.2);
    ringMesh2.rotation.y = Math.PI / 4;
    objectsGroup.add(ringMesh2);

    // 4. Floating Sculptural Icosahedron (Showroom gem)
    const polyGeo = new THREE.IcosahedronGeometry(0.85, 0);
    const polyMat = new THREE.MeshStandardMaterial({
      color: 0x8a7a58,
      metalness: 0.9,
      roughness: 0.15,
      flatShading: true
    });
    floatingPoly = new THREE.Mesh(polyGeo, polyMat);
    floatingPoly.position.set(-2.8, -3.5, 0);
    objectsGroup.add(floatingPoly);

    // 5. Floating Showcase Pedestal Rings (Shop Section Accent)
    pedestalGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const pGeo = new THREE.CylinderGeometry(1.6 + i * 0.4, 1.6 + i * 0.4, 0.06, 64);
      const pMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x22241e : 0xc49b56,
        metalness: 0.7,
        roughness: 0.3
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.y = -i * 0.18;
      pedestalGroup.add(pMesh);
    }
    pedestalGroup.position.set(3.2, -7.5, -2);
    pedestalGroup.rotation.x = 0.35;
    objectsGroup.add(pedestalGroup);

    // 6. Interactive 3D Showroom Turntable Section Mesh
    showroomTurntableGroup = new THREE.Group();
    showroomTurntableGroup.position.set(0, -11.2, 0);

    // Showroom Cylindrical Pedestal
    const baseGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.25, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x262923,
      metalness: 0.8,
      roughness: 0.2
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -1.2;
    showroomTurntableGroup.add(baseMesh);

    // Showroom 3D Centerpiece
    const centerpieceGeo = new THREE.DodecahedronGeometry(1.1, 1);
    const centerpieceMat = new THREE.MeshStandardMaterial({
      color: 0xd0b36c,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: false
    });
    showroomMesh = new THREE.Mesh(centerpieceGeo, centerpieceMat);
    showroomTurntableGroup.add(showroomMesh);

    // Showroom Orbit Rings
    const orbitGeo = new THREE.TorusGeometry(1.6, 0.02, 16, 64);
    const orbitMat = new THREE.MeshStandardMaterial({ color: 0xef6b45, metalness: 0.5 });
    const orbitMesh = new THREE.Mesh(orbitGeo, orbitMat);
    orbitMesh.rotation.x = Math.PI / 2.2;
    showroomTurntableGroup.add(orbitMesh);

    objectsGroup.add(showroomTurntableGroup);

    // 7. Champagne & Gold Ambient Particles System
    const particleCount = isMobile ? 90 : 240;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 18;
      positions[i + 1] = (Math.random() - 0.5) * 32;
      positions[i + 2] = (Math.random() - 0.5) * 14;
      scales[i / 3] = Math.random() * 0.8 + 0.2;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    // Particle texture generator (soft round particle)
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    const pGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    pGrad.addColorStop(0, 'rgba(212, 168, 90, 1)');
    pGrad.addColorStop(0.4, 'rgba(239, 107, 69, 0.6)');
    pGrad.addColorStop(1, 'rgba(245, 242, 235, 0)');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 32, 32);

    const pTexture = new THREE.CanvasTexture(pCanvas);

    const particleMat = new THREE.PointsMaterial({
      size: 0.28,
      map: pTexture,
      transparent: true,
      opacity: 0.78,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // Event listeners
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Showroom 3D Interactive Turntable mouse/touch drag
    setupShowroomInteraction();

    onResize();
    onScroll();
    animate();
  }

  function setupShowroomInteraction() {
    const stage = document.getElementById('showroomStage');
    if (!stage) return;

    stage.addEventListener('pointerdown', e => {
      showroomDrag.isDragging = true;
      showroomDrag.startX = e.clientX;
      stage.classList.add('grabbing');
    });

    window.addEventListener('pointermove', e => {
      if (!showroomDrag.isDragging) return;
      const deltaX = e.clientX - showroomDrag.startX;
      showroomRotation += deltaX * 0.008;
      showroomDrag.startX = e.clientX;
    });

    window.addEventListener('pointerup', () => {
      if (showroomDrag.isDragging) {
        showroomDrag.isDragging = false;
        stage.classList.remove('grabbing');
      }
    });
  }

  // Exposed API to switch showroom piece
  window.setShowroomPiece = function (pieceType) {
    if (!showroomMesh) return;
    if (pieceType === 'shirt') {
      showroomMesh.geometry.dispose();
      showroomMesh.geometry = new THREE.TorusKnotGeometry(1.0, 0.28, 96, 24, 2, 3);
      showroomMesh.material.color.setHex(0xc49b56);
    } else if (pieceType === 'denim') {
      showroomMesh.geometry.dispose();
      showroomMesh.geometry = new THREE.CylinderGeometry(0.8, 0.9, 1.8, 32);
      showroomMesh.material.color.setHex(0x3a5a78); // indigo
    } else if (pieceType === 'slide') {
      showroomMesh.geometry.dispose();
      showroomMesh.geometry = new THREE.BoxGeometry(1.8, 0.5, 1.1);
      showroomMesh.material.color.setHex(0xef6b45); // terracotta
    }
  };

  // Exposed API to change showroom lighting
  window.setShowroomLighting = function (mode) {
    if (!dirLight1 || !ambientLight) return;
    if (mode === 'studio') {
      dirLight1.color.setHex(0xffffff);
      ambientLight.color.setHex(0xfff8ee);
      pointLight.color.setHex(0xd46a43);
    } else if (mode === 'sunset') {
      dirLight1.color.setHex(0xff9944);
      ambientLight.color.setHex(0xaa5533);
      pointLight.color.setHex(0xff5522);
    } else if (mode === 'midnight') {
      dirLight1.color.setHex(0x88bbff);
      ambientLight.color.setHex(0x112233);
      pointLight.color.setHex(0x4466aa);
    }
  };

  // Exposed API to adapt 3D scene to Dark/Light theme
  window.update3DTheme = function (theme) {
    if (!scene || !renderer) return;
    const isDark = theme === 'dark';
    scene.fog.color.setHex(isDark ? 0x121411 : 0xf5f2eb);
    if (ambientLight) ambientLight.color.setHex(isDark ? 0x30352b : 0xfff8ee);
    if (dirLight2) dirLight2.color.setHex(isDark ? 0xb59e6c : 0xc8b082);
    renderer.toneMappingExposure = isDark ? 1.25 : 1.05;
  };

  function onResize() {
    if (!renderer || !camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    isMobile = width < 768;

    camera.aspect = width / height;
    if (isMobile) {
      camera.fov = 62;
      if (heroTorus) heroTorus.position.set(0, 1.8, -1.5);
      if (ringMesh1) ringMesh1.position.set(0, 1.8, -2.0);
      if (ringMesh2) ringMesh2.position.set(0, 1.8, -2.4);
    } else {
      camera.fov = 50;
      if (heroTorus) heroTorus.position.set(2.4, 0.2, 0);
      if (ringMesh1) ringMesh1.position.set(2.4, 0.2, -0.5);
      if (ringMesh2) ringMesh2.position.set(2.4, 0.2, -1.2);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function onScroll() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      targetScrollProgress = Math.max(0, Math.min(1, window.scrollY / docHeight));
    }
    // Update scroll depth indicator in DOM
    const depthEl = document.getElementById('scrollDepthIndicator');
    if (depthEl) {
      const pct = Math.round(targetScrollProgress * 100);
      depthEl.textContent = `${pct.toString().padStart(2, '0')}%`;
    }
    const progressBar = document.getElementById('scrollProgressBar');
    if (progressBar) {
      progressBar.style.width = `${targetScrollProgress * 100}%`;
    }
  }

  function onMouseMove(e) {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  let clock = {
    start: Date.now(),
    getElapsedTime: function () {
      return (Date.now() - this.start) / 1000;
    }
  };

  function animate() {
    requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();

    // Smooth lerp for scroll & mouse
    scrollProgress += (targetScrollProgress - scrollProgress) * 0.07;
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    // 3D Camera Trajectory along scroll depth
    const camY = -scrollProgress * 16;
    const camZ = 8 - Math.sin(scrollProgress * Math.PI) * 2.2;
    const camX = Math.sin(scrollProgress * Math.PI * 2) * 1.8 + mouse.x * 0.6;

    camera.position.x = camX;
    camera.position.y = camY - mouse.y * 0.4;
    camera.position.z = camZ;

    camera.lookAt(
      Math.sin(scrollProgress * 3) * 0.8,
      camY - 0.4,
      0
    );

    // Rotate Sculptures
    if (heroTorus) {
      heroTorus.rotation.x = elapsed * 0.35 + scrollProgress * 5;
      heroTorus.rotation.y = elapsed * 0.45 + mouse.x * 0.5;
      heroTorus.rotation.z = scrollProgress * 3;
    }

    if (ringMesh1) {
      ringMesh1.rotation.x = Math.PI / 3 + elapsed * 0.15;
      ringMesh1.rotation.y = elapsed * 0.25 - scrollProgress * 3;
    }

    if (ringMesh2) {
      ringMesh2.rotation.z = elapsed * 0.18 + scrollProgress * 4;
      ringMesh2.rotation.x = Math.PI / 4 + elapsed * 0.1;
    }

    if (floatingPoly) {
      floatingPoly.rotation.x = elapsed * 0.5;
      floatingPoly.rotation.y = elapsed * 0.6;
      floatingPoly.position.y = -3.5 - scrollProgress * 6 + Math.sin(elapsed * 1.5) * 0.25;
    }

    if (pedestalGroup) {
      pedestalGroup.rotation.y = elapsed * 0.2;
      pedestalGroup.position.y = -7.5 - scrollProgress * 4;
    }

    // Showroom 3D Interactive Turntable rotation
    if (showroomTurntableGroup) {
      if (!showroomDrag.isDragging) {
        showroomRotation += 0.005;
      }
      showroomTurntableGroup.rotation.y = showroomRotation;
      if (showroomMesh) {
        showroomMesh.rotation.x = Math.sin(elapsed * 1.2) * 0.1;
      }
    }

    // Particle subtle floating drift
    if (particleSystem) {
      particleSystem.rotation.y = elapsed * 0.04;
      particleSystem.rotation.x = Math.sin(elapsed * 0.03) * 0.1;
      const positions = particleSystem.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 0.004;
        if (positions[i] < -16) positions[i] = 16;
      }
      particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThree);
  } else {
    initThree();
  }
})();
