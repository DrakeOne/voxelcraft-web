/**
 * VoxelCraft - Sistema de Controles Móviles
 * v0.1.0
 * 
 * Controles táctiles optimizados para dispositivos móviles
 */

class MobileControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Estado de controles
        this.enabled = true;
        
        // Joystick virtual
        this.joystick = {
            element: document.getElementById('joystick'),
            knob: document.getElementById('joystick-knob'),
            active: false,
            center: { x: 0, y: 0 },
            position: { x: 0, y: 0 },
            vector: { x: 0, y: 0 },
            maxRadius: 50,
            deadzone: CONFIG.MOBILE.JOYSTICK_DEADZONE
        };
        
        // Botones de acción
        this.buttons = {
            jump: document.getElementById('jump-btn'),
            place: document.getElementById('place-btn'),
            break: document.getElementById('break-btn')
        };
        
        // Control de cámara táctil
        this.touch = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            deltaX: 0,
            deltaY: 0,
            identifier: null,
            sensitivity: CONFIG.PLAYER.TOUCH_SENSITIVITY
        };
        
        // Multi-touch
        this.touches = new Map();
        this.pinchDistance = 0;
        this.isPinching = false;
        
        // Movimiento
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.jump = false;
        
        // Rotación de cámara
        this.rotation = {
            x: 0,
            y: 0
        };
        
        // Auto-jump
        this.autoJump = CONFIG.MOBILE.AUTO_JUMP;
        
        // Callbacks
        this.onBlockPlace = null;
        this.onBlockBreak = null;
        
        // Inicializar eventos
        this.initJoystick();
        this.initButtons();
        this.initTouchControls();
        
        // Mostrar controles móviles
        if (CONFIG.DEVICE.IS_MOBILE || CONFIG.DEVICE.HAS_TOUCH) {
            document.querySelector('.mobile-controls').style.display = 'block';
        }
    }
    
    initJoystick() {
        const joystick = this.joystick.element;
        if (!joystick) return;
        
        // Touch start
        joystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                const rect = joystick.getBoundingClientRect();
                
                this.joystick.active = true;
                this.joystick.center = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
                
                this.updateJoystickPosition(touch.clientX, touch.clientY);
                
                // Haptic feedback
                this.vibrate(10);
            }
        }, { passive: false });
        
        // Touch move
        joystick.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (this.joystick.active && e.touches.length > 0) {
                const touch = e.touches[0];
                this.updateJoystickPosition(touch.clientX, touch.clientY);
            }
        }, { passive: false });
        
        // Touch end
        joystick.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            this.joystick.active = false;
            this.resetJoystick();
            
            // Reset movement
            this.moveForward = false;
            this.moveBackward = false;
            this.moveLeft = false;
            this.moveRight = false;
        }, { passive: false });
        
        // Touch cancel
        joystick.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.joystick.active = false;
            this.resetJoystick();
        }, { passive: false });
    }
    
    updateJoystickPosition(touchX, touchY) {
        const deltaX = touchX - this.joystick.center.x;
        const deltaY = touchY - this.joystick.center.y;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        // Limitar al radio máximo
        const limitedDistance = Math.min(distance, this.joystick.maxRadius);
        
        // Calcular posición del knob
        const knobX = Math.cos(angle) * limitedDistance;
        const knobY = Math.sin(angle) * limitedDistance;
        
        // Actualizar posición visual del knob
        this.joystick.knob.style.transform = 
            `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
        
        // Calcular vector normalizado
        const normalizedDistance = limitedDistance / this.joystick.maxRadius;
        
        if (normalizedDistance > this.joystick.deadzone) {
            // Aplicar deadzone
            const adjustedDistance = (normalizedDistance - this.joystick.deadzone) / 
                                    (1 - this.joystick.deadzone);
            
            this.joystick.vector.x = Math.cos(angle) * adjustedDistance;
            this.joystick.vector.y = Math.sin(angle) * adjustedDistance;
            
            // Actualizar flags de movimiento
            this.moveForward = this.joystick.vector.y < -0.3;
            this.moveBackward = this.joystick.vector.y > 0.3;
            this.moveLeft = this.joystick.vector.x < -0.3;
            this.moveRight = this.joystick.vector.x > 0.3;
        } else {
            // En deadzone, no hay movimiento
            this.joystick.vector.x = 0;
            this.joystick.vector.y = 0;
            this.moveForward = false;
            this.moveBackward = false;
            this.moveLeft = false;
            this.moveRight = false;
        }
    }
    
    resetJoystick() {
        this.joystick.knob.style.transform = 'translate(-50%, -50%)';
        this.joystick.vector.x = 0;
        this.joystick.vector.y = 0;
    }
    
    initButtons() {
        // Botón de salto
        if (this.buttons.jump) {
            this.buttons.jump.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.jump = true;
                this.vibrate(10);
            }, { passive: false });
            
            this.buttons.jump.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.jump = false;
            }, { passive: false });
        }
        
        // Botón de colocar bloque
        if (this.buttons.place) {
            this.buttons.place.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.onBlockPlace) {
                    this.onBlockPlace();
                }
                this.vibrate(15);
            }, { passive: false });
        }
        
        // Botón de romper bloque
        if (this.buttons.break) {
            this.buttons.break.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.onBlockBreak) {
                    this.onBlockBreak();
                }
                this.vibrate(20);
            }, { passive: false });
        }
    }
    
    initTouchControls() {
        // Control de cámara con touch en el canvas
        this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        this.domElement.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: false });
        
        // Prevenir zoom del navegador
        document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
    }
    
    onTouchStart(e) {
        e.preventDefault();
        
        // Guardar todos los toques
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            this.touches.set(touch.identifier, {
                startX: touch.clientX,
                startY: touch.clientY,
                currentX: touch.clientX,
                currentY: touch.clientY
            });
        }
        
        if (e.touches.length === 1) {
            // Un solo toque - control de cámara
            const touch = e.touches[0];
            this.touch.active = true;
            this.touch.identifier = touch.identifier;
            this.touch.startX = touch.clientX;
            this.touch.startY = touch.clientY;
            this.touch.currentX = touch.clientX;
            this.touch.currentY = touch.clientY;
        } else if (e.touches.length === 2) {
            // Dos toques - pinch zoom
            this.isPinching = true;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.pinchDistance = this.getDistance(touch1, touch2);
        }
    }
    
    onTouchMove(e) {
        e.preventDefault();
        
        // Actualizar todos los toques
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const savedTouch = this.touches.get(touch.identifier);
            if (savedTouch) {
                savedTouch.currentX = touch.clientX;
                savedTouch.currentY = touch.clientY;
            }
        }
        
        if (e.touches.length === 1 && this.touch.active) {
            // Control de cámara
            const touch = e.touches[0];
            if (touch.identifier === this.touch.identifier) {
                this.touch.deltaX = touch.clientX - this.touch.currentX;
                this.touch.deltaY = touch.clientY - this.touch.currentY;
                this.touch.currentX = touch.clientX;
                this.touch.currentY = touch.clientY;
                
                // Aplicar rotación
                this.rotation.y -= this.touch.deltaX * this.touch.sensitivity;
                this.rotation.x -= this.touch.deltaY * this.touch.sensitivity;
                
                // Limitar rotación vertical
                this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
            }
        } else if (e.touches.length === 2 && this.isPinching) {
            // Pinch zoom
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const newDistance = this.getDistance(touch1, touch2);
            const scale = newDistance / this.pinchDistance;
            
            // Ajustar FOV de la cámara
            if (this.camera) {
                const newFov = this.camera.fov / scale;
                this.camera.fov = Math.max(30, Math.min(110, newFov));
                this.camera.updateProjectionMatrix();
            }
            
            this.pinchDistance = newDistance;
        }
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        
        // Remover toques que terminaron
        const remainingTouches = new Set();
        for (let i = 0; i < e.touches.length; i++) {
            remainingTouches.add(e.touches[i].identifier);
        }
        
        for (const [identifier] of this.touches) {
            if (!remainingTouches.has(identifier)) {
                this.touches.delete(identifier);
            }
        }
        
        if (e.touches.length === 0) {
            // Todos los toques terminaron
            this.touch.active = false;
            this.touch.identifier = null;
            this.isPinching = false;
            this.touches.clear();
        } else if (e.touches.length === 1) {
            // Queda un toque
            this.isPinching = false;
            const touch = e.touches[0];
            this.touch.identifier = touch.identifier;
            this.touch.currentX = touch.clientX;
            this.touch.currentY = touch.clientY;
        }
    }
    
    onTouchCancel(e) {
        e.preventDefault();
        this.touch.active = false;
        this.touch.identifier = null;
        this.isPinching = false;
        this.touches.clear();
    }
    
    getDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    vibrate(duration = 10) {
        if (CONFIG.MOBILE.HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }
    
    getMovementVector() {
        // Retornar vector de movimiento del joystick
        return {
            x: this.joystick.vector.x,
            y: -this.joystick.vector.y, // Invertir Y para que coincida con el sistema de coordenadas
            forward: this.moveForward,
            backward: this.moveBackward,
            left: this.moveLeft,
            right: this.moveRight,
            jump: this.jump
        };
    }
    
    getRotation() {
        return {
            x: this.rotation.x,
            y: this.rotation.y
        };
    }
    
    update(delta) {
        if (!this.enabled) return;
        
        // Aplicar rotación a la cámara
        if (this.camera && this.touch.active) {
            this.camera.rotation.x = this.rotation.x;
            this.camera.rotation.y = this.rotation.y;
        }
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        
        // Mostrar/ocultar controles
        const controlsElement = document.querySelector('.mobile-controls');
        if (controlsElement) {
            controlsElement.style.display = enabled ? 'block' : 'none';
        }
        
        if (!enabled) {
            this.resetJoystick();
            this.touch.active = false;
            this.isPinching = false;
            this.touches.clear();
        }
    }
    
    dispose() {
        // Limpiar event listeners
        if (this.joystick.element) {
            this.joystick.element.removeEventListener('touchstart', this.onTouchStart);
            this.joystick.element.removeEventListener('touchmove', this.onTouchMove);
            this.joystick.element.removeEventListener('touchend', this.onTouchEnd);
        }
        
        // Limpiar botones
        Object.values(this.buttons).forEach(button => {
            if (button) {
                button.removeEventListener('touchstart', () => {});
                button.removeEventListener('touchend', () => {});
            }
        });
        
        // Limpiar touch controls
        this.domElement.removeEventListener('touchstart', this.onTouchStart);
        this.domElement.removeEventListener('touchmove', this.onTouchMove);
        this.domElement.removeEventListener('touchend', this.onTouchEnd);
        this.domElement.removeEventListener('touchcancel', this.onTouchCancel);
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileControls;
}