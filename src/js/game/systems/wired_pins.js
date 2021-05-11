import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { drawRotatedSprite } from "../../core/draw_utils";
import { Loader } from "../../core/loader";
import { STOP_PROPAGATION } from "../../core/signal";
import { enumDirectionToAngle, Vector } from "../../core/vector";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";
import { getBuildingDataFromCode } from "../building_codes";

/** @type {Object<ItemType, number>} */
const enumTypeToSize = {
    boolean: 9,
    shape: 9,
    color: 14,
};

export class WiredPinsSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [WiredPinsComponent]);

        this.pinSprites = {
            [enumPinSlotType.logicalEjector]: Loader.getSprite("sprites/wires/logical_ejector.png"),
            [enumPinSlotType.logicalAcceptor]: Loader.getSprite("sprites/wires/logical_acceptor.png"),
        };

        this.root.signals.prePlacementCheck.add(this.prePlacementCheck, this);
        this.root.signals.freeEntityAreaBeforeBuild.add(this.freeEntityAreaBeforeBuild, this);
    }

    static getId() {
        return "wiredPins";
    }

    /**
     * Performs pre-placement checks
     * @param {Entity} entity
     * @param {Vector} offset
     */
    prePlacementCheck(entity, offset) {
        // Compute area of the building
        const rect = entity.components.StaticMapEntity.getTileSpaceBounds();
        if (offset) {
            rect.x += offset.x;
            rect.y += offset.y;
        }

        // If this entity is placed on the wires layer, make sure we don't
        // place it above a pin
        if (entity.layer === "wires") {
            for (let x = rect.x; x < rect.x + rect.w; ++x) {
                for (let y = rect.y; y < rect.y + rect.h; ++y) {
                    // Find which entities are in same tiles of both layers
                    const entities = this.root.map.getLayersContentsMultipleXY(x, y);
                    for (let i = 0; i < entities.length; ++i) {
                        const otherEntity = entities[i];

                        // Check if entity has a wired component
                        const pinComponent = otherEntity.components.WiredPins;
                        const staticComp = otherEntity.components.StaticMapEntity;
                        const data = getBuildingDataFromCode(staticComp.code);
                        if (!pinComponent) {
                            continue;
                        }

                        if (staticComp.getMetaBuilding().getIsReplaceable(data.variant)) {
                            // Don't mind here, even if there would be a collision we
                            // could replace it
                            continue;
                        }

                        // Go over all pins and check if they are blocking
                        const pins = pinComponent.slots;
                        for (let pinSlot = 0; pinSlot < pins.length; ++pinSlot) {
                            const pos = staticComp.localTileToWorld(pins[pinSlot].pos);
                            // Occupied by a pin
                            if (pos.x === x && pos.y === y) {
                                return STOP_PROPAGATION;
                            }
                        }
                    }
                }
            }
        }

        // Check for collisions on the wires layer
        if (this.checkEntityPinsCollide(entity, offset)) {
            return STOP_PROPAGATION;
        }
    }

    /**
     * Checks if the pins of the given entity collide on the wires layer
     * @param {Entity} entity
     * @param {Vector=} offset Optional, move the entity by the given offset first
     * @returns {boolean} True if the pins collide
     */
    checkEntityPinsCollide(entity, offset) {
        const pinsComp = entity.components.WiredPins;
        if (!pinsComp) {
            return false;
        }

        // Go over all slots
        for (let slotIndex = 0; slotIndex < pinsComp.slots.length; ++slotIndex) {
            const slot = pinsComp.slots[slotIndex];

            // Figure out which tile this slot is on
            const worldPos = entity.components.StaticMapEntity.localTileToWorld(slot.pos);
            if (offset) {
                worldPos.x += offset.x;
                worldPos.y += offset.y;
            }

            // Check if there is any entity on that tile (Wired pins are always on the wires layer)
            const collidingEntity = this.root.map.getLayerContentXY(worldPos.x, worldPos.y, "wires");

            // If there's an entity, and it can't get removed -> That's a collision
            if (collidingEntity) {
                const staticComp = collidingEntity.components.StaticMapEntity;
                const data = getBuildingDataFromCode(staticComp.code);
                if (
                    !collidingEntity.components.StaticMapEntity.getMetaBuilding().getIsReplaceable(
                        data.variant
                    )
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Called to free space for the given entity
     * @param {Entity} entity
     */
    freeEntityAreaBeforeBuild(entity) {
        const pinsComp = entity.components.WiredPins;
        if (!pinsComp) {
            // Entity has no pins
            return;
        }

        // Remove any stuff which collides with the pins
        for (let i = 0; i < pinsComp.slots.length; ++i) {
            const slot = pinsComp.slots[i];
            const worldPos = entity.components.StaticMapEntity.localTileToWorld(slot.pos);
            const collidingEntity = this.root.map.getLayerContentXY(worldPos.x, worldPos.y, "wires");
            if (collidingEntity) {
                const staticComp = collidingEntity.components.StaticMapEntity;
                const data = getBuildingDataFromCode(staticComp.code);
                assertAlways(
                    collidingEntity.components.StaticMapEntity.getMetaBuilding().getIsReplaceable(
                        data.variant
                    ),
                    "Tried to replace non-repleaceable entity for pins"
                );
                if (!this.root.logic.tryDeleteBuilding(collidingEntity)) {
                    assertAlways(false, "Tried to replace non-repleaceable entity for pins #2");
                }
            }
        }
    }

    /**
     * Draws a given entity
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk_WiresForegroundLayer(parameters, chunk) {
        const contents = chunk.containedEntities;

        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const pinsComp = entity.components.WiredPins;
            if (!pinsComp) {
                continue;
            }

            const staticComp = entity.components.StaticMapEntity;
            const data = getBuildingDataFromCode(staticComp.code);
            const slots = pinsComp.slots;

            for (let j = 0; j < slots.length; ++j) {
                const slot = slots[j];
                const tile = staticComp.localTileToWorld(slot.pos);

                if (!chunk.tileSpaceRectangle.containsPoint(tile.x, tile.y)) {
                    // Doesn't belong to this chunk
                    continue;
                }
                const worldPos = tile.toWorldSpaceCenterOfTile();

                // Culling
                if (
                    !parameters.visibleRect.containsCircle(worldPos.x, worldPos.y, globalConfig.halfTileSize)
                ) {
                    continue;
                }

                const effectiveRotation = Math.radians(
                    staticComp.rotation + enumDirectionToAngle[slot.direction]
                );

                if (staticComp.getMetaBuilding().getRenderPins(data.variant)) {
                    drawRotatedSprite({
                        parameters,
                        sprite: this.pinSprites[slot.type],
                        x: worldPos.x,
                        y: worldPos.y,
                        angle: effectiveRotation,
                        size: globalConfig.tileSize + 2,
                        offsetX: 0,
                        offsetY: 0,
                    });
                }

                // Draw contained item to visualize whats emitted
                const value = slot.value;
                if (value) {
                    const offset = new Vector(0, -9.1).rotated(effectiveRotation);

                    value.drawItemCenteredClipped(
                        worldPos.x + offset.x,
                        worldPos.y + offset.y,
                        parameters,
                        enumTypeToSize[value.getItemType()]
                    );
                }

                // Debug view
                if (G_IS_DEV && globalConfig.debug.renderWireNetworkInfos) {
                    const offset = new Vector(0, -10).rotated(effectiveRotation);
                    const network = slot.linkedNetwork;
                    parameters.context.fillStyle = "blue";
                    parameters.context.font = "5px Tahoma";
                    parameters.context.textAlign = "center";
                    parameters.context.fillText(
                        network ? "S" + network.uid : "???",
                        (tile.x + 0.5) * globalConfig.tileSize + offset.x,
                        (tile.y + 0.5) * globalConfig.tileSize + offset.y
                    );
                    parameters.context.textAlign = "left";
                }
            }
        }
    }
}
