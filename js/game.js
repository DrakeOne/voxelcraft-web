/**
 * VoxelCraft - Sistema de Juego
 * v0.1.0
 * 
 * Clase principal del juego
 */

class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.player = null;
        this.chunkManager = null;
        this.controls = null;
        this.mobileControls = null;
        
        this.isPaused = false;
        this.isRunning = false;
        
        // FPS counter
        this.fpsCounter = Utils.createFPSCounter();
        
        // Performance monitor
        this.perfMonitor = Utils.createPerformanceMonitor();
    }
    
    async init() {
        console.log('🎮 Inicializando VoxelCraft v' + CONFIG.VERSION);
        
        // Verificar WebGL
        if (!Utils.isWebGLAvailable()) {
            alert(Utils.getWebGLErrorMessage());
            return false;
        }
        
        // Inicializar Three.js
        this.initThreeJS();
        
        // Inicializar iluminación
        this.initLighting();
        
        // Inicializar mundo
        this.world = new World(this.scene);
        
        // Inicializar sistema de chunks
        this.chunkManager = new ChunkManager(this.scene, this.camera);
        
        // Inicializar jugador
        this.player = new Player(this.scene, this.camera);
        
        // Inicializar controles
        this.initControls();
        
        // Inicializar UI
        this.initUI();
        
        // Generar mundo inicial
        await this.generateInitialWorld();
        
        this.isRunning = true;
        
        console.log('✅ Juego inicializado correctamente');
        return true;
    }
    
    initThreeJS() {
        // Crear escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // Crear cámara
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.PLAYER.FOV,
            aspect,
            0.1,
            1000
        );
        
        // Crear renderer
        const canvas = document.getElementById('gameCanvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: CONFIG.RENDERING.ANTIALIAS,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = CONFIG.RENDERING.SHADOWS_ENABLED;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Configurar niebla
        if (CONFIG.RENDERING.FOG.ENABLED) {
            this.scene.fog = new THREE.Fog(
                CONFIG.RENDERING.FOG.COLOR,
                CONFIG.RENDERING.FOG.NEAR,
                CONFIG.RENDERING.FOG.FAR
            );
        }
        
        // Manejar redimensionamiento
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    initLighting() {
        // Luz ambiental
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
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
        
        this.scene.add(directionalLight);
        
        // Luz de hemisferio
        const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x545454, 0.4);
        this.scene.add(hemisphereLight);
    }
    
    initControls() {
        if (CONFIG.DEVICE.IS_MOBILE || CONFIG.DEVICE.HAS_TOUCH) {
            // Controles móviles
            this.mobileControls = new MobileControls(this.camera, this.renderer.domElement);
            this.player.setMobileControls(this.mobileControls);
            
            // Callbacks para bloques
            this.mobileControls.onBlockPlace = () => this.placeBlock();
            this.mobileControls.onBlockBreak = () => this.breakBlock();
        } else {
            // Controles de desktop
            this.controls = new Controls(this.camera, this.renderer.domElement);
            this.player.setControls(this.controls);
            
            // Callbacks para bloques
            this.controls.onBlockPlace = (intersection, blockType) => this.placeBlock(intersection, blockType);
            this.controls.onBlockBreak = (intersection) => this.breakBlock(intersection);
        }
    }
    
    initUI() {
        // Inicializar hotbar
        const hotbarSlots = document.querySelectorAll('.hotbar-slot');
        hotbarSlots.forEach((slot, index) => {
            slot.addEventListener('click', () => {
                this.player.selectHotbarSlot(index);
            });
        });
        
        // ESC para pausar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.togglePause();
            }
        });
    }
    
    async generateInitialWorld() {
        // Generar chunks alrededor del spawn
        const spawnRadius = 3;
        
        for (let x = -spawnRadius; x <= spawnRadius; x++) {
            for (let z = -spawnRadius; z <= spawnRadius; z++) {
                const distance = Math.sqrt(x * x + z * z);
                if (distance <= spawnRadius) {
                    const priority = distance < 2 ? 
                        CONFIG.WORKERS.PRIORITY.CRITICAL : 
                        CONFIG.WORKERS.PRIORITY.HIGH;
                    this.chunkManager.requestChunk(x, z, priority);
                }
            }
        }
        
        // Esperar un poco para que se generen algunos chunks
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    placeBlock(intersection, blockType) {
        if (!intersection) return;
        
        // TODO: Implementar colocación de bloques
        console.log('Colocando bloque:', blockType);
    }
    
    breakBlock(intersection) {
        if (!intersection) return;
        
        // TODO: Implementar destrucción de bloques
        console.log('Rompiendo bloque');
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        
        const pauseMenu = document.getElementById('pauseMenu');
        if (this.isPaused) {
            pauseMenu.style.display = 'block';
            if (this.controls) {
                document.exitPointerLock();
            }
        } else {
            pauseMenu.style.display = 'none';
            if (this.controls && !CONFIG.DEVICE.IS_MOBILE) {
                this.renderer.domElement.requestPointerLock();
            }
        }
    }
    
    resume() {
        if (this.isPaused) {
            this.togglePause();
        }
    }
    
    settings() {
        console.log('Abriendo configuración...');
        // TODO: Implementar menú de configuración
    }
    
    update(deltaTime) {
        if (!this.isRunning || this.isPaused) return;
        
        // Actualizar jugador
        this.player.update(deltaTime, this.world);
        
        // Actualizar chunks
        this.chunkManager.update(this.player.position);
        
        // Actualizar controles
        if (this.controls) {
            this.controls.update(deltaTime);
        }
        if (this.mobileControls) {
            this.mobileControls.update(deltaTime);
        }
        
        // Actualizar FPS
        this.fpsCounter.update();
        
        // Actualizar UI
        this.updateUI();
    }
    
    updateUI() {
        // FPS
        document.getElementById('fps').textContent = this.fpsCounter.get();
        
        // Chunks
        const chunkStats = this.chunkManager.getStats();
        document.getElementById('chunks').textContent = 
            `${chunkStats.chunksInView}/${chunkStats.chunksLoaded}`;
    }
    
    render() {
        if (!this.isRunning) return;
        
        this.renderer.render(this.scene, this.camera);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    dispose() {
        this.isRunning = false;
        
        // Limpiar chunk manager
        if (this.chunkManager) {
            this.chunkManager.dispose();
        }
        
        // Limpiar jugador
        if (this.player) {
            this.player.dispose();
        }
        
        // Limpiar controles
        if (this.controls) {
            this.controls.dispose();
        }
        if (this.mobileControls) {
            this.mobileControls.dispose();
        }
        
        // Limpiar renderer
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.Game = Game;
}

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Game;
}