import { DrawParameters } from "../../../core/draw_parameters";
import { Vector } from "../../../core/vector";
import { Entity } from "../../entity";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { BaseHUDPart } from "../base_hud_part";

export class HUDShapeTooltip extends BaseHUDPart {
    createElements(parent) {}

    initialize() {
        /** @type {Vector} */
        this.currentTile = new Vector(0, 0);

        /** @type {Entity} */
        this.currentEntity = null;

        this.isPlacingBuilding = false;
        this.active = false;

        this.root.signals.entityQueuedForDestroy.add(() => {
            this.currentEntity = null;
        }, this);

        this.root.hud.signals.selectedPlacementBuildingChanged.add(metaBuilding => {
            this.isPlacingBuilding = metaBuilding;
        }, this);
    }

    update() {
        // don't show the tooltip when any other placer is active
        const hudParts = this.root.hud.parts;

        this.active =
            this.root.keyMapper.getBinding(KEYMAPPINGS.ingame.showShapeTooltip).pressed &&
            !this.isPlacingBuilding &&
            !hudParts.massSelector.currentSelectionStartWorld &&
            hudParts.massSelector.selectedUids.size < 1 &&
            !hudParts.blueprintPlacer.currentBlueprint.get();

        const mousePos = this.root.app.mousePosition;

        if (!mousePos) {
            // Not on screen
            return;
        }

        const tile = this.root.camera.screenToWorld(mousePos.copy()).toTileSpace();
        if (!tile.equals(this.currentTile)) {
            this.currentTile = tile;

            const entity = this.root.map.getLayerContentXY(tile.x, tile.y, this.root.currentLayer);

            if (entity && entity.components.ItemProcessor && entity.components.ItemEjector) {
                this.currentEntity = entity;
            } else {
                this.currentEntity = null;
            }
        }
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        if (this.active && this.currentEntity) {
            const ejectorComp = this.currentEntity.components.ItemEjector;
            const staticComp = this.currentEntity.components.StaticMapEntity;

            for (let i = 0; i < ejectorComp.slots.length; ++i) {
                const slot = ejectorComp.slots[i];

                if (!slot.lastItem || slot.lastItem._type != "shape") {
                    continue;
                }

                /** @type {Vector} */
                let drawPos = null;
                if (ejectorComp.slots.length == 1) {
                    drawPos = staticComp.getTileSpaceBounds().getCenter().toWorldSpace();
                } else {
                    drawPos = staticComp.localTileToWorld(slot.pos).toWorldSpaceCenterOfTile();
                }

                slot.lastItem.drawItemCenteredClipped(drawPos.x, drawPos.y, parameters, 25);
            }
        }
    }
}
