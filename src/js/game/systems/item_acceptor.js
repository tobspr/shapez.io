import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { fastArrayDelete } from "../../core/utils";
import { enumDirectionToVector } from "../../core/vector";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";

export class ItemAcceptorSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [ItemAcceptorComponent]);

        // Well ... it's better to be verbose I guess?
        this.accumulatedTicksWhileInMapOverview = 0;
    }

    update() {
        if (this.root.app.settings.getAllSettings().simplifiedBelts) {
            // Disabled in potato mode
            return;
        }

        // This system doesn't render anything while in map overview,
        // so simply accumulate ticks
        if (this.root.camera.getIsMapOverlayActive()) {
            ++this.accumulatedTicksWhileInMapOverview;
            return;
        }

        // Compute how much ticks we missed
        const numTicks = 1 + this.accumulatedTicksWhileInMapOverview;
        const progress =
            this.root.dynamicTickrate.deltaSeconds *
            2 *
            this.root.hubGoals.getBeltBaseSpeed() *
            globalConfig.itemSpacingOnBelts * // * 2 because its only a half tile
            numTicks;

        // Reset accumulated ticks
        this.accumulatedTicksWhileInMapOverview = 0;

        for (let i = this.allEntitiesArray.length - 1; i >= 0; --i) {
            const entity = this.allEntitiesArray[i];
            const aceptorComp = entity.components.ItemAcceptor;
            const animations = aceptorComp.itemConsumptionAnimations;

            // Process item consumption animations to avoid items popping from the belts
            for (let animIndex = 0; animIndex < animations.length; ++animIndex) {
                const anim = animations[animIndex];
                anim.animProgress += progress;
                if (anim.animProgress > 1) {
                    fastArrayDelete(animations, animIndex);
                    animIndex -= 1;
                }
            }
        }
    }

    /**
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        if (this.root.app.settings.getAllSettings().simplifiedBelts) {
            // Disabled in potato mode
            return;
        }

        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const acceptorComp = entity.components.ItemAcceptor;
            if (!acceptorComp) {
                continue;
            }

            const staticComp = entity.components.StaticMapEntity;
            for (let animIndex = 0; animIndex < acceptorComp.itemConsumptionAnimations.length; ++animIndex) {
                const { item, slotIndex, animProgress, direction } = acceptorComp.itemConsumptionAnimations[
                    animIndex
                ];

                const slotData = acceptorComp.slots[slotIndex];
                const realSlotPos = staticComp.localTileToWorld(slotData.pos);

                if (!chunk.tileSpaceRectangle.containsPoint(realSlotPos.x, realSlotPos.y)) {
                    // Not within this chunk
                    continue;
                }

                const fadeOutDirection = enumDirectionToVector[staticComp.localDirectionToWorld(direction)];
                const finalTile = realSlotPos.subScalars(
                    fadeOutDirection.x * (animProgress / 2 - 0.5),
                    fadeOutDirection.y * (animProgress / 2 - 0.5)
                );

                item.drawItemCenteredClipped(
                    (finalTile.x + 0.5) * globalConfig.tileSize,
                    (finalTile.y + 0.5) * globalConfig.tileSize,
                    parameters,
                    globalConfig.defaultItemDiameter
                );
            }
        }
    }
}
