/**
 * VoxelCraft - Sistema del Mundo
 * v0.1.0
 * 
 * Gestión del mundo y chunks
 */

class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.seed = CONFIG.WORLD.TERRAIN.SEED;
    }
    
    getBlockAt(x, y, z) {
        const chunkCoords = Utils.worldToChunk(x, z);
        const chunkKey = `${chunkCoords.x},${chunkCoords.z}`;
        const chunk = this.chunks.get(chunkKey);
        
        if (!chunk) return CONFIG.BLOCKS.AIR;
        
        const local = Utils.worldToLocal(x, y, z);
        return chunk.getBlock(local.x, local.y, local.z);
    }
    
    setBlockAt(x, y, z, blockType) {
        const chunkCoords = Utils.worldToChunk(x, z);
        const chunkKey = `${chunkCoords.x},${chunkCoords.z}`;
        const chunk = this.chunks.get(chunkKey);
        
        if (!chunk) return false;
        
        const local = Utils.worldToLocal(x, y, z);
        return chunk.setBlock(local.x, local.y, local.z, blockType);
    }
}

// Clase Chunk simplificada
class Chunk {
    constructor(x, z) {
        this.x = x;
        this.z = z;
        this.blocks = new Uint8Array(CONFIG.WORLD.CHUNK_SIZE * CONFIG.WORLD.CHUNK_HEIGHT * CONFIG.WORLD.CHUNK_SIZE);
    }
    
    getBlock(x, y, z) {
        if (x < 0 || x >= CONFIG.WORLD.CHUNK_SIZE ||
            y < 0 || y >= CONFIG.WORLD.CHUNK_HEIGHT ||
            z < 0 || z >= CONFIG.WORLD.CHUNK_SIZE) {
            return CONFIG.BLOCKS.AIR;
        }
        
        const index = Utils.coordsToIndex(x, y, z, CONFIG.WORLD.CHUNK_SIZE);
        return this.blocks[index];
    }
    
    setBlock(x, y, z, blockType) {
        if (x < 0 || x >= CONFIG.WORLD.CHUNK_SIZE ||
            y < 0 || y >= CONFIG.WORLD.CHUNK_HEIGHT ||
            z < 0 || z >= CONFIG.WORLD.CHUNK_SIZE) {
            return false;
        }
        
        const index = Utils.coordsToIndex(x, y, z, CONFIG.WORLD.CHUNK_SIZE);
        this.blocks[index] = blockType;
        return true;
    }
}