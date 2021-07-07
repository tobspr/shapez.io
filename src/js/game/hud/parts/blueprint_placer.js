import { DrawParameters } from "../../../core/draw_parameters";
import { STOP_PROPAGATION } from "../../../core/signal";
import { TrackedState } from "../../../core/tracked_state";
import { makeDiv } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { SOUNDS } from "../../../platform/sound";
import { T } from "../../../translations";
import { Blueprint } from "../../blueprint";
import { enumMouseButton } from "../../camera";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { Entity } from "../../entity";

export class HUDBlueprintPlacer extends BaseHUDPart {
    createElements(parent) {
        const blueprintCostShape = this.root.shapeDefinitionMgr.getShapeFromShortKey(
            this.root.gameMode.getBlueprintShapeKey()
        );
        const blueprintCostShapeCanvas = blueprintCostShape.generateAsCanvas(80);

        this.costDisplayParent = makeDiv(parent, "ingame_HUD_BlueprintPlacer", [], ``);

        makeDiv(this.costDisplayParent, null, ["label"], T.ingame.blueprintPlacer.cost);
        const costContainer = makeDiv(this.costDisplayParent, null, ["costContainer"], "");
        this.costDisplayText = makeDiv(costContainer, null, ["costText"], "");
        costContainer.appendChild(blueprintCostShapeCanvas);
    }

    initialize() {
        this.root.hud.signals.buildingsSelectedForCopy.add(this.createBlueprintFromBuildings, this);

        /** @type {TypedTrackedState<Blueprint?>} */
        this.currentBlueprint = new TrackedState(this.onBlueprintChanged, this);
        /** @type {Blueprint?} */
        this.lastBlueprintUsed = null;

        const keyActionMapper = this.root.keyMapper;
        keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.abortPlacement, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.pipette).add(this.abortPlacement, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateWhilePlacing).add(this.rotateBlueprint, this);
        keyActionMapper.getBinding(KEYMAPPINGS.massSelect.pasteLastBlueprint).add(this.pasteBlueprint, this);

        this.root.camera.downPreHandler.add(this.onMouseDown, this);
        this.root.camera.movePreHandler.add(this.onMouseMove, this);

        this.root.hud.signals.selectedPlacementBuildingChanged.add(this.abortPlacement, this);
        this.root.signals.editModeChanged.add(this.onEditModeChanged, this);

        this.domAttach = new DynamicDomAttach(this.root, this.costDisplayParent);
        this.trackedCanAfford = new TrackedState(this.onCanAffordChanged, this);
    }

    getHasFreeCopyPaste() {
        return this.root.gameMode.getHasFreeCopyPaste();
    }

    abortPlacement() {
        if (this.currentBlueprint.get()) {
            this.currentBlueprint.set(null);

            return STOP_PROPAGATION;
        }
    }

    /**
     * Called when the layer was changed
     * @param {Layer} layer
     */
    onEditModeChanged(layer) {
        // Check if the layer of the blueprint differs and thus we have to deselect it
        const blueprint = this.currentBlueprint.get();
        if (blueprint) {
            if (blueprint.layer !== layer) {
                this.currentBlueprint.set(null);
            }
        }
    }

    /**
     * Called when the blueprint is now affordable or not
     * @param {boolean} canAfford
     */
    onCanAffordChanged(canAfford) {
        this.costDisplayParent.classList.toggle("canAfford", canAfford);
    }

    update() {
        const currentBlueprint = this.currentBlueprint.get();
        this.domAttach.update(
            !this.getHasFreeCopyPaste() && currentBlueprint && currentBlueprint.getCost() > 0
        );
        this.trackedCanAfford.set(currentBlueprint && currentBlueprint.canAfford(this.root));
    }

    /**
     * Called when the blueprint was changed
     * @param {Blueprint} blueprint
     */
    onBlueprintChanged(blueprint) {
        if (blueprint) {
            this.lastBlueprintUsed = blueprint;
            this.costDisplayText.innerText = "" + blueprint.getCost();
        }
    }

    /**
     * mouse down pre handler
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDown(pos, button) {
        if (button === enumMouseButton.right) {
            if (this.currentBlueprint.get()) {
                this.abortPlacement();
                return STOP_PROPAGATION;
            }
        } else if (button === enumMouseButton.left) {
            const blueprint = this.currentBlueprint.get();
            if (!blueprint) {
                return;
            }

            if (!this.getHasFreeCopyPaste() && !blueprint.canAfford(this.root)) {
                this.root.soundProxy.playUiError();
                return;
            }

            const worldPos = this.root.camera.screenToWorld(pos);
            const tile = worldPos.toTileSpace();
            if (blueprint.tryPlace(this.root, tile)) {
                if (!this.getHasFreeCopyPaste()) {
                    const cost = blueprint.getCost();
                    this.root.hubGoals.takeShapeByKey(this.root.gameMode.getBlueprintShapeKey(), cost);
                }
                this.root.soundProxy.playUi(SOUNDS.placeBuilding);
            }
            return STOP_PROPAGATION;
        }
    }

    /**
     * Mouse move handler
     */
    onMouseMove() {
        // Prevent movement while blueprint is selected
        if (this.currentBlueprint.get()) {
            return STOP_PROPAGATION;
        }
    }

    /**
     * Called when an array of bulidings was selected
     * @param {Array<Entity>} uids
     */
    createBlueprintFromBuildings(entities) {
        if (entities.length === 0) {
            return;
        }
        this.currentBlueprint.set(Blueprint.fromEntities(entities));
    }

    /**
     * Attempts to rotate the current blueprint
     */
    rotateBlueprint() {
        if (this.currentBlueprint.get()) {
            if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateInverseModifier).pressed) {
                this.currentBlueprint.get().rotateCcw();
            } else {
                this.currentBlueprint.get().rotateCw();
            }
        }
    }

    /**
     * Attempts to paste the last blueprint
     */
    pasteBlueprint() {
        if (this.lastBlueprintUsed !== null) {
            if (this.lastBlueprintUsed.layer !== this.root.currentLayer) {
                // Not compatible
                this.root.soundProxy.playUiError();
                return;
            }

            this.root.hud.signals.pasteBlueprintRequested.dispatch();
            this.currentBlueprint.set(this.lastBlueprintUsed);
        } else {
            this.root.soundProxy.playUiError();
        }
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        const blueprint = this.currentBlueprint.get();
        if (!blueprint) {
            return;
        }
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const tile = worldPos.toTileSpace();
        blueprint.draw(parameters, tile);
    }
}
