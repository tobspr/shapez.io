import {
    Math_abs,
    Math_ceil,
    Math_floor,
    Math_max,
    Math_min,
    Math_random,
    performanceNow,
} from "../core/builtins";
import { clickDetectorGlobals } from "../core/click_detector";
import { globalConfig } from "../core/config";
import { createLogger } from "../core/logging";
import { queryParamOptions } from "../core/query_parameters";
import { Rectangle } from "../core/rectangle";
import { Signal, STOP_PROPAGATION } from "../core/signal";
import { clamp } from "../core/utils";
import { mixVector, Vector } from "../core/vector";
import { BasicSerializableObject, types } from "../savegame/serialization";
import { GameRoot } from "./root";
import { KEYMAPPINGS } from "./key_action_mapper";

const logger = createLogger("camera");

export const USER_INTERACT_MOVE = "move";
export const USER_INTERACT_ZOOM = "zoom";
export const USER_INTERACT_TOUCHEND = "touchend";

const velocitySmoothing = 0.5;
const velocityFade = 0.98;
const velocityStrength = 0.4;
const velocityMax = 20;

/**
 * @enum {string}
 */
export const enumMouseButton = {
    left: "left",
    middle: "middle",
    right: "right",
};

export class Camera extends BasicSerializableObject {
    constructor(root) {
        super();

        /** @type {GameRoot} */
        this.root = root;

        // Zoom level, 2 means double size

        // Find optimal initial zoom

        this.zoomLevel = this.findInitialZoom();
        this.clampZoomLevel();

        /** @type {Vector} */
        this.center = new Vector(0, 0);

        // Input handling
        this.currentlyMoving = false;
        this.lastMovingPosition = null;
        this.cameraUpdateTimeBucket = 0.0;
        this.didMoveSinceTouchStart = false;
        this.currentlyPinching = false;
        this.lastPinchPositions = null;

        this.keyboardForce = new Vector();

        // Signal which gets emitted once the user changed something
        this.userInteraction = new Signal();

        /** @type {Vector} */
        this.currentShake = new Vector(0, 0);

        /** @type {Vector} */
        this.currentPan = new Vector(0, 0);

        // Set desired pan (camera movement)
        /** @type {Vector} */
        this.desiredPan = new Vector(0, 0);

        // Set desired camera center
        /** @type {Vector} */
        this.desiredCenter = null;

        // Set desired camera zoom
        /** @type {number} */
        this.desiredZoom = null;

        /** @type {Vector} */
        this.touchPostMoveVelocity = new Vector(0, 0);

        // Handlers
        this.downPreHandler = /** @type {TypedSignal<[Vector, enumMouseButton]>} */ (new Signal());
        this.movePreHandler = /** @type {TypedSignal<[Vector]>} */ (new Signal());
        // this.pinchPreHandler = /** @type {TypedSignal<[Vector]>} */ (new Signal());
        this.upPostHandler = /** @type {TypedSignal<[Vector]>} */ (new Signal());

        this.internalInitEvents();
        this.clampZoomLevel();
        this.bindKeys();
        if (G_IS_DEV) {
            window.addEventListener("keydown", ev => {
                if (ev.key === "l") {
                    this.zoomLevel = 3;
                }
            });
        }
    }

    // Serialization
    static getId() {
        return "Camera";
    }

    static getSchema() {
        return {
            zoomLevel: types.float,
            center: types.vector,
        };
    }

    deserialize(data) {
        const errorCode = super.deserialize(data);
        if (errorCode) {
            return errorCode;
        }

        // Safety
        this.clampZoomLevel();
    }

    // Simple geters & setters

    addScreenShake(amount) {
        const currentShakeAmount = this.currentShake.length();
        const scale = 1 / (1 + 3 * currentShakeAmount);
        this.currentShake.x = this.currentShake.x + 2 * (Math_random() - 0.5) * scale * amount;
        this.currentShake.y = this.currentShake.y + 2 * (Math_random() - 0.5) * scale * amount;
    }

    /**
     * Sets a point in world space to focus on
     * @param {Vector} center
     */
    setDesiredCenter(center) {
        this.desiredCenter = center.copy();
        this.currentlyMoving = false;
    }

    /**
     * Returns if this camera is currently moving by a non-user interaction
     */
    isCurrentlyMovingToDesiredCenter() {
        return this.desiredCenter !== null;
    }

    /**
     * Sets the camera pan, every frame the camera will move by this amount
     * @param {Vector} pan
     */
    setPan(pan) {
        this.desiredPan = pan.copy();
    }

    /**
     * Finds a good initial zoom level
     */
    findInitialZoom() {
        const desiredWorldSpaceWidth = 15 * globalConfig.tileSize;
        const zoomLevelX = this.root.gameWidth / desiredWorldSpaceWidth;
        const zoomLevelY = this.root.gameHeight / desiredWorldSpaceWidth;

        const finalLevel = Math_min(zoomLevelX, zoomLevelY);
        assert(
            Number.isFinite(finalLevel) && finalLevel > 0,
            "Invalid zoom level computed for initial zoom: " + finalLevel
        );
        return finalLevel;
    }

    /**
     * Clears all animations
     */
    clearAnimations() {
        this.touchPostMoveVelocity.x = 0;
        this.touchPostMoveVelocity.y = 0;
        this.desiredCenter = null;
        this.desiredPan.x = 0;
        this.desiredPan.y = 0;
        this.currentPan.x = 0;
        this.currentPan.y = 0;
        this.currentlyPinching = false;
        this.currentlyMoving = false;
        this.lastMovingPosition = null;
        this.didMoveSinceTouchStart = false;
        this.desiredZoom = null;
    }

    /**
     * Returns if the user is currently interacting with the camera
     * @returns {boolean} true if the user interacts
     */
    isCurrentlyInteracting() {
        if (this.currentlyPinching) {
            return true;
        }
        if (this.currentlyMoving) {
            // Only interacting if moved at least once
            return this.didMoveSinceTouchStart;
        }
        if (this.touchPostMoveVelocity.lengthSquare() > 1) {
            return true;
        }
        return false;
    }

    /**
     * Returns if in the next frame the viewport will change
     * @returns {boolean} true if it willchange
     */
    viewportWillChange() {
        return this.desiredCenter !== null || this.desiredZoom !== null || this.isCurrentlyInteracting();
    }

    /**
     * Cancels all interactions, that is user interaction and non user interaction
     */
    cancelAllInteractions() {
        this.touchPostMoveVelocity = new Vector(0, 0);
        this.desiredCenter = null;
        this.currentlyMoving = false;
        this.currentlyPinching = false;
        this.desiredZoom = null;
    }

    /**
     * Returns effective viewport width
     */
    getViewportWidth() {
        return this.root.gameWidth / this.zoomLevel;
    }

    /**
     * Returns effective viewport height
     */
    getViewportHeight() {
        return this.root.gameHeight / this.zoomLevel;
    }

    /**
     * Returns effective world space viewport left
     */
    getViewportLeft() {
        return this.center.x - this.getViewportWidth() / 2 + (this.currentShake.x * 10) / this.zoomLevel;
    }

    /**
     * Returns effective world space viewport right
     */
    getViewportRight() {
        return this.center.x + this.getViewportWidth() / 2 + (this.currentShake.x * 10) / this.zoomLevel;
    }

    /**
     * Returns effective world space viewport top
     */
    getViewportTop() {
        return this.center.y - this.getViewportHeight() / 2 + (this.currentShake.x * 10) / this.zoomLevel;
    }

    /**
     * Returns effective world space viewport bottom
     */
    getViewportBottom() {
        return this.center.y + this.getViewportHeight() / 2 + (this.currentShake.x * 10) / this.zoomLevel;
    }

    /**
     * Returns the visible world space rect
     * @returns {Rectangle}
     */
    getVisibleRect() {
        return Rectangle.fromTRBL(
            Math_floor(this.getViewportTop()),
            Math_ceil(this.getViewportRight()),
            Math_ceil(this.getViewportBottom()),
            Math_floor(this.getViewportLeft())
        );
    }

    getIsMapOverlayActive() {
        return this.zoomLevel < globalConfig.mapChunkOverviewMinZoom;
    }

    /**
     * Attaches all event listeners
     */
    internalInitEvents() {
        this.eventListenerTouchStart = this.onTouchStart.bind(this);
        this.eventListenerTouchEnd = this.onTouchEnd.bind(this);
        this.eventListenerTouchMove = this.onTouchMove.bind(this);
        this.eventListenerMousewheel = this.onMouseWheel.bind(this);
        this.eventListenerMouseDown = this.onMouseDown.bind(this);
        this.eventListenerMouseMove = this.onMouseMove.bind(this);
        this.eventListenerMouseUp = this.onMouseUp.bind(this);

        this.root.canvas.addEventListener("touchstart", this.eventListenerTouchStart);
        this.root.canvas.addEventListener("touchend", this.eventListenerTouchEnd);
        this.root.canvas.addEventListener("touchcancel", this.eventListenerTouchEnd);
        this.root.canvas.addEventListener("touchmove", this.eventListenerTouchMove);

        this.root.canvas.addEventListener("wheel", this.eventListenerMousewheel);
        this.root.canvas.addEventListener("mousedown", this.eventListenerMouseDown);
        this.root.canvas.addEventListener("mousemove", this.eventListenerMouseMove);
        this.root.canvas.addEventListener("mouseup", this.eventListenerMouseUp);
        this.root.canvas.addEventListener("mouseout", this.eventListenerMouseUp);
    }

    /**
     * Cleans up all event listeners
     */
    cleanup() {
        this.root.canvas.removeEventListener("touchstart", this.eventListenerTouchStart);
        this.root.canvas.removeEventListener("touchend", this.eventListenerTouchEnd);
        this.root.canvas.removeEventListener("touchcancel", this.eventListenerTouchEnd);
        this.root.canvas.removeEventListener("touchmove", this.eventListenerTouchMove);

        this.root.canvas.removeEventListener("wheel", this.eventListenerMousewheel);
        this.root.canvas.removeEventListener("mousedown", this.eventListenerMouseDown);
        this.root.canvas.removeEventListener("mousemove", this.eventListenerMouseMove);
        this.root.canvas.removeEventListener("mouseup", this.eventListenerMouseUp);
        this.root.canvas.removeEventListener("mouseout", this.eventListenerMouseUp);
    }

    /**
     * Binds the arrow keys
     */
    bindKeys() {
        const mapper = this.root.keyMapper;
        mapper.getBinding(KEYMAPPINGS.ingame.mapMoveUp).add(() => (this.keyboardForce.y = -1));
        mapper.getBinding(KEYMAPPINGS.ingame.mapMoveDown).add(() => (this.keyboardForce.y = 1));
        mapper.getBinding(KEYMAPPINGS.ingame.mapMoveRight).add(() => (this.keyboardForce.x = 1));
        mapper.getBinding(KEYMAPPINGS.ingame.mapMoveLeft).add(() => (this.keyboardForce.x = -1));

        const roundToPow = (v, n)=> Math.pow(2, Math.round(Math.log2(v) * n) / n);
        mapper.getBinding(KEYMAPPINGS.ingame.mapZoomIn).add(() => (this.desiredZoom = roundToPow(this.zoomLevel * 1.2, 4)));
        mapper.getBinding(KEYMAPPINGS.ingame.mapZoomOut).add(() => (this.desiredZoom = roundToPow(this.zoomLevel * 0.8, 4)));

        mapper.getBinding(KEYMAPPINGS.ingame.centerMap).add(() => this.centerOnMap());
    }

    centerOnMap() {
        this.desiredCenter = new Vector(0, 0);
    }

    /**
     * Converts from screen to world space
     * @param {Vector} screen
     * @returns {Vector} world space
     */
    screenToWorld(screen) {
        const centerSpace = screen.subScalars(this.root.gameWidth / 2, this.root.gameHeight / 2);
        return centerSpace.divideScalar(this.zoomLevel).add(this.center);
    }

    /**
     * Converts from world to screen space
     * @param {Vector} world
     * @returns {Vector} screen space
     */
    worldToScreen(world) {
        const screenSpace = world.sub(this.center).multiplyScalar(this.zoomLevel);
        return screenSpace.addScalars(this.root.gameWidth / 2, this.root.gameHeight / 2);
    }

    /**
     * Returns if a point is on screen
     * @param {Vector} point
     * @returns {boolean} true if its on screen
     */
    isWorldPointOnScreen(point) {
        const rect = this.getVisibleRect();
        return rect.containsPoint(point.x, point.y);
    }

    /**
     * Returns if we can further zoom in
     * @returns {boolean}
     */
    canZoomIn() {
        const maxLevel = this.root.app.platformWrapper.getMaximumZoom();
        return this.zoomLevel <= maxLevel - 0.01;
    }

    /**
     * Returns if we can further zoom out
     * @returns {boolean}
     */
    canZoomOut() {
        const minLevel = this.root.app.platformWrapper.getMinimumZoom();
        return this.zoomLevel >= minLevel + 0.01;
    }

    // EVENTS

    /**
     * Checks if the mouse event is too close after a touch event and thus
     * should get ignored
     */
    checkPreventDoubleMouse() {
        if (performanceNow() - clickDetectorGlobals.lastTouchTime < 1000.0) {
            return false;
        }
        return true;
    }

    /**
     * Mousedown handler
     * @param {MouseEvent} event
     */
    onMouseDown(event) {
        if (event.cancelable) {
            event.preventDefault();
            // event.stopPropagation();
        }

        if (!this.checkPreventDoubleMouse()) {
            return;
        }

        this.touchPostMoveVelocity = new Vector(0, 0);
        if (event.which === 1) {
            this.combinedSingleTouchStartHandler(event.clientX, event.clientY);
        } else if (event.which === 2) {
            this.downPreHandler.dispatch(new Vector(event.clientX, event.clientY), enumMouseButton.middle);
        } else if (event.which === 3) {
            this.downPreHandler.dispatch(new Vector(event.clientX, event.clientY), enumMouseButton.right);
        }
        return false;
    }

    /**
     * Mousemove handler
     * @param {MouseEvent} event
     */
    onMouseMove(event) {
        if (event.cancelable) {
            event.preventDefault();
            // event.stopPropagation();
        }

        if (!this.checkPreventDoubleMouse()) {
            return;
        }

        if (event.which === 1) {
            this.combinedSingleTouchMoveHandler(event.clientX, event.clientY);
        }

        // Clamp everything afterwards
        this.clampZoomLevel();
        return false;
    }

    /**
     * Mouseup handler
     * @param {MouseEvent=} event
     */
    onMouseUp(event) {
        if (event) {
            if (event.cancelable) {
                event.preventDefault();
                // event.stopPropagation();
            }
        }

        if (!this.checkPreventDoubleMouse()) {
            return;
        }

        this.combinedSingleTouchStopHandler(event.clientX, event.clientY);
        return false;
    }

    /**
     * Mousewheel event
     * @param {WheelEvent} event
     */
    onMouseWheel(event) {
        if (event.cancelable) {
            event.preventDefault();
            // event.stopPropagation();
        }

        const delta = Math.sign(event.deltaY) * -0.15;
        assert(Number.isFinite(delta), "Got invalid delta in mouse wheel event: " + event.deltaY);
        assert(Number.isFinite(this.zoomLevel), "Got invalid zoom level *before* wheel: " + this.zoomLevel);
        this.zoomLevel *= 1 + delta;
        assert(Number.isFinite(this.zoomLevel), "Got invalid zoom level *after* wheel: " + this.zoomLevel);

        this.clampZoomLevel();
        const roundToPow = (v, n)=> Math.pow(2, Math.round(Math.log2(v) * n) / n);
        this.desiredZoom = roundToPow(this.zoomLevel, 4);
        return false;
    }

    /**
     * Touch start handler
     * @param {TouchEvent} event
     */
    onTouchStart(event) {
        if (event.cancelable) {
            event.preventDefault();
            // event.stopPropagation();
        }

        clickDetectorGlobals.lastTouchTime = performanceNow();
        this.touchPostMoveVelocity = new Vector(0, 0);

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.combinedSingleTouchStartHandler(touch.clientX, touch.clientY);
        } else if (event.touches.length === 2) {
            // if (this.pinchPreHandler.dispatch() === STOP_PROPAGATION) {
            //     // Something prevented pinching
            //     return false;
            // }

            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            this.currentlyMoving = false;
            this.currentlyPinching = true;
            this.lastPinchPositions = [
                new Vector(touch1.clientX, touch1.clientY),
                new Vector(touch2.clientX, touch2.clientY),
            ];
        }
        return false;
    }

    /**
     * Touch move handler
     * @param {TouchEvent} event
     */
    onTouchMove(event) {
        if (event.cancelable) {
            event.preventDefault();
            // event.stopPropagation();
        }

        clickDetectorGlobals.lastTouchTime = performanceNow();

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.combinedSingleTouchMoveHandler(touch.clientX, touch.clientY);
        } else if (event.touches.length === 2) {
            if (this.currentlyPinching) {
                const touch1 = event.touches[0];
                const touch2 = event.touches[1];

                const newPinchPositions = [
                    new Vector(touch1.clientX, touch1.clientY),
                    new Vector(touch2.clientX, touch2.clientY),
                ];

                // Get distance of taps last time and now
                const lastDistance = this.lastPinchPositions[0].distance(this.lastPinchPositions[1]);
                const thisDistance = newPinchPositions[0].distance(newPinchPositions[1]);

                // IMPORTANT to do math max here to avoid NaN and causing an invalid zoom level
                const difference = thisDistance / Math_max(0.001, lastDistance);

                // Find old center of zoom
                let oldCenter = this.lastPinchPositions[0].centerPoint(this.lastPinchPositions[1]);

                // Find new center of zoom
                let center = newPinchPositions[0].centerPoint(newPinchPositions[1]);

                // Compute movement
                let movement = oldCenter.sub(center);
                this.center.x += movement.x / this.zoomLevel;
                this.center.y += movement.y / this.zoomLevel;

                // Compute zoom
                center = center.sub(new Vector(this.root.gameWidth / 2, this.root.gameHeight / 2));

                // Apply zoom
                assert(
                    Number.isFinite(difference),
                    "Invalid pinch difference: " +
                        difference +
                        "(last=" +
                        lastDistance +
                        ", new = " +
                        thisDistance +
                        ")"
                );
                this.zoomLevel *= difference;

                // Stick to pivot point
                const correcture = center.multiplyScalar(difference - 1).divideScalar(this.zoomLevel);

                this.center = this.center.add(correcture);
                this.lastPinchPositions = newPinchPositions;
                this.userInteraction.dispatch(USER_INTERACT_MOVE);

                // Since we zoomed, abort any programmed zooming
                if (this.desiredZoom) {
                    this.desiredZoom = null;
                }
            }
        }

        // Clamp everything afterwards
        this.clampZoomLevel();
        return false;
    }

    /**
     * Touch end and cancel handler
     * @param {TouchEvent=} event
     */
    onTouchEnd(event) {
        if (event) {
            if (event.cancelable) {
                event.preventDefault();
                // event.stopPropagation();
            }
        }

        clickDetectorGlobals.lastTouchTime = performanceNow();
        if (event.changedTouches.length === 0) {
            logger.warn("Touch end without changed touches");
        }

        const touch = event.changedTouches[0];
        this.combinedSingleTouchStopHandler(touch.clientX, touch.clientY);
        return false;
    }

    /**
     * Internal touch start handler
     * @param {number} x
     * @param {number} y
     */
    combinedSingleTouchStartHandler(x, y) {
        const pos = new Vector(x, y);
        if (this.downPreHandler.dispatch(pos, enumMouseButton.left) === STOP_PROPAGATION) {
            // Somebody else captured it
            return;
        }

        this.touchPostMoveVelocity = new Vector(0, 0);
        this.currentlyMoving = true;
        this.lastMovingPosition = pos;
        this.didMoveSinceTouchStart = false;
    }

    /**
     * Internal touch move handler
     * @param {number} x
     * @param {number} y
     */
    combinedSingleTouchMoveHandler(x, y) {
        const pos = new Vector(x, y);
        if (this.movePreHandler.dispatch(pos) === STOP_PROPAGATION) {
            // Somebody else captured it
            return;
        }

        if (!this.currentlyMoving) {
            return false;
        }

        let delta = this.lastMovingPosition.sub(pos).divideScalar(this.zoomLevel);
        if (G_IS_DEV && globalConfig.debug.testCulling) {
            // When testing culling, we see everything from the same distance
            delta = delta.multiplyScalar(this.zoomLevel * -2);
        }

        this.didMoveSinceTouchStart = this.didMoveSinceTouchStart || delta.length() > 0;
        this.center = this.center.add(delta);

        this.touchPostMoveVelocity = this.touchPostMoveVelocity
            .multiplyScalar(velocitySmoothing)
            .add(delta.multiplyScalar(1 - velocitySmoothing));

        this.lastMovingPosition = pos;
        this.userInteraction.dispatch(USER_INTERACT_MOVE);

        // Since we moved, abort any programmed moving
        if (this.desiredCenter) {
            this.desiredCenter = null;
        }
    }

    /**
     * Internal touch stop handler
     */
    combinedSingleTouchStopHandler(x, y) {
        if (this.currentlyMoving || this.currentlyPinching) {
            this.currentlyMoving = false;
            this.currentlyPinching = false;
            this.lastMovingPosition = null;
            this.lastPinchPositions = null;
            this.userInteraction.dispatch(USER_INTERACT_TOUCHEND);
            this.didMoveSinceTouchStart = false;
        }
        this.upPostHandler.dispatch(new Vector(x, y));
    }

    /**
     * Clamps the camera zoom level within the allowed range
     */
    clampZoomLevel() {
        if (G_IS_DEV && globalConfig.debug.disableZoomLimits) {
            return;
        }
        const wrapper = this.root.app.platformWrapper;

        assert(Number.isFinite(this.zoomLevel), "Invalid zoom level *before* clamp: " + this.zoomLevel);
        this.zoomLevel = clamp(this.zoomLevel, wrapper.getMinimumZoom(), wrapper.getMaximumZoom());
        assert(Number.isFinite(this.zoomLevel), "Invalid zoom level *after* clamp: " + this.zoomLevel);

        if (this.desiredZoom) {
            this.desiredZoom = clamp(this.desiredZoom, wrapper.getMinimumZoom(), wrapper.getMaximumZoom());
        }
    }

    /**
     * Updates the camera
     * @param {number} dt Delta time in milliseconds
     */
    update(dt) {
        dt = Math_min(dt, 33);
        this.cameraUpdateTimeBucket += dt;

        // Simulate movement of N FPS
        const updatesPerFrame = 4;
        const physicsStepSizeMs = 1000.0 / (60.0 * updatesPerFrame);

        let now = this.root.time.systemNow() - 3 * physicsStepSizeMs;

        while (this.cameraUpdateTimeBucket > physicsStepSizeMs) {
            now += physicsStepSizeMs;
            this.cameraUpdateTimeBucket -= physicsStepSizeMs;

            this.internalUpdatePanning(now, physicsStepSizeMs);
            this.internalUpdateZooming(now, physicsStepSizeMs);
            this.internalUpdateCentering(now, physicsStepSizeMs);
            this.internalUpdateShake(now, physicsStepSizeMs);
            this.internalUpdateKeyboardForce(now, physicsStepSizeMs);
        }
        this.clampZoomLevel();
    }

    /**
     * Prepares a context to transform it
     * @param {CanvasRenderingContext2D} context
     */
    transform(context) {
        if (G_IS_DEV && globalConfig.debug.testCulling) {
            context.transform(1, 0, 0, 1, 100, 100);
            return;
        }

        this.clampZoomLevel();
        const zoom = this.zoomLevel;

        context.transform(
            // Scale, skew, rotate
            zoom,
            0,
            0,
            zoom,

            // Translate
            -zoom * this.getViewportLeft(),
            -zoom * this.getViewportTop()
        );
    }

    /**
     * Internal shake handler
     * @param {number} now Time now in seconds
     * @param {number} dt Delta time
     */
    internalUpdateShake(now, dt) {
        this.currentShake = this.currentShake.multiplyScalar(0.92);
    }

    /**
     * Internal pan handler
     * @param {number} now Time now in seconds
     * @param {number} dt Delta time
     */
    internalUpdatePanning(now, dt) {
        const baseStrength = velocityStrength * this.root.app.platformWrapper.getTouchPanStrength();

        this.touchPostMoveVelocity = this.touchPostMoveVelocity.multiplyScalar(velocityFade);

        // Check influence of past points
        if (!this.currentlyMoving && !this.currentlyPinching) {
            const len = this.touchPostMoveVelocity.length();
            if (len >= velocityMax) {
                this.touchPostMoveVelocity.x = (this.touchPostMoveVelocity.x * velocityMax) / len;
                this.touchPostMoveVelocity.y = (this.touchPostMoveVelocity.y * velocityMax) / len;
            }

            this.center = this.center.add(this.touchPostMoveVelocity.multiplyScalar(baseStrength));

            // Panning
            this.currentPan = mixVector(this.currentPan, this.desiredPan, 0.06);
            this.center = this.center.add(this.currentPan.multiplyScalar((0.5 * dt) / this.zoomLevel));
        }
    }

    /**
     * Updates the non user interaction zooming
     * @param {number} now Time now in seconds
     * @param {number} dt Delta time
     */
    internalUpdateZooming(now, dt) {
        if (!this.currentlyPinching && this.desiredZoom !== null) {
            const diff = this.zoomLevel - this.desiredZoom;
            if (Math_abs(diff) > 0.0001) {
                let fade = 0.94;
                if (diff > 0) {
                    // Zoom out faster than in
                    fade = 0.9;
                }

                assert(Number.isFinite(this.desiredZoom), "Desired zoom is NaN: " + this.desiredZoom);
                assert(Number.isFinite(fade), "Zoom fade is NaN: " + fade);
                this.zoomLevel = this.zoomLevel * fade + this.desiredZoom * (1 - fade);
                assert(Number.isFinite(this.zoomLevel), "Zoom level is NaN after fade: " + this.zoomLevel);
            } else {
                this.desiredZoom = null;
            }
        }
    }

    /**
     * Updates the non user interaction centering
     * @param {number} now Time now in seconds
     * @param {number} dt Delta time
     */
    internalUpdateCentering(now, dt) {
        if (!this.currentlyMoving && this.desiredCenter !== null) {
            const diff = this.center.direction(this.desiredCenter);
            const length = diff.length();
            const tolerance = 1 / this.zoomLevel;
            if (length > tolerance) {
                const movement = diff.multiplyScalar(Math_min(1, dt * 0.008));
                this.center.x += movement.x;
                this.center.y += movement.y;
            } else {
                this.desiredCenter = null;
            }
        }
    }

    /**
     * Updates the keyboard forces
     * @param {number} now
     * @param {number} dt Delta time
     */
    internalUpdateKeyboardForce(now, dt) {
        if (!this.currentlyMoving && this.desiredCenter == null) {
            const limitingDimension = Math_min(this.root.gameWidth, this.root.gameHeight);

            const moveAmount = ((limitingDimension / 2048) * dt) / this.zoomLevel;

            let forceX = 0;
            let forceY = 0;

            const actionMapper = this.root.keyMapper;
            if (actionMapper.getBinding(KEYMAPPINGS.ingame.mapMoveUp).currentlyDown) {
                forceY -= 1;
            }

            if (actionMapper.getBinding(KEYMAPPINGS.ingame.mapMoveDown).currentlyDown) {
                forceY += 1;
            }

            if (actionMapper.getBinding(KEYMAPPINGS.ingame.mapMoveLeft).currentlyDown) {
                forceX -= 1;
            }

            if (actionMapper.getBinding(KEYMAPPINGS.ingame.mapMoveRight).currentlyDown) {
                forceX += 1;
            }

            this.center.x += moveAmount * forceX;
            this.center.y += moveAmount * forceY;
        }
    }
}
