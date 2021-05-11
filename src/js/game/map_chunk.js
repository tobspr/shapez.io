import { globalConfig } from "../core/config";
import { createLogger } from "../core/logging";
import { RandomNumberGenerator } from "../core/rng";
import { clamp, fastArrayDeleteValueIfContained, make2DUndefinedArray } from "../core/utils";
import { Vector } from "../core/vector";
import { BaseItem } from "./base_item";
import { enumColors } from "./colors";
import { Entity } from "./entity";
import { ColorItem } from "./items/color_item";
import { GameRoot } from "./root";
import { enumSubShape } from "./shape_definition";
import { Rectangle } from "../core/rectangle";

const logger = createLogger("map_chunk");

export class MapChunk {
    /**
     *
     * @param {GameRoot} root
     * @param {number} x
     * @param {number} y
     */
    constructor(root, x, y) {
        this.root = root;
        this.x = x;
        this.y = y;
        this.tileX = x * globalConfig.mapChunkSize;
        this.tileY = y * globalConfig.mapChunkSize;

        /**
         * Stores the contents of the lower (= map resources) layer
         *  @type {Array<Array<?BaseItem>>}
         */
        this.lowerLayer = make2DUndefinedArray(globalConfig.mapChunkSize, globalConfig.mapChunkSize);

        /**
         * Stores the contents of the regular layer
         * @type {Array<Array<?Entity>>}
         */
        this.contents = make2DUndefinedArray(globalConfig.mapChunkSize, globalConfig.mapChunkSize);

        /**
         * Stores the contents of the wires layer
         *  @type {Array<Array<?Entity>>}
         */
        this.wireContents = make2DUndefinedArray(globalConfig.mapChunkSize, globalConfig.mapChunkSize);

        /**
         * Stores the contents of the layers
         *  @type {Map<string, Array<Array<?Entity>>>}
         */
        this.layersContents = new Map();

        /** @type {Array<Entity>} */
        this.containedEntities = [];

        /**
         * World space rectangle, can be used for culling
         */
        this.worldSpaceRectangle = new Rectangle(
            this.tileX * globalConfig.tileSize,
            this.tileY * globalConfig.tileSize,
            globalConfig.mapChunkWorldSize,
            globalConfig.mapChunkWorldSize
        );

        /**
         * Tile space rectangle, can be used for culling
         */
        this.tileSpaceRectangle = new Rectangle(
            this.tileX,
            this.tileY,
            globalConfig.mapChunkSize,
            globalConfig.mapChunkSize
        );

        /**
         * Which entities this chunk contains, sorted by layer
         * @type {Record<Layer, Array<Entity>>}
         */
        this.containedEntitiesByLayer = {
            regular: [],
            wires: [],
        };

        for (let i = 0; i < shapezAPI.ingame.layers.length; i++) {
            const layer = shapezAPI.ingame.layers[i];
            this.containedEntitiesByLayer[layer] = [];
            this.layersContents.set(
                layer,
                make2DUndefinedArray(globalConfig.mapChunkSize, globalConfig.mapChunkSize)
            );
        }

        /**
         * Store which patches we have so we can render them in the overview
         * @type {Array<{pos: Vector, item: BaseItem, size: number }>}
         */
        this.patches = [];

        this.generateLowerLayer();
    }

    /**
     * Generates a patch filled with the given item
     * @param {RandomNumberGenerator} rng
     * @param {number} patchSize
     * @param {any} item
     * @param {number=} overrideX Override the X position of the patch
     * @param {number=} overrideY Override the Y position of the patch
     */
    internalGeneratePatch(rng, patchSize, item, overrideX = null, overrideY = null) {
        const border = Math.ceil(patchSize / 2 + 3);

        // Find a position within the chunk which is not blocked
        let patchX = rng.nextIntRange(border, globalConfig.mapChunkSize - border - 1);
        let patchY = rng.nextIntRange(border, globalConfig.mapChunkSize - border - 1);

        if (overrideX !== null) {
            patchX = overrideX;
        }

        if (overrideY !== null) {
            patchY = overrideY;
        }

        const avgPos = new Vector(0, 0);
        let patchesDrawn = 0;

        // Each patch consists of multiple circles
        const numCircles = patchSize;

        for (let i = 0; i <= numCircles; ++i) {
            // Determine circle parameters
            const circleRadius = Math.min(1 + i, patchSize);
            const circleRadiusSquare = circleRadius * circleRadius;
            const circleOffsetRadius = (numCircles - i) / 2 + 2;

            // We draw an elipsis actually
            const circleScaleX = rng.nextRange(0.9, 1.1);
            const circleScaleY = rng.nextRange(0.9, 1.1);

            const circleX = patchX + rng.nextIntRange(-circleOffsetRadius, circleOffsetRadius);
            const circleY = patchY + rng.nextIntRange(-circleOffsetRadius, circleOffsetRadius);

            for (let dx = -circleRadius * circleScaleX - 2; dx <= circleRadius * circleScaleX + 2; ++dx) {
                for (let dy = -circleRadius * circleScaleY - 2; dy <= circleRadius * circleScaleY + 2; ++dy) {
                    const x = Math.round(circleX + dx);
                    const y = Math.round(circleY + dy);
                    if (x >= 0 && x < globalConfig.mapChunkSize && y >= 0 && y <= globalConfig.mapChunkSize) {
                        const originalDx = dx / circleScaleX;
                        const originalDy = dy / circleScaleY;
                        if (originalDx * originalDx + originalDy * originalDy <= circleRadiusSquare) {
                            if (!this.lowerLayer[x][y]) {
                                this.lowerLayer[x][y] = item;
                                ++patchesDrawn;
                                avgPos.x += x;
                                avgPos.y += y;
                            }
                        }
                    } else {
                        // logger.warn("Tried to spawn resource out of chunk");
                    }
                }
            }
        }

        this.patches.push({
            pos: avgPos.divideScalar(patchesDrawn),
            item,
            size: patchSize,
        });
    }

    /**
     * Generates the lower layer "terrain"
     */
    generateLowerLayer() {
        const rng = new RandomNumberGenerator(this.x + "|" + this.y + "|" + this.root.map.seed);

        if (this.generatePredefined(rng)) {
            return;
        }

        const chunkCenter = new Vector(this.x, this.y).addScalar(0.5);
        const distanceToOriginInChunks = Math.round(chunkCenter.length());

        for (let i = 0; i < MapChunk.lowerLayers.length; i++) {
            MapChunk.lowerLayers[i](this, rng, distanceToOriginInChunks);
        }
    }

    /**
     * Checks if this chunk has predefined contents, and if so returns true and generates the
     * predefined contents
     * @param {RandomNumberGenerator} rng
     * @returns {boolean}
     */
    generatePredefined(rng) {
        for (let i = 0; i < MapChunk.predefined.length; i++) {
            if (MapChunk.predefined[i](this, rng)) {
                return true;
            }
        }
        return false;
    }

    /**
     *
     * @param {number} worldX
     * @param {number} worldY
     * @returns {BaseItem=}
     */
    getLowerLayerFromWorldCoords(worldX, worldY) {
        const localX = worldX - this.tileX;
        const localY = worldY - this.tileY;
        assert(localX >= 0, "Local X is < 0");
        assert(localY >= 0, "Local Y is < 0");
        assert(localX < globalConfig.mapChunkSize, "Local X is >= chunk size");
        assert(localY < globalConfig.mapChunkSize, "Local Y is >= chunk size");
        return this.lowerLayer[localX][localY] || null;
    }

    /**
     * Returns the contents of this chunk from the given world space coordinates
     * @param {number} worldX
     * @param {number} worldY
     * @returns {Entity=}
     */
    getTileContentFromWorldCoords(worldX, worldY) {
        const localX = worldX - this.tileX;
        const localY = worldY - this.tileY;
        assert(localX >= 0, "Local X is < 0");
        assert(localY >= 0, "Local Y is < 0");
        assert(localX < globalConfig.mapChunkSize, "Local X is >= chunk size");
        assert(localY < globalConfig.mapChunkSize, "Local Y is >= chunk size");
        return this.contents[localX][localY] || null;
    }

    /**
     * Returns the contents of this chunk from the given world space coordinates
     * @param {number} worldX
     * @param {number} worldY
     * @param {Layer} layer
     * @returns {Entity=}
     */
    getLayerContentFromWorldCoords(worldX, worldY, layer) {
        const localX = worldX - this.tileX;
        const localY = worldY - this.tileY;
        assert(localX >= 0, "Local X is < 0");
        assert(localY >= 0, "Local Y is < 0");
        assert(localX < globalConfig.mapChunkSize, "Local X is >= chunk size");
        assert(localY < globalConfig.mapChunkSize, "Local Y is >= chunk size");
        if (layer === "regular") {
            return this.contents[localX][localY] || null;
        } else if (layer === "wires") {
            return this.wireContents[localX][localY] || null;
        } else if (this.layersContents.has(layer)) {
            return this.layersContents.get(layer)[localX][localY] || null;
        }
    }

    /**
     * Returns the contents of this chunk from the given world space coordinates
     * @param {number} worldX
     * @param {number} worldY
     * @returns {Array<Entity>}
     */
    getLayersContentsMultipleFromWorldCoords(worldX, worldY) {
        const localX = worldX - this.tileX;
        const localY = worldY - this.tileY;
        assert(localX >= 0, "Local X is < 0");
        assert(localY >= 0, "Local Y is < 0");
        assert(localX < globalConfig.mapChunkSize, "Local X is >= chunk size");
        assert(localY < globalConfig.mapChunkSize, "Local Y is >= chunk size");

        const regularContent = this.contents[localX][localY];
        const wireContent = this.wireContents[localX][localY];

        const result = [];
        if (regularContent) {
            result.push(regularContent);
        }
        if (wireContent) {
            result.push(wireContent);
        }

        for (const [layer, array] of this.layersContents) {
            if (array[localX][localY]) {
                result.push(array[localX][localY]);
            }
        }

        return result;
    }

    /**
     * Returns the chunks contents from the given local coordinates
     * @param {number} localX
     * @param {number} localY
     * @returns {Entity=}
     */
    getTileContentFromLocalCoords(localX, localY) {
        assert(localX >= 0, "Local X is < 0");
        assert(localY >= 0, "Local Y is < 0");
        assert(localX < globalConfig.mapChunkSize, "Local X is >= chunk size");
        assert(localY < globalConfig.mapChunkSize, "Local Y is >= chunk size");

        return this.contents[localX][localY] || null;
    }

    /**
     * Sets the chunks contents
     * @param {number} tileX
     * @param {number} tileY
     * @param {Entity} contents
     * @param {Layer} layer
     */
    setLayerContentFromWorldCords(tileX, tileY, contents, layer) {
        const localX = tileX - this.tileX;
        const localY = tileY - this.tileY;
        assert(localX >= 0, "Local X is < 0");
        assert(localY >= 0, "Local Y is < 0");
        assert(localX < globalConfig.mapChunkSize, "Local X is >= chunk size");
        assert(localY < globalConfig.mapChunkSize, "Local Y is >= chunk size");

        let oldContents;
        if (layer === "regular") {
            oldContents = this.contents[localX][localY];
        } else if (layer === "wires") {
            oldContents = this.wireContents[localX][localY];
        } else if (this.layersContents.has(layer)) {
            oldContents = this.layersContents.get(layer)[localX][localY];
        }

        assert(contents === null || !oldContents, "Tile already used: " + tileX + " / " + tileY);

        if (oldContents) {
            // Remove from list (the old contents must be reigstered)
            fastArrayDeleteValueIfContained(this.containedEntities, oldContents);
            fastArrayDeleteValueIfContained(this.containedEntitiesByLayer[layer], oldContents);
        }

        if (layer === "regular") {
            this.contents[localX][localY] = contents;
        } else if (layer === "wires") {
            this.wireContents[localX][localY] = contents;
        } else if (this.layersContents.has(layer)) {
            this.layersContents.get(layer)[localX][localY] = contents;
        }

        if (contents) {
            if (this.containedEntities.indexOf(contents) < 0) {
                this.containedEntities.push(contents);
            }

            if (this.containedEntitiesByLayer[layer].indexOf(contents) < 0) {
                this.containedEntitiesByLayer[layer].push(contents);
            }
        }
    }
}
MapChunk.predefined = [
    (self, rng) => {
        if (self.x === 0 && self.y === 0) {
            self.internalGeneratePatch(rng, 2, ColorItem.ITEM_SINGLETONS[enumColors.red], 7, 7);
            return true;
        }
    },
    (self, rng) => {
        if (self.x === 0 && self.y === 0) {
            self.internalGeneratePatch(rng, 2, ColorItem.ITEM_SINGLETONS[enumColors.red], 7, 7);
            return true;
        }
    },
    (self, rng) => {
        if (self.x === -1 && self.y === 0) {
            const item = self.root.shapeDefinitionMgr.getShapeItemFromShortKey("CuCuCuCu");
            self.internalGeneratePatch(rng, 2, item, globalConfig.mapChunkSize - 9, 7);
            return true;
        }
    },
    (self, rng) => {
        if (self.x === 0 && self.y === -1) {
            const item = self.root.shapeDefinitionMgr.getShapeItemFromShortKey("RuRuRuRu");
            self.internalGeneratePatch(rng, 2, item, 5, globalConfig.mapChunkSize - 7);
            return true;
        }
    },
    (self, rng) => {
        if (self.x === -1 && self.y === -1) {
            self.internalGeneratePatch(rng, 2, ColorItem.ITEM_SINGLETONS[enumColors.green]);
            return true;
        }
    },
    (self, rng) => {
        if (self.x === 5 && self.y === -2) {
            const item = self.root.shapeDefinitionMgr.getShapeItemFromShortKey("SuSuSuSu");
            self.internalGeneratePatch(rng, 2, item, 5, globalConfig.mapChunkSize - 7);
            return true;
        }
    },
];

MapChunk.lowerLayers = [
    (self, rng, distanceToOriginInChunks) => {
        // Determine how likely it is that there is a color patch
        const colorPatchChance = 0.9 - clamp(distanceToOriginInChunks / 25, 0, 1) * 0.5;

        if (rng.next() < colorPatchChance / 4) {
            const colorPatchSize = Math.max(2, Math.round(1 + clamp(distanceToOriginInChunks / 8, 0, 4)));
            // First, determine available colors
            let availableColors = [enumColors.red, enumColors.green];
            if (distanceToOriginInChunks > 2) {
                availableColors.push(enumColors.blue);
            }
            self.internalGeneratePatch(
                rng,
                colorPatchSize,
                ColorItem.ITEM_SINGLETONS[rng.choice(availableColors)]
            );
        }
    },
    (self, rng, distanceToOriginInChunks) => {
        /**
         * Chooses a random shape with the given weights
         * @param {RandomNumberGenerator} rng
         * @param {Object.<enumSubShape, number>} weights
         * @returns {enumSubShape}
         */
        var internalGenerateRandomSubShape = (rng, weights) => {
            // @ts-ignore
            const sum = Object.values(weights).reduce((a, b) => a + b, 0);

            const chosenNumber = rng.nextIntRange(0, sum - 1);
            let accumulated = 0;
            for (const key in weights) {
                const weight = weights[key];
                if (accumulated + weight > chosenNumber) {
                    return key;
                }
                accumulated += weight;
            }

            logger.error("Failed to find matching shape in chunk generation");
            return enumSubShape.circle;
        };
        /**
         * Generates a shape patch
         * @param {RandomNumberGenerator} rng
         * @param {number} shapePatchSize
         * @param {number} distanceToOriginInChunks
         */
        var internalGenerateShapePatch = (rng, shapePatchSize, distanceToOriginInChunks) => {
            /** @type {[enumSubShape, enumSubShape, enumSubShape, enumSubShape]} */
            let subShapes = null;

            let weights = {};

            // Later there is a mix of everything
            weights = {
                [enumSubShape.rect]: 100,
                [enumSubShape.circle]: Math.round(50 + clamp(distanceToOriginInChunks * 2, 0, 50)),
                [enumSubShape.star]: Math.round(20 + clamp(distanceToOriginInChunks, 0, 30)),
                [enumSubShape.windmill]: Math.round(6 + clamp(distanceToOriginInChunks / 2, 0, 20)),
            };

            if (distanceToOriginInChunks < 7) {
                // Initial chunks can not spawn the good stuff
                weights[enumSubShape.star] = 0;
                weights[enumSubShape.windmill] = 0;
            }

            if (distanceToOriginInChunks < 10) {
                // Initial chunk patches always have the same shape
                const subShape = internalGenerateRandomSubShape(rng, weights);
                subShapes = [subShape, subShape, subShape, subShape];
            } else if (distanceToOriginInChunks < 15) {
                // Later patches can also have mixed ones
                const subShapeA = internalGenerateRandomSubShape(rng, weights);
                const subShapeB = internalGenerateRandomSubShape(rng, weights);
                subShapes = [subShapeA, subShapeA, subShapeB, subShapeB];
            } else {
                // Finally there is a mix of everything
                subShapes = [
                    internalGenerateRandomSubShape(rng, weights),
                    internalGenerateRandomSubShape(rng, weights),
                    internalGenerateRandomSubShape(rng, weights),
                    internalGenerateRandomSubShape(rng, weights),
                ];
            }

            // Makes sure windmills never spawn as whole
            let windmillCount = 0;
            for (let i = 0; i < subShapes.length; ++i) {
                if (subShapes[i] === enumSubShape.windmill) {
                    ++windmillCount;
                }
            }
            if (windmillCount > 1) {
                subShapes[0] = enumSubShape.rect;
                subShapes[1] = enumSubShape.rect;
            }

            const definition = self.root.shapeDefinitionMgr.getDefinitionFromSimpleShapes(subShapes);
            self.internalGeneratePatch(
                rng,
                shapePatchSize,
                self.root.shapeDefinitionMgr.getShapeItemFromDefinition(definition)
            );
        };

        // Determine how likely it is that there is a shape patch
        const shapePatchChance = 0.9 - clamp(distanceToOriginInChunks / 25, 0, 1) * 0.5;
        if (rng.next() < shapePatchChance / 4) {
            const shapePatchSize = Math.max(2, Math.round(1 + clamp(distanceToOriginInChunks / 8, 0, 4)));
            internalGenerateShapePatch(rng, shapePatchSize, distanceToOriginInChunks);
        }
    },
];
