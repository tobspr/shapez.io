import { globalConfig } from "../../../core/config";
import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { Signal, STOP_PROPAGATION } from "../../../core/signal";
import { TrackedState } from "../../../core/tracked_state";
import { Vector } from "../../../core/vector";
import { enumMouseButton } from "../../camera";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { Entity } from "../../entity";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { defaultBuildingVariant, MetaBuilding } from "../../meta_building";
import { BaseHUDPart } from "../base_hud_part";
import { SOUNDS } from "../../../platform/sound";
import { MetaMinerBuilding, enumMinerVariants } from "../../buildings/miner";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { getBuildingDataFromCode, getCodeFromBuildingData } from "../../building_codes";
import { MetaHubBuilding } from "../../buildings/hub";
import { safeModulo } from "../../../core/utils";

/**
 * Contains all logic for the building placer - this doesn't include the rendering
 * of info boxes or drawing.
 */
export class HUDBuildingPlacerLogic extends BaseHUDPart {
    /**
     * Initializes the logic
     * @see BaseHUDPart.initialize
     */
    initialize() {
        /**
         * We use a fake entity to get information about how a building will look
         * once placed
         * @type {Entity}
         */
        this.fakeEntity = null;

        // Signals
        this.signals = {
            variantChanged: new Signal(),
            draggingStarted: new Signal(),
        };

        /**
         * The current building
         * @type {TypedTrackedState<MetaBuilding?>}
         */
        this.currentMetaBuilding = new TrackedState(this.onSelectedMetaBuildingChanged, this);

        /**
         * The current rotation
         * @type {number}
         */
        this.currentBaseRotationGeneral = 0;

        /**
         * The current rotation preference for each building.
         * @type{Object.<string,number>}
         */
        this.preferredBaseRotations = {};

        /**
         * Whether we are currently dragging
         * @type {boolean}
         */
        this.currentlyDragging = false;

        /**
         * Current building variant
         * @type {TypedTrackedState<string>}
         */
        this.currentVariant = new TrackedState(() => this.signals.variantChanged.dispatch());

        /**
         * Whether we are currently drag-deleting
         * @type {boolean}
         */
        this.currentlyDeleting = false;

        /**
         * Stores which variants for each building we prefer, this is based on what
         * the user last selected
         * @type {Object.<string, string>}
         */
        this.preferredVariants = {};

        /**
         * The tile we last dragged from
         * @type {Vector}
         */
        this.lastDragTile = null;

        /**
         * The side for direction lock
         * @type {number} (0|1)
         */
        this.currentDirectionLockSide = 0;

        /**
         * Whether the side for direction lock has not yet been determined.
         * @type {boolean}
         */
        this.currentDirectionLockSideIndeterminate = true;

        this.initializeBindings();
    }

    /**
     * Initializes all bindings
     */
    initializeBindings() {
        // KEYBINDINGS
        const keyActionMapper = this.root.keyMapper;
        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateWhilePlacing).add(this.tryRotate, this);

        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateToUp).add(this.trySetRotate, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateToDown).add(this.trySetRotate, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateToRight).add(this.trySetRotate, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateToLeft).add(this.trySetRotate, this);

        keyActionMapper.getBinding(KEYMAPPINGS.placement.cycleBuildingVariants).add(this.cycleVariants, this);
        keyActionMapper
            .getBinding(KEYMAPPINGS.placement.switchDirectionLockSide)
            .add(this.switchDirectionLockSide, this);
        keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.abortPlacement, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.pipette).add(this.startPipette, this);
        this.root.gameState.inputReciever.keyup.add(this.checkForDirectionLockSwitch, this);

        // BINDINGS TO GAME EVENTS
        this.root.hud.signals.buildingsSelectedForCopy.add(this.abortPlacement, this);
        this.root.hud.signals.pasteBlueprintRequested.add(this.abortPlacement, this);
        this.root.signals.storyGoalCompleted.add(() => this.signals.variantChanged.dispatch());
        this.root.signals.storyGoalCompleted.add(() => this.currentMetaBuilding.set(null));
        this.root.signals.upgradePurchased.add(() => this.signals.variantChanged.dispatch());
        this.root.signals.editModeChanged.add(this.onEditModeChanged, this);
        this.root.signals.testModeChanged.add(this.abortPlacement, this);

        // MOUSE BINDINGS
        this.root.camera.downPreHandler.add(this.onMouseDown, this);
        this.root.camera.movePreHandler.add(this.onMouseMove, this);
        this.root.camera.upPostHandler.add(this.onMouseUp, this);
    }

    /**
     * Called when the edit mode got changed
     * @param {Layer} layer
     */
    onEditModeChanged(layer) {
        const metaBuilding = this.currentMetaBuilding.get();
        if (metaBuilding) {
            if (metaBuilding.getLayer() !== layer) {
                // This layer doesn't fit the edit mode anymore
                this.currentMetaBuilding.set(null);
            }
        }
    }

    /**
     * Returns the current base rotation for the current meta-building.
     * @returns {number}
     */
    get currentBaseRotation() {
        if (!this.root.app.settings.getAllSettings().rotationByBuilding) {
            return this.currentBaseRotationGeneral;
        }
        const metaBuilding = this.currentMetaBuilding.get();
        if (metaBuilding && this.preferredBaseRotations.hasOwnProperty(metaBuilding.getId())) {
            return this.preferredBaseRotations[metaBuilding.getId()];
        } else {
            return this.currentBaseRotationGeneral;
        }
    }

    /**
     * Sets the base rotation for the current meta-building.
     * @param {number} rotation The new rotation/angle.
     */
    set currentBaseRotation(rotation) {
        if (!this.root.app.settings.getAllSettings().rotationByBuilding) {
            this.currentBaseRotationGeneral = rotation;
        } else {
            const metaBuilding = this.currentMetaBuilding.get();
            if (metaBuilding) {
                this.preferredBaseRotations[metaBuilding.getId()] = rotation;
            } else {
                this.currentBaseRotationGeneral = rotation;
            }
        }
    }

    /**
     * Returns if the direction lock is currently active
     * @returns {boolean}
     */
    get isDirectionLockActive() {
        const metaBuilding = this.currentMetaBuilding.get();
        return (
            metaBuilding &&
            metaBuilding.getHasDirectionLockAvailable() &&
            this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.lockBeltDirection).pressed
        );
    }

    /**
     * Returns the current direction lock corner, that is, the corner between
     * mouse and original start point
     * @returns {Vector|null}
     */
    get currentDirectionLockCorner() {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return null;
        }

        if (!this.lastDragTile) {
            // Haven't dragged yet
            return null;
        }

        // Figure which points the line visits
        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const mouseTile = worldPos.toTileSpace();

        // Figure initial direction
        const dx = Math.abs(this.lastDragTile.x - mouseTile.x);
        const dy = Math.abs(this.lastDragTile.y - mouseTile.y);
        if (dx === 0 && dy === 0) {
            // Back at the start. Try a new direction.
            this.currentDirectionLockSideIndeterminate = true;
        } else if (this.currentDirectionLockSideIndeterminate) {
            this.currentDirectionLockSideIndeterminate = false;
            this.currentDirectionLockSide = dx <= dy ? 0 : 1;
        }

        if (this.currentDirectionLockSide === 0) {
            return new Vector(this.lastDragTile.x, mouseTile.y);
        } else {
            return new Vector(mouseTile.x, this.lastDragTile.y);
        }
    }

    /**
     * Aborts the placement
     */
    abortPlacement() {
        if (this.currentMetaBuilding.get()) {
            this.currentMetaBuilding.set(null);
            return STOP_PROPAGATION;
        }
    }

    /**
     * Aborts any dragging
     */
    abortDragging() {
        this.currentlyDragging = true;
        this.currentlyDeleting = false;
        this.initialPlacementVector = null;
        this.lastDragTile = null;
    }

    /**
     * @see BaseHUDPart.update
     */
    update() {
        // Abort placement if a dialog was shown in the meantime
        if (this.root.hud.hasBlockingOverlayOpen()) {
            this.abortPlacement();
            return;
        }

        // Always update since the camera might have moved
        const mousePos = this.root.app.mousePosition;
        if (mousePos) {
            this.onMouseMove(mousePos);
        }

        // Make sure we have nothing selected while in overview mode
        if (this.root.camera.getIsMapOverlayActive()) {
            if (this.currentMetaBuilding.get()) {
                this.currentMetaBuilding.set(null);
            }
        }
    }

    /**
     * Tries to rotate the current building
     */
    tryRotate() {
        const selectedBuilding = this.currentMetaBuilding.get();
        if (selectedBuilding) {
            if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateInverseModifier).pressed) {
                this.currentBaseRotation = (this.currentBaseRotation + 270) % 360;
            } else {
                this.currentBaseRotation = (this.currentBaseRotation + 90) % 360;
            }
            const staticComp = this.fakeEntity.components.StaticMapEntity;
            staticComp.rotation = this.currentBaseRotation;
        }
    }

    /**
     * Rotates the current building to the specified direction.
     */
    trySetRotate() {
        const selectedBuilding = this.currentMetaBuilding.get();
        if (selectedBuilding) {
            if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateToUp).pressed) {
                this.currentBaseRotation = 0;
            } else if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateToDown).pressed) {
                this.currentBaseRotation = 180;
            } else if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateToRight).pressed) {
                this.currentBaseRotation = 90;
            } else if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateToLeft).pressed) {
                this.currentBaseRotation = 270;
            }

            const staticComp = this.fakeEntity.components.StaticMapEntity;
            staticComp.rotation = this.currentBaseRotation;
        }
    }

    /**
     * Tries to delete the building under the mouse
     */
    deleteBelowCursor() {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return false;
        }

        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const tile = worldPos.toTileSpace();
        const contents = this.root.map.getTileContent(tile, this.root.currentLayer);
        if (contents) {
            if (this.root.logic.tryDeleteBuilding(contents)) {
                this.root.soundProxy.playUi(SOUNDS.destroyBuilding);
                return true;
            }
        }
        return false;
    }

    /**
     * Starts the pipette function
     */
    startPipette() {
        // Disable in overview
        if (this.root.camera.getIsMapOverlayActive()) {
            return;
        }

        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const tile = worldPos.toTileSpace();

        const contents = this.root.map.getTileContent(tile, this.root.currentLayer);
        if (!contents) {
            const tileBelow = this.root.map.getLowerLayerContentXY(tile.x, tile.y);

            // Check if there's a shape or color item below, if so select the miner
            if (
                tileBelow &&
                this.root.app.settings.getAllSettings().pickMinerOnPatch &&
                this.root.currentLayer === "regular" &&
                this.root.gameMode.hasResources()
            ) {
                this.currentMetaBuilding.set(gMetaBuildingRegistry.findByClass(MetaMinerBuilding));

                // Select chained miner if available, since that's always desired once unlocked
                if (this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_miner_chainable)) {
                    this.currentVariant.set(enumMinerVariants.chainable);
                }
            } else {
                this.currentMetaBuilding.set(null);
            }
            return;
        }

        // Try to extract the building
        const buildingCode = contents.components.StaticMapEntity.code;
        const extracted = getBuildingDataFromCode(buildingCode);

        // Disable pipetting a non removeable building
        if (!extracted.metaInstance.getIsRemovable(this.root)) {
            this.currentMetaBuilding.set(null);
            return;
        }

        // Disallow picking excluded buildings
        if (this.root.gameMode.isBuildingExcluded(extracted.metaClass)) {
            this.currentMetaBuilding.set(null);
            return;
        }

        // If the building we are picking is the same as the one we have, clear the cursor.
        if (
            this.currentMetaBuilding.get() &&
            extracted.metaInstance.getId() === this.currentMetaBuilding.get().getId() &&
            extracted.variant === this.currentVariant.get()
        ) {
            this.currentMetaBuilding.set(null);
            return;
        }

        this.currentMetaBuilding.set(extracted.metaInstance);
        this.currentVariant.set(extracted.variant);
        this.currentBaseRotation = contents.components.StaticMapEntity.rotation;
    }

    /**
     * Switches the side for the direction lock manually
     */
    switchDirectionLockSide() {
        this.currentDirectionLockSide = 1 - this.currentDirectionLockSide;
    }

    /**
     * Checks if the direction lock key got released and if such, resets the placement
     * @param {any} args
     */
    checkForDirectionLockSwitch({ keyCode }) {
        if (
            keyCode ===
            this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.lockBeltDirection).keyCode
        ) {
            this.abortDragging();
        }
    }

    /**
     * Tries to place the current building at the given tile
     * @param {Vector} tile
     */
    tryPlaceCurrentBuildingAt(tile) {
        if (this.root.camera.getIsMapOverlayActive()) {
            // Dont allow placing in overview mode
            return;
        }

        const metaBuilding = this.currentMetaBuilding.get();
        const { rotation, rotationVariant } = metaBuilding.computeOptimalDirectionAndRotationVariantAtTile({
            root: this.root,
            tile,
            rotation: this.currentBaseRotation,
            variant: this.currentVariant.get(),
            layer: metaBuilding.getLayer(),
        });

        const entity = this.root.logic.tryPlaceBuilding({
            origin: tile,
            rotation,
            rotationVariant,
            originalRotation: this.currentBaseRotation,
            building: this.currentMetaBuilding.get(),
            variant: this.currentVariant.get(),
        });

        if (entity) {
            // Succesfully placed, find which entity we actually placed
            this.root.signals.entityManuallyPlaced.dispatch(entity);

            // Check if we should flip the orientation (used for tunnels)
            if (
                metaBuilding.getFlipOrientationAfterPlacement() &&
                !this.root.keyMapper.getBinding(
                    KEYMAPPINGS.placementModifiers.placementDisableAutoOrientation
                ).pressed
            ) {
                this.currentBaseRotation = (180 + this.currentBaseRotation) % 360;
            }

            // Check if we should stop placement
            if (
                !metaBuilding.getStayInPlacementMode() &&
                !this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.placeMultiple).pressed &&
                !this.root.app.settings.getAllSettings().alwaysMultiplace
            ) {
                // Stop placement
                this.currentMetaBuilding.set(null);
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * Cycles through the variants
     */
    cycleVariants() {
        const metaBuilding = this.currentMetaBuilding.get();
        if (!metaBuilding) {
            this.currentVariant.set(defaultBuildingVariant);
        } else {
            const availableVariants = metaBuilding.getAvailableVariants(this.root);
            let index = availableVariants.indexOf(this.currentVariant.get());
            if (index < 0) {
                index = 0;
                console.warn("Invalid variant selected:", this.currentVariant.get());
            }
            const direction = this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateInverseModifier)
                .pressed
                ? -1
                : 1;

            const newIndex = safeModulo(index + direction, availableVariants.length);
            const newVariant = availableVariants[newIndex];
            this.setVariant(newVariant);
        }
    }

    /**
     * Sets the current variant to the given variant
     * @param {string} variant
     */
    setVariant(variant) {
        const metaBuilding = this.currentMetaBuilding.get();
        this.currentVariant.set(variant);

        this.preferredVariants[metaBuilding.getId()] = variant;
    }

    /**
     * Performs the direction locked placement between two points after
     * releasing the mouse
     */
    executeDirectionLockedPlacement() {
        const metaBuilding = this.currentMetaBuilding.get();
        if (!metaBuilding) {
            // No active building
            return;
        }

        // Get path to place
        const path = this.computeDirectionLockPath();

        // Store if we placed anything
        let anythingPlaced = false;

        // Perform this in bulk to avoid recalculations
        this.root.logic.performBulkOperation(() => {
            for (let i = 0; i < path.length; ++i) {
                const { rotation, tile } = path[i];
                this.currentBaseRotation = rotation;
                if (this.tryPlaceCurrentBuildingAt(tile)) {
                    anythingPlaced = true;
                }
            }
        });

        if (anythingPlaced) {
            this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
        }
    }

    /**
     * Finds the path which the current direction lock will use
     * @returns {Array<{ tile: Vector, rotation: number }>}
     */
    computeDirectionLockPath() {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return [];
        }

        let result = [];

        // Figure which points the line visits
        const worldPos = this.root.camera.screenToWorld(mousePosition);
        let endTile = worldPos.toTileSpace();
        let startTile = this.lastDragTile;

        // if the alt key is pressed, reverse belt planner direction by switching start and end tile
        if (this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.placeInverse).pressed) {
            let tmp = startTile;
            startTile = endTile;
            endTile = tmp;
        }

        // Place from start to corner
        const pathToCorner = this.currentDirectionLockCorner.sub(startTile);
        const deltaToCorner = pathToCorner.normalize().round();
        const lengthToCorner = Math.round(pathToCorner.length());
        let currentPos = startTile.copy();

        let rotation = (Math.round(Math.degrees(deltaToCorner.angle()) / 90) * 90 + 360) % 360;

        if (lengthToCorner > 0) {
            for (let i = 0; i < lengthToCorner; ++i) {
                result.push({
                    tile: currentPos.copy(),
                    rotation,
                });
                currentPos.addInplace(deltaToCorner);
            }
        }

        // Place from corner to end
        const pathFromCorner = endTile.sub(this.currentDirectionLockCorner);
        const deltaFromCorner = pathFromCorner.normalize().round();
        const lengthFromCorner = Math.round(pathFromCorner.length());

        if (lengthFromCorner > 0) {
            rotation = (Math.round(Math.degrees(deltaFromCorner.angle()) / 90) * 90 + 360) % 360;
            for (let i = 0; i < lengthFromCorner + 1; ++i) {
                result.push({
                    tile: currentPos.copy(),
                    rotation,
                });
                currentPos.addInplace(deltaFromCorner);
            }
        } else {
            // Finish last one
            result.push({
                tile: currentPos.copy(),
                rotation,
            });
        }
        return result;
    }

    /**
     * Selects a given building
     * @param {MetaBuilding} metaBuilding
     */
    startSelection(metaBuilding) {
        this.currentMetaBuilding.set(metaBuilding);
    }

    /**
     * Called when the selected buildings changed
     * @param {MetaBuilding} metaBuilding
     */
    onSelectedMetaBuildingChanged(metaBuilding) {
        this.abortDragging();
        this.root.hud.signals.selectedPlacementBuildingChanged.dispatch(metaBuilding);
        if (metaBuilding) {
            const availableVariants = metaBuilding.getAvailableVariants(this.root);
            const preferredVariant = this.preferredVariants[metaBuilding.getId()];

            // Choose last stored variant if possible, otherwise the default one
            let variant;
            if (!preferredVariant || !availableVariants.includes(preferredVariant)) {
                variant = availableVariants[0];
            } else {
                variant = preferredVariant;
            }

            this.currentVariant.set(variant);

            this.fakeEntity = new Entity(null);
            metaBuilding.setupEntityComponents(this.fakeEntity, null);

            this.fakeEntity.addComponent(
                new StaticMapEntityComponent({
                    origin: new Vector(0, 0),
                    rotation: 0,
                    tileSize: metaBuilding.getDimensions(this.currentVariant.get()).copy(),
                    code: getCodeFromBuildingData(metaBuilding, variant, 0),
                })
            );
            metaBuilding.updateVariants(this.fakeEntity, 0, this.currentVariant.get());
        } else {
            this.fakeEntity = null;
        }

        // Since it depends on both, rerender twice
        this.signals.variantChanged.dispatch();
    }

    /**
     * mouse down pre handler
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDown(pos, button) {
        if (this.root.camera.getIsMapOverlayActive()) {
            // We do not allow dragging if the overlay is active
            return;
        }

        const metaBuilding = this.currentMetaBuilding.get();

        // Placement
        if (button === enumMouseButton.left && metaBuilding) {
            this.currentlyDragging = true;
            this.currentlyDeleting = false;
            this.lastDragTile = this.root.camera.screenToWorld(pos).toTileSpace();

            // Place initial building, but only if direction lock is not active
            if (!this.isDirectionLockActive) {
                if (this.tryPlaceCurrentBuildingAt(this.lastDragTile)) {
                    this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
                }
            }
            return STOP_PROPAGATION;
        }

        // Deletion
        if (
            button === enumMouseButton.right &&
            (!metaBuilding || !this.root.app.settings.getAllSettings().clearCursorOnDeleteWhilePlacing)
        ) {
            this.currentlyDragging = true;
            this.currentlyDeleting = true;
            this.lastDragTile = this.root.camera.screenToWorld(pos).toTileSpace();
            if (this.deleteBelowCursor()) {
                return STOP_PROPAGATION;
            }
        }

        // Cancel placement
        if (button === enumMouseButton.right && metaBuilding) {
            this.currentMetaBuilding.set(null);
        }
    }

    /**
     * mouse move pre handler
     * @param {Vector} pos
     */
    onMouseMove(pos) {
        if (this.root.camera.getIsMapOverlayActive()) {
            return;
        }

        // Check for direction lock
        if (this.isDirectionLockActive) {
            return;
        }

        const metaBuilding = this.currentMetaBuilding.get();
        if ((metaBuilding || this.currentlyDeleting) && this.lastDragTile) {
            const oldPos = this.lastDragTile;
            let newPos = this.root.camera.screenToWorld(pos).toTileSpace();

            // Check if camera is moving, since then we do nothing
            if (this.root.camera.desiredCenter) {
                this.lastDragTile = newPos;
                return;
            }

            // Check if anything changed
            if (!oldPos.equals(newPos)) {
                // Automatic Direction
                if (
                    metaBuilding &&
                    metaBuilding.getRotateAutomaticallyWhilePlacing(this.currentVariant.get()) &&
                    !this.root.keyMapper.getBinding(
                        KEYMAPPINGS.placementModifiers.placementDisableAutoOrientation
                    ).pressed
                ) {
                    const delta = newPos.sub(oldPos);
                    const angleDeg = Math.degrees(delta.angle());
                    this.currentBaseRotation = (Math.round(angleDeg / 90) * 90 + 360) % 360;

                    // Holding alt inverts the placement
                    if (this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.placeInverse).pressed) {
                        this.currentBaseRotation = (180 + this.currentBaseRotation) % 360;
                    }
                }

                // bresenham
                let x0 = oldPos.x;
                let y0 = oldPos.y;
                let x1 = newPos.x;
                let y1 = newPos.y;

                var dx = Math.abs(x1 - x0);
                var dy = Math.abs(y1 - y0);
                var sx = x0 < x1 ? 1 : -1;
                var sy = y0 < y1 ? 1 : -1;
                var err = dx - dy;

                let anythingPlaced = false;
                let anythingDeleted = false;

                while (this.currentlyDeleting || this.currentMetaBuilding.get()) {
                    if (this.currentlyDeleting) {
                        // Deletion
                        const contents = this.root.map.getLayerContentXY(x0, y0, this.root.currentLayer);
                        if (contents && !contents.queuedForDestroy && !contents.destroyed) {
                            if (this.root.logic.tryDeleteBuilding(contents)) {
                                anythingDeleted = true;
                            }
                        }
                    } else {
                        // Placement
                        if (this.tryPlaceCurrentBuildingAt(new Vector(x0, y0))) {
                            anythingPlaced = true;
                        }
                    }

                    if (x0 === x1 && y0 === y1) break;
                    var e2 = 2 * err;
                    if (e2 > -dy) {
                        err -= dy;
                        x0 += sx;
                    }
                    if (e2 < dx) {
                        err += dx;
                        y0 += sy;
                    }
                }

                if (anythingPlaced) {
                    this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
                }
                if (anythingDeleted) {
                    this.root.soundProxy.playUi(SOUNDS.destroyBuilding);
                }
            }

            this.lastDragTile = newPos;
            return STOP_PROPAGATION;
        }
    }

    /**
     * Mouse up handler
     */
    onMouseUp() {
        if (this.root.camera.getIsMapOverlayActive()) {
            return;
        }

        // Check for direction lock
        if (this.lastDragTile && this.currentlyDragging && this.isDirectionLockActive) {
            this.executeDirectionLockedPlacement();
        }

        this.abortDragging();
    }
}
