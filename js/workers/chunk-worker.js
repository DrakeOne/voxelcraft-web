/**
 * VoxelCraft - Web Worker para Generación de Chunks
 * v0.1.0
 * 
 * Worker optimizado para generación procedural de chunks usando ruido Perlin/Simplex
 */

// Importar scripts necesarios en el worker
self.importScripts('../lib/noise.js');

// Cache de chunks generados para reutilización
const chunkCache = new Map();
const MAX_CACHE_SIZE = 50;

// Configuración local del worker
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;
const WATER_LEVEL = 20;

// Pool de arrays reutilizables para optimización de memoria
const arrayPool = [];
const MAX_POOL_SIZE = 10;

function getPooledArray(size) {
    if (arrayPool.length > 0) {
        const arr = arrayPool.pop();
        arr.fill(0);
        return arr;
    }
    return new Uint8Array(size);
}

function returnToPool(array) {
    if (arrayPool.length < MAX_POOL_SIZE) {
        arrayPool.push(array);
    }
}

// Generador de ruido optimizado
class NoiseGenerator {
    constructor(seed) {
        this.seed = seed;
        this.noise = new SimplexNoise(seed);
        
        // Cache de valores de ruido para optimización
        this.noiseCache = new Map();
        this.maxCacheSize = 1000;
    }
    
    getNoise2D(x, z, octaves = 4, persistence = 0.5, lacunarity = 2.0, scale = 0.02) {
        const key = `${x},${z},${octaves},${persistence},${lacunarity},${scale}`;
        
        if (this.noiseCache.has(key)) {
            return this.noiseCache.get(key);
        }
        
        let total = 0;
        let frequency = scale;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.noise.noise2D(x * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        const value = total / maxValue;
        
        // Mantener el cache bajo control
        if (this.noiseCache.size >= this.maxCacheSize) {
            const firstKey = this.noiseCache.keys().next().value;
            this.noiseCache.delete(firstKey);
        }
        
        this.noiseCache.set(key, value);
        return value;
    }
    
    getNoise3D(x, y, z, scale = 0.05) {
        return this.noise.noise3D(x * scale, y * scale, z * scale);
    }
}

// Generador de chunks optimizado
class ChunkGenerator {
    constructor(seed) {
        this.noiseGen = new NoiseGenerator(seed);
        this.biomeNoise = new NoiseGenerator(seed + 1000);
        this.caveNoise = new NoiseGenerator(seed + 2000);
        this.oreNoise = new NoiseGenerator(seed + 3000);
    }
    
    generateChunk(chunkX, chunkZ) {
        const startTime = performance.now();
        
        // Verificar cache
        const cacheKey = `${chunkX},${chunkZ}`;
        if (chunkCache.has(cacheKey)) {
            return chunkCache.get(cacheKey);
        }
        
        // Usar array del pool
        const voxels = getPooledArray(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        
        // Pre-calcular valores de altura para optimización
        const heightMap = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
        const biomeMap = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
        
        // Generar mapa de altura y biomas
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = chunkX * CHUNK_SIZE + x;
                const worldZ = chunkZ * CHUNK_SIZE + z;
                const index = x * CHUNK_SIZE + z;
                
                // Generar altura del terreno
                const baseHeight = this.noiseGen.getNoise2D(worldX, worldZ, 4, 0.5, 2.0, 0.02);
                const detailHeight = this.noiseGen.getNoise2D(worldX, worldZ, 2, 0.3, 2.5, 0.1);
                
                // Determinar bioma
                const biomeValue = this.biomeNoise.getNoise2D(worldX, worldZ, 2, 0.5, 2.0, 0.01);
                biomeMap[index] = biomeValue;
                
                // Calcular altura final basada en bioma
                let heightMultiplier = 1.0;
                if (biomeValue < -0.3) {
                    // Llanuras
                    heightMultiplier = 0.3;
                } else if (biomeValue < 0.3) {
                    // Colinas
                    heightMultiplier = 0.6;
                } else {
                    // Montañas
                    heightMultiplier = 1.0;
                }
                
                const height = Math.floor(
                    WATER_LEVEL + 
                    (baseHeight * 0.7 + detailHeight * 0.3) * 20 * heightMultiplier
                );
                
                heightMap[index] = Math.max(1, Math.min(CHUNK_HEIGHT - 1, height));
            }
        }
        
        // Generar voxels del chunk
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const heightIndex = x * CHUNK_SIZE + z;
                const height = heightMap[heightIndex];
                const biome = biomeMap[heightIndex];
                const worldX = chunkX * CHUNK_SIZE + x;
                const worldZ = chunkZ * CHUNK_SIZE + z;
                
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    const index = x + y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE;
                    
                    // Bedrock en el fondo
                    if (y === 0) {
                        voxels[index] = 11; // Bedrock
                        continue;
                    }
                    
                    // Generar cuevas
                    const caveValue = this.caveNoise.getNoise3D(worldX, y, worldZ, 0.1);
                    const caveThreshold = y < 10 ? 0.8 : 0.7; // Menos cuevas cerca del bedrock
                    
                    if (Math.abs(caveValue) > caveThreshold && y < height - 2) {
                        voxels[index] = 0; // Aire (cueva)
                        continue;
                    }
                    
                    // Generar terreno basado en altura
                    if (y > height) {
                        // Sobre el terreno
                        if (y <= WATER_LEVEL) {
                            voxels[index] = 6; // Agua
                        } else {
                            voxels[index] = 0; // Aire
                        }
                    } else if (y === height) {
                        // Superficie
                        if (y <= WATER_LEVEL - 2) {
                            voxels[index] = 5; // Arena bajo el agua
                        } else if (biome > 0.5 && y > 40) {
                            voxels[index] = 3; // Piedra en montañas altas
                        } else {
                            voxels[index] = 1; // Césped
                        }
                    } else if (y >= height - 3) {
                        // Cerca de la superficie
                        if (y <= WATER_LEVEL - 2) {
                            voxels[index] = 5; // Arena
                        } else {
                            voxels[index] = 2; // Tierra
                        }
                    } else {
                        // Subterráneo
                        voxels[index] = 3; // Piedra
                        
                        // Generar minerales
                        const oreValue = this.oreNoise.getNoise3D(worldX, y, worldZ, 0.2);
                        if (oreValue > 0.85) {
                            // Minerales raros en profundidad
                            if (y < 10) {
                                voxels[index] = 10; // Mineral raro (representado como TNT por ahora)
                            } else if (y < 30) {
                                voxels[index] = 9; // Mineral común (ladrillo por ahora)
                            }
                        }
                    }
                }
                
                // Generar árboles en la superficie
                if (heightMap[heightIndex] > WATER_LEVEL + 1 && biome > -0.3 && biome < 0.3) {
                    if (Math.random() < 0.01 && x > 2 && x < CHUNK_SIZE - 2 && z > 2 && z < CHUNK_SIZE - 2) {
                        this.generateTree(voxels, x, heightMap[heightIndex] + 1, z);
                    }
                }
            }
        }
        
        // Optimización: Aplicar suavizado de bordes
        this.smoothChunkEdges(voxels, heightMap);
        
        const generationTime = performance.now() - startTime;
        
        const result = {
            voxels: voxels,
            chunkX: chunkX,
            chunkZ: chunkZ,
            generationTime: generationTime,
            heightMap: heightMap,
            biomeMap: biomeMap
        };
        
        // Guardar en cache
        if (chunkCache.size >= MAX_CACHE_SIZE) {
            const firstKey = chunkCache.keys().next().value;
            const oldData = chunkCache.get(firstKey);
            returnToPool(oldData.voxels);
            chunkCache.delete(firstKey);
        }
        chunkCache.set(cacheKey, result);
        
        return result;
    }
    
    generateTree(voxels, x, y, z) {
        const treeHeight = 4 + Math.floor(Math.random() * 3);
        
        // Tronco
        for (let h = 0; h < treeHeight; h++) {
            const index = x + (y + h) * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE;
            if (index < voxels.length) {
                voxels[index] = 4; // Madera
            }
        }
        
        // Copa del árbol
        const crownStart = y + treeHeight - 2;
        const crownRadius = 2;
        
        for (let dy = 0; dy < 3; dy++) {
            const currentY = crownStart + dy;
            const radius = crownRadius - Math.floor(dy / 2);
            
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (dx * dx + dz * dz <= radius * radius) {
                        const nx = x + dx;
                        const nz = z + dz;
                        
                        if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
                            const index = nx + currentY * CHUNK_SIZE * CHUNK_SIZE + nz * CHUNK_SIZE;
                            if (index < voxels.length && voxels[index] === 0) {
                                voxels[index] = 7; // Hojas
                            }
                        }
                    }
                }
            }
        }
    }
    
    smoothChunkEdges(voxels, heightMap) {
        // Suavizar los bordes del chunk para transiciones más naturales
        const smoothingPasses = 2;
        
        for (let pass = 0; pass < smoothingPasses; pass++) {
            // Suavizar bordes X
            for (let z = 1; z < CHUNK_SIZE - 1; z++) {
                this.smoothEdge(voxels, heightMap, 0, z, 1, z);
                this.smoothEdge(voxels, heightMap, CHUNK_SIZE - 1, z, CHUNK_SIZE - 2, z);
            }
            
            // Suavizar bordes Z
            for (let x = 1; x < CHUNK_SIZE - 1; x++) {
                this.smoothEdge(voxels, heightMap, x, 0, x, 1);
                this.smoothEdge(voxels, heightMap, x, CHUNK_SIZE - 1, x, CHUNK_SIZE - 2);
            }
        }
    }
    
    smoothEdge(voxels, heightMap, x1, z1, x2, z2) {
        const index1 = x1 * CHUNK_SIZE + z1;
        const index2 = x2 * CHUNK_SIZE + z2;
        
        const height1 = heightMap[index1];
        const height2 = heightMap[index2];
        
        if (Math.abs(height1 - height2) > 2) {
            heightMap[index1] = (height1 + height2) / 2;
        }
    }
}

// Instancia global del generador
let generator = null;

// Manejador de mensajes del worker
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            // Inicializar generador con semilla
            generator = new ChunkGenerator(data.seed || Date.now());
            self.postMessage({
                type: 'initialized',
                workerId: data.workerId
            });
            break;
            
        case 'generateChunk':
            if (!generator) {
                generator = new ChunkGenerator(Date.now());
            }
            
            const result = generator.generateChunk(data.chunkX, data.chunkZ);
            
            // Transferir el array buffer para mejor rendimiento
            self.postMessage({
                type: 'chunkGenerated',
                data: {
                    chunkX: data.chunkX,
                    chunkZ: data.chunkZ,
                    voxels: result.voxels.buffer,
                    heightMap: result.heightMap.buffer,
                    biomeMap: result.biomeMap.buffer,
                    generationTime: result.generationTime,
                    requestId: data.requestId
                }
            }, [result.voxels.buffer, result.heightMap.buffer, result.biomeMap.buffer]);
            break;
            
        case 'clearCache':
            // Limpiar cache y liberar memoria
            for (const [key, value] of chunkCache) {
                returnToPool(value.voxels);
            }
            chunkCache.clear();
            
            if (generator) {
                generator.noiseGen.noiseCache.clear();
                generator.biomeNoise.noiseCache.clear();
                generator.caveNoise.noiseCache.clear();
                generator.oreNoise.noiseCache.clear();
            }
            
            self.postMessage({
                type: 'cacheCleared'
            });
            break;
            
        case 'generateBatch':
            // Generar múltiples chunks en lote para mejor eficiencia
            if (!generator) {
                generator = new ChunkGenerator(data.seed || Date.now());
            }
            
            const chunks = [];
            for (const chunk of data.chunks) {
                const result = generator.generateChunk(chunk.x, chunk.z);
                chunks.push({
                    chunkX: chunk.x,
                    chunkZ: chunk.z,
                    voxels: result.voxels,
                    heightMap: result.heightMap,
                    biomeMap: result.biomeMap,
                    generationTime: result.generationTime
                });
            }
            
            self.postMessage({
                type: 'batchGenerated',
                data: {
                    chunks: chunks,
                    requestId: data.requestId
                }
            });
            break;
            
        default:
            console.error('Unknown message type:', type);
    }
};