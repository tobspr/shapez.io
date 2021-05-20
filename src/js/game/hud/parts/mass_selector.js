import { BaseHUDPart } from "../base_hud_part";
import { Vector } from "../../../core/vector";
import { STOP_PROPAGATION } from "../../../core/signal";
import { DrawParameters } from "../../../core/draw_parameters";
import { Entity } from "../../entity";
import { Loader } from "../../../core/loader";
import { globalConfig } from "../../../core/config";
import { makeDiv, formatBigNumber, formatBigNumberFull } from "../../../core/utils";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { createLogger } from "../../../core/logging";
import { ACHIEVEMENTS } from "../../../platform/achievement_provider";
import { enumMouseButton } from "../../camera";
import { T } from "../../../translations";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { THEME } from "../../theme";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { Blueprint } from "../../blueprint";

const logger = createLogger("hud/mass_selector");

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

        this.root.keyMapper.getBinding(KEYMAPPINGS.general.back).add(this.onBack, this);
        this.root.keyMapper
            .getBinding(KEYMAPPINGS.massSelect.confirmMassDelete)
            .add(this.confirmDelete, this);
        this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectCut).add(this.confirmCut, this);
        this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectCopy).add(this.startCopy, this);

        this.root.hud.signals.selectedPlacementBuildingChanged.add(this.clearSelection, this);
        this.root.signals.editModeChanged.add(this.clearSelection, this);
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
        const count = this.root.logic.tryBulkDelete(entityUids);
        this.root.signals.achievementCheck.dispatch(ACHIEVEMENTS.destroy1000, count);
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

                this.root.logic.tryBulkDelete(entityUids);
                this.selectedUids = new Set();
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
        if (!this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectStart).pressed) {
            return;
        }

        if (mouseButton !== enumMouseButton.left) {
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
        this.selectedUids.forEach(uid => {
            const entity = this.root.entityMgr.findByUid(uid);
            const staticComp = entity.components.StaticMapEntity;
            const bounds = staticComp.getTileSpaceBounds();
            parameters.context.beginRoundedRect(
                bounds.x * globalConfig.tileSize + boundsBorder,
                bounds.y * globalConfig.tileSize + boundsBorder,
                bounds.w * globalConfig.tileSize - 2 * boundsBorder,
                bounds.h * globalConfig.tileSize - 2 * boundsBorder,
                2
            );
            parameters.context.fill();
        });
    }
}
