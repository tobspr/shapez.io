/* typehints:start */
import { GameRoot } from "./root";
import { DrawParameters } from "../core/draw_parameters";
/* typehints:end */

/**
 * A game system processes all entities which match a given schema, usually a list of
 * required components. This is the core of the game logic.
 */
export class GameSystem {
    /**
     * @param {GameRoot} root
     */
    constructor(root) {
        this.root = root;
    }

    ///// PUBLIC API /////

    /**
     * Returns static id
     */
    static getId() {
        abstract;
        return "unknown-system";
    }

    /**
     * Updates the game system, override to perform logic
     */
    update() {}

    /**
     * Override, do not call this directly, use startDraw()
     * @param {DrawParameters} parameters
     */
    draw(parameters) {}

    /**
     * Should refresh all caches
     */
    refreshCaches() {}

    /**
     * @see GameSystem.draw Wrapper arround the draw method
     * @param {DrawParameters} parameters
     */
    startDraw(parameters) {
        this.draw(parameters);
    }
}
