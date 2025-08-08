/**
 * VoxelCraft - Archivo Principal
 * v0.1.0
 * 
 * Punto de entrada del juego
 */

// Variables globales - TODAS en window para acceso global
window.game = null;
window.scene = null;
window.camera = null;
window.renderer = null;
window.chunkManager = null;
window.player = null;
window.controls = null;
window.mobileControls = null;
window.world = null;

// Stats locales
let stats = {
    fps: 0,
    chunks: 0,
    position: { x: 0, y: 0, z: 0 }
};

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('🎮 Iniciando VoxelCraft v0.1.0...');
    
    if (window.debugSystem) {
        window.debugSystem.checkpoint('INIT_START');
    }
    
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
    
    if (window.debugSystem) {
        window.debugSystem.checkpoint('INIT_COMPLETE');
    }
    
    // Ocultar pantalla de carga
    updateLoadingProgress(100);
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
        // Iniciar loop de renderizado
        animate();
        console.log('✅ VoxelCraft iniciado correctamente');
        
        // Log estado final
        console.log('📊 Estado del sistema:');
        console.log('- Scene:', window.scene ? 'OK' : 'ERROR');
        console.log('- Camera:', window.camera ? 'OK' : 'ERROR');
        console.log('- Renderer:', window.renderer ? 'OK' : 'ERROR');
        console.log('- ChunkManager:', window.chunkManager ? 'OK' : 'ERROR');
        console.log('- World:', window.world ? 'OK' : 'ERROR');
        console.log('- Player:', window.player ? 'OK' : 'ERROR');
        
        if (window.chunkManager) {
            console.log('- Workers:', window.chunkManager.workers.length);
            console.log('- Chunks loaded:', window.chunkManager.chunks.size);
        }
    }, 500);
}

function initThreeJS() {
    console.log('📦 Inicializando Three.js...');
    
    // Crear escena
    window.scene = new THREE.Scene();
    window.scene.background = new THREE.Color(0x87CEEB); // Color del cielo
    
    // Configurar cámara
    const aspect = window.innerWidth / window.innerHeight;
    window.camera = new THREE.PerspectiveCamera(
        CONFIG.PLAYER.FOV,
        aspect,
        0.1,
        1000
    );
    window.camera.position.set(0, 50, 0);
    
    // Configurar renderer
    const canvas = document.getElementById('gameCanvas');
    window.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: CONFIG.RENDERING.ANTIALIAS,
        powerPreference: "high-performance"
    });
    
    window.renderer.setSize(window.innerWidth, window.innerHeight);
    window.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    window.renderer.shadowMap.enabled = CONFIG.RENDERING.SHADOWS_ENABLED;
    window.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Configurar niebla
    if (CONFIG.RENDERING.FOG.ENABLED) {
        window.scene.fog = new THREE.Fog(
            CONFIG.RENDERING.FOG.COLOR,
            CONFIG.RENDERING.FOG.NEAR,
            CONFIG.RENDERING.FOG.FAR
        );
    }
    
    // Manejar redimensionamiento
    window.addEventListener('resize', onWindowResize);
    
    console.log('✅ Three.js inicializado');
    if (window.debugSystem) {
        window.debugSystem.checkpoint('THREE_INIT');
    }
}

function initLighting() {
    console.log('💡 Configurando iluminación...');
    
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    window.scene.add(ambientLight);
    
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
    
    window.scene.add(directionalLight);
    
    // Luz de hemisferio para mejor iluminación
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x545454, 0.4);
    window.scene.add(hemisphereLight);
    
    console.log('✅ Iluminación configurada');
    if (window.debugSystem) {
        window.debugSystem.checkpoint('LIGHTING_INIT');
    }
}

function initChunkSystem() {
    console.log('🏗️ Inicializando sistema de chunks...');
    
    try {
        // Crear el gestor de chunks
        window.chunkManager = new ChunkManager(window.scene, window.camera);
        console.log('✅ ChunkManager creado con', window.chunkManager.workers.length, 'workers');
        
        if (window.debugSystem) {
            window.debugSystem.checkpoint('CHUNK_MANAGER_INIT', {
                workers: window.chunkManager.workers.length,
                maxWorkers: window.chunkManager.maxWorkers
            });
        }
    } catch (error) {
        console.error('❌ Error creando ChunkManager:', error);
        if (window.debugSystem) {
            window.debugSystem.error('CHUNK_INIT_ERROR', error.message);
        }
    }
}

function initWorld() {
    console.log('🌍 Creando mundo...');
    
    try {
        // Crear el mundo
        window.world = new World(window.scene);
        console.log('✅ World creado');
        
        if (window.debugSystem) {
            window.debugSystem.checkpoint('WORLD_INIT');
        }
    } catch (error) {
        console.error('❌ Error creando World:', error);
        if (window.debugSystem) {
            window.debugSystem.error('WORLD_INIT_ERROR', error.message);
        }
    }
}

function initPlayer() {
    console.log('🚶 Creando jugador...');
    
    try {
        // Crear objeto del jugador
        window.player = new Player(window.scene, window.camera);
        console.log('✅ Player creado');
        
        if (window.debugSystem) {
            window.debugSystem.checkpoint('PLAYER_INIT');
        }
    } catch (error) {
        console.error('❌ Error creando Player:', error);
        if (window.debugSystem) {
            window.debugSystem.error('PLAYER_INIT_ERROR', error.message);
        }
    }
}

function initGameControls() {
    console.log('🎮 Configurando controles...');
    
    const canvas = document.getElementById('gameCanvas');
    
    try {
        if (CONFIG.DEVICE.IS_MOBILE || CONFIG.DEVICE.HAS_TOUCH) {
            // Controles móviles
            window.mobileControls = new MobileControls(window.camera, canvas);
            window.player.setMobileControls(window.mobileControls);
            
            // Callbacks para bloques
            window.mobileControls.onBlockPlace = () => placeBlock();
            window.mobileControls.onBlockBreak = () => breakBlock();
            
            console.log('✅ Controles móviles configurados');
        } else {
            // Controles de desktop
            window.controls = new Controls(window.camera, canvas);
            window.player.setControls(window.controls);
            
            // Callbacks para bloques
            window.controls.onBlockPlace = (intersection, blockType) => placeBlock();
            window.controls.onBlockBreak = (intersection) => breakBlock();
            
            console.log('✅ Controles de desktop configurados');
        }
        
        if (window.debugSystem) {
            window.debugSystem.checkpoint('CONTROLS_INIT');
        }
    } catch (error) {
        console.error('❌ Error configurando controles:', error);
        if (window.debugSystem) {
            window.debugSystem.error('CONTROLS_INIT_ERROR', error.message);
        }
    }
}

function initUI() {
    console.log('🎨 Inicializando UI...');
    
    // Inicializar hotbar
    const hotbarSlots = document.querySelectorAll('.hotbar-slot');
    hotbarSlots.forEach((slot, index) => {
        slot.addEventListener('click', () => {
            if (window.player) {
                window.player.selectHotbarSlot(index);
            }
        });
    });
    
    // Tecla ESC para pausar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            togglePause();
        }
    });
    
    console.log('✅ UI inicializada');
    if (window.debugSystem) {
        window.debugSystem.checkpoint('UI_INIT');
    }
}

async function generateInitialWorld() {
    console.log('🌎 Generando mundo inicial...');
    
    if (!window.chunkManager) {
        console.error('❌ ChunkManager no disponible para generar mundo');
        return;
    }
    
    // Generar chunks alrededor del spawn
    const spawnRadius = 3;
    let chunksRequested = 0;
    
    for (let x = -spawnRadius; x <= spawnRadius; x++) {
        for (let z = -spawnRadius; z <= spawnRadius; z++) {
            const distance = Math.sqrt(x * x + z * z);
            if (distance <= spawnRadius) {
                const priority = distance < 2 ? 
                    CONFIG.WORKERS.PRIORITY.CRITICAL : 
                    CONFIG.WORKERS.PRIORITY.HIGH;
                window.chunkManager.requestChunk(x, z, priority);
                chunksRequested++;
            }
        }
    }
    
    console.log(`✅ Solicitados ${chunksRequested} chunks iniciales`);
    
    // Esperar un poco para que se generen algunos chunks
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (window.debugSystem) {
        window.debugSystem.checkpoint('WORLD_GENERATION', {
            chunksRequested: chunksRequested
        });
    }
}

function placeBlock() {
    // TODO: Implementar colocación de bloques
    console.log('Colocando bloque:', window.player ? window.player.getSelectedBlock() : 'N/A');
}

function breakBlock() {
    // TODO: Implementar destrucción de bloques
    console.log('Rompiendo bloque');
}

function togglePause() {
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu.style.display === 'block') {
        pauseMenu.style.display = 'none';
        if (!CONFIG.DEVICE.IS_MOBILE && window.controls) {
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
    if (window.chunkManager) {
        const chunkStats = window.chunkManager.getStats();
        document.getElementById('chunks').textContent = 
            `${chunkStats.chunksInView}/${chunkStats.chunksLoaded}`;
    }
    
    // Actualizar posición
    if (window.player) {
        document.getElementById('position').textContent = 
            `${Math.round(window.player.position.x)}, ${Math.round(window.player.position.y)}, ${Math.round(window.player.position.z)}`;
    }
}

function onWindowResize() {
    if (window.camera) {
        window.camera.aspect = window.innerWidth / window.innerHeight;
        window.camera.updateProjectionMatrix();
    }
    if (window.renderer) {
        window.renderer.setSize(window.innerWidth, window.innerHeight);
    }
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
    if (window.player) {
        window.player.update(deltaTime, window.world);
    }
    
    // Actualizar chunks
    if (window.chunkManager && window.player) {
        window.chunkManager.update(window.player.position);
    }
    
    // Actualizar controles
    if (window.controls) {
        window.controls.update(deltaTime);
    }
    if (window.mobileControls) {
        window.mobileControls.update(deltaTime);
    }
    
    // Actualizar estadísticas
    updateStats();
    
    // Renderizar
    if (window.renderer && window.scene && window.camera) {
        window.renderer.render(window.scene, window.camera);
    }
}

// Actualizar el objeto game global
window.game = {
    resume: () => togglePause(),
    settings: () => console.log('Configuración no implementada aún'),
    togglePause: togglePause,
    // Funciones de debug adicionales
    getState: () => ({
        scene: window.scene,
        camera: window.camera,
        renderer: window.renderer,
        player: window.player,
        chunkManager: window.chunkManager,
        world: window.world,
        controls: window.controls,
        mobileControls: window.mobileControls
    })
};

console.log('📜 main.js cargado completamente');