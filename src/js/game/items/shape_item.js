import { DrawParameters } from "../../core/draw_parameters";
import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { ShapeDefinition } from "../shape_definition";
import { THEME } from "../theme";
import { globalConfig } from "../../core/config";

export class ShapeItem extends BaseItem {
    static getId() {
        return "shape";
    }

    static getSchema() {
        return types.string;
    }

    serialize() {
        return this.definition.getHash();
    }

    deserialize(data) {
        this.definition = ShapeDefinition.fromShortKey(data);
    }

    /** @returns {"shape"} **/
    getItemType() {
        return "shape";
    }

    /**
     * @returns {string}
     */
    getAsCopyableKey() {
        return this.definition.getHash();
    }

    /**
     * @param {BaseItem} other
     */
    equalsImpl(other) {
        return this.definition.getHash() === /** @type {ShapeItem} */ (other).definition.getHash();
    }

    /**
     * @param {ShapeDefinition} definition
     */
    constructor(definition) {
        super();

        /**
         * This property must not be modified on runtime, you have to clone the class in order to change the definition
         */
        this.definition = definition;
    }

    getBackgroundColorAsResource() {
        return THEME.map.resources.shape;
    }

    /**
     * Draws the item to a canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} size
     */
    drawFullSizeOnCanvas(context, size) {
        this.definition.drawFullSizeOnCanvas(context, size);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {DrawParameters} parameters
     * @param {number=} diameter
     */
    drawItemCenteredImpl(x, y, parameters, diameter = globalConfig.defaultItemDiameter, background = true) {
        this.definition.drawCentered(x, y, parameters, diameter, background);
    }
}

ShapeItem.resolveSingleton = (root, itemData) => {
    return root.shapeDefinitionMgr.getShapeItemFromShortKey(itemData);
};
