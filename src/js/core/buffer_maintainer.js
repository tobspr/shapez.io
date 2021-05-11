// @ts-nocheck
import { GameRoot } from "../game/root";
import { clearBufferBacklog, freeCanvas, getBufferStats, makeOffscreenBuffer } from "./buffer_utils";
import { createLogger } from "./logging";
import { round1Digit } from "./utils";

/**
 * @typedef {{
 *  canvas: HTMLCanvasElement,
 *  context: CanvasRenderingContext2D,
 *  lastUse: number,
 * }} CacheEntry
 */

const logger = createLogger("buffers");

const bufferGcDurationSeconds = 0.5;

export class BufferMaintainer {
    /**
     * @param {GameRoot} root
     */
    constructor(root) {
        this.root = root;

        /** @type {Map<string, Map<string, CacheEntry>>} */
        this.cache = new Map();

        this.iterationIndex = 1;
        this.lastIteration = 0;

        this.root.signals.gameFrameStarted.add(this.update, this);
    }

    /**
     * Returns the buffer stats
     */
    getStats() {
        let stats = {
            rootKeys: 0,
            subKeys: 0,
            vramBytes: 0,
        };
        this.cache.forEach((subCache, key) => {
            ++stats.rootKeys;

            subCache.forEach((cacheEntry, subKey) => {
                ++stats.subKeys;

                const canvas = cacheEntry.canvas;
                stats.vramBytes += canvas.width * canvas.height * 4;
            });
        });

        return stats;
    }

    /**
     * Goes to the next buffer iteration, clearing all buffers which were not used
     * for a few iterations
     */
    garbargeCollect() {
        let totalKeys = 0;
        let deletedKeys = 0;
        const minIteration = this.iterationIndex;

        this.cache.forEach((subCache, key) => {
            let unusedSubKeys = [];

            // Filter sub cache
            subCache.forEach((cacheEntry, subKey) => {
                if (cacheEntry.lastUse < minIteration) {
                    unusedSubKeys.push(subKey);
                    freeCanvas(cacheEntry.canvas);
                    ++deletedKeys;
                } else {
                    ++totalKeys;
                }
            });

            // Delete unused sub keys
            for (let i = 0; i < unusedSubKeys.length; ++i) {
                subCache.delete(unusedSubKeys[i]);
            }
        });

        // Make sure our backlog never gets too big
        clearBufferBacklog();

        // if (G_IS_DEV) {
        //     const bufferStats = getBufferStats();
        //     const mbUsed = round1Digit(bufferStats.vramUsage / (1024 * 1024));
        //     logger.log(
        //         "GC: Remove",
        //         (deletedKeys + "").padStart(4),
        //         ", Remain",
        //         (totalKeys + "").padStart(4),
        //         "(",
        //         (bufferStats.bufferCount + "").padStart(4),
        //         "total",
        //         ")",

        //         "(",
        //         (bufferStats.backlogSize + "").padStart(4),
        //         "backlog",
        //         ")",

        //         "VRAM:",
        //         mbUsed,
        //         "MB"
        //     );
        // }

        ++this.iterationIndex;
    }

    update() {
        const now = this.root.time.realtimeNow();
        if (now - this.lastIteration > bufferGcDurationSeconds) {
            this.lastIteration = now;
            this.garbargeCollect();
        }
    }

    /**
     * @param {object} param0
     * @param {string} param0.key
     * @param {string} param0.subKey
     * @param {number} param0.w
     * @param {number} param0.h
     * @param {number} param0.dpi
     * @param {function(HTMLCanvasElement, CanvasRenderingContext2D, number, number, number, object?) : void} param0.redrawMethod
     * @param {object=} param0.additionalParams
     * @returns {HTMLCanvasElement}
     *
     */
    getForKey({ key, subKey, w, h, dpi, redrawMethod, additionalParams }) {
        // First, create parent key
        let parent = this.cache.get(key);
        if (!parent) {
            parent = new Map();
            this.cache.set(key, parent);
        }

        // Now search for sub key
        const cacheHit = parent.get(subKey);
        if (cacheHit) {
            cacheHit.lastUse = this.iterationIndex;
            return cacheHit.canvas;
        }

        // Need to generate new buffer
        const effectiveWidth = w * dpi;
        const effectiveHeight = h * dpi;

        const [canvas, context] = makeOffscreenBuffer(effectiveWidth, effectiveHeight, {
            reusable: true,
            label: "buffer-" + key + "/" + subKey,
            smooth: true,
        });

        redrawMethod(canvas, context, w, h, dpi, additionalParams);

        parent.set(subKey, {
            canvas,
            context,
            lastUse: this.iterationIndex,
        });
        return canvas;
    }
}
