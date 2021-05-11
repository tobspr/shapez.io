import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { Rectangle } from "../../core/rectangle";
import { AtlasSprite } from "../../core/sprites";
import { enumDirection, Vector } from "../../core/vector";
import { types } from "../../savegame/serialization";
import { getBuildingDataFromCode } from "../building_codes";
import { Component } from "../component";

export class StaticMapEntityComponent extends Component {
    static getId() {
        return "StaticMapEntity";
    }

    static getSchema() {
        return {
            origin: types.tileVector,
            rotation: types.float,
            originalRotation: types.float,

            // See building_codes.js
            code: types.string,
        };
    }

    /**
     * Returns the effective tile size
     * @returns {Vector}
     */
    getTileSize() {
        return getBuildingDataFromCode(this.code).tileSize;
    }

    /**
     * Returns the sprite
     * @returns {AtlasSprite}
     */
    getSprite() {
        return getBuildingDataFromCode(this.code).sprite;
    }

    /**
     * Returns the blueprint sprite
     * @returns {AtlasSprite}
     */
    getBlueprintSprite() {
        return getBuildingDataFromCode(this.code).blueprintSprite;
    }

    /**
     * Returns the silhouette color
     * @returns {string}
     */
    getSilhouetteColor() {
        return getBuildingDataFromCode(this.code).silhouetteColor;
    }

    /**
     * Returns the meta building
     * @returns {import("../meta_building").MetaBuilding}
     */
    getMetaBuilding() {
        return getBuildingDataFromCode(this.code).metaInstance;
    }

    /**
     * Returns the buildings variant
     * @returns {string}
     */
    getVariant() {
        return getBuildingDataFromCode(this.code).variant;
    }

    /**
     * Copy the current state to another component
     * @param {Component} otherComponent
     */
    copyAdditionalStateTo(otherComponent) {
        return new StaticMapEntityComponent({
            origin: this.origin.copy(),
            rotation: this.rotation,
            originalRotation: this.originalRotation,
            code: this.code,
        });
    }

    /**
     *
     * @param {object} param0
     * @param {Vector=} param0.origin Origin (Top Left corner) of the entity
     * @param {Vector=} param0.tileSize Size of the entity in tiles
     * @param {number=} param0.rotation Rotation in degrees. Must be multiple of 90
     * @param {number=} param0.originalRotation Original Rotation in degrees. Must be multiple of 90
     * @param {String=} param0.code Building code
     */
    constructor({
        origin = new Vector(),
        tileSize = new Vector(1, 1),
        rotation = 0,
        originalRotation = 0,
        code = "",
    }) {
        super();
        assert(
            rotation % 90 === 0,
            "Rotation of static map entity must be multiple of 90 (was " + rotation + ")"
        );

        this.origin = origin;
        this.rotation = rotation;
        this.code = code;
        this.originalRotation = originalRotation;
    }

    /**
     * Returns the effective rectangle of this entity in tile space
     * @returns {Rectangle}
     */
    getTileSpaceBounds() {
        const size = this.getTileSize();
        switch (this.rotation) {
            case 0:
                return new Rectangle(this.origin.x, this.origin.y, size.x, size.y);
            case 90:
                return new Rectangle(this.origin.x - size.y + 1, this.origin.y, size.y, size.x);
            case 180:
                return new Rectangle(this.origin.x - size.x + 1, this.origin.y - size.y + 1, size.x, size.y);
            case 270:
                return new Rectangle(this.origin.x, this.origin.y - size.x + 1, size.y, size.x);
            default:
                assert(false, "Invalid rotation");
        }
    }

    /**
     * Transforms the given vector/rotation from local space to world space
     * @param {Vector} vector
     * @returns {Vector}
     */
    applyRotationToVector(vector) {
        return vector.rotateFastMultipleOf90(this.rotation);
    }

    /**
     * Transforms the given vector/rotation from world space to local space
     * @param {Vector} vector
     * @returns {Vector}
     */
    unapplyRotationToVector(vector) {
        return vector.rotateFastMultipleOf90(360 - this.rotation);
    }

    /**
     * Transforms the given direction from local space
     * @param {enumDirection} direction
     * @returns {enumDirection}
     */
    localDirectionToWorld(direction) {
        return Vector.transformDirectionFromMultipleOf90(direction, this.rotation);
    }

    /**
     * Transforms the given direction from world to local space
     * @param {enumDirection} direction
     * @returns {enumDirection}
     */
    worldDirectionToLocal(direction) {
        return Vector.transformDirectionFromMultipleOf90(direction, 360 - this.rotation);
    }

    /**
     * Transforms from local tile space to global tile space
     * @param {Vector} localTile
     * @returns {Vector}
     */
    localTileToWorld(localTile) {
        const result = localTile.rotateFastMultipleOf90(this.rotation);
        result.x += this.origin.x;
        result.y += this.origin.y;
        return result;
    }

    /**
     * Transforms from world space to local space
     * @param {Vector} worldTile
     */
    worldToLocalTile(worldTile) {
        const localUnrotated = worldTile.sub(this.origin);
        return this.unapplyRotationToVector(localUnrotated);
    }

    /**
     * Returns whether the entity should be drawn for the given parameters
     * @param {DrawParameters} parameters
     */
    shouldBeDrawn(parameters) {
        let x = 0;
        let y = 0;
        let w = 0;
        let h = 0;
        const size = this.getTileSize();

        switch (this.rotation) {
            case 0: {
                x = this.origin.x;
                y = this.origin.y;
                w = size.x;
                h = size.y;
                break;
            }
            case 90: {
                x = this.origin.x - size.y + 1;
                y = this.origin.y;
                w = size.y;
                h = size.x;
                break;
            }
            case 180: {
                x = this.origin.x - size.x + 1;
                y = this.origin.y - size.y + 1;
                w = size.x;
                h = size.y;
                break;
            }
            case 270: {
                x = this.origin.x;
                y = this.origin.y - size.x + 1;
                w = size.y;
                h = size.x;
                break;
            }
            default:
                assert(false, "Invalid rotation");
        }

        return parameters.visibleRect.containsRect4Params(
            x * globalConfig.tileSize,
            y * globalConfig.tileSize,
            w * globalConfig.tileSize,
            h * globalConfig.tileSize
        );
    }

    /**
     * Draws a sprite over the whole space of the entity
     * @param {DrawParameters} parameters
     * @param {AtlasSprite} sprite
     * @param {number=} extrudePixels How many pixels to extrude the sprite
     * @param {Vector=} overridePosition Whether to drwa the entity at a different location
     */
    drawSpriteOnBoundsClipped(parameters, sprite, extrudePixels = 0, overridePosition = null) {
        if (!this.shouldBeDrawn(parameters) && !overridePosition) {
            return;
        }
        const size = this.getTileSize();
        let worldX = this.origin.x * globalConfig.tileSize;
        let worldY = this.origin.y * globalConfig.tileSize;

        if (overridePosition) {
            worldX = overridePosition.x * globalConfig.tileSize;
            worldY = overridePosition.y * globalConfig.tileSize;
        }

        if (this.rotation === 0) {
            // Early out, is faster
            sprite.drawCached(
                parameters,
                worldX - extrudePixels * size.x,
                worldY - extrudePixels * size.y,
                globalConfig.tileSize * size.x + 2 * extrudePixels * size.x,
                globalConfig.tileSize * size.y + 2 * extrudePixels * size.y
            );
        } else {
            const rotationCenterX = worldX + globalConfig.halfTileSize;
            const rotationCenterY = worldY + globalConfig.halfTileSize;

            parameters.context.translate(rotationCenterX, rotationCenterY);
            parameters.context.rotate(Math.radians(this.rotation));
            sprite.drawCached(
                parameters,
                -globalConfig.halfTileSize - extrudePixels * size.x,
                -globalConfig.halfTileSize - extrudePixels * size.y,
                globalConfig.tileSize * size.x + 2 * extrudePixels * size.x,
                globalConfig.tileSize * size.y + 2 * extrudePixels * size.y,
                false // no clipping possible here
            );
            parameters.context.rotate(-Math.radians(this.rotation));
            parameters.context.translate(-rotationCenterX, -rotationCenterY);
        }
    }
}
