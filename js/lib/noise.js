/**
 * VoxelCraft - Librería de Ruido Simplex/Perlin
 * v0.1.0
 * 
 * Implementación optimizada de ruido Simplex para generación procedural
 */

class SimplexNoise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        
        // Inicializar tablas de permutación
        this.initPermutationTable();
        
        // Gradientes 3D optimizados
        this.grad3 = new Float32Array([
            1,1,0, -1,1,0, 1,-1,0, -1,-1,0,
            1,0,1, -1,0,1, 1,0,-1, -1,0,-1,
            0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1
        ]);
        
        // Gradientes 4D para ruido 4D
        this.grad4 = new Float32Array([
            0,1,1,1, 0,1,1,-1, 0,1,-1,1, 0,1,-1,-1,
            0,-1,1,1, 0,-1,1,-1, 0,-1,-1,1, 0,-1,-1,-1,
            1,0,1,1, 1,0,1,-1, 1,0,-1,1, 1,0,-1,-1,
            -1,0,1,1, -1,0,1,-1, -1,0,-1,1, -1,0,-1,-1,
            1,1,0,1, 1,1,0,-1, 1,-1,0,1, 1,-1,0,-1,
            -1,1,0,1, -1,1,0,-1, -1,-1,0,1, -1,-1,0,-1,
            1,1,1,0, 1,1,-1,0, 1,-1,1,0, 1,-1,-1,0,
            -1,1,1,0, -1,1,-1,0, -1,-1,1,0, -1,-1,-1,0
        ]);
        
        // Constantes optimizadas
        this.F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        this.G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        this.F3 = 1.0 / 3.0;
        this.G3 = 1.0 / 6.0;
        this.F4 = (Math.sqrt(5.0) - 1.0) / 4.0;
        this.G4 = (5.0 - Math.sqrt(5.0)) / 20.0;
    }
    
    initPermutationTable() {
        // Generar tabla de permutación basada en seed
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }
        
        // Mezclar usando seed
        let n = this.seed * 2654435761 | 0;
        for (let i = 255; i > 0; i--) {
            n = (n * 16807) | 0;
            const j = n % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }
        
        // Duplicar para evitar overflow
        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }
    
    dot2(g, x, y) {
        return g[0] * x + g[1] * y;
    }
    
    dot3(g, x, y, z) {
        return g[0] * x + g[1] * y + g[2] * z;
    }
    
    dot4(g, x, y, z, w) {
        return g[0] * x + g[1] * y + g[2] * z + g[3] * w;
    }
    
    // Ruido 2D optimizado
    noise2D(xin, yin) {
        let n0, n1, n2;
        
        // Skew del espacio de entrada
        const s = (xin + yin) * this.F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        
        const t = (i + j) * this.G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;
        
        // Determinar qué simplex estamos
        let i1, j1;
        if (x0 > y0) {
            i1 = 1; j1 = 0;
        } else {
            i1 = 0; j1 = 1;
        }
        
        const x1 = x0 - i1 + this.G2;
        const y1 = y0 - j1 + this.G2;
        const x2 = x0 - 1.0 + 2.0 * this.G2;
        const y2 = y0 - 1.0 + 2.0 * this.G2;
        
        // Hash de las coordenadas
        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.permMod12[ii + this.perm[jj]] * 3;
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]] * 3;
        const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]] * 3;
        
        // Calcular contribuciones
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0.0;
        } else {
            t0 *= t0;
            n0 = t0 * t0 * this.dot2(this.grad3.subarray(gi0, gi0 + 2), x0, y0);
        }
        
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0.0;
        } else {
            t1 *= t1;
            n1 = t1 * t1 * this.dot2(this.grad3.subarray(gi1, gi1 + 2), x1, y1);
        }
        
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0.0;
        } else {
            t2 *= t2;
            n2 = t2 * t2 * this.dot2(this.grad3.subarray(gi2, gi2 + 2), x2, y2);
        }
        
        // Sumar contribuciones y escalar resultado
        return 70.0 * (n0 + n1 + n2);
    }
    
    // Ruido 3D optimizado
    noise3D(xin, yin, zin) {
        let n0, n1, n2, n3;
        
        // Skew del espacio de entrada
        const s = (xin + yin + zin) * this.F3;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const k = Math.floor(zin + s);
        
        const t = (i + j + k) * this.G3;
        const X0 = i - t;
        const Y0 = j - t;
        const Z0 = k - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;
        const z0 = zin - Z0;
        
        // Determinar qué simplex estamos
        let i1, j1, k1;
        let i2, j2, k2;
        
        if (x0 >= y0) {
            if (y0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
            } else if (x0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
            } else {
                i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
            }
        } else {
            if (y0 < z0) {
                i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
            } else if (x0 < z0) {
                i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
            } else {
                i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
            }
        }
        
        const x1 = x0 - i1 + this.G3;
        const y1 = y0 - j1 + this.G3;
        const z1 = z0 - k1 + this.G3;
        const x2 = x0 - i2 + 2.0 * this.G3;
        const y2 = y0 - j2 + 2.0 * this.G3;
        const z2 = z0 - k2 + 2.0 * this.G3;
        const x3 = x0 - 1.0 + 3.0 * this.G3;
        const y3 = y0 - 1.0 + 3.0 * this.G3;
        const z3 = z0 - 1.0 + 3.0 * this.G3;
        
        // Hash de las coordenadas
        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;
        const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]] * 3;
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]] * 3;
        const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]] * 3;
        const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]] * 3;
        
        // Calcular contribuciones
        let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (t0 < 0) {
            n0 = 0.0;
        } else {
            t0 *= t0;
            n0 = t0 * t0 * this.dot3(this.grad3.subarray(gi0, gi0 + 3), x0, y0, z0);
        }
        
        let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (t1 < 0) {
            n1 = 0.0;
        } else {
            t1 *= t1;
            n1 = t1 * t1 * this.dot3(this.grad3.subarray(gi1, gi1 + 3), x1, y1, z1);
        }
        
        let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (t2 < 0) {
            n2 = 0.0;
        } else {
            t2 *= t2;
            n2 = t2 * t2 * this.dot3(this.grad3.subarray(gi2, gi2 + 3), x2, y2, z2);
        }
        
        let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (t3 < 0) {
            n3 = 0.0;
        } else {
            t3 *= t3;
            n3 = t3 * t3 * this.dot3(this.grad3.subarray(gi3, gi3 + 3), x3, y3, z3);
        }
        
        // Sumar contribuciones y escalar resultado
        return 32.0 * (n0 + n1 + n2 + n3);
    }
    
    // Ruido fractal (FBM - Fractal Brownian Motion)
    fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0, scale = 1.0) {
        let total = 0;
        let frequency = scale;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return total / maxValue;
    }
    
    fbm3D(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2.0, scale = 1.0) {
        let total = 0;
        let frequency = scale;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return total / maxValue;
    }
    
    // Ruido turbulento
    turbulence2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0, scale = 1.0) {
        let total = 0;
        let frequency = scale;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += Math.abs(this.noise2D(x * frequency, y * frequency)) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return total / maxValue;
    }
    
    turbulence3D(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2.0, scale = 1.0) {
        let total = 0;
        let frequency = scale;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += Math.abs(this.noise3D(x * frequency, y * frequency, z * frequency)) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return total / maxValue;
    }
    
    // Ruido ridge (crestas)
    ridge2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0, scale = 1.0, offset = 1.0) {
        let total = 0;
        let frequency = scale;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            const n = this.noise2D(x * frequency, y * frequency);
            total += (offset - Math.abs(n)) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return total / maxValue;
    }
    
    ridge3D(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2.0, scale = 1.0, offset = 1.0) {
        let total = 0;
        let frequency = scale;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            const n = this.noise3D(x * frequency, y * frequency, z * frequency);
            total += (offset - Math.abs(n)) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return total / maxValue;
    }
}

// Exportar para uso en workers y módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimplexNoise;
}

// Hacer disponible globalmente si no estamos en un módulo
if (typeof window !== 'undefined') {
    window.SimplexNoise = SimplexNoise;
}