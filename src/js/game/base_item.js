import { globalConfig } from "../core/config";
import { DrawParameters } from "../core/draw_parameters";
import { BasicSerializableObject } from "../savegame/serialization";

/**
 * Class for items on belts etc. Not an entity for performance reasons
 */
export class BaseItem extends BasicSerializableObject {
    constructor() {
        super();
    }

    static getId() {
        return "base_item";
    }

    /** @returns {object} */
    static getSchema() {
        return {};
    }

    /** @returns {ItemType} **/
    getItemType() {
        abstract;
        return "shape";
    }

    /**
     * Returns a string id of the item
     * @returns {string}
     */
    getAsCopyableKey() {
        abstract;
        return "";
    }

    /**
     * Returns if the item equals the other itme
     * @param {BaseItem} other
     * @returns {boolean}
     */
    equals(other) {
        if (this.getItemType() !== other.getItemType()) {
            return false;
        }
        return this.equalsImpl(other);
    }

    /**
     * Override for custom comparison
     * @abstract
     * @param {BaseItem} other
     * @returns {boolean}
     */
    equalsImpl(other) {
        abstract;
        return false;
    }

    /**
     * Draws the item to a canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} size
     */
    drawFullSizeOnCanvas(context, size) {
        abstract;
    }

    /**
     * Draws the item at the given position
     * @param {number} x
     * @param {number} y
     * @param {DrawParameters} parameters
     * @param {number=} diameter
     */
    drawItemCenteredClipped(
        x,
        y,
        parameters,
        diameter = globalConfig.defaultItemDiameter,
        background = true
    ) {
        if (parameters.visibleRect.containsCircle(x, y, diameter / 2)) {
            this.drawItemCenteredImpl(x, y, parameters, diameter, background);
        }
    }

    /**
     * INTERNAL
     * @param {number} x
     * @param {number} y
     * @param {DrawParameters} parameters
     * @param {number=} diameter
     */
    drawItemCenteredImpl(x, y, parameters, diameter = globalConfig.defaultItemDiameter, background = true) {
        abstract;
    }

    getBackgroundColorAsResource() {
        abstract;
        return "";
    }
}
