import { globalConfig } from "../../../core/config";
import { DrawParameters } from "../../../core/draw_parameters";
import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { createLogger } from "../../../core/logging";
import { STOP_PROPAGATION } from "../../../core/signal";
import { formatBigNumberFull } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { ACHIEVEMENTS } from "../../../platform/achievement_provider";
import { T } from "../../../translations";
import { Blueprint } from "../../blueprint";
import { MetaBlockBuilding } from "../../buildings/block";
import { MetaConstantProducerBuilding } from "../../buildings/constant_producer";
import { enumMouseButton } from "../../camera";
import { Component } from "../../component";
import { Entity } from "../../entity";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { THEME } from "../../theme";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { BaseHUDPart } from "../base_hud_part";

const logger = createLogger("hud/mass_selector");
var globalTileSizeAdjusted = 0;

export class HUDMassSelector extends BaseHUDPart {
    createElements(parent) {}

    initialize() {
        this.currentSelectionStartWorld = null;
        this.currentSelectionEnd = null;
        this.selectedUids = new Set();

        this.root.signals.entityQueuedForDestroy.add(this.onEntityDestroyed, this);
        this.root.hud.signals.pasteBlueprintRequested.add(this.clearSelection, this);

        this.root.camera.downPreHandler.add(this.onMouseDown, this);
        this.root.camera.movePreHandler.add(this.onMouseMove, this);
        this.root.camera.upPostHandler.add(this.onMouseUp, this);

        this.root.keyMapper.getBinding(KEYMAPPINGS.general.back).addToTop(this.onBack, this);
        this.root.keyMapper
            .getBinding(KEYMAPPINGS.massSelect.confirmMassDelete)
            .add(this.confirmDelete, this);
        this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectCut).add(this.confirmCut, this);
        this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectCopy).add(this.startCopy, this);
        this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectClear).add(this.clearBelts, this);

        this.root.hud.signals.selectedPlacementBuildingChanged.add(this.clearSelection, this);
        this.root.signals.editModeChanged.add(this.clearSelection, this);
        globalTileSizeAdjusted = globalConfig.tileSize - 2 * 2;
    }

    /**
     * Handles the destroy callback and makes sure we clean our list
     * @param {Entity} entity
     */
    onEntityDestroyed(entity) {
        if (this.root.bulkOperationRunning) {
            return;
        }
        this.selectedUids.delete(entity.uid);
    }

    /**
     *
     */
    onBack() {
        // Clear entities on escape
        if (this.selectedUids.size > 0) {
            this.selectedUids = new Set();
            return STOP_PROPAGATION;
        }
    }

    /**
     * Clears the entire selection
     */
    clearSelection() {
        this.selectedUids = new Set();
    }

    confirmDelete() {
        if (
            !this.root.app.settings.getAllSettings().disableCutDeleteWarnings &&
            this.selectedUids.size > 100
        ) {
            const { ok } = this.root.hud.parts.dialogs.showWarning(
                T.dialogs.massDeleteConfirm.title,
                T.dialogs.massDeleteConfirm.desc.replace(
                    "<count>",
                    "" + formatBigNumberFull(this.selectedUids.size)
                ),
                ["cancel:good:escape", "ok:bad:enter"]
            );
            ok.add(() => this.doDelete());
        } else {
            this.doDelete();
        }
    }

    doDelete() {
        const entityUids = Array.from(this.selectedUids);

        // Build mapping from uid to entity
        /**
         * @type {Map<number, Entity>}
         */
        const mapUidToEntity = this.root.entityMgr.getFrozenUidSearchMap();

        let count = 0;
        this.root.logic.performBulkOperation(() => {
            for (let i = 0; i < entityUids.length; ++i) {
                const uid = entityUids[i];
                const entity = mapUidToEntity.get(uid);
                if (!entity) {
                    logger.error("Entity not found by uid:", uid);
                    continue;
                }

                if (!this.root.logic.tryDeleteBuilding(entity)) {
                    logger.error("Error in mass delete, could not remove building");
                } else {
                    count++;
                }
            }

            this.root.signals.achievementCheck.dispatch(ACHIEVEMENTS.destroy1000, count);
        });

        // Clear uids later
        this.selectedUids = new Set();
    }

    startCopy() {
        if (this.selectedUids.size > 0) {
            if (!this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_blueprints)) {
                this.root.hud.parts.dialogs.showInfo(
                    T.dialogs.blueprintsNotUnlocked.title,
                    T.dialogs.blueprintsNotUnlocked.desc
                );
                return;
            }
            this.root.hud.signals.buildingsSelectedForCopy.dispatch(Array.from(this.selectedUids));
            this.selectedUids = new Set();
            this.root.soundProxy.playUiClick();
        } else {
            this.root.soundProxy.playUiError();
        }
    }

    clearBelts() {
        for (const uid of this.selectedUids) {
            const entity = this.root.entityMgr.findByUid(uid);
            for (const component of Object.values(entity.components)) {
                /** @type {Component} */ (component).clear();
            }
        }
        this.selectedUids = new Set();
    }

    confirmCut() {
        if (!this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_blueprints)) {
            this.root.hud.parts.dialogs.showInfo(
                T.dialogs.blueprintsNotUnlocked.title,
                T.dialogs.blueprintsNotUnlocked.desc
            );
        } else if (
            !this.root.app.settings.getAllSettings().disableCutDeleteWarnings &&
            this.selectedUids.size > 100
        ) {
            const { ok } = this.root.hud.parts.dialogs.showWarning(
                T.dialogs.massCutConfirm.title,
                T.dialogs.massCutConfirm.desc.replace(
                    "<count>",
                    "" + formatBigNumberFull(this.selectedUids.size)
                ),
                ["cancel:good:escape", "ok:bad:enter"]
            );
            ok.add(() => this.doCut());
        } else {
            this.doCut();
        }
    }

    doCut() {
        if (this.selectedUids.size > 0) {
            const entityUids = Array.from(this.selectedUids);

            const cutAction = () => {
                // copy code relies on entities still existing, so must copy before deleting.
                this.root.hud.signals.buildingsSelectedForCopy.dispatch(entityUids);

                for (let i = 0; i < entityUids.length; ++i) {
                    const uid = entityUids[i];
                    const entity = this.root.entityMgr.findByUid(uid);
                    if (!this.root.logic.tryDeleteBuilding(entity)) {
                        logger.error("Error in mass cut, could not remove building");
                        this.selectedUids.delete(uid);
                    }
                }
            };

            const blueprint = Blueprint.fromUids(this.root, entityUids);
            if (blueprint.canAfford(this.root)) {
                cutAction();
            } else {
                const { cancel, ok } = this.root.hud.parts.dialogs.showWarning(
                    T.dialogs.massCutInsufficientConfirm.title,
                    T.dialogs.massCutInsufficientConfirm.desc,
                    ["cancel:good:escape", "ok:bad:enter"]
                );
                ok.add(cutAction);
            }

            this.root.soundProxy.playUiClick();
        } else {
            this.root.soundProxy.playUiError();
        }
    }

    /**
     * mouse down pre handler
     * @param {Vector} pos
     * @param {enumMouseButton} mouseButton
     */
    onMouseDown(pos, mouseButton) {
        if (
        !this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectStart.pressed) ||
            mouseButton !== enumMouseButton.left) {
            return;
        }

        if (!this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectSelectMultiple).pressed) {
            // Start new selection

            this.selectedUids = new Set();
        }

        this.currentSelectionStartWorld = this.root.camera.screenToWorld(pos.copy());
        this.currentSelectionEnd = pos.copy();
        return STOP_PROPAGATION;
    }

    /**
     * mouse move pre handler
     * @param {Vector} pos
     */
    onMouseMove(pos) {
        if (this.currentSelectionStartWorld) {
            this.currentSelectionEnd = pos.copy();
        }
    }

    onMouseUp() {
        if (this.currentSelectionStartWorld) {
            const worldStart = this.currentSelectionStartWorld;
            const worldEnd = this.root.camera.screenToWorld(this.currentSelectionEnd);

            const tileStart = worldStart.toTileSpace();
            const tileEnd = worldEnd.toTileSpace();

            const realTileStart = tileStart.min(tileEnd);
            const realTileEnd = tileStart.max(tileEnd);

            for (let x = realTileStart.x; x <= realTileEnd.x; ++x) {
                for (let y = realTileStart.y; y <= realTileEnd.y; ++y) {
                    const contents = this.root.map.getLayerContentXY(x, y, this.root.currentLayer);

                    if (contents && this.root.logic.canDeleteBuilding(contents)) {
                        const staticComp = contents.components.StaticMapEntity;

                        if (!staticComp.getMetaBuilding().getIsRemovable(this.root)) {
                            continue;
                        }

                        this.selectedUids.add(contents.uid);
                    }
                }
            }

            this.currentSelectionStartWorld = null;
            this.currentSelectionEnd = null;
        }
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        const boundsBorder = 2;

        if (this.currentSelectionStartWorld) {
            const worldStart = this.currentSelectionStartWorld;
            const worldEnd = this.root.camera.screenToWorld(this.currentSelectionEnd);

            const realWorldStart = worldStart.min(worldEnd);
            const realWorldEnd = worldStart.max(worldEnd);

            const tileStart = worldStart.toTileSpace();
            const tileEnd = worldEnd.toTileSpace();

            const realTileStart = tileStart.min(tileEnd);
            const realTileEnd = tileStart.max(tileEnd);

            parameters.context.lineWidth = 1;
            parameters.context.fillStyle = THEME.map.selectionBackground;
            parameters.context.strokeStyle = THEME.map.selectionOutline;
            parameters.context.beginPath();
            parameters.context.rect(
                realWorldStart.x,
                realWorldStart.y,
                realWorldEnd.x - realWorldStart.x,
                realWorldEnd.y - realWorldStart.y
            );
            parameters.context.fill();
            parameters.context.stroke();

            parameters.context.fillStyle = THEME.map.selectionOverlay;

            const renderedUids = new Set();

            for (let x = realTileStart.x; x <= realTileEnd.x; ++x) {
                for (let y = realTileStart.y; y <= realTileEnd.y; ++y) {
                    const contents = this.root.map.getLayerContentXY(x, y, this.root.currentLayer);
                    if (contents && this.root.logic.canDeleteBuilding(contents)) {
                        // Prevent rendering the overlay twice
                        const uid = contents.uid;
                        if (renderedUids.has(uid)) {
                            continue;
                        }
                        renderedUids.add(uid);

                        const staticComp = contents.components.StaticMapEntity;

                        if (!staticComp.getMetaBuilding().getIsRemovable(this.root)) {
                            continue;
                        }

                        const bounds = staticComp.getTileSpaceBounds();
                        parameters.context.beginRoundedRect(
                            bounds.x * globalConfig.tileSize + boundsBorder,
                            bounds.y * globalConfig.tileSize + boundsBorder,
                            bounds.w * globalConfig.tileSize - 2 * boundsBorder,
                            bounds.h * globalConfig.tileSize - 2 * boundsBorder,
                            2
                        );
                        parameters.context.fill();
                    }
                }
            }
        }

        parameters.context.fillStyle = THEME.map.selectionOverlay;
        parameters.context.beginPath();
        this.selectedUids.forEach(uid => {
        	// Do not attempt to write this in one line, it will be much slower.
            const entity = this.root.entityMgr.findByUid(uid);
            const staticComp = entity.components.StaticMapEntity;
            const bounds = staticComp.getTileSpaceBounds();
            parameters.context.fillRect(
                bounds.x * globalConfig.tileSize + boundsBorder,
                bounds.y * globalConfig.tileSize + boundsBorder,
                bounds.w * globalTileSizeAdjusted,
                bounds.h * globalTileSizeAdjusted // MICROOPTIMIZATION: Avoid computing inside loops.
            );
        });
        parameters.context.closePath(); // +1 fps for some reason
    }
}
