/**
 * VoxelCraft - Utilidades
 * v0.1.0
 * 
 * Funciones de utilidad generales
 */

const Utils = {
    // Conversión de coordenadas mundo a chunk
    worldToChunk(x, z) {
        return {
            x: Math.floor(x / CONFIG.WORLD.CHUNK_SIZE),
            z: Math.floor(z / CONFIG.WORLD.CHUNK_SIZE)
        };
    },
    
    // Conversión de coordenadas chunk a mundo
    chunkToWorld(chunkX, chunkZ) {
        return {
            x: chunkX * CONFIG.WORLD.CHUNK_SIZE,
            z: chunkZ * CONFIG.WORLD.CHUNK_SIZE
        };
    },
    
    // Obtener coordenadas locales dentro de un chunk
    worldToLocal(x, y, z) {
        return {
            x: ((x % CONFIG.WORLD.CHUNK_SIZE) + CONFIG.WORLD.CHUNK_SIZE) % CONFIG.WORLD.CHUNK_SIZE,
            y: y,
            z: ((z % CONFIG.WORLD.CHUNK_SIZE) + CONFIG.WORLD.CHUNK_SIZE) % CONFIG.WORLD.CHUNK_SIZE
        };
    },
    
    // Convertir índice 1D a coordenadas 3D
    indexToCoords(index, size) {
        const x = index % size;
        const y = Math.floor(index / (size * size));
        const z = Math.floor((index % (size * size)) / size);
        return { x, y, z };
    },
    
    // Convertir coordenadas 3D a índice 1D
    coordsToIndex(x, y, z, size) {
        return x + y * size * size + z * size;
    },
    
    // Distancia entre dos puntos
    distance(x1, y1, z1, x2, y2, z2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },
    
    // Distancia 2D (ignorando Y)
    distance2D(x1, z1, x2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        return Math.sqrt(dx * dx + dz * dz);
    },
    
    // Clamp de valor
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    // Lerp (interpolación lineal)
    lerp(start, end, t) {
        return start + (end - start) * t;
    },
    
    // Smooth step
    smoothstep(edge0, edge1, x) {
        const t = Utils.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
        return t * t * (3.0 - 2.0 * t);
    },
    
    // Mapear valor de un rango a otro
    map(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    },
    
    // Generar ID único
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Formatear número con comas
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },
    
    // Formatear bytes a tamaño legible
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },
    
    // Throttle de función
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Debounce de función
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Pool de objetos genérico
    createObjectPool(createFn, resetFn, maxSize = 100) {
        const pool = [];
        
        return {
            get() {
                if (pool.length > 0) {
                    const obj = pool.pop();
                    if (resetFn) resetFn(obj);
                    return obj;
                }
                return createFn();
            },
            
            release(obj) {
                if (pool.length < maxSize) {
                    pool.push(obj);
                }
            },
            
            clear() {
                pool.length = 0;
            },
            
            size() {
                return pool.length;
            }
        };
    },
    
    // Verificar si el navegador soporta WebGL
    isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                     (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    },
    
    // Verificar si el navegador soporta WebGL2
    isWebGL2Available() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
        } catch (e) {
            return false;
        }
    },
    
    // Obtener mensaje de error de WebGL
    getWebGLErrorMessage() {
        return 'Tu navegador no soporta WebGL. Por favor actualiza tu navegador o usa uno diferente.';
    },
    
    // Calcular FPS
    createFPSCounter() {
        let fps = 0;
        let frames = 0;
        let lastTime = performance.now();
        
        return {
            update() {
                frames++;
                const currentTime = performance.now();
                
                if (currentTime >= lastTime + 1000) {
                    fps = Math.round((frames * 1000) / (currentTime - lastTime));
                    frames = 0;
                    lastTime = currentTime;
                }
                
                return fps;
            },
            
            get() {
                return fps;
            }
        };
    },
    
    // Medidor de rendimiento
    createPerformanceMonitor() {
        const metrics = {};
        
        return {
            start(name) {
                metrics[name] = performance.now();
            },
            
            end(name) {
                if (metrics[name]) {
                    const duration = performance.now() - metrics[name];
                    delete metrics[name];
                    return duration;
                }
                return 0;
            },
            
            measure(name, fn) {
                const start = performance.now();
                const result = fn();
                const duration = performance.now() - start;
                console.log(`${name}: ${duration.toFixed(2)}ms`);
                return result;
            }
        };
    },
    
    // Guardar en localStorage con compresión
    saveToStorage(key, data) {
        try {
            const json = JSON.stringify(data);
            localStorage.setItem(key, json);
            return true;
        } catch (e) {
            console.error('Error guardando en localStorage:', e);
            return false;
        }
    },
    
    // Cargar de localStorage
    loadFromStorage(key) {
        try {
            const json = localStorage.getItem(key);
            if (json) {
                return JSON.parse(json);
            }
        } catch (e) {
            console.error('Error cargando de localStorage:', e);
        }
        return null;
    },
    
    // Limpiar localStorage
    clearStorage(key) {
        if (key) {
            localStorage.removeItem(key);
        } else {
            localStorage.clear();
        }
    },
    
    // Obtener tamaño usado en localStorage
    getStorageSize() {
        let size = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                size += localStorage[key].length + key.length;
            }
        }
        return size * 2; // Caracteres a bytes (UTF-16)
    },
    
    // Detectar dispositivo móvil
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    // Detectar navegador
    getBrowser() {
        const userAgent = navigator.userAgent;
        let browserName;
        
        if (userAgent.match(/chrome|chromium|crios/i)) {
            browserName = "Chrome";
        } else if (userAgent.match(/firefox|fxios/i)) {
            browserName = "Firefox";
        } else if (userAgent.match(/safari/i)) {
            browserName = "Safari";
        } else if (userAgent.match(/opr\//i)) {
            browserName = "Opera";
        } else if (userAgent.match(/edg/i)) {
            browserName = "Edge";
        } else {
            browserName = "Unknown";
        }
        
        return browserName;
    },
    
    // Copiar al portapapeles
    copyToClipboard(text) {
        if (navigator.clipboard) {
            return navigator.clipboard.writeText(text);
        } else {
            // Fallback para navegadores antiguos
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return Promise.resolve();
            } catch (err) {
                document.body.removeChild(textArea);
                return Promise.reject(err);
            }
        }
    },
    
    // Generar color aleatorio
    randomColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16);
    },
    
    // Convertir HSL a RGB
    hslToRgb(h, s, l) {
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h / 360 + 1/3);
            g = hue2rgb(p, q, h / 360);
            b = hue2rgb(p, q, h / 360 - 1/3);
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }
};

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}