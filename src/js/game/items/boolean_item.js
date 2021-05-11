import { DrawParameters } from "../../core/draw_parameters";
import { Loader } from "../../core/loader";
import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { globalConfig } from "../../core/config";

export class BooleanItem extends BaseItem {
    static getId() {
        return "boolean_item";
    }

    static getSchema() {
        return types.uint;
    }

    serialize() {
        return this.value;
    }

    deserialize(data) {
        this.value = data;
    }

    /** @returns {"boolean"} **/
    getItemType() {
        return "boolean";
    }

    /**
     * @returns {string}
     */
    getAsCopyableKey() {
        return this.value ? "1" : "0";
    }

    /**
     * @param {number} value
     */
    constructor(value) {
        super();
        this.value = value ? 1 : 0;
    }

    /**
     * @param {BaseItem} other
     */
    equalsImpl(other) {
        return this.value === /** @type {BooleanItem} */ (other).value;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} diameter
     * @param {DrawParameters} parameters
     */
    drawItemCenteredImpl(x, y, parameters, diameter = globalConfig.defaultItemDiameter) {
        let sprite;
        if (this.value) {
            sprite = Loader.getSprite("sprites/wires/boolean_true.png");
        } else {
            sprite = Loader.getSprite("sprites/wires/boolean_false.png");
        }
        sprite.drawCachedCentered(parameters, x, y, diameter);
    }

    /**
     * Draws the item to a canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} size
     */
    drawFullSizeOnCanvas(context, size) {
        let sprite;
        if (this.value) {
            sprite = Loader.getSprite("sprites/wires/boolean_true.png");
        } else {
            sprite = Loader.getSprite("sprites/wires/boolean_false.png");
        }
        sprite.drawCentered(context, size / 2, size / 2, size);
    }
}

BooleanItem.resolveSingleton = (root, itemData) => {
    return itemData ? BOOL_TRUE_SINGLETON : BOOL_FALSE_SINGLETON;
};

export const BOOL_FALSE_SINGLETON = new BooleanItem(0);
export const BOOL_TRUE_SINGLETON = new BooleanItem(1);

/**
 * Returns whether the item is Boolean and TRUE
 * @param {BaseItem} item
 * @returns {boolean}
 */
export function isTrueItem(item) {
    return item && item.getItemType() === "boolean" && !!(/** @type {BooleanItem} */ (item).value);
}

/**
 * Returns whether the item is truthy
 * @param {BaseItem} item
 * @returns {boolean}
 */
export function isTruthyItem(item) {
    if (!item) {
        return false;
    }

    if (item.getItemType() === "boolean") {
        return !!(/** @type {BooleanItem} */ (item).value);
    }

    return true;
}
