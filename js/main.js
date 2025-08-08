/**
 * VoxelCraft - Archivo Principal
 * v0.1.0
 * 
 * Punto de entrada del juego
 */

// Variables globales
let game = null;
let scene, camera, renderer;
let chunkManager, player, controls;
let stats = {
    fps: 0,
    chunks: 0,
    position: { x: 0, y: 0, z: 0 }
};

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('🎮 Iniciando VoxelCraft v0.1.0...');
    
    // Actualizar estado de carga
    updateLoadingStatus('Inicializando Three.js...');
    updateLoadingProgress(10);
    
    // Inicializar Three.js
    initThreeJS();
    
    // Inicializar iluminación
    updateLoadingStatus('Configurando iluminación...');
    updateLoadingProgress(20);
    initLighting();
    
    // Inicializar sistema de chunks
    updateLoadingStatus('Inicializando sistema de chunks...');
    updateLoadingProgress(30);
    initChunkSystem();
    
    // Inicializar jugador
    updateLoadingStatus('Creando jugador...');
    updateLoadingProgress(50);
    initPlayer();
    
    // Inicializar controles
    updateLoadingStatus('Configurando controles...');
    updateLoadingProgress(70);
    initControls();
    
    // Inicializar UI
    updateLoadingStatus('Preparando interfaz...');
    updateLoadingProgress(85);
    initUI();
    
    // Generar mundo inicial
    updateLoadingStatus('Generando mundo...');
    updateLoadingProgress(95);
    await generateInitialWorld();
    
    // Ocultar pantalla de carga
    updateLoadingProgress(100);
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
        // Iniciar loop de renderizado
        animate();
    }, 500);
    
    console.log('✅ VoxelCraft iniciado correctamente');
}

function initThreeJS() {
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Color del cielo
    
    // Configurar cámara
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(
        CONFIG.PLAYER.FOV,
        aspect,
        0.1,
        1000
    );
    camera.position.set(0, 50, 0);
    
    // Configurar renderer
    const canvas = document.getElementById('gameCanvas');
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: CONFIG.RENDERING.ANTIALIAS,
        powerPreference: "high-performance"
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = CONFIG.RENDERING.SHADOWS_ENABLED;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Configurar niebla
    if (CONFIG.RENDERING.FOG.ENABLED) {
        scene.fog = new THREE.Fog(
            CONFIG.RENDERING.FOG.COLOR,
            CONFIG.RENDERING.FOG.NEAR,
            CONFIG.RENDERING.FOG.FAR
        );
    }
    
    // Manejar redimensionamiento
    window.addEventListener('resize', onWindowResize);
}

function initLighting() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Luz direccional (sol)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = CONFIG.RENDERING.SHADOWS_ENABLED;
    
    if (CONFIG.RENDERING.SHADOWS_ENABLED) {
        directionalLight.shadow.mapSize.width = CONFIG.RENDERING.SHADOW_MAP_SIZE;
        directionalLight.shadow.mapSize.height = CONFIG.RENDERING.SHADOW_MAP_SIZE;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
    }
    
    scene.add(directionalLight);
    
    // Luz de hemisferio para mejor iluminación
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x545454, 0.4);
    scene.add(hemisphereLight);
}

function initChunkSystem() {
    // Crear el gestor de chunks
    chunkManager = new ChunkManager(scene, camera);
}

function initPlayer() {
    // Crear objeto del jugador
    player = {
        position: new THREE.Vector3(0, 50, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Euler(0, 0, 0),
        onGround: false,
        isRunning: false,
        selectedBlock: 1,
        health: 100,
        hunger: 100
    };
    
    // Posicionar cámara en el jugador
    camera.position.copy(player.position);
    camera.position.y += CONFIG.PLAYER.CAMERA_HEIGHT;
}

function initControls() {
    // Controles de cámara básicos
    controls = {
        keys: {},
        mouse: {
            x: 0,
            y: 0,
            locked: false
        },
        touch: {
            active: false,
            startX: 0,
            startY: 0
        }
    };
    
    // Eventos de teclado
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    // Eventos de mouse
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    
    // Pointer Lock API
    canvas.addEventListener('click', () => {
        if (!CONFIG.DEVICE.IS_MOBILE) {
            canvas.requestPointerLock();
        }
    });
    
    document.addEventListener('pointerlockchange', () => {
        controls.mouse.locked = document.pointerLockElement === canvas;
    });
    
    // Eventos táctiles para móvil
    if (CONFIG.DEVICE.HAS_TOUCH) {
        initMobileControls();
    }
}

function initMobileControls() {
    const joystick = document.getElementById('joystick');
    const joystickKnob = document.getElementById('joystick-knob');
    
    let joystickActive = false;
    let joystickCenter = { x: 0, y: 0 };
    
    // Joystick control
    joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        const touch = e.touches[0];
        const rect = joystick.getBoundingClientRect();
        joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    });
    
    joystick.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!joystickActive) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - joystickCenter.x;
        const deltaY = touch.clientY - joystickCenter.y;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = 50;
        
        let knobX = deltaX;
        let knobY = deltaY;
        
        if (distance > maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            knobX = Math.cos(angle) * maxDistance;
            knobY = Math.sin(angle) * maxDistance;
        }
        
        joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
        
        // Actualizar movimiento del jugador
        const moveX = knobX / maxDistance;
        const moveY = knobY / maxDistance;
        
        controls.keys['KeyW'] = moveY < -0.3;
        controls.keys['KeyS'] = moveY > 0.3;
        controls.keys['KeyA'] = moveX < -0.3;
        controls.keys['KeyD'] = moveX > 0.3;
    });
    
    joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        joystickActive = false;
        joystickKnob.style.transform = 'translate(-50%, -50%)';
        controls.keys['KeyW'] = false;
        controls.keys['KeyS'] = false;
        controls.keys['KeyA'] = false;
        controls.keys['KeyD'] = false;
    });
    
    // Botones de acción
    document.getElementById('jump-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        controls.keys['Space'] = true;
        if (CONFIG.MOBILE.HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(CONFIG.MOBILE.HAPTIC_DURATION);
        }
    });
    
    document.getElementById('jump-btn').addEventListener('touchend', (e) => {
        e.preventDefault();
        controls.keys['Space'] = false;
    });
    
    document.getElementById('place-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        placeBlock();
    });
    
    document.getElementById('break-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        breakBlock();
    });
    
    // Control de cámara táctil
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);
}

function onTouchStart(e) {
    if (e.touches.length === 1) {
        controls.touch.active = true;
        controls.touch.startX = e.touches[0].clientX;
        controls.touch.startY = e.touches[0].clientY;
    }
}

function onTouchMove(e) {
    if (!controls.touch.active || e.touches.length !== 1) return;
    
    const deltaX = e.touches[0].clientX - controls.touch.startX;
    const deltaY = e.touches[0].clientY - controls.touch.startY;
    
    // Rotar cámara
    player.rotation.y -= deltaX * CONFIG.PLAYER.TOUCH_SENSITIVITY;
    player.rotation.x -= deltaY * CONFIG.PLAYER.TOUCH_SENSITIVITY;
    
    // Limitar rotación vertical
    player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
    
    controls.touch.startX = e.touches[0].clientX;
    controls.touch.startY = e.touches[0].clientY;
}

function onTouchEnd(e) {
    controls.touch.active = false;
}

function initUI() {
    // Inicializar hotbar
    const hotbarSlots = document.querySelectorAll('.hotbar-slot');
    hotbarSlots.forEach((slot, index) => {
        slot.addEventListener('click', () => {
            document.querySelector('.hotbar-slot.active').classList.remove('active');
            slot.classList.add('active');
            player.selectedBlock = index + 1;
        });
    });
    
    // Tecla ESC para pausar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            togglePause();
        }
    });
}

async function generateInitialWorld() {
    // Generar chunks alrededor del spawn
    const spawnRadius = 3;
    const promises = [];
    
    for (let x = -spawnRadius; x <= spawnRadius; x++) {
        for (let z = -spawnRadius; z <= spawnRadius; z++) {
            const distance = Math.sqrt(x * x + z * z);
            if (distance <= spawnRadius) {
                const priority = distance < 2 ? 
                    CONFIG.WORKERS.PRIORITY.CRITICAL : 
                    CONFIG.WORKERS.PRIORITY.HIGH;
                chunkManager.requestChunk(x, z, priority);
            }
        }
    }
    
    // Esperar un poco para que se generen algunos chunks
    await new Promise(resolve => setTimeout(resolve, 1000));
}

function onKeyDown(e) {
    controls.keys[e.code] = true;
    
    // Números para seleccionar bloques
    if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const slot = parseInt(e.code.replace('Digit', '')) - 1;
        document.querySelector('.hotbar-slot.active').classList.remove('active');
        document.querySelectorAll('.hotbar-slot')[slot].classList.add('active');
        player.selectedBlock = slot + 1;
    }
}

function onKeyUp(e) {
    controls.keys[e.code] = false;
}

function onMouseDown(e) {
    if (!controls.mouse.locked) return;
    
    if (e.button === 0) {
        // Click izquierdo - romper bloque
        breakBlock();
    } else if (e.button === 2) {
        // Click derecho - colocar bloque
        placeBlock();
    }
}

function onMouseUp(e) {
    // Placeholder para eventos de mouse
}

function onMouseMove(e) {
    if (!controls.mouse.locked) return;
    
    const deltaX = e.movementX;
    const deltaY = e.movementY;
    
    player.rotation.y -= deltaX * CONFIG.PLAYER.MOUSE_SENSITIVITY;
    player.rotation.x -= deltaY * CONFIG.PLAYER.MOUSE_SENSITIVITY;
    
    // Limitar rotación vertical
    player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
}

function placeBlock() {
    // TODO: Implementar colocación de bloques
    console.log('Colocando bloque:', player.selectedBlock);
}

function breakBlock() {
    // TODO: Implementar destrucción de bloques
    console.log('Rompiendo bloque');
}

function togglePause() {
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu.style.display === 'block') {
        pauseMenu.style.display = 'none';
        if (!CONFIG.DEVICE.IS_MOBILE) {
            canvas.requestPointerLock();
        }
    } else {
        pauseMenu.style.display = 'block';
        document.exitPointerLock();
    }
}

function updatePlayer(deltaTime) {
    // Aplicar gravedad
    if (!player.onGround) {
        player.velocity.y += CONFIG.PLAYER.GRAVITY * deltaTime;
    }
    
    // Movimiento horizontal
    const moveVector = new THREE.Vector3();
    
    if (controls.keys['KeyW']) moveVector.z -= 1;
    if (controls.keys['KeyS']) moveVector.z += 1;
    if (controls.keys['KeyA']) moveVector.x -= 1;
    if (controls.keys['KeyD']) moveVector.x += 1;
    
    // Normalizar y aplicar velocidad
    if (moveVector.length() > 0) {
        moveVector.normalize();
        
        // Rotar según la dirección de la cámara
        moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
        
        const speed = controls.keys['ShiftLeft'] ? 
            CONFIG.PLAYER.RUN_SPEED : 
            CONFIG.PLAYER.WALK_SPEED;
        
        player.velocity.x = moveVector.x * speed;
        player.velocity.z = moveVector.z * speed;
    } else {
        // Aplicar fricción
        const friction = player.onGround ? 
            CONFIG.PLAYER.FRICTION : 
            CONFIG.PLAYER.AIR_FRICTION;
        
        player.velocity.x *= friction;
        player.velocity.z *= friction;
    }
    
    // Salto
    if (controls.keys['Space'] && player.onGround) {
        player.velocity.y = CONFIG.PLAYER.JUMP_FORCE;
        player.onGround = false;
    }
    
    // Actualizar posición
    player.position.x += player.velocity.x * deltaTime;
    player.position.y += player.velocity.y * deltaTime;
    player.position.z += player.velocity.z * deltaTime;
    
    // Colisión simple con el suelo (temporal)
    if (player.position.y < 30) {
        player.position.y = 30;
        player.velocity.y = 0;
        player.onGround = true;
    }
    
    // Actualizar cámara
    camera.position.copy(player.position);
    camera.position.y += CONFIG.PLAYER.CAMERA_HEIGHT;
    camera.rotation.x = player.rotation.x;
    camera.rotation.y = player.rotation.y;
}

function updateStats() {
    // Actualizar FPS
    document.getElementById('fps').textContent = Math.round(stats.fps);
    
    // Actualizar chunks
    const chunkStats = chunkManager.getStats();
    document.getElementById('chunks').textContent = 
        `${chunkStats.chunksInView}/${chunkStats.chunksLoaded}`;
    
    // Actualizar posición
    document.getElementById('position').textContent = 
        `${Math.round(player.position.x)}, ${Math.round(player.position.y)}, ${Math.round(player.position.z)}`;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateLoadingStatus(status) {
    document.getElementById('loadingStatus').textContent = status;
}

function updateLoadingProgress(percent) {
    document.getElementById('loadingProgress').style.width = percent + '%';
}

// Loop principal de animación
let lastTime = performance.now();
let frameCount = 0;
let fpsTime = 0;

function animate() {
    requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // Calcular FPS
    frameCount++;
    fpsTime += deltaTime;
    if (fpsTime >= 1.0) {
        stats.fps = frameCount / fpsTime;
        frameCount = 0;
        fpsTime = 0;
    }
    
    // Actualizar jugador
    updatePlayer(deltaTime);
    
    // Actualizar chunks
    chunkManager.update(player.position);
    
    // Actualizar estadísticas
    updateStats();
    
    // Renderizar
    renderer.render(scene, camera);
}

// Hacer el juego accesible globalmente para debugging
window.game = {
    scene,
    camera,
    renderer,
    player,
    chunkManager,
    resume: () => togglePause(),
    settings: () => console.log('Configuración no implementada aún')
};