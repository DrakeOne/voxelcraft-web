/**
 * VoxelCraft - Sistema de Gestión de Chunks
 * v0.1.0
 * 
 * Gestiona el pool de workers y la generación/carga de chunks
 */

class ChunkManager {
    constructor(scene, camera) {
        console.log('🏗️ Creando ChunkManager...');
        
        this.scene = scene;
        this.camera = camera;
        
        // Pool de workers
        this.workers = [];
        this.workerPool = [];
        this.nextWorkerId = 0;
        this.maxWorkers = Math.min(2, CONFIG.WORKERS.CHUNK_WORKERS); // Limitar a 2 workers por ahora
        
        // Chunks activos
        this.chunks = new Map();
        this.chunkMeshes = new Map();
        this.loadingChunks = new Set();
        
        // Cola de generación con prioridad
        this.generationQueue = [];
        this.meshingQueue = [];
        
        // Cache de chunks
        this.chunkCache = new Map();
        this.maxCacheSize = CONFIG.OPTIMIZATION.CHUNK_CACHE_SIZE;
        
        // Pool de geometrías para reutilización
        this.geometryPool = [];
        this.materialPool = new Map();
        
        // Estadísticas
        this.stats = {
            chunksLoaded: 0,
            chunksInView: 0,
            verticesRendered: 0,
            workersActive: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Inicializar workers
        this.initWorkers();
        
        // Inicializar materiales
        this.initMaterials();
        
        // Sistema de LOD
        this.lodLevels = CONFIG.RENDERING.LOD_LEVELS;
        
        // Optimización: Frustum culling
        this.frustum = new THREE.Frustum();
        this.frustumMatrix = new THREE.Matrix4();
        
        console.log('✅ ChunkManager creado');
    }
    
    initWorkers() {
        console.log('👷 Inicializando workers...');
        
        for (let i = 0; i < this.maxWorkers; i++) {
            try {
                const worker = new Worker('js/workers/chunk-worker.js');
                
                worker.onmessage = (e) => {
                    console.log(`📨 Mensaje del Worker ${i}:`, e.data.type);
                    this.handleWorkerMessage(e, i);
                };
                
                worker.onerror = (e) => {
                    console.error(`❌ Error en Worker ${i}:`, e);
                    this.handleWorkerError(e, i);
                };
                
                // Inicializar worker
                console.log(`Inicializando Worker ${i}...`);
                worker.postMessage({
                    type: 'init',
                    data: {
                        seed: CONFIG.WORLD.TERRAIN.SEED,
                        workerId: i
                    }
                });
                
                this.workers.push({
                    id: i,
                    worker: worker,
                    busy: false,
                    currentTask: null
                });
                
                this.workerPool.push(i);
                
                console.log(`✅ Worker ${i} creado`);
            } catch (error) {
                console.error(`❌ Error creando Worker ${i}:`, error);
            }
        }
        
        console.log(`✅ ${this.workers.length} workers inicializados`);
    }
    
    initMaterials() {
        console.log('🎨 Inicializando materiales...');
        
        // Crear materiales optimizados para cada tipo de bloque
        const blockColors = {
            1: 0x7CFC00,  // Césped - verde brillante
            2: 0x8B4513,  // Tierra - marrón
            3: 0x808080,  // Piedra - gris
            4: 0x654321,  // Madera - marrón oscuro
            5: 0xF4E4BC,  // Arena - beige
            6: 0x006994,  // Agua - azul
            7: 0x228B22,  // Hojas - verde oscuro
            8: 0xADD8E6,  // Vidrio - azul claro
            9: 0xB22222,  // Ladrillo - rojo
            10: 0xFF0000, // TNT - rojo brillante
            11: 0x1C1C1C  // Bedrock - negro
        };
        
        for (const [blockId, color] of Object.entries(blockColors)) {
            const material = new THREE.MeshLambertMaterial({
                color: color,
                side: THREE.FrontSide
            });
            
            this.materialPool.set(parseInt(blockId), material);
        }
        
        // Material especial para agua con transparencia
        this.materialPool.set(6, new THREE.MeshLambertMaterial({
            color: 0x006994,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        }));
        
        console.log('✅ Materiales creados');
    }
    
    handleWorkerMessage(e, workerId) {
        const { type, data } = e.data;
        
        console.log(`Worker ${workerId} mensaje tipo: ${type}`);
        
        switch (type) {
            case 'initialized':
                console.log(`✅ Worker ${workerId} inicializado correctamente`);
                break;
                
            case 'chunkGenerated':
                console.log(`📦 Chunk generado por Worker ${workerId}:`, data.chunkX, data.chunkZ);
                this.onChunkGenerated(data, workerId);
                break;
                
            case 'batchGenerated':
                this.onBatchGenerated(data, workerId);
                break;
                
            default:
                console.log(`Worker ${workerId} mensaje desconocido:`, type);
        }
        
        // Marcar worker como disponible
        this.workers[workerId].busy = false;
        this.workers[workerId].currentTask = null;
        this.workerPool.push(workerId);
        this.stats.workersActive--;
        
        // Procesar siguiente tarea en cola
        this.processNextInQueue();
    }
    
    handleWorkerError(e, workerId) {
        console.error(`❌ Error en worker ${workerId}:`, e);
        
        // Reintentar la tarea
        const task = this.workers[workerId].currentTask;
        if (task) {
            console.log('Reintentando tarea:', task);
            this.generationQueue.unshift(task);
        }
        
        // Marcar worker como disponible
        this.workers[workerId].busy = false;
        this.workers[workerId].currentTask = null;
        if (!this.workerPool.includes(workerId)) {
            this.workerPool.push(workerId);
        }
        this.stats.workersActive--;
        
        // Procesar siguiente tarea
        this.processNextInQueue();
    }
    
    requestChunk(chunkX, chunkZ, priority = CONFIG.WORKERS.PRIORITY.NORMAL) {
        const key = `${chunkX},${chunkZ}`;
        
        console.log(`📍 Solicitando chunk ${key} con prioridad ${priority}`);
        
        // Verificar si ya está cargado
        if (this.chunks.has(key)) {
            console.log(`Chunk ${key} ya está cargado`);
            this.stats.cacheHits++;
            return;
        }
        
        // Verificar si está en proceso
        if (this.loadingChunks.has(key)) {
            console.log(`Chunk ${key} ya está en proceso`);
            return;
        }
        
        // Verificar cache
        if (this.chunkCache.has(key)) {
            console.log(`Chunk ${key} encontrado en cache`);
            this.stats.cacheHits++;
            this.loadChunkFromCache(key);
            return;
        }
        
        this.stats.cacheMisses++;
        this.loadingChunks.add(key);
        
        // Agregar a cola con prioridad
        const task = {
            chunkX,
            chunkZ,
            priority,
            key,
            timestamp: performance.now()
        };
        
        this.generationQueue.push(task);
        this.generationQueue.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.timestamp - b.timestamp;
        });
        
        console.log(`📋 Chunk ${key} agregado a la cola. Cola actual: ${this.generationQueue.length}`);
        
        // Procesar inmediatamente si hay workers disponibles
        this.processNextInQueue();
    }
    
    processNextInQueue() {
        if (this.generationQueue.length === 0) {
            console.log('Cola vacía');
            return;
        }
        
        if (this.workerPool.length === 0) {
            console.log('No hay workers disponibles');
            return;
        }
        
        const workerId = this.workerPool.shift();
        const task = this.generationQueue.shift();
        
        console.log(`🚀 Asignando chunk ${task.key} al Worker ${workerId}`);
        
        this.workers[workerId].busy = true;
        this.workers[workerId].currentTask = task;
        this.stats.workersActive++;
        
        // Enviar tarea al worker
        try {
            this.workers[workerId].worker.postMessage({
                type: 'generateChunk',
                data: {
                    chunkX: task.chunkX,
                    chunkZ: task.chunkZ,
                    requestId: task.key
                }
            });
            console.log(`✅ Mensaje enviado al Worker ${workerId}`);
        } catch (error) {
            console.error(`❌ Error enviando mensaje al Worker ${workerId}:`, error);
            this.handleWorkerError(error, workerId);
        }
    }
    
    onChunkGenerated(data, workerId) {
        console.log('🎯 Procesando chunk generado:', data);
        
        const { chunkX, chunkZ, voxels, heightMap, biomeMap, generationTime } = data;
        const key = `${chunkX},${chunkZ}`;
        
        // Convertir ArrayBuffer de vuelta a Uint8Array
        const voxelArray = new Uint8Array(voxels);
        const heightArray = new Float32Array(heightMap);
        const biomeArray = new Float32Array(biomeMap);
        
        console.log(`📊 Chunk ${key} generado en ${generationTime.toFixed(2)}ms`);
        console.log(`   - Voxels: ${voxelArray.length}`);
        console.log(`   - HeightMap: ${heightArray.length}`);
        
        // Crear datos del chunk
        const chunkData = {
            voxels: voxelArray,
            heightMap: heightArray,
            biomeMap: biomeArray,
            chunkX,
            chunkZ,
            generationTime
        };
        
        // Guardar en cache
        this.addToCache(key, chunkData);
        
        // Crear mesh del chunk
        this.createChunkMesh(chunkData);
        
        // Remover de loading
        this.loadingChunks.delete(key);
        
        // Actualizar estadísticas
        this.stats.chunksLoaded++;
        
        console.log(`✅ Chunk ${key} completado. Total chunks: ${this.stats.chunksLoaded}`);
    }
    
    createChunkMesh(chunkData) {
        const { chunkX, chunkZ, voxels } = chunkData;
        const key = `${chunkX},${chunkZ}`;
        
        console.log(`🔨 Creando mesh para chunk ${key}`);
        
        // Por ahora, crear un mesh simple para visualizar
        // Crear un cubo por cada bloque sólido (simplificado para testing)
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = this.materialPool.get(1) || new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        
        // Crear un grupo para el chunk
        const chunkGroup = new THREE.Group();
        chunkGroup.name = `chunk_${key}`;
        
        let blockCount = 0;
        
        // Crear cubos solo para la superficie (simplificado)
        for (let x = 0; x < CONFIG.WORLD.CHUNK_SIZE; x++) {
            for (let z = 0; z < CONFIG.WORLD.CHUNK_SIZE; z++) {
                // Obtener altura del terreno
                const heightIndex = x * CONFIG.WORLD.CHUNK_SIZE + z;
                const height = chunkData.heightMap[heightIndex];
                
                if (height && height > 0) {
                    const y = Math.floor(height);
                    
                    // Crear un cubo en esta posición
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(x, y, z);
                    chunkGroup.add(mesh);
                    blockCount++;
                    
                    // Limitar bloques para testing
                    if (blockCount > 100) break;
                }
            }
            if (blockCount > 100) break;
        }
        
        // Posicionar el grupo en el mundo
        chunkGroup.position.set(
            chunkX * CONFIG.WORLD.CHUNK_SIZE,
            0,
            chunkZ * CONFIG.WORLD.CHUNK_SIZE
        );
        
        // Agregar a la escena
        this.scene.add(chunkGroup);
        
        // Guardar referencias
        this.chunks.set(key, chunkData);
        this.chunkMeshes.set(key, chunkGroup);
        
        console.log(`✅ Mesh creado para chunk ${key} con ${blockCount} bloques`);
        
        // Actualizar estadísticas
        this.stats.verticesRendered += blockCount * 8; // 8 vértices por cubo
    }
    
    addToCache(key, chunkData) {
        if (this.chunkCache.size >= this.maxCacheSize) {
            // Eliminar chunk más antiguo
            const firstKey = this.chunkCache.keys().next().value;
            this.chunkCache.delete(firstKey);
        }
        this.chunkCache.set(key, chunkData);
    }
    
    loadChunkFromCache(key) {
        const chunkData = this.chunkCache.get(key);
        if (chunkData) {
            this.createChunkMesh(chunkData);
        }
    }
    
    unloadChunk(chunkX, chunkZ) {
        const key = `${chunkX},${chunkZ}`;
        
        // Remover mesh de la escena
        const mesh = this.chunkMeshes.get(key);
        if (mesh) {
            this.scene.remove(mesh);
            
            // Limpiar geometrías y materiales
            mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            
            this.chunkMeshes.delete(key);
        }
        
        // Mantener datos en cache para recarga rápida
        const chunkData = this.chunks.get(key);
        if (chunkData) {
            this.addToCache(key, chunkData);
            this.chunks.delete(key);
        }
        
        this.stats.chunksLoaded--;
    }
    
    update(playerPosition) {
        // Calcular chunks visibles basado en posición del jugador
        const playerChunkX = Math.floor(playerPosition.x / CONFIG.WORLD.CHUNK_SIZE);
        const playerChunkZ = Math.floor(playerPosition.z / CONFIG.WORLD.CHUNK_SIZE);
        
        const renderDistance = CONFIG.DEVICE.IS_MOBILE ? 
            CONFIG.WORLD.RENDER_DISTANCE_MOBILE : 
            CONFIG.WORLD.RENDER_DISTANCE;
        
        // Actualizar frustum para culling
        if (this.camera) {
            this.frustumMatrix.multiplyMatrices(
                this.camera.projectionMatrix,
                this.camera.matrixWorldInverse
            );
            this.frustum.setFromProjectionMatrix(this.frustumMatrix);
        }
        
        // Solicitar chunks en rango
        const chunksToLoad = [];
        for (let dx = -renderDistance; dx <= renderDistance; dx++) {
            for (let dz = -renderDistance; dz <= renderDistance; dz++) {
                const distance = Math.sqrt(dx * dx + dz * dz);
                if (distance <= renderDistance) {
                    const chunkX = playerChunkX + dx;
                    const chunkZ = playerChunkZ + dz;
                    
                    // Calcular prioridad basada en distancia
                    let priority = CONFIG.WORKERS.PRIORITY.NORMAL;
                    if (distance < 2) {
                        priority = CONFIG.WORKERS.PRIORITY.CRITICAL;
                    } else if (distance < 4) {
                        priority = CONFIG.WORKERS.PRIORITY.HIGH;
                    } else if (distance > renderDistance - 2) {
                        priority = CONFIG.WORKERS.PRIORITY.LOW;
                    }
                    
                    chunksToLoad.push({ chunkX, chunkZ, priority, distance });
                }
            }
        }
        
        // Ordenar por distancia y prioridad
        chunksToLoad.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.distance - b.distance;
        });
        
        // Cargar chunks (limitar a los primeros 10 para no sobrecargar)
        for (let i = 0; i < Math.min(10, chunksToLoad.length); i++) {
            const chunk = chunksToLoad[i];
            this.requestChunk(chunk.chunkX, chunk.chunkZ, chunk.priority);
        }
        
        // Descargar chunks fuera de rango
        for (const [key, chunk] of this.chunks) {
            const [x, z] = key.split(',').map(Number);
            const distance = Math.sqrt(
                Math.pow(x - playerChunkX, 2) + 
                Math.pow(z - playerChunkZ, 2)
            );
            
            if (distance > renderDistance + 2) {
                this.unloadChunk(x, z);
            }
        }
        
        // Actualizar estadísticas
        this.updateStats();
    }
    
    updateStats() {
        this.stats.chunksInView = 0;
        
        for (const [key, mesh] of this.chunkMeshes) {
            if (mesh.visible) {
                this.stats.chunksInView++;
            }
        }
    }
    
    getStats() {
        return this.stats;
    }
    
    dispose() {
        // Limpiar workers
        for (const worker of this.workers) {
            worker.worker.terminate();
        }
        
        // Limpiar meshes
        for (const [key, mesh] of this.chunkMeshes) {
            this.scene.remove(mesh);
            mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
        
        // Limpiar pools
        this.geometryPool.forEach(g => g.dispose());
        this.materialPool.forEach(m => m.dispose());
        
        // Limpiar mapas
        this.chunks.clear();
        this.chunkMeshes.clear();
        this.chunkCache.clear();
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChunkManager;
}