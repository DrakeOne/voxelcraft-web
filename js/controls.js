/**
 * VoxelCraft - Sistema de Controles Desktop
 * v0.1.0
 * 
 * Manejo de controles de teclado y mouse para desktop
 */

class Controls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Estado de controles
        this.enabled = true;
        this.isLocked = false;
        
        // Movimiento
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.isRunning = false;
        this.isCrouching = false;
        
        // Rotación de cámara
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.PI_2 = Math.PI / 2;
        
        // Velocidad de movimiento
        this.movementSpeed = CONFIG.PLAYER.WALK_SPEED;
        this.lookSpeed = CONFIG.PLAYER.MOUSE_SENSITIVITY;
        
        // Vector de dirección
        this.direction = new THREE.Vector3();
        this.rotation = new THREE.Vector3();
        
        // Raycaster para interacción
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = CONFIG.PLAYER.REACH_DISTANCE;
        
        // Inicializar eventos
        this.initPointerLock();
        this.initEventListeners();
        
        // Estado del mouse
        this.mouseButtons = {
            LEFT: false,
            MIDDLE: false,
            RIGHT: false
        };
        
        // Bloque seleccionado
        this.selectedBlock = 1;
        
        // Callback functions
        this.onBlockPlace = null;
        this.onBlockBreak = null;
    }
    
    initPointerLock() {
        const havePointerLock = 'pointerLockElement' in document ||
                               'mozPointerLockElement' in document ||
                               'webkitPointerLockElement' in document;
        
        if (havePointerLock) {
            const element = this.domElement;
            
            const pointerlockchange = () => {
                this.isLocked = document.pointerLockElement === element ||
                               document.mozPointerLockElement === element ||
                               document.webkitPointerLockElement === element;
                
                if (this.isLocked) {
                    this.onLock();
                } else {
                    this.onUnlock();
                }
            };
            
            const pointerlockerror = () => {
                console.error('Pointer Lock Error');
            };
            
            // Hook pointer lock state change events
            document.addEventListener('pointerlockchange', pointerlockchange, false);
            document.addEventListener('mozpointerlockchange', pointerlockchange, false);
            document.addEventListener('webkitpointerlockchange', pointerlockchange, false);
            
            document.addEventListener('pointerlockerror', pointerlockerror, false);
            document.addEventListener('mozpointerlockerror', pointerlockerror, false);
            document.addEventListener('webkitpointerlockerror', pointerlockerror, false);
            
            // Click para activar pointer lock
            this.domElement.addEventListener('click', () => {
                if (!this.isLocked && !CONFIG.DEVICE.IS_MOBILE) {
                    element.requestPointerLock = element.requestPointerLock ||
                                                element.mozRequestPointerLock ||
                                                element.webkitRequestPointerLock;
                    element.requestPointerLock();
                }
            });
        } else {
            console.warn('Tu navegador no soporta Pointer Lock API');
        }
    }
    
    initEventListeners() {
        // Eventos de teclado
        document.addEventListener('keydown', this.onKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onKeyUp.bind(this), false);
        
        // Eventos de mouse
        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        document.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        document.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        document.addEventListener('wheel', this.onMouseWheel.bind(this), false);
        
        // Prevenir menú contextual
        this.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        }, false);
    }
    
    onLock() {
        this.isLocked = true;
        document.getElementById('crosshair').style.display = 'block';
    }
    
    onUnlock() {
        this.isLocked = false;
        document.getElementById('crosshair').style.display = 'none';
        
        // Reset movement
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
    }
    
    onKeyDown(event) {
        if (!this.enabled) return;
        
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = true;
                break;
                
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = true;
                break;
                
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = true;
                break;
                
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = true;
                break;
                
            case 'Space':
                if (this.canJump) {
                    this.jump();
                }
                break;
                
            case 'ShiftLeft':
            case 'ShiftRight':
                this.isRunning = true;
                this.movementSpeed = CONFIG.PLAYER.RUN_SPEED;
                if (this.camera.fov !== CONFIG.PLAYER.FOV_RUNNING) {
                    this.camera.fov = CONFIG.PLAYER.FOV_RUNNING;
                    this.camera.updateProjectionMatrix();
                }
                break;
                
            case 'ControlLeft':
            case 'ControlRight':
                this.isCrouching = true;
                break;
                
            case 'KeyE':
                this.openInventory();
                break;
                
            case 'Escape':
                if (this.isLocked) {
                    document.exitPointerLock();
                }
                break;
                
            // Selección de bloques con números
            case 'Digit1':
            case 'Digit2':
            case 'Digit3':
            case 'Digit4':
            case 'Digit5':
            case 'Digit6':
            case 'Digit7':
            case 'Digit8':
            case 'Digit9':
                const slot = parseInt(event.code.replace('Digit', '')) - 1;
                this.selectHotbarSlot(slot);
                break;
                
            case 'KeyQ':
                this.dropItem();
                break;
                
            case 'F5':
                event.preventDefault();
                this.togglePerspective();
                break;
        }
    }
    
    onKeyUp(event) {
        if (!this.enabled) return;
        
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = false;
                break;
                
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = false;
                break;
                
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = false;
                break;
                
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = false;
                break;
                
            case 'ShiftLeft':
            case 'ShiftRight':
                this.isRunning = false;
                this.movementSpeed = CONFIG.PLAYER.WALK_SPEED;
                if (this.camera.fov !== CONFIG.PLAYER.FOV) {
                    this.camera.fov = CONFIG.PLAYER.FOV;
                    this.camera.updateProjectionMatrix();
                }
                break;
                
            case 'ControlLeft':
            case 'ControlRight':
                this.isCrouching = false;
                break;
        }
    }
    
    onMouseMove(event) {
        if (!this.enabled || !this.isLocked) return;
        
        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
        
        // Rotar cámara
        this.euler.setFromQuaternion(this.camera.quaternion);
        
        this.euler.y -= movementX * this.lookSpeed;
        this.euler.x -= movementY * this.lookSpeed;
        
        // Limitar rotación vertical
        this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x));
        
        this.camera.quaternion.setFromEuler(this.euler);
    }
    
    onMouseDown(event) {
        if (!this.enabled || !this.isLocked) return;
        
        switch (event.button) {
            case 0: // Click izquierdo
                this.mouseButtons.LEFT = true;
                this.onLeftClick();
                break;
                
            case 1: // Click medio
                this.mouseButtons.MIDDLE = true;
                this.onMiddleClick();
                break;
                
            case 2: // Click derecho
                this.mouseButtons.RIGHT = true;
                this.onRightClick();
                break;
        }
    }
    
    onMouseUp(event) {
        if (!this.enabled) return;
        
        switch (event.button) {
            case 0:
                this.mouseButtons.LEFT = false;
                break;
            case 1:
                this.mouseButtons.MIDDLE = false;
                break;
            case 2:
                this.mouseButtons.RIGHT = false;
                break;
        }
    }
    
    onMouseWheel(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        // Cambiar slot del hotbar con la rueda del mouse
        const delta = Math.sign(event.deltaY);
        let currentSlot = this.selectedBlock - 1;
        
        currentSlot += delta;
        
        if (currentSlot < 0) currentSlot = 8;
        if (currentSlot > 8) currentSlot = 0;
        
        this.selectHotbarSlot(currentSlot);
    }
    
    onLeftClick() {
        // Romper bloque
        if (this.onBlockBreak) {
            const intersection = this.getTargetBlock();
            if (intersection) {
                this.onBlockBreak(intersection);
            }
        }
    }
    
    onRightClick() {
        // Colocar bloque
        if (this.onBlockPlace) {
            const intersection = this.getTargetBlock();
            if (intersection) {
                this.onBlockPlace(intersection, this.selectedBlock);
            }
        }
    }
    
    onMiddleClick() {
        // Seleccionar bloque apuntado
        const intersection = this.getTargetBlock();
        if (intersection && intersection.blockType) {
            this.selectedBlock = intersection.blockType;
            this.updateHotbarSelection();
        }
    }
    
    getTargetBlock() {
        // Raycast desde el centro de la pantalla
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        // TODO: Implementar intersección con bloques del mundo
        // Por ahora retorna null
        return null;
    }
    
    selectHotbarSlot(slot) {
        if (slot < 0 || slot > 8) return;
        
        // Actualizar selección visual
        document.querySelector('.hotbar-slot.active')?.classList.remove('active');
        const slots = document.querySelectorAll('.hotbar-slot');
        if (slots[slot]) {
            slots[slot].classList.add('active');
            this.selectedBlock = slot + 1;
        }
    }
    
    updateHotbarSelection() {
        const slot = this.selectedBlock - 1;
        this.selectHotbarSlot(slot);
    }
    
    jump() {
        // Implementado en el sistema de física
        this.canJump = false;
    }
    
    dropItem() {
        console.log('Drop item:', this.selectedBlock);
    }
    
    openInventory() {
        console.log('Abrir inventario');
    }
    
    togglePerspective() {
        console.log('Cambiar perspectiva');
    }
    
    getDirection() {
        // Calcular vector de dirección basado en input
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();
        
        return this.direction;
    }
    
    update(delta) {
        if (!this.enabled) return;
        
        // La actualización de movimiento se maneja en player.js
    }
    
    dispose() {
        document.removeEventListener('keydown', this.onKeyDown.bind(this));
        document.removeEventListener('keyup', this.onKeyUp.bind(this));
        document.removeEventListener('mousemove', this.onMouseMove.bind(this));
        document.removeEventListener('mousedown', this.onMouseDown.bind(this));
        document.removeEventListener('mouseup', this.onMouseUp.bind(this));
        document.removeEventListener('wheel', this.onMouseWheel.bind(this));
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Controls;
}