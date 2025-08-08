/**
 * VoxelCraft - Sistema del Jugador
 * v0.1.0
 * 
 * Maneja el jugador, física y colisiones
 */

class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Posición y movimiento
        this.position = new THREE.Vector3(0, 50, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        
        // Rotación
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
        
        // Estado del jugador
        this.onGround = false;
        this.inWater = false;
        this.isRunning = false;
        this.isCrouching = false;
        this.isFlying = false;
        this.canJump = false;
        
        // Propiedades físicas
        this.width = CONFIG.PLAYER.WIDTH;
        this.height = CONFIG.PLAYER.HEIGHT;
        this.eyeHeight = CONFIG.PLAYER.CAMERA_HEIGHT;
        
        // Velocidades
        this.walkSpeed = CONFIG.PLAYER.WALK_SPEED;
        this.runSpeed = CONFIG.PLAYER.RUN_SPEED;
        this.jumpForce = CONFIG.PLAYER.JUMP_FORCE;
        this.gravity = CONFIG.PLAYER.GRAVITY;
        
        // Fricción
        this.groundFriction = CONFIG.PLAYER.FRICTION;
        this.airFriction = CONFIG.PLAYER.AIR_FRICTION;
        
        // Colisión
        this.collisionBox = new THREE.Box3();
        this.updateCollisionBox();
        
        // Raycaster para detección de suelo
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 2;
        
        // Inventario
        this.inventory = new Array(36).fill(null);
        this.hotbar = new Array(9).fill(null);
        this.selectedSlot = 0;
        
        // Estadísticas
        this.health = 20;
        this.maxHealth = 20;
        this.hunger = 20;
        this.maxHunger = 20;
        this.armor = 0;
        
        // Inicializar hotbar con bloques básicos
        this.hotbar[0] = { type: 1, count: 64 }; // Tierra
        this.hotbar[1] = { type: 3, count: 64 }; // Piedra
        this.hotbar[2] = { type: 4, count: 64 }; // Madera
        this.hotbar[3] = { type: 5, count: 64 }; // Arena
        this.hotbar[4] = { type: 6, count: 64 }; // Agua
        this.hotbar[5] = { type: 7, count: 64 }; // Hojas
        this.hotbar[6] = { type: 8, count: 64 }; // Vidrio
        this.hotbar[7] = { type: 9, count: 64 }; // Ladrillo
        this.hotbar[8] = { type: 10, count: 64 }; // TNT
        
        // Mesh del jugador (para multijugador futuro)
        this.mesh = null;
        
        // Controles
        this.controls = null;
        this.mobileControls = null;
    }
    
    setControls(controls) {
        this.controls = controls;
    }
    
    setMobileControls(mobileControls) {
        this.mobileControls = mobileControls;
    }
    
    update(deltaTime, world) {
        if (!this.controls && !this.mobileControls) return;
        
        // Obtener input de movimiento
        const moveVector = this.getMovementVector();
        
        // Aplicar movimiento
        this.applyMovement(moveVector, deltaTime);
        
        // Aplicar gravedad
        if (!this.onGround && !this.isFlying) {
            this.velocity.y += this.gravity * deltaTime;
        }
        
        // Aplicar fricción
        const friction = this.onGround ? this.groundFriction : this.airFriction;
        this.velocity.x *= friction;
        this.velocity.z *= friction;
        
        // Limitar velocidad de caída
        if (this.velocity.y < -50) {
            this.velocity.y = -50;
        }
        
        // Actualizar posición con colisiones
        this.updatePosition(deltaTime, world);
        
        // Actualizar cámara
        this.updateCamera();
        
        // Actualizar estado
        this.updateState(world);
        
        // Actualizar UI
        this.updateUI();
    }
    
    getMovementVector() {
        let moveVector = new THREE.Vector3();
        
        if (this.controls && this.controls.enabled) {
            // Controles de desktop
            moveVector.z = Number(this.controls.moveForward) - Number(this.controls.moveBackward);
            moveVector.x = Number(this.controls.moveRight) - Number(this.controls.moveLeft);
            
            if (this.controls.canJump && this.onGround) {
                this.jump();
            }
            
            this.isRunning = this.controls.isRunning;
            this.isCrouching = this.controls.isCrouching;
            
        } else if (this.mobileControls && this.mobileControls.enabled) {
            // Controles móviles
            const movement = this.mobileControls.getMovementVector();
            moveVector.x = movement.x;
            moveVector.z = -movement.y;
            
            if (movement.jump && this.onGround) {
                this.jump();
            }
        }
        
        // Normalizar vector de movimiento
        if (moveVector.length() > 0) {
            moveVector.normalize();
            
            // Rotar según la dirección de la cámara
            const euler = new THREE.Euler(0, this.camera.rotation.y, 0, 'YXZ');
            moveVector.applyEuler(euler);
        }
        
        return moveVector;
    }
    
    applyMovement(moveVector, deltaTime) {
        if (moveVector.length() === 0) return;
        
        // Determinar velocidad
        let speed = this.walkSpeed;
        if (this.isRunning && !this.isCrouching) {
            speed = this.runSpeed;
        } else if (this.isCrouching) {
            speed = this.walkSpeed * 0.3;
        }
        
        // En agua, movimiento más lento
        if (this.inWater) {
            speed *= 0.5;
        }
        
        // Aplicar velocidad
        this.velocity.x = moveVector.x * speed;
        this.velocity.z = moveVector.z * speed;
        
        // Modo vuelo
        if (this.isFlying) {
            this.velocity.y = moveVector.y * speed;
        }
    }
    
    jump() {
        if (!this.onGround || this.inWater) return;
        
        this.velocity.y = this.jumpForce;
        this.onGround = false;
        this.canJump = false;
        
        // Sonido de salto (TODO)
        // this.playSound('jump');
    }
    
    updatePosition(deltaTime, world) {
        // Guardar posición anterior
        const oldPosition = this.position.clone();
        
        // Calcular nueva posición
        const newPosition = this.position.clone();
        newPosition.x += this.velocity.x * deltaTime;
        newPosition.y += this.velocity.y * deltaTime;
        newPosition.z += this.velocity.z * deltaTime;
        
        // Verificar colisiones con el mundo
        if (world) {
            // Colisión en X
            this.position.x = newPosition.x;
            this.updateCollisionBox();
            if (this.checkWorldCollision(world)) {
                this.position.x = oldPosition.x;
                this.velocity.x = 0;
            }
            
            // Colisión en Z
            this.position.z = newPosition.z;
            this.updateCollisionBox();
            if (this.checkWorldCollision(world)) {
                this.position.z = oldPosition.z;
                this.velocity.z = 0;
            }
            
            // Colisión en Y
            this.position.y = newPosition.y;
            this.updateCollisionBox();
            if (this.checkWorldCollision(world)) {
                if (this.velocity.y < 0) {
                    // Tocando el suelo
                    this.onGround = true;
                    this.canJump = true;
                } else {
                    // Golpeando el techo
                    this.velocity.y = 0;
                }
                this.position.y = oldPosition.y;
            } else {
                this.onGround = false;
            }
        } else {
            // Sin mundo, usar suelo simple en Y=30
            this.position.copy(newPosition);
            
            if (this.position.y < 30) {
                this.position.y = 30;
                this.velocity.y = 0;
                this.onGround = true;
                this.canJump = true;
            } else {
                this.onGround = false;
            }
        }
        
        // Limitar posición al mundo
        const bounds = CONFIG.WORLD.WORLD_BOUNDS;
        this.position.x = Math.max(bounds.MIN_X, Math.min(bounds.MAX_X, this.position.x));
        this.position.z = Math.max(bounds.MIN_Z, Math.min(bounds.MAX_Z, this.position.z));
        
        // Actualizar collision box final
        this.updateCollisionBox();
    }
    
    checkWorldCollision(world) {
        // TODO: Implementar colisión real con bloques del mundo
        // Por ahora retorna false
        return false;
    }
    
    updateCollisionBox() {
        const halfWidth = this.width / 2;
        const min = new THREE.Vector3(
            this.position.x - halfWidth,
            this.position.y,
            this.position.z - halfWidth
        );
        const max = new THREE.Vector3(
            this.position.x + halfWidth,
            this.position.y + this.height,
            this.position.z + halfWidth
        );
        
        this.collisionBox.set(min, max);
    }
    
    updateCamera() {
        // Posicionar cámara en los ojos del jugador
        this.camera.position.copy(this.position);
        this.camera.position.y += this.eyeHeight;
        
        // Si está agachado, bajar la cámara
        if (this.isCrouching) {
            this.camera.position.y -= 0.3;
        }
        
        // Aplicar rotación de controles móviles si existen
        if (this.mobileControls && this.mobileControls.enabled) {
            const rotation = this.mobileControls.getRotation();
            this.camera.rotation.x = rotation.x;
            this.camera.rotation.y = rotation.y;
        }
    }
    
    updateState(world) {
        // Verificar si está en agua
        if (world) {
            const blockAtFeet = world.getBlockAt(
                Math.floor(this.position.x),
                Math.floor(this.position.y + 0.5),
                Math.floor(this.position.z)
            );
            
            this.inWater = blockAtFeet === CONFIG.BLOCKS.WATER;
            
            // En agua, reducir gravedad y permitir nadar
            if (this.inWater) {
                this.velocity.y *= 0.8;
                if (this.velocity.y < -2) {
                    this.velocity.y = -2;
                }
            }
        }
        
        // Auto-jump para móviles
        if (CONFIG.MOBILE.AUTO_JUMP && this.mobileControls && this.mobileControls.enabled) {
            // TODO: Detectar si hay un bloque adelante y saltar automáticamente
        }
    }
    
    updateUI() {
        // Actualizar posición en HUD
        const posElement = document.getElementById('position');
        if (posElement) {
            posElement.textContent = `${Math.floor(this.position.x)}, ${Math.floor(this.position.y)}, ${Math.floor(this.position.z)}`;
        }
    }
    
    selectHotbarSlot(slot) {
        if (slot < 0 || slot > 8) return;
        
        this.selectedSlot = slot;
        
        // Actualizar UI
        document.querySelector('.hotbar-slot.active')?.classList.remove('active');
        const slots = document.querySelectorAll('.hotbar-slot');
        if (slots[slot]) {
            slots[slot].classList.add('active');
        }
    }
    
    getSelectedBlock() {
        const item = this.hotbar[this.selectedSlot];
        return item ? item.type : null;
    }
    
    placeBlock(position, blockType) {
        const item = this.hotbar[this.selectedSlot];
        if (!item || item.count <= 0) return false;
        
        // Reducir cantidad
        item.count--;
        if (item.count <= 0) {
            this.hotbar[this.selectedSlot] = null;
        }
        
        return true;
    }
    
    breakBlock(position) {
        // TODO: Agregar bloque al inventario
        return true;
    }
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        
        if (this.health <= 0) {
            this.respawn();
        }
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }
    
    respawn() {
        this.position.set(0, 50, 0);
        this.velocity.set(0, 0, 0);
        this.health = this.maxHealth;
        this.hunger = this.maxHunger;
    }
    
    toggleFlying() {
        this.isFlying = !this.isFlying;
        if (this.isFlying) {
            this.velocity.y = 0;
        }
    }
    
    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}