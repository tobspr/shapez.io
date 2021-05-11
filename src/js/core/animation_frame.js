import { Signal } from "./signal";

// @ts-ignore
import BackgroundAnimationFrameEmitterWorker from "../webworkers/background_animation_frame_emittter.worker";

import { createLogger } from "./logging";
/**
 * Logger for animation_frame
 */
const logger = createLogger("animation_frame");

/**
 * Maximum delta milliseconds
 */
const maxDtMs = 1000;
/**
 * Reset delta milliseconds
 */
const resetDtMs = 16;

/**
 * Controls the frames and emit signals to draw
 */
export class AnimationFrame {
    constructor() {
        this.frameEmitted = new Signal();
        this.bgFrameEmitted = new Signal();

        this.lastTime = performance.now();
        this.bgLastTime = performance.now();

        this.boundMethod = this.handleAnimationFrame.bind(this);

        this.backgroundWorker = new BackgroundAnimationFrameEmitterWorker();
        this.backgroundWorker.addEventListener("error", err => {
            logger.error("Error in background fps worker:", err);
        });
        this.backgroundWorker.addEventListener("message", this.handleBackgroundTick.bind(this));
    }

    /**
     * Handels the background tick
     */
    handleBackgroundTick() {
        const time = performance.now();

        let dt = time - this.bgLastTime;

        if (dt > maxDtMs) {
            dt = resetDtMs;
        }

        this.bgFrameEmitted.dispatch(dt);
        this.bgLastTime = time;
    }

    /**
     * Starts the frame loop
     */
    start() {
        assertAlways(window.requestAnimationFrame, "requestAnimationFrame is not supported!");
        this.handleAnimationFrame();
    }

    /**
     * Handels the animation frame
     */
    handleAnimationFrame(time) {
        let dt = time - this.lastTime;

        if (dt > maxDtMs) {
            dt = resetDtMs;
        }

        this.frameEmitted.dispatch(dt);
        this.lastTime = time;

        window.requestAnimationFrame(this.boundMethod);
    }
}
