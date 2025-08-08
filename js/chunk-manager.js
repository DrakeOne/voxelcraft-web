/**
 * VoxelCraft - Sistema de Gestión de Chunks
 * v0.1.0
 * 
 * Gestiona el pool de workers y la generación/carga de chunks
 */

class ChunkManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Pool de workers
        this.workers = [];
        this.workerPool = [];
        this.nextWorkerId = 0;
        this.maxWorkers = CONFIG.WORKERS.CHUNK_WORKERS;
        
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
    }
    
    initWorkers() {
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = new Worker('js/workers/chunk-worker.js');
            
            worker.onmessage = (e) => this.handleWorkerMessage(e, i);
            worker.onerror = (e) => this.handleWorkerError(e, i);
            
            // Inicializar worker
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
        }
    }
    
    initMaterials() {
        // Crear materiales optimizados para cada tipo de bloque
        for (const [blockId, properties] of Object.entries(CONFIG.BLOCK_PROPERTIES)) {
            if (properties.color) {
                const material = new THREE.MeshLambertMaterial({
                    color: properties.color,
                    transparent: properties.transparent,
                    opacity: properties.transparent ? 0.8 : 1.0,
                    side: THREE.FrontSide
                });
                
                this.materialPool.set(parseInt(blockId), material);
            }
        }
        
        // Material especial para agua con transparencia
        this.materialPool.set(CONFIG.BLOCKS.WATER, new THREE.MeshLambertMaterial({
            color: 0x006994,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        }));
    }
    
    handleWorkerMessage(e, workerId) {
        const { type, data } = e.data;
        
        switch (type) {
            case 'initialized':
                console.log(`Worker ${workerId} inicializado`);
                break;
                
            case 'chunkGenerated':
                this.onChunkGenerated(data, workerId);
                break;
                
            case 'batchGenerated':
                this.onBatchGenerated(data, workerId);
                break;
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
        console.error(`Error en worker ${workerId}:`, e);
        
        // Reintentar la tarea
        const task = this.workers[workerId].currentTask;
        if (task) {
            this.generationQueue.unshift(task);
        }
        
        // Reiniciar worker
        this.workers[workerId].busy = false;
        this.workers[workerId].currentTask = null;
        this.workerPool.push(workerId);
        this.stats.workersActive--;
    }
    
    requestChunk(chunkX, chunkZ, priority = CONFIG.WORKERS.PRIORITY.NORMAL) {
        const key = `${chunkX},${chunkZ}`;
        
        // Verificar si ya está cargado
        if (this.chunks.has(key)) {
            this.stats.cacheHits++;
            return;
        }
        
        // Verificar si está en proceso
        if (this.loadingChunks.has(key)) {
            return;
        }
        
        // Verificar cache
        if (this.chunkCache.has(key)) {
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
        
        this.processNextInQueue();
    }
    
    processNextInQueue() {
        if (this.generationQueue.length === 0 || this.workerPool.length === 0) {
            return;
        }
        
        const workerId = this.workerPool.shift();
        const task = this.generationQueue.shift();
        
        this.workers[workerId].busy = true;
        this.workers[workerId].currentTask = task;
        this.stats.workersActive++;
        
        // Enviar tarea al worker
        this.workers[workerId].worker.postMessage({
            type: 'generateChunk',
            data: {
                chunkX: task.chunkX,
                chunkZ: task.chunkZ,
                requestId: task.key
            }
        });
    }
    
    onChunkGenerated(data, workerId) {
        const { chunkX, chunkZ, voxels, heightMap, biomeMap, generationTime } = data;
        const key = `${chunkX},${chunkZ}`;
        
        // Convertir ArrayBuffer de vuelta a Uint8Array
        const voxelArray = new Uint8Array(voxels);
        const heightArray = new Float32Array(heightMap);
        const biomeArray = new Float32Array(biomeMap);
        
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
    }
    
    createChunkMesh(chunkData) {
        const { chunkX, chunkZ, voxels } = chunkData;
        const key = `${chunkX},${chunkZ}`;
        
        // Usar greedy meshing para optimización
        const meshData = CONFIG.OPTIMIZATION.GREEDY_MESHING ? 
            this.greedyMesh(voxels) : 
            this.simpleMesh(voxels);
        
        if (meshData.vertices.length === 0) {
            return; // Chunk vacío
        }
        
        // Crear o reutilizar geometría
        const geometry = this.getPooledGeometry();
        
        // Configurar atributos de geometría
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(meshData.colors, 3));
        
        // Optimización: Calcular bounding box para frustum culling
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        
        // Crear mesh con instanced rendering si está habilitado
        let mesh;
        if (CONFIG.OPTIMIZATION.INSTANCED_RENDERING && meshData.instances) {
            mesh = this.createInstancedMesh(geometry, meshData.instances);
        } else {
            // Crear mesh normal con material múltiple
            const materials = this.getMaterialsForChunk(meshData.blockTypes);
            mesh = new THREE.Mesh(geometry, materials);
        }
        
        // Posicionar mesh en el mundo
        mesh.position.set(
            chunkX * CONFIG.WORLD.CHUNK_SIZE,
            0,
            chunkZ * CONFIG.WORLD.CHUNK_SIZE
        );
        
        // Configurar propiedades del mesh
        mesh.castShadow = CONFIG.RENDERING.SHADOWS_ENABLED;
        mesh.receiveShadow = CONFIG.RENDERING.SHADOWS_ENABLED;
        mesh.frustumCulled = CONFIG.RENDERING.FRUSTUM_CULLING;
        
        // Agregar a la escena
        this.scene.add(mesh);
        
        // Guardar referencias
        this.chunks.set(key, chunkData);
        this.chunkMeshes.set(key, mesh);
        
        // Actualizar estadísticas
        this.stats.verticesRendered += meshData.vertices.length / 3;
    }
    
    greedyMesh(voxels) {
        // Implementación de greedy meshing para reducir polígonos
        const vertices = [];
        const normals = [];
        const uvs = [];
        const colors = [];
        const blockTypes = new Set();
        
        // Direcciones para las 6 caras del cubo
        const directions = [
            { axis: 0, dir: 1 },  // +X
            { axis: 0, dir: -1 }, // -X
            { axis: 1, dir: 1 },  // +Y
            { axis: 1, dir: -1 }, // -Y
            { axis: 2, dir: 1 },  // +Z
            { axis: 2, dir: -1 }  // -Z
        ];
        
        for (const { axis, dir } of directions) {
            const mask = new Uint8Array(CONFIG.WORLD.CHUNK_SIZE * CONFIG.WORLD.CHUNK_SIZE);
            
            for (let d = 0; d < CONFIG.WORLD.CHUNK_HEIGHT; d++) {
                // Generar máscara para esta capa
                let n = 0;
                for (let u = 0; u < CONFIG.WORLD.CHUNK_SIZE; u++) {
                    for (let v = 0; v < CONFIG.WORLD.CHUNK_SIZE; v++) {
                        const pos = [0, 0, 0];
                        pos[axis] = d;
                        pos[(axis + 1) % 3] = u;
                        pos[(axis + 2) % 3] = v;
                        
                        const current = this.getVoxel(voxels, pos[0], pos[1], pos[2]);
                        
                        pos[axis] += dir;
                        const neighbor = this.getVoxel(voxels, pos[0], pos[1], pos[2]);
                        
                        if (current && !neighbor) {
                            mask[n] = current;
                        } else {
                            mask[n] = 0;
                        }
                        n++;
                    }
                }
                
                // Generar mesh desde la máscara
                n = 0;
                for (let j = 0; j < CONFIG.WORLD.CHUNK_SIZE; j++) {
                    for (let i = 0; i < CONFIG.WORLD.CHUNK_SIZE;) {
                        if (mask[n]) {
                            const blockType = mask[n];
                            blockTypes.add(blockType);
                            
                            // Calcular dimensiones del quad
                            let w = 1;
                            while (i + w < CONFIG.WORLD.CHUNK_SIZE && mask[n + w] === blockType) {
                                w++;
                            }
                            
                            let h = 1;
                            let done = false;
                            while (j + h < CONFIG.WORLD.CHUNK_SIZE) {
                                for (let k = 0; k < w; k++) {
                                    if (mask[n + k + h * CONFIG.WORLD.CHUNK_SIZE] !== blockType) {
                                        done = true;
                                        break;
                                    }
                                }
                                if (done) break;
                                h++;
                            }
                            
                            // Agregar quad
                            const x = [0, 0, 0];
                            x[axis] = d;
                            x[(axis + 1) % 3] = i;
                            x[(axis + 2) % 3] = j;
                            
                            const du = [0, 0, 0];
                            du[(axis + 1) % 3] = w;
                            
                            const dv = [0, 0, 0];
                            dv[(axis + 2) % 3] = h;
                            
                            this.addQuad(
                                vertices, normals, uvs, colors,
                                x, du, dv, dir, blockType
                            );
                            
                            // Limpiar máscara
                            for (let l = 0; l < h; l++) {
                                for (let k = 0; k < w; k++) {
                                    mask[n + k + l * CONFIG.WORLD.CHUNK_SIZE] = 0;
                                }
                            }
                            
                            i += w;
                            n += w;
                        } else {
                            i++;
                            n++;
                        }
                    }
                }
            }
        }
        
        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            uvs: new Float32Array(uvs),
            colors: new Float32Array(colors),
            blockTypes: Array.from(blockTypes)
        };
    }
    
    simpleMesh(voxels) {
        // Meshing simple sin optimización (fallback)
        const vertices = [];
        const normals = [];
        const uvs = [];
        const colors = [];
        const blockTypes = new Set();
        
        for (let x = 0; x < CONFIG.WORLD.CHUNK_SIZE; x++) {
            for (let y = 0; y < CONFIG.WORLD.CHUNK_HEIGHT; y++) {
                for (let z = 0; z < CONFIG.WORLD.CHUNK_SIZE; z++) {
                    const voxel = this.getVoxel(voxels, x, y, z);
                    
                    if (voxel && voxel !== CONFIG.BLOCKS.AIR) {
                        blockTypes.add(voxel);
                        
                        // Verificar caras visibles
                        const faces = [
                            { dir: [1, 0, 0], check: [x + 1, y, z] },   // +X
                            { dir: [-1, 0, 0], check: [x - 1, y, z] },  // -X
                            { dir: [0, 1, 0], check: [x, y + 1, z] },   // +Y
                            { dir: [0, -1, 0], check: [x, y - 1, z] },  // -Y
                            { dir: [0, 0, 1], check: [x, y, z + 1] },   // +Z
                            { dir: [0, 0, -1], check: [x, y, z - 1] }   // -Z
                        ];
                        
                        for (const face of faces) {
                            const neighbor = this.getVoxel(voxels, ...face.check);
                            
                            if (!neighbor || neighbor === CONFIG.BLOCKS.AIR) {
                                this.addCubeFace(
                                    vertices, normals, uvs, colors,
                                    [x, y, z], face.dir, voxel
                                );
                            }
                        }
                    }
                }
            }
        }
        
        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            uvs: new Float32Array(uvs),
            colors: new Float32Array(colors),
            blockTypes: Array.from(blockTypes)
        };
    }
    
    getVoxel(voxels, x, y, z) {
        if (x < 0 || x >= CONFIG.WORLD.CHUNK_SIZE ||
            y < 0 || y >= CONFIG.WORLD.CHUNK_HEIGHT ||
            z < 0 || z >= CONFIG.WORLD.CHUNK_SIZE) {
            return 0;
        }
        
        const index = x + y * CONFIG.WORLD.CHUNK_SIZE * CONFIG.WORLD.CHUNK_SIZE + z * CONFIG.WORLD.CHUNK_SIZE;
        return voxels[index];
    }
    
    addQuad(vertices, normals, uvs, colors, pos, du, dv, dir, blockType) {
        const color = this.getBlockColor(blockType);
        const normal = dir > 0 ? [0, 0, 0] : [0, 0, 0];
        normal[Math.abs(dir) - 1] = dir > 0 ? 1 : -1;
        
        // Vértices del quad
        const v = [
            [pos[0], pos[1], pos[2]],
            [pos[0] + du[0], pos[1] + du[1], pos[2] + du[2]],
            [pos[0] + du[0] + dv[0], pos[1] + du[1] + dv[1], pos[2] + du[2] + dv[2]],
            [pos[0] + dv[0], pos[1] + dv[1], pos[2] + dv[2]]
        ];
        
        // Agregar dos triángulos
        const indices = [0, 1, 2, 0, 2, 3];
        for (const i of indices) {
            vertices.push(...v[i]);
            normals.push(...normal);
            uvs.push(i === 1 || i === 2 ? 1 : 0, i === 2 || i === 3 ? 1 : 0);
            colors.push(...color);
        }
    }
    
    addCubeFace(vertices, normals, uvs, colors, pos, dir, blockType) {
        // Implementación simplificada para agregar una cara del cubo
        const color = this.getBlockColor(blockType);
        
        // Definir vértices según la dirección
        let faceVertices;
        if (dir[0] === 1) { // +X
            faceVertices = [
                [pos[0] + 1, pos[1], pos[2]],
                [pos[0] + 1, pos[1] + 1, pos[2]],
                [pos[0] + 1, pos[1] + 1, pos[2] + 1],
                [pos[0] + 1, pos[1], pos[2] + 1]
            ];
        } else if (dir[0] === -1) { // -X
            faceVertices = [
                [pos[0], pos[1], pos[2] + 1],
                [pos[0], pos[1] + 1, pos[2] + 1],
                [pos[0], pos[1] + 1, pos[2]],
                [pos[0], pos[1], pos[2]]
            ];
        } else if (dir[1] === 1) { // +Y
            faceVertices = [
                [pos[0], pos[1] + 1, pos[2] + 1],
                [pos[0] + 1, pos[1] + 1, pos[2] + 1],
                [pos[0] + 1, pos[1] + 1, pos[2]],
                [pos[0], pos[1] + 1, pos[2]]
            ];
        } else if (dir[1] === -1) { // -Y
            faceVertices = [
                [pos[0], pos[1], pos[2]],
                [pos[0] + 1, pos[1], pos[2]],
                [pos[0] + 1, pos[1], pos[2] + 1],
                [pos[0], pos[1], pos[2] + 1]
            ];
        } else if (dir[2] === 1) { // +Z
            faceVertices = [
                [pos[0], pos[1], pos[2] + 1],
                [pos[0] + 1, pos[1], pos[2] + 1],
                [pos[0] + 1, pos[1] + 1, pos[2] + 1],
                [pos[0], pos[1] + 1, pos[2] + 1]
            ];
        } else { // -Z
            faceVertices = [
                [pos[0] + 1, pos[1], pos[2]],
                [pos[0], pos[1], pos[2]],
                [pos[0], pos[1] + 1, pos[2]],
                [pos[0] + 1, pos[1] + 1, pos[2]]
            ];
        }
        
        // Agregar triángulos
        const indices = [0, 1, 2, 0, 2, 3];
        for (const i of indices) {
            vertices.push(...faceVertices[i]);
            normals.push(...dir);
            uvs.push(i === 1 || i === 2 ? 1 : 0, i === 2 || i === 3 ? 1 : 0);
            colors.push(...color);
        }
    }
    
    getBlockColor(blockType) {
        const properties = CONFIG.BLOCK_PROPERTIES[blockType];
        if (properties && properties.color) {
            const color = new THREE.Color(properties.color);
            return [color.r, color.g, color.b];
        }
        return [1, 1, 1];
    }
    
    getMaterialsForChunk(blockTypes) {
        const materials = [];
        for (const blockType of blockTypes) {
            if (this.materialPool.has(blockType)) {
                materials.push(this.materialPool.get(blockType));
            }
        }
        return materials.length > 1 ? materials : materials[0];
    }
    
    getPooledGeometry() {
        if (this.geometryPool.length > 0) {
            return this.geometryPool.pop();
        }
        return new THREE.BufferGeometry();
    }
    
    returnGeometryToPool(geometry) {
        if (this.geometryPool.length < CONFIG.OPTIMIZATION.GEOMETRY_CACHE_SIZE) {
            geometry.deleteAttribute('position');
            geometry.deleteAttribute('normal');
            geometry.deleteAttribute('uv');
            geometry.deleteAttribute('color');
            this.geometryPool.push(geometry);
        } else {
            geometry.dispose();
        }
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
            
            // Retornar geometría al pool
            this.returnGeometryToPool(mesh.geometry);
            
            // Limpiar mesh
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
            
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
        this.frustumMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.frustumMatrix);
        
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
        
        // Cargar chunks
        for (const chunk of chunksToLoad) {
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
        
        // Actualizar LOD para chunks visibles
        this.updateLOD(playerPosition);
        
        // Actualizar estadísticas
        this.updateStats();
    }
    
    updateLOD(playerPosition) {
        if (!CONFIG.RENDERING.LOD_ENABLED) return;
        
        for (const [key, mesh] of this.chunkMeshes) {
            const distance = mesh.position.distanceTo(playerPosition);
            
            // Aplicar nivel de detalle apropiado
            for (const lodLevel of this.lodLevels) {
                if (distance <= lodLevel.distance) {
                    mesh.visible = true;
                    // Aquí se podría cambiar la geometría por una versión simplificada
                    break;
                }
            }
            
            // Ocultar chunks muy lejanos
            if (distance > CONFIG.RENDERING.FOG.FAR) {
                mesh.visible = false;
            }
        }
    }
    
    updateStats() {
        this.stats.chunksInView = 0;
        
        for (const [key, mesh] of this.chunkMeshes) {
            if (mesh.visible && this.frustum.intersectsObject(mesh)) {
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
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                mesh.material.dispose();
            }
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