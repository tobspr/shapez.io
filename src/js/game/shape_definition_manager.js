import { createLogger } from "../core/logging";
import { BasicSerializableObject } from "../savegame/serialization";
import { enumColors } from "./colors";
import { ShapeItem } from "./items/shape_item";
import { GameRoot } from "./root";
import { enumSubShape, ShapeDefinition } from "./shape_definition";
import { ACHIEVEMENTS } from "../platform/achievement_provider";

const logger = createLogger("shape_definition_manager");

export class ShapeDefinitionManager extends BasicSerializableObject {
    static getId() {
        return "ShapeDefinitionManager";
    }

    /**
     *
     * @param {GameRoot} root
     */
    constructor(root) {
        super();
        this.root = root;

        /**
         * Store a cache from key -> definition
         * @type {Object<string, ShapeDefinition>}
         */
        this.shapeKeyToDefinition = {};

        /**
         * Store a cache from key -> item
         */
        this.shapeKeyToItem = {};

        // Caches operations in the form of 'operation/def1[/def2]'
        /** @type {Object.<string, Array<ShapeDefinition>|ShapeDefinition>} */
        this.operationCache = {};
    }

    /**
     * Returns a shape instance from a given short key
     * @param {string} hash
     * @returns {ShapeDefinition}
     */
    getShapeFromShortKey(hash) {
        const cached = this.shapeKeyToDefinition[hash];
        if (cached) {
            return cached;
        }
        return (this.shapeKeyToDefinition[hash] = ShapeDefinition.fromShortKey(hash));
    }

    /**
     * Returns a item instance from a given short key
     * @param {string} hash
     * @returns {ShapeItem}
     */
    getShapeItemFromShortKey(hash) {
        const cached = this.shapeKeyToItem[hash];
        if (cached) {
            return cached;
        }
        const definition = this.getShapeFromShortKey(hash);
        return (this.shapeKeyToItem[hash] = new ShapeItem(definition));
    }

    /**
     * Returns a shape item for a given definition
     * @param {ShapeDefinition} definition
     * @returns {ShapeItem}
     */
    getShapeItemFromDefinition(definition) {
        return this.getShapeItemFromShortKey(definition.getHash());
    }

    /**
     * Registers a new shape definition
     * @param {ShapeDefinition} definition
     */
    registerShapeDefinition(definition) {
        const id = definition.getHash();
        assert(!this.shapeKeyToDefinition[id], "Shape Definition " + id + " already exists");
        this.shapeKeyToDefinition[id] = definition;
        // logger.log("Registered shape with key", id);
    }

    /**
     * Generates a definition for splitting a shape definition in two halfs
     * @param {ShapeDefinition} definition
     * @returns {[ShapeDefinition, ShapeDefinition]}
     */
    shapeActionCutHalf(definition) {
        const key = "cut/" + definition.getHash();
        if (this.operationCache[key]) {
            return /** @type {[ShapeDefinition, ShapeDefinition]} */ (this.operationCache[key]);
        }
        const rightSide = definition.cloneFilteredByQuadrants([2, 3]);
        const leftSide = definition.cloneFilteredByQuadrants([0, 1]);

        this.root.signals.achievementCheck.dispatch(ACHIEVEMENTS.cutShape);

        return /** @type {[ShapeDefinition, ShapeDefinition]} */ (this.operationCache[key] = [
            this.registerOrReturnHandle(rightSide),
            this.registerOrReturnHandle(leftSide),
        ]);
    }

    /**
     * Generates a definition for splitting a shape definition in four quads
     * @param {ShapeDefinition} definition
     * @returns {[ShapeDefinition, ShapeDefinition, ShapeDefinition, ShapeDefinition]}
     */
    shapeActionCutQuad(definition) {
        const key = "cut-quad/" + definition.getHash();
        if (this.operationCache[key]) {
            return /** @type {[ShapeDefinition, ShapeDefinition, ShapeDefinition, ShapeDefinition]} */ (this
                .operationCache[key]);
        }

        return /** @type {[ShapeDefinition, ShapeDefinition, ShapeDefinition, ShapeDefinition]} */ (this.operationCache[
            key
        ] = [
            this.registerOrReturnHandle(definition.cloneFilteredByQuadrants([0])),
            this.registerOrReturnHandle(definition.cloneFilteredByQuadrants([1])),
            this.registerOrReturnHandle(definition.cloneFilteredByQuadrants([2])),
            this.registerOrReturnHandle(definition.cloneFilteredByQuadrants([3])),
        ]);
    }

    /**
     * Generates a definition for rotating a shape clockwise
     * @param {ShapeDefinition} definition
     * @returns {ShapeDefinition}
     */
    shapeActionRotateCW(definition) {
        const key = "rotate-cw/" + definition.getHash();
        if (this.operationCache[key]) {
            return /** @type {ShapeDefinition} */ (this.operationCache[key]);
        }

        const rotated = definition.cloneRotateCW();

        this.root.signals.achievementCheck.dispatch(ACHIEVEMENTS.rotateShape);

        return /** @type {ShapeDefinition} */ (this.operationCache[key] = this.registerOrReturnHandle(
            rotated
        ));
    }

    /**
     * Generates a definition for rotating a shape counter clockwise
     * @param {ShapeDefinition} definition
     * @returns {ShapeDefinition}
     */
    shapeActionRotateCCW(definition) {
        const key = "rotate-ccw/" + definition.getHash();
        if (this.operationCache[key]) {
            return /** @type {ShapeDefinition} */ (this.operationCache[key]);
        }

        const rotated = definition.cloneRotateCCW();

        return /** @type {ShapeDefinition} */ (this.operationCache[key] = this.registerOrReturnHandle(
            rotated
        ));
    }

    /**
     * Generates a definition for rotating a shape FL
     * @param {ShapeDefinition} definition
     * @returns {ShapeDefinition}
     */
    shapeActionRotate180(definition) {
        const key = "rotate-fl/" + definition.getHash();
        if (this.operationCache[key]) {
            return /** @type {ShapeDefinition} */ (this.operationCache[key]);
        }

        const rotated = definition.cloneRotate180();

        return /** @type {ShapeDefinition} */ (this.operationCache[key] = this.registerOrReturnHandle(
            rotated
        ));
    }

    /**
     * Generates a definition for stacking the upper definition onto the lower one
     * @param {ShapeDefinition} lowerDefinition
     * @param {ShapeDefinition} upperDefinition
     * @returns {ShapeDefinition}
     */
    shapeActionStack(lowerDefinition, upperDefinition) {
        const key = "stack/" + lowerDefinition.getHash() + "/" + upperDefinition.getHash();
        if (this.operationCache[key]) {
            return /** @type {ShapeDefinition} */ (this.operationCache[key]);
        }

        this.root.signals.achievementCheck.dispatch(ACHIEVEMENTS.stackShape);

        const stacked = lowerDefinition.cloneAndStackWith(upperDefinition);
        return /** @type {ShapeDefinition} */ (this.operationCache[key] = this.registerOrReturnHandle(
            stacked
        ));
    }

    /**
     * Generates a definition for painting it with the given color
     * @param {ShapeDefinition} definition
     * @param {enumColors} color
     * @returns {ShapeDefinition}
     */
    shapeActionPaintWith(definition, color) {
        const key = "paint/" + definition.getHash() + "/" + color;
        if (this.operationCache[key]) {
            return /** @type {ShapeDefinition} */ (this.operationCache[key]);
        }

        this.root.signals.achievementCheck.dispatch(ACHIEVEMENTS.paintShape);

        const colorized = definition.cloneAndPaintWith(color);
        return /** @type {ShapeDefinition} */ (this.operationCache[key] = this.registerOrReturnHandle(
            colorized
        ));
    }

    /**
     * Generates a definition for painting it with the 4 colors
     * @param {ShapeDefinition} definition
     * @param {[enumColors, enumColors, enumColors, enumColors]} colors
     * @returns {ShapeDefinition}
     */
    shapeActionPaintWith4Colors(definition, colors) {
        const key = "paint4/" + definition.getHash() + "/" + colors.join(",");
        if (this.operationCache[key]) {
            return /** @type {ShapeDefinition} */ (this.operationCache[key]);
        }
        const colorized = definition.cloneAndPaintWith4Colors(colors);
        return /** @type {ShapeDefinition} */ (this.operationCache[key] = this.registerOrReturnHandle(
            colorized
        ));
    }

    /**
     * Checks if we already have cached this definition, and if so throws it away and returns the already
     * cached variant
     * @param {ShapeDefinition} definition
     */
    registerOrReturnHandle(definition) {
        const id = definition.getHash();
        if (this.shapeKeyToDefinition[id]) {
            return this.shapeKeyToDefinition[id];
        }
        this.shapeKeyToDefinition[id] = definition;
        // logger.log("Registered shape with key (2)", id);
        return definition;
    }

    /**
     *
     * @param {[enumSubShape, enumSubShape, enumSubShape, enumSubShape]} subShapes
     * @returns {ShapeDefinition}
     */
    getDefinitionFromSimpleShapes(subShapes, color = enumColors.uncolored) {
        const shapeLayer = /** @type {import("./shape_definition").ShapeLayer} */ (subShapes.map(
            subShape => ({ subShape, color })
        ));

        return this.registerOrReturnHandle(new ShapeDefinition({ layers: [shapeLayer] }));
    }
}
