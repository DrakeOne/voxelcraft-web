/**
 * VoxelCraft - Archivo Principal
 * v0.1.0
 * 
 * Punto de entrada del juego
 */

// Variables globales
let game = null;
let scene, camera, renderer;
let chunkManager, player, controls, mobileControls;
let world;
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
    
    // Inicializar mundo
    updateLoadingStatus('Creando mundo...');
    updateLoadingProgress(40);
    initWorld();
    
    // Inicializar jugador
    updateLoadingStatus('Creando jugador...');
    updateLoadingProgress(50);
    initPlayer();
    
    // Inicializar controles
    updateLoadingStatus('Configurando controles...');
    updateLoadingProgress(70);
    initGameControls();
    
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

function initWorld() {
    // Crear el mundo
    world = new World(scene);
}

function initPlayer() {
    // Crear objeto del jugador
    player = new Player(scene, camera);
}

function initGameControls() {
    const canvas = document.getElementById('gameCanvas');
    
    if (CONFIG.DEVICE.IS_MOBILE || CONFIG.DEVICE.HAS_TOUCH) {
        // Controles móviles
        mobileControls = new MobileControls(camera, canvas);
        player.setMobileControls(mobileControls);
        
        // Callbacks para bloques
        mobileControls.onBlockPlace = () => placeBlock();
        mobileControls.onBlockBreak = () => breakBlock();
    } else {
        // Controles de desktop
        controls = new Controls(camera, canvas);
        player.setControls(controls);
        
        // Callbacks para bloques
        controls.onBlockPlace = (intersection, blockType) => placeBlock();
        controls.onBlockBreak = (intersection) => breakBlock();
    }
}

function initUI() {
    // Inicializar hotbar
    const hotbarSlots = document.querySelectorAll('.hotbar-slot');
    hotbarSlots.forEach((slot, index) => {
        slot.addEventListener('click', () => {
            player.selectHotbarSlot(index);
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

function placeBlock() {
    // TODO: Implementar colocación de bloques
    console.log('Colocando bloque:', player.getSelectedBlock());
}

function breakBlock() {
    // TODO: Implementar destrucción de bloques
    console.log('Rompiendo bloque');
}

function togglePause() {
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu.style.display === 'block') {
        pauseMenu.style.display = 'none';
        if (!CONFIG.DEVICE.IS_MOBILE && controls) {
            const canvas = document.getElementById('gameCanvas');
            canvas.requestPointerLock();
        }
    } else {
        pauseMenu.style.display = 'block';
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
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
    const element = document.getElementById('loadingStatus');
    if (element) {
        element.textContent = status;
    }
}

function updateLoadingProgress(percent) {
    const element = document.getElementById('loadingProgress');
    if (element) {
        element.style.width = percent + '%';
    }
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
    if (player) {
        player.update(deltaTime, world);
    }
    
    // Actualizar chunks
    if (chunkManager && player) {
        chunkManager.update(player.position);
    }
    
    // Actualizar controles
    if (controls) {
        controls.update(deltaTime);
    }
    if (mobileControls) {
        mobileControls.update(deltaTime);
    }
    
    // Actualizar estadísticas
    updateStats();
    
    // Renderizar
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Hacer el juego accesible globalmente para debugging
window.game = {
    scene,
    camera,
    renderer,
    player,
    chunkManager,
    world,
    resume: () => togglePause(),
    settings: () => console.log('Configuración no implementada aún'),
    togglePause: togglePause
};