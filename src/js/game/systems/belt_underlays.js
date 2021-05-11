import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { Loader } from "../../core/loader";
import { Rectangle } from "../../core/rectangle";
import { FULL_CLIP_RECT } from "../../core/sprites";
import { StaleAreaDetector } from "../../core/stale_area_detector";
import {
    enumDirection,
    enumDirectionToAngle,
    enumDirectionToVector,
    enumInvertedDirections,
    Vector,
} from "../../core/vector";
import { BeltComponent } from "../components/belt";
import { BeltUnderlaysComponent, enumClippedBeltUnderlayType } from "../components/belt_underlays";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";
import { BELT_ANIM_COUNT } from "./belt";

/**
 * Mapping from underlay type to clip rect
 * @type {Object<enumClippedBeltUnderlayType, Rectangle>}
 */
const enumUnderlayTypeToClipRect = {
    [enumClippedBeltUnderlayType.none]: null,
    [enumClippedBeltUnderlayType.full]: FULL_CLIP_RECT,
    [enumClippedBeltUnderlayType.topOnly]: new Rectangle(0, 0, 1, 0.5),
    [enumClippedBeltUnderlayType.bottomOnly]: new Rectangle(0, 0.5, 1, 0.5),
};

export class BeltUnderlaysSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [BeltUnderlaysComponent]);

        this.underlayBeltSprites = [];

        for (let i = 0; i < BELT_ANIM_COUNT; ++i) {
            this.underlayBeltSprites.push(Loader.getSprite("sprites/belt/built/forward_" + i + ".png"));
        }

        // Automatically recompute areas
        this.staleArea = new StaleAreaDetector({
            root,
            name: "belt-underlay",
            recomputeMethod: this.recomputeStaleArea.bind(this),
        });

        this.staleArea.recomputeOnComponentsChanged(
            [BeltUnderlaysComponent, BeltComponent, ItemAcceptorComponent, ItemEjectorComponent],
            1
        );
    }

    static getId() {
        return "beltUnderlays";
    }

    update() {
        this.staleArea.update();
    }

    /**
     * Called when an area changed - Resets all caches in the given area
     * @param {Rectangle} area
     */
    recomputeStaleArea(area) {
        for (let x = 0; x < area.w; ++x) {
            for (let y = 0; y < area.h; ++y) {
                const tileX = area.x + x;
                const tileY = area.y + y;
                const entity = this.root.map.getLayerContentXY(tileX, tileY, "regular");
                if (entity) {
                    const underlayComp = entity.components.BeltUnderlays;
                    if (underlayComp) {
                        for (let i = 0; i < underlayComp.underlays.length; ++i) {
                            underlayComp.underlays[i].cachedType = null;
                        }
                    }
                }
            }
        }
    }

    /**
     * Checks if a given tile is connected and has an acceptor
     * @param {Vector} tile
     * @param {enumDirection} fromDirection
     * @returns {boolean}
     */
    checkIsAcceptorConnected(tile, fromDirection) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        if (!contents) {
            return false;
        }

        const staticComp = contents.components.StaticMapEntity;

        // Check if its a belt, since then its simple
        const beltComp = contents.components.Belt;
        if (beltComp) {
            return staticComp.localDirectionToWorld(enumDirection.bottom) === fromDirection;
        }

        // Check if there's an item acceptor
        const acceptorComp = contents.components.ItemAcceptor;
        if (acceptorComp) {
            // Check each slot to see if its connected
            for (let i = 0; i < acceptorComp.slots.length; ++i) {
                const slot = acceptorComp.slots[i];
                const slotTile = staticComp.localTileToWorld(slot.pos);

                // Step 1: Check if the tile matches
                if (!slotTile.equals(tile)) {
                    continue;
                }

                // Step 2: Check if any of the directions matches
                for (let j = 0; j < slot.directions.length; ++j) {
                    const slotDirection = staticComp.localDirectionToWorld(slot.directions[j]);
                    if (slotDirection === fromDirection) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Checks if a given tile is connected and has an ejector
     * @param {Vector} tile
     * @param {enumDirection} toDirection
     * @returns {boolean}
     */
    checkIsEjectorConnected(tile, toDirection) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        if (!contents) {
            return false;
        }

        const staticComp = contents.components.StaticMapEntity;

        // Check if its a belt, since then its simple
        const beltComp = contents.components.Belt;
        if (beltComp) {
            return staticComp.localDirectionToWorld(beltComp.direction) === toDirection;
        }

        // Check for an ejector
        const ejectorComp = contents.components.ItemEjector;
        if (ejectorComp) {
            // Check each slot to see if its connected
            for (let i = 0; i < ejectorComp.slots.length; ++i) {
                const slot = ejectorComp.slots[i];
                const slotTile = staticComp.localTileToWorld(slot.pos);

                // Step 1: Check if the tile matches
                if (!slotTile.equals(tile)) {
                    continue;
                }

                // Step 2: Check if the direction matches
                const slotDirection = staticComp.localDirectionToWorld(slot.direction);
                if (slotDirection === toDirection) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Computes the flag for a given tile
     * @param {Entity} entity
     * @param {import("../components/belt_underlays").BeltUnderlayTile} underlayTile
     * @returns {enumClippedBeltUnderlayType} The type of the underlay
     */
    computeBeltUnderlayType(entity, underlayTile) {
        if (underlayTile.cachedType) {
            return underlayTile.cachedType;
        }

        const staticComp = entity.components.StaticMapEntity;

        const transformedPos = staticComp.localTileToWorld(underlayTile.pos);
        const destX = transformedPos.x * globalConfig.tileSize;
        const destY = transformedPos.y * globalConfig.tileSize;

        // Extract direction and angle
        const worldDirection = staticComp.localDirectionToWorld(underlayTile.direction);
        const worldDirectionVector = enumDirectionToVector[worldDirection];

        // Figure out if there is anything connected at the top
        const connectedTop = this.checkIsAcceptorConnected(
            transformedPos.add(worldDirectionVector),
            enumInvertedDirections[worldDirection]
        );

        // Figure out if there is anything connected at the bottom
        const connectedBottom = this.checkIsEjectorConnected(
            transformedPos.sub(worldDirectionVector),
            worldDirection
        );

        let flag = enumClippedBeltUnderlayType.none;

        if (connectedTop && connectedBottom) {
            flag = enumClippedBeltUnderlayType.full;
        } else if (connectedTop) {
            flag = enumClippedBeltUnderlayType.topOnly;
        } else if (connectedBottom) {
            flag = enumClippedBeltUnderlayType.bottomOnly;
        }

        return (underlayTile.cachedType = flag);
    }

    /**
     * Draws a given chunk
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk_BackgroundLayer(parameters, chunk) {
        // Limit speed to avoid belts going backwards
        const speedMultiplier = Math.min(this.root.hubGoals.getBeltBaseSpeed(), 10);

        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const underlayComp = entity.components.BeltUnderlays;
            if (!underlayComp) {
                continue;
            }

            const staticComp = entity.components.StaticMapEntity;
            const underlays = underlayComp.underlays;
            for (let i = 0; i < underlays.length; ++i) {
                // Extract underlay parameters
                const { pos, direction } = underlays[i];
                const transformedPos = staticComp.localTileToWorld(pos);
                const destX = transformedPos.x * globalConfig.tileSize;
                const destY = transformedPos.y * globalConfig.tileSize;

                // Culling, Part 1: Check if the chunk contains the tile
                if (!chunk.tileSpaceRectangle.containsPoint(transformedPos.x, transformedPos.y)) {
                    continue;
                }

                // Culling, Part 2: Check if the overlay is visible
                if (
                    !parameters.visibleRect.containsRect4Params(
                        destX,
                        destY,
                        globalConfig.tileSize,
                        globalConfig.tileSize
                    )
                ) {
                    continue;
                }

                // Extract direction and angle
                const worldDirection = staticComp.localDirectionToWorld(direction);
                const angle = enumDirectionToAngle[worldDirection];

                const underlayType = this.computeBeltUnderlayType(entity, underlays[i]);
                const clipRect = enumUnderlayTypeToClipRect[underlayType];
                if (!clipRect) {
                    // Empty
                    continue;
                }

                // Actually draw the sprite
                const x = destX + globalConfig.halfTileSize;
                const y = destY + globalConfig.halfTileSize;
                const angleRadians = Math.radians(angle);

                // SYNC with systems/belt.js:drawSingleEntity!
                const animationIndex = Math.floor(
                    ((this.root.time.realtimeNow() * speedMultiplier * BELT_ANIM_COUNT * 126) / 42) *
                        globalConfig.itemSpacingOnBelts
                );
                parameters.context.translate(x, y);
                parameters.context.rotate(angleRadians);
                this.underlayBeltSprites[
                    animationIndex % this.underlayBeltSprites.length
                ].drawCachedWithClipRect(
                    parameters,
                    -globalConfig.halfTileSize,
                    -globalConfig.halfTileSize,
                    globalConfig.tileSize,
                    globalConfig.tileSize,
                    clipRect
                );
                parameters.context.rotate(-angleRadians);
                parameters.context.translate(-x, -y);
            }
        }
    }
}
