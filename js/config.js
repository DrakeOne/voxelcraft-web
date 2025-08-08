/**
 * VoxelCraft - Archivo de Configuración
 * v0.1.0
 * 
 * Configuración global del juego con todas las optimizaciones
 */

const CONFIG = {
    // Información del juego
    VERSION: '0.1.0',
    GAME_NAME: 'VoxelCraft',
    
    // Configuración del mundo
    WORLD: {
        // Tamaño de chunks (potencia de 2 para optimización)
        CHUNK_SIZE: 16,
        CHUNK_HEIGHT: 64,
        
        // Distancia de renderizado (en chunks)
        RENDER_DISTANCE: 8,
        RENDER_DISTANCE_MOBILE: 5,
        
        // Generación del terreno
        TERRAIN: {
            SEED: Date.now(),
            WATER_LEVEL: 20,
            MAX_HEIGHT: 48,
            MIN_HEIGHT: 8,
            
            // Octavas de ruido para terreno más realista
            OCTAVES: 4,
            PERSISTENCE: 0.5,
            LACUNARITY: 2.0,
            SCALE: 0.02,
            
            // Biomas básicos
            BIOMES: {
                PLAINS: { height: 0.3, variation: 0.1 },
                HILLS: { height: 0.5, variation: 0.2 },
                MOUNTAINS: { height: 0.8, variation: 0.3 }
            }
        },
        
        // Pool de objetos para optimización de memoria
        OBJECT_POOL_SIZE: 1000,
        
        // Límites del mundo
        WORLD_BOUNDS: {
            MIN_X: -1000,
            MAX_X: 1000,
            MIN_Z: -1000,
            MAX_Z: 1000
        }
    },
    
    // Tipos de bloques
    BLOCKS: {
        AIR: 0,
        GRASS: 1,
        DIRT: 2,
        STONE: 3,
        WOOD: 4,
        SAND: 5,
        WATER: 6,
        LEAVES: 7,
        GLASS: 8,
        BRICK: 9,
        TNT: 10,
        BEDROCK: 11
    },
    
    // Propiedades de los bloques
    BLOCK_PROPERTIES: {
        0: { name: 'Aire', solid: false, transparent: true, color: null },
        1: { name: 'Tierra', solid: true, transparent: false, color: 0x7CFC00 },
        2: { name: 'Tierra', solid: true, transparent: false, color: 0x8B4513 },
        3: { name: 'Piedra', solid: true, transparent: false, color: 0x808080 },
        4: { name: 'Madera', solid: true, transparent: false, color: 0x8B4513 },
        5: { name: 'Arena', solid: true, transparent: false, color: 0xF4E4BC },
        6: { name: 'Agua', solid: false, transparent: true, color: 0x006994 },
        7: { name: 'Hojas', solid: true, transparent: true, color: 0x228B22 },
        8: { name: 'Vidrio', solid: true, transparent: true, color: 0xADD8E6 },
        9: { name: 'Ladrillo', solid: true, transparent: false, color: 0xB22222 },
        10: { name: 'TNT', solid: true, transparent: false, color: 0xFF0000 },
        11: { name: 'Bedrock', solid: true, transparent: false, color: 0x1C1C1C }
    },
    
    // Configuración del jugador
    PLAYER: {
        // Movimiento
        WALK_SPEED: 5.0,
        RUN_SPEED: 8.0,
        JUMP_FORCE: 8.0,
        
        // Física
        GRAVITY: -20.0,
        FRICTION: 0.9,
        AIR_FRICTION: 0.98,
        
        // Cámara
        CAMERA_HEIGHT: 1.6,
        FOV: 75,
        FOV_RUNNING: 80,
        
        // Interacción
        REACH_DISTANCE: 5,
        BREAK_TIME: 0.5, // segundos
        
        // Colisión
        WIDTH: 0.6,
        HEIGHT: 1.8,
        
        // Sensibilidad (desktop)
        MOUSE_SENSITIVITY: 0.002,
        
        // Sensibilidad (móvil)
        TOUCH_SENSITIVITY: 0.003,
        JOYSTICK_SENSITIVITY: 0.05
    },
    
    // Configuración de renderizado
    RENDERING: {
        // Sombras
        SHADOWS_ENABLED: true,
        SHADOW_MAP_SIZE: 2048,
        
        // Anti-aliasing
        ANTIALIAS: true,
        PIXEL_RATIO: window.devicePixelRatio || 1,
        
        // Niebla para ocultar chunks lejanos
        FOG: {
            ENABLED: true,
            COLOR: 0x87CEEB,
            NEAR: 50,
            FAR: 200
        },
        
        // Optimizaciones
        FRUSTUM_CULLING: true,
        OCCLUSION_CULLING: true,
        LOD_ENABLED: true,
        LOD_LEVELS: [
            { distance: 0, detail: 1.0 },
            { distance: 50, detail: 0.5 },
            { distance: 100, detail: 0.25 }
        ],
        
        // Límite de FPS
        TARGET_FPS: 60,
        TARGET_FPS_MOBILE: 30
    },
    
    // Configuración de Web Workers
    WORKERS: {
        // Número de workers para generación de chunks
        CHUNK_WORKERS: navigator.hardwareConcurrency || 4,
        
        // Tamaño del pool de workers
        WORKER_POOL_SIZE: 4,
        
        // Timeout para tareas de workers (ms)
        TASK_TIMEOUT: 5000,
        
        // Prioridad de tareas
        PRIORITY: {
            CRITICAL: 0,
            HIGH: 1,
            NORMAL: 2,
            LOW: 3
        }
    },
    
    // Configuración de caché y optimización
    OPTIMIZATION: {
        // Caché de chunks
        CHUNK_CACHE_SIZE: 100,
        
        // Caché de geometría
        GEOMETRY_CACHE_SIZE: 50,
        
        // Caché de texturas
        TEXTURE_CACHE_SIZE: 20,
        
        // Actualización de chunks por frame
        CHUNKS_UPDATE_PER_FRAME: 2,
        
        // Meshing greedy para reducir polígonos
        GREEDY_MESHING: true,
        
        // Instanced rendering para bloques repetidos
        INSTANCED_RENDERING: true,
        
        // Batch size para instanced rendering
        INSTANCE_BATCH_SIZE: 1000,
        
        // Usar BufferGeometry compartida
        SHARED_GEOMETRY: true,
        
        // Merge de geometrías cercanas
        GEOMETRY_MERGING: true,
        MERGE_DISTANCE: 2
    },
    
    // Configuración de controles móviles
    MOBILE: {
        // Detección automática
        AUTO_DETECT: true,
        
        // Tamaño de botones
        BUTTON_SIZE: 60,
        JOYSTICK_SIZE: 120,
        
        // Zona muerta del joystick
        JOYSTICK_DEADZONE: 0.15,
        
        // Vibración háptica
        HAPTIC_FEEDBACK: true,
        HAPTIC_DURATION: 10,
        
        // Auto-jump en móvil
        AUTO_JUMP: true,
        
        // Simplificaciones para rendimiento
        SIMPLIFIED_SHADOWS: true,
        REDUCED_PARTICLES: true,
        LOWER_RESOLUTION: 0.75
    },
    
    // Configuración de audio
    AUDIO: {
        ENABLED: true,
        MASTER_VOLUME: 0.7,
        
        SOUNDS: {
            BLOCK_BREAK: 'sounds/break.mp3',
            BLOCK_PLACE: 'sounds/place.mp3',
            FOOTSTEP: 'sounds/step.mp3',
            JUMP: 'sounds/jump.mp3',
            SPLASH: 'sounds/splash.mp3'
        },
        
        // Audio espacial 3D
        SPATIAL_AUDIO: true,
        MAX_DISTANCE: 50
    },
    
    // Configuración de red (para futuras versiones multijugador)
    NETWORK: {
        ENABLED: false,
        SERVER_URL: '',
        UPDATE_RATE: 20, // Hz
        INTERPOLATION: true,
        PREDICTION: true
    },
    
    // Configuración de debug
    DEBUG: {
        ENABLED: false,
        SHOW_FPS: true,
        SHOW_CHUNKS: true,
        SHOW_POSITION: true,
        SHOW_WIREFRAME: false,
        SHOW_CHUNK_BORDERS: false,
        SHOW_COLLISION_BOXES: false,
        LOG_PERFORMANCE: false,
        
        // Herramientas de desarrollo
        CHUNK_INSPECTOR: false,
        MEMORY_MONITOR: false,
        WORKER_MONITOR: false
    },
    
    // Configuración de guardado
    SAVE: {
        AUTO_SAVE: true,
        AUTO_SAVE_INTERVAL: 60000, // 1 minuto
        USE_LOCAL_STORAGE: true,
        USE_INDEXED_DB: true,
        COMPRESSION: true
    },
    
    // Detección de capacidades del dispositivo
    DEVICE: {
        IS_MOBILE: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        HAS_TOUCH: 'ontouchstart' in window,
        HAS_POINTER: window.PointerEvent !== undefined,
        HAS_WEBGL2: !!document.createElement('canvas').getContext('webgl2'),
        CORES: navigator.hardwareConcurrency || 2,
        MEMORY: navigator.deviceMemory || 4,
        CONNECTION: navigator.connection?.effectiveType || '4g'
    }
};

// Ajustes automáticos basados en el dispositivo
if (CONFIG.DEVICE.IS_MOBILE) {
    CONFIG.WORLD.RENDER_DISTANCE = CONFIG.WORLD.RENDER_DISTANCE_MOBILE;
    CONFIG.RENDERING.TARGET_FPS = CONFIG.RENDERING.TARGET_FPS_MOBILE;
    CONFIG.RENDERING.SHADOW_MAP_SIZE = 1024;
    CONFIG.RENDERING.LOD_ENABLED = true;
    CONFIG.OPTIMIZATION.CHUNKS_UPDATE_PER_FRAME = 1;
    CONFIG.WORKERS.CHUNK_WORKERS = Math.min(2, CONFIG.DEVICE.CORES);
}

// Ajustes basados en memoria disponible
if (CONFIG.DEVICE.MEMORY < 4) {
    CONFIG.OPTIMIZATION.CHUNK_CACHE_SIZE = 50;
    CONFIG.OPTIMIZATION.GEOMETRY_CACHE_SIZE = 25;
    CONFIG.WORLD.RENDER_DISTANCE = Math.min(CONFIG.WORLD.RENDER_DISTANCE, 5);
}

// Ajustes basados en conexión
if (CONFIG.DEVICE.CONNECTION === '3g' || CONFIG.DEVICE.CONNECTION === '2g') {
    CONFIG.NETWORK.UPDATE_RATE = 10;
}

// Congelar configuración para evitar modificaciones accidentales
Object.freeze(CONFIG);
Object.freeze(CONFIG.WORLD);
Object.freeze(CONFIG.BLOCKS);
Object.freeze(CONFIG.BLOCK_PROPERTIES);
Object.freeze(CONFIG.PLAYER);
Object.freeze(CONFIG.RENDERING);
Object.freeze(CONFIG.WORKERS);
Object.freeze(CONFIG.OPTIMIZATION);
Object.freeze(CONFIG.MOBILE);
Object.freeze(CONFIG.AUDIO);
Object.freeze(CONFIG.DEBUG);
Object.freeze(CONFIG.SAVE);
Object.freeze(CONFIG.DEVICE);

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}