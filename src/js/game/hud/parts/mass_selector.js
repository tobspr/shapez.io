import { BaseHUDPart } from "../base_hud_part";
import { Vector } from "../../../core/vector";
import { STOP_PROPAGATION } from "../../../core/signal";
import { DrawParameters } from "../../../core/draw_parameters";
import { Entity } from "../../entity";
import { Loader } from "../../../core/loader";
import { globalConfig } from "../../../core/config";
import { makeDiv, formatBigNumber, formatBigNumberFull } from "../../../core/utils";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { MapChunkView } from "../../map_chunk_view";
import { createLogger } from "../../../core/logging";
import { enumMouseButton } from "../../camera";
import { T } from "../../../translations";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { THEME } from "../../theme";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { Blueprint } from "../../blueprint";
import { StaticMapEntityComponent } from "../../components/static_map_entity";

const logger = createLogger("hud/mass_selector");

export class HUDMassSelector extends BaseHUDPart {
    createElements(parent) {}

    initialize() {
        this.multiLayerSelect = false;
        this.currentSelectionStartWorld = null;
		this.currentSelectionEnd = null;

		/**@type {Array<Entity>} */
        this.selectedEntities = [];

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
		const index = this.selectedEntities.indexOf(entity);
		if(index != -1)
        	this.selectedEntities.splice(index, 1);
    }

    /**
     *
     */
    onBack() {
        // Clear entities on escape
        if (this.selectedEntities.length > 0) {
            this.selectedEntities = [];
            return STOP_PROPAGATION;
        }
    }

    /**
     * Clears the entire selection
     */
    clearSelection() {
        this.selectedEntities = [];
    }

    confirmDelete() {
        if (
            !this.root.app.settings.getAllSettings().disableCutDeleteWarnings &&
            this.selectedEntities.length > 100
        ) {
            const { ok } = this.root.hud.parts.dialogs.showWarning(
                T.dialogs.massDeleteConfirm.title,
                T.dialogs.massDeleteConfirm.desc.replace(
                    "<count>",
                    "" + formatBigNumberFull(this.selectedEntities.length)
                ),
                ["cancel:good:escape", "ok:bad:enter"]
            );
            ok.add(() => this.doDelete());
        } else {
            this.doDelete();
        }
    }

    doDelete() {
        const entities = Array.from(this.selectedEntities);

        // Build mapping from uid to entity
        /**
         * @type {Map<number, Entity>}
         */
        const mapUidToEntity = this.root.entityMgr.getFrozenUidSearchMap();

        this.root.logic.performBulkOperation(() => {
            for (let i = 0; i < entities.length; ++i) {
                const entity = mapUidToEntity.get(entities[i].uid);

                if (!entity) {
                    logger.warn("Invalid Entity in Selected Entities");
                    continue;
                }

                if (!this.root.logic.tryDeleteBuilding(entity)) {
                    logger.error("Error in mass delete, could not remove building");
                }
            }
        });

        // Clear uids later
        this.selectedEntities = [];
    }

    startCopy() {
        if (this.selectedEntities.length > 0) {
            if (!this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_blueprints)) {
                this.root.hud.parts.dialogs.showInfo(
                    T.dialogs.blueprintsNotUnlocked.title,
                    T.dialogs.blueprintsNotUnlocked.desc
                );
                return;
			}

			this.root.hud.signals.buildingsSelectedForCopy.dispatch(this.selectedEntities);
			
            this.selectedEntities = [];
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
            this.selectedEntities.length > 100
        ) {
            const { ok } = this.root.hud.parts.dialogs.showWarning(
                T.dialogs.massCutConfirm.title,
                T.dialogs.massCutConfirm.desc.replace(
                    "<count>",
                    "" + formatBigNumberFull(this.selectedEntities.length)
                ),
                ["cancel:good:escape", "ok:bad:enter"]
            );
            ok.add(() => this.doCut());
        } else {
            this.doCut();
        }
    }

    doCut() {
        if (this.selectedEntities.length > 0) {
			const entities = Array.from(this.selectedEntities);
            const cutAction = () => {
                // copy code relies on entities still existing, so must copy before deleting.
                this.root.hud.signals.buildingsSelectedForCopy.dispatch(entities);

                for (let i = 0; i < entities.length; ++i) {
                    const entity = entities[i];
                    if (!this.root.logic.tryDeleteBuilding(entity)) {
                        logger.error("Error in mass cut, could not remove building");
                        this.selectedEntities.splice(i, 1);
                    }
                }
            };

            const blueprint = Blueprint.fromEntities(this.root, entities);
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

        this.multiLayerSelect = this.root.keyMapper.getBinding(
            KEYMAPPINGS.massSelect.massSelectSelectMultiLayer
        ).pressed;

        if (!this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectSelectMultiple).pressed) {
            // Start new selection
            this.selectedEntities = [];
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
                    let entities = [];
                    if (this.multiLayerSelect) {
                        entities = this.root.map.getLayersContentsMultipleXY(x, y);
                    } else {
                        entities = [this.root.map.getLayerContentXY(x, y, this.root.currentLayer)];
                    }

                    for (let i = 0; i < entities.length; ++i) {
                        let entity = entities[i];
                        if (entity && this.root.logic.canDeleteBuilding(entity))
                            this.selectedEntities.push(entity);
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
        this.multiLayerSelect =
            this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectSelectMultiLayer).pressed ||
            this.multiLayerSelect;

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

            const renderedUids = new Set();

            for (let x = realTileStart.x; x <= realTileEnd.x; ++x) {
                for (let y = realTileStart.y; y <= realTileEnd.y; ++y) {
                    let entities = [];
                    if (this.multiLayerSelect) {
                        entities = this.root.map.getLayersContentsMultipleXY(x, y);
                    } else {
                        entities = [this.root.map.getLayerContentXY(x, y, this.root.currentLayer)];
                    }

                    for (let i = 0; i < entities.length; ++i) {
                        let entity = entities[i];
                        if (entity && this.root.logic.canDeleteBuilding(entity)) {
                            // Prevent rendering the overlay twice
                            const uid = entity.uid;
                            if (renderedUids.has(uid)) {
                                continue;
                            }
                            renderedUids.add(uid);

                            this.RenderSelectonPreviewTile(parameters, entity);
                        }
                    }
                }
            }
        }

		//EXTREMELY SLOW. There must be a better way. (Possibly use a Array)
		for(let i = 0; i < this.selectedEntities.length; ++ i){
			const entity = this.selectedEntities[i];
			this.RenderSelectonPreviewTile(parameters, entity);
		}
        // this.selectedUids.forEach(uid => {
        //     const entity = this.root.entityMgr.findByUid(uid);

        //     this.RenderSelectonPreviewTile(parameters, entity);
        // });

        parameters.context.globalAlpha = 1;
    }
    /**
     *
     * @param {DrawParameters} parameters
     * @param {Entity} entity
     */
    RenderSelectonPreviewTile(parameters, entity) {
        const staticComp = entity.components.StaticMapEntity;

        parameters.context.globalAlpha = entity.layer == this.root.currentLayer ? 1 : 0.7;

        parameters.context.beginPath();

        staticComp.drawSpriteOnBoundsClipped(parameters, staticComp.getBlueprintSprite(), 0);

        parameters.context.fill();
    }
}
