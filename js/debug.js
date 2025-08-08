/**
 * VoxelCraft - Sistema de Debug
 * v0.1.0
 * 
 * Sistema completo de debugging para identificar problemas
 */

class DebugSystem {
    constructor() {
        this.enabled = true;
        this.logs = [];
        this.errors = [];
        this.warnings = [];
        this.checkpoints = {};
        this.performanceMarks = {};
        
        // Crear panel de debug
        this.createDebugPanel();
        
        // Interceptar console
        this.interceptConsole();
        
        // Monitorear errores globales
        this.setupErrorHandling();
        
        // Auto-actualizar cada segundo
        setInterval(() => this.updateDebugPanel(), 1000);
    }
    
    createDebugPanel() {
        // Crear contenedor de debug
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            width: 400px;
            max-height: 500px;
            background: rgba(0, 0, 0, 0.9);
            color: #0f0;
            font-family: monospace;
            font-size: 11px;
            padding: 10px;
            border: 1px solid #0f0;
            border-radius: 5px;
            overflow-y: auto;
            z-index: 10000;
            display: ${this.enabled ? 'block' : 'none'};
        `;
        
        debugPanel.innerHTML = `
            <div style="color: #ff0; font-size: 14px; margin-bottom: 10px;">
                🔧 DEBUG SYSTEM v0.1.0
            </div>
            <div id="debugContent"></div>
            <button onclick="debugSystem.clear()" style="
                margin-top: 10px;
                padding: 5px 10px;
                background: #333;
                color: #0f0;
                border: 1px solid #0f0;
                cursor: pointer;
            ">Clear</button>
            <button onclick="debugSystem.toggle()" style="
                margin-top: 10px;
                margin-left: 5px;
                padding: 5px 10px;
                background: #333;
                color: #0f0;
                border: 1px solid #0f0;
                cursor: pointer;
            ">Hide</button>
        `;
        
        document.body.appendChild(debugPanel);
    }
    
    interceptConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        console.log = (...args) => {
            this.log('LOG', args.join(' '));
            originalLog.apply(console, args);
        };
        
        console.error = (...args) => {
            this.error('ERROR', args.join(' '));
            originalError.apply(console, args);
        };
        
        console.warn = (...args) => {
            this.warning('WARN', args.join(' '));
            originalWarn.apply(console, args);
        };
    }
    
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            this.error('GLOBAL ERROR', `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.error('PROMISE REJECTION', event.reason);
        });
    }
    
    checkpoint(name, data = null) {
        const timestamp = performance.now();
        this.checkpoints[name] = {
            time: timestamp,
            data: data
        };
        this.log('CHECKPOINT', `✓ ${name}${data ? ': ' + JSON.stringify(data) : ''}`);
    }
    
    startPerformance(name) {
        this.performanceMarks[name] = performance.now();
        this.log('PERF START', name);
    }
    
    endPerformance(name) {
        if (this.performanceMarks[name]) {
            const duration = performance.now() - this.performanceMarks[name];
            delete this.performanceMarks[name];
            this.log('PERF END', `${name}: ${duration.toFixed(2)}ms`);
            return duration;
        }
        return 0;
    }
    
    log(type, message) {
        const entry = {
            type: type,
            message: message,
            timestamp: new Date().toLocaleTimeString()
        };
        this.logs.push(entry);
        if (this.logs.length > 100) {
            this.logs.shift();
        }
    }
    
    error(type, message) {
        const entry = {
            type: type,
            message: message,
            timestamp: new Date().toLocaleTimeString()
        };
        this.errors.push(entry);
        this.log('ERROR', message);
    }
    
    warning(type, message) {
        const entry = {
            type: type,
            message: message,
            timestamp: new Date().toLocaleTimeString()
        };
        this.warnings.push(entry);
        this.log('WARNING', message);
    }
    
    updateDebugPanel() {
        const content = document.getElementById('debugContent');
        if (!content) return;
        
        let html = '';
        
        // Estado del sistema
        html += '<div style="color: #ff0; margin-bottom: 10px;">📊 SYSTEM STATUS</div>';
        
        // Verificar componentes críticos
        const components = {
            'Three.js': typeof THREE !== 'undefined',
            'Config': typeof CONFIG !== 'undefined',
            'Utils': typeof Utils !== 'undefined',
            'World': typeof World !== 'undefined',
            'ChunkManager': typeof ChunkManager !== 'undefined',
            'Player': typeof Player !== 'undefined',
            'Controls': typeof Controls !== 'undefined',
            'MobileControls': typeof MobileControls !== 'undefined',
            'Game': typeof window.game !== 'undefined',
            'Scene': window.scene !== undefined,
            'Camera': window.camera !== undefined,
            'Renderer': window.renderer !== undefined
        };
        
        for (const [name, loaded] of Object.entries(components)) {
            const color = loaded ? '#0f0' : '#f00';
            const icon = loaded ? '✓' : '✗';
            html += `<div style="color: ${color};">${icon} ${name}: ${loaded ? 'OK' : 'MISSING'}</div>`;
        }
        
        // Estado del ChunkManager
        if (window.chunkManager) {
            const stats = window.chunkManager.getStats();
            html += '<div style="color: #ff0; margin-top: 10px;">🎮 CHUNK MANAGER</div>';
            html += `<div>Chunks Loaded: ${stats.chunksLoaded}</div>`;
            html += `<div>Chunks In View: ${stats.chunksInView}</div>`;
            html += `<div>Workers Active: ${stats.workersActive}</div>`;
            html += `<div>Cache Hits: ${stats.cacheHits}</div>`;
            html += `<div>Cache Misses: ${stats.cacheMisses}</div>`;
            html += `<div>Vertices: ${stats.verticesRendered}</div>`;
            
            // Estado de los workers
            if (window.chunkManager.workers) {
                html += '<div style="color: #ff0; margin-top: 10px;">👷 WORKERS</div>';
                window.chunkManager.workers.forEach((worker, i) => {
                    const status = worker.busy ? 'BUSY' : 'IDLE';
                    const color = worker.busy ? '#ff0' : '#0f0';
                    html += `<div style="color: ${color};">Worker ${i}: ${status}</div>`;
                });
            }
            
            // Cola de generación
            if (window.chunkManager.generationQueue) {
                html += `<div>Generation Queue: ${window.chunkManager.generationQueue.length}</div>`;
            }
            
            // Chunks cargándose
            if (window.chunkManager.loadingChunks) {
                html += `<div>Loading Chunks: ${window.chunkManager.loadingChunks.size}</div>`;
            }
        }
        
        // Estado del jugador
        if (window.player) {
            html += '<div style="color: #ff0; margin-top: 10px;">🚶 PLAYER</div>';
            html += `<div>Position: ${Math.round(window.player.position.x)}, ${Math.round(window.player.position.y)}, ${Math.round(window.player.position.z)}</div>`;
            html += `<div>Velocity: ${window.player.velocity.x.toFixed(2)}, ${window.player.velocity.y.toFixed(2)}, ${window.player.velocity.z.toFixed(2)}</div>`;
            html += `<div>On Ground: ${window.player.onGround}</div>`;
            html += `<div>In Water: ${window.player.inWater}</div>`;
        }
        
        // Checkpoints
        if (Object.keys(this.checkpoints).length > 0) {
            html += '<div style="color: #ff0; margin-top: 10px;">📍 CHECKPOINTS</div>';
            for (const [name, data] of Object.entries(this.checkpoints)) {
                html += `<div style="color: #0f0;">✓ ${name}</div>`;
            }
        }
        
        // Errores recientes
        if (this.errors.length > 0) {
            html += '<div style="color: #ff0; margin-top: 10px;">❌ ERRORS</div>';
            this.errors.slice(-5).forEach(error => {
                html += `<div style="color: #f00;">[${error.timestamp}] ${error.message}</div>`;
            });
        }
        
        // Logs recientes
        html += '<div style="color: #ff0; margin-top: 10px;">📝 RECENT LOGS</div>';
        this.logs.slice(-10).forEach(log => {
            let color = '#0f0';
            if (log.type === 'ERROR') color = '#f00';
            if (log.type === 'WARNING') color = '#ff0';
            if (log.type === 'CHECKPOINT') color = '#0ff';
            html += `<div style="color: ${color};">[${log.timestamp}] ${log.type}: ${log.message}</div>`;
        });
        
        content.innerHTML = html;
    }
    
    clear() {
        this.logs = [];
        this.errors = [];
        this.warnings = [];
        this.checkpoints = {};
        this.performanceMarks = {};
        this.updateDebugPanel();
    }
    
    toggle() {
        const panel = document.getElementById('debugPanel');
        if (panel) {
            this.enabled = !this.enabled;
            panel.style.display = this.enabled ? 'block' : 'none';
        }
    }
    
    // Funciones de debug específicas para VoxelCraft
    debugChunkGeneration(chunkX, chunkZ) {
        this.log('CHUNK', `Requesting chunk at ${chunkX}, ${chunkZ}`);
    }
    
    debugWorkerMessage(workerId, message) {
        this.log('WORKER', `Worker ${workerId}: ${message}`);
    }
    
    debugMeshCreation(chunkKey, vertices) {
        this.log('MESH', `Created mesh for ${chunkKey} with ${vertices} vertices`);
    }
    
    testChunkGeneration() {
        console.log('🧪 Testing chunk generation...');
        
        // Verificar que el ChunkManager existe
        if (!window.chunkManager) {
            console.error('ChunkManager not found!');
            return;
        }
        
        // Intentar generar un chunk manualmente
        console.log('Requesting test chunk at 0,0...');
        window.chunkManager.requestChunk(0, 0, 0);
        
        // Verificar workers
        console.log('Workers status:', window.chunkManager.workers);
        
        // Verificar cola
        console.log('Generation queue:', window.chunkManager.generationQueue);
        
        // Forzar procesamiento
        console.log('Forcing queue processing...');
        window.chunkManager.processNextInQueue();
    }
    
    forceGenerateWorld() {
        console.log('🔨 Force generating world...');
        
        if (!window.chunkManager) {
            console.error('ChunkManager not found!');
            return;
        }
        
        // Generar chunks alrededor del origen
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                console.log(`Requesting chunk ${x}, ${z}`);
                window.chunkManager.requestChunk(x, z, 0);
            }
        }
    }
    
    checkWorkers() {
        console.log('👷 Checking workers...');
        
        if (!window.chunkManager || !window.chunkManager.workers) {
            console.error('Workers not found!');
            return;
        }
        
        window.chunkManager.workers.forEach((worker, i) => {
            console.log(`Worker ${i}:`, {
                id: worker.id,
                busy: worker.busy,
                currentTask: worker.currentTask,
                worker: worker.worker
            });
            
            // Enviar mensaje de prueba
            worker.worker.postMessage({
                type: 'test',
                data: { test: true }
            });
        });
    }
}

// Crear instancia global del sistema de debug
window.debugSystem = new DebugSystem();

// Agregar comandos de debug al objeto global
window.debug = {
    test: () => window.debugSystem.testChunkGeneration(),
    force: () => window.debugSystem.forceGenerateWorld(),
    workers: () => window.debugSystem.checkWorkers(),
    clear: () => window.debugSystem.clear(),
    toggle: () => window.debugSystem.toggle(),
    checkpoint: (name, data) => window.debugSystem.checkpoint(name, data),
    log: (message) => window.debugSystem.log('DEBUG', message)
};

console.log('🔧 Debug system loaded! Use window.debug for commands:');
console.log('- debug.test() : Test chunk generation');
console.log('- debug.force() : Force generate world');
console.log('- debug.workers() : Check workers status');
console.log('- debug.clear() : Clear debug panel');
console.log('- debug.toggle() : Toggle debug panel');