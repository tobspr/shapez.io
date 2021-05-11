import { ClickDetector } from "../../../core/click_detector";
import { globalConfig } from "../../../core/config";
import { DrawParameters } from "../../../core/draw_parameters";
import { drawRotatedSprite } from "../../../core/draw_utils";
import { Loader } from "../../../core/loader";
import { clamp, makeDiv, removeAllChildren } from "../../../core/utils";
import {
    enumDirectionToAngle,
    enumDirectionToVector,
    enumInvertedDirections,
    Vector,
    enumDirection,
} from "../../../core/vector";
import { T } from "../../../translations";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { defaultBuildingVariant } from "../../meta_building";
import { THEME } from "../../theme";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { HUDBuildingPlacerLogic } from "./building_placer_logic";
import { makeOffscreenBuffer } from "../../../core/buffer_utils";
import { layers } from "../../root";
import { getCodeFromBuildingData } from "../../building_codes";

export class HUDBuildingPlacer extends HUDBuildingPlacerLogic {
    /**
     * @param {HTMLElement} parent
     */
    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_PlacementHints", [], ``);

        this.buildingInfoElements = {};
        this.buildingInfoElements.label = makeDiv(this.element, null, ["buildingLabel"], "Extract");
        this.buildingInfoElements.desc = makeDiv(this.element, null, ["description"], "");
        this.buildingInfoElements.descText = makeDiv(this.buildingInfoElements.desc, null, ["text"], "");
        this.buildingInfoElements.additionalInfo = makeDiv(
            this.buildingInfoElements.desc,
            null,
            ["additionalInfo"],
            ""
        );
        this.buildingInfoElements.hotkey = makeDiv(this.buildingInfoElements.desc, null, ["hotkey"], "");
        this.buildingInfoElements.tutorialImage = makeDiv(this.element, null, ["buildingImage"]);

        this.variantsElement = makeDiv(parent, "ingame_HUD_PlacerVariants");

        const compact = this.root.app.settings.getAllSettings().compactBuildingInfo;
        this.element.classList.toggle("compact", compact);
        this.variantsElement.classList.toggle("compact", compact);
    }

    initialize() {
        super.initialize();

        // Bind to signals
        this.signals.variantChanged.add(this.rerenderVariants, this);
        this.root.hud.signals.buildingSelectedForPlacement.add(this.startSelection, this);

        this.domAttach = new DynamicDomAttach(this.root, this.element, { trackHover: true });
        this.variantsAttach = new DynamicDomAttach(this.root, this.variantsElement, {});

        this.currentInterpolatedCornerTile = new Vector();

        this.lockIndicatorSprites = {};
        layers.forEach(layer => {
            this.lockIndicatorSprites[layer] = this.makeLockIndicatorSprite(layer);
        });

        //

        /**
         * Stores the click detectors for the variants so we can clean them up later
         * @type {Array<ClickDetector>}
         */
        this.variantClickDetectors = [];
    }

    /**
     * Makes the lock indicator sprite for the given layer
     * @param {Layer} layer
     */
    makeLockIndicatorSprite(layer) {
        const dims = 48;
        const [canvas, context] = makeOffscreenBuffer(dims, dims, {
            smooth: true,
            reusable: false,
            label: "lock-direction-indicator",
        });

        context.fillStyle = THEME.map.directionLock[layer].color;
        context.strokeStyle = THEME.map.directionLock[layer].color;
        context.lineWidth = 2;

        const padding = 5;
        const height = dims * 0.5;
        const bottom = (dims + height) / 2;

        context.moveTo(padding, bottom);
        context.lineTo(dims / 2, bottom - height);
        context.lineTo(dims - padding, bottom);
        context.closePath();
        context.stroke();
        context.fill();

        return canvas;
    }

    /**
     * Rerenders the building info dialog
     */
    rerenderInfoDialog() {
        const metaBuilding = this.currentMetaBuilding.get();

        if (!metaBuilding) {
            return;
        }

        const variant = this.currentVariant.get();

        this.buildingInfoElements.label.innerHTML = T.buildings[metaBuilding.id][variant].name;
        this.buildingInfoElements.descText.innerHTML = T.buildings[metaBuilding.id][variant].description;

        const layer = this.root.currentLayer;

        let rawBinding = KEYMAPPINGS.buildings[metaBuilding.getId() + "_" + layer];
        if (!rawBinding) {
            rawBinding = KEYMAPPINGS.buildings[metaBuilding.getId()];
        }

        const binding = this.root.keyMapper.getBinding(rawBinding);

        this.buildingInfoElements.hotkey.innerHTML = T.ingame.buildingPlacement.hotkeyLabel.replace(
            "<key>",
            "<code class='keybinding'>" + binding.getKeyCodeString() + "</code>"
        );

        this.buildingInfoElements.tutorialImage.setAttribute(
            "data-icon",
            "building_tutorials/" +
                metaBuilding.getId() +
                (variant === defaultBuildingVariant ? "" : "-" + variant) +
                ".png"
        );

        removeAllChildren(this.buildingInfoElements.additionalInfo);
        const additionalInfo = metaBuilding.getAdditionalStatistics(this.root, this.currentVariant.get());
        for (let i = 0; i < additionalInfo.length; ++i) {
            const [label, contents] = additionalInfo[i];
            this.buildingInfoElements.additionalInfo.innerHTML += `
                <label>${label}:</label>
                <span>${contents}</contents>
            `;
        }
    }

    cleanup() {
        super.cleanup();
        this.cleanupVariantClickDetectors();
    }

    /**
     * Cleans up all variant click detectors
     */
    cleanupVariantClickDetectors() {
        for (let i = 0; i < this.variantClickDetectors.length; ++i) {
            const detector = this.variantClickDetectors[i];
            detector.cleanup();
        }
        this.variantClickDetectors = [];
    }

    /**
     * Rerenders the variants displayed
     */
    rerenderVariants() {
        removeAllChildren(this.variantsElement);
        this.rerenderInfoDialog();

        const metaBuilding = this.currentMetaBuilding.get();

        // First, clear up all click detectors
        this.cleanupVariantClickDetectors();

        if (!metaBuilding) {
            return;
        }
        const availableVariants = metaBuilding.getAvailableVariants(this.root);
        if (availableVariants.length === 1) {
            return;
        }

        makeDiv(
            this.variantsElement,
            null,
            ["explanation"],
            T.ingame.buildingPlacement.cycleBuildingVariants.replace(
                "<key>",
                "<code class='keybinding'>" +
                    this.root.keyMapper
                        .getBinding(KEYMAPPINGS.placement.cycleBuildingVariants)
                        .getKeyCodeString() +
                    "</code>"
            )
        );

        const container = makeDiv(this.variantsElement, null, ["variants"]);

        for (let i = 0; i < availableVariants.length; ++i) {
            const variant = availableVariants[i];

            const element = makeDiv(container, null, ["variant"]);
            element.classList.toggle("active", variant === this.currentVariant.get());
            makeDiv(element, null, ["label"], variant);

            const iconSize = 64;

            const dimensions = metaBuilding.getDimensions(variant);
            const sprite = metaBuilding.getPreviewSprite(0, variant);
            const spriteWrapper = makeDiv(element, null, ["iconWrap"]);
            // @ts-ignore
            spriteWrapper.setAttribute("data-tile-w", dimensions.x);
            // @ts-ignore
            spriteWrapper.setAttribute("data-tile-h", dimensions.y);

            spriteWrapper.innerHTML = sprite.getAsHTML(iconSize * dimensions.x, iconSize * dimensions.y);

            const detector = new ClickDetector(element, {
                consumeEvents: true,
                targetOnly: true,
            });
            detector.click.add(() => this.setVariant(variant));
        }
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        if (this.root.camera.zoomLevel < globalConfig.mapChunkOverviewMinZoom) {
            // Dont allow placing in overview mode
            this.domAttach.update(false);
            this.variantsAttach.update(false);
            return;
        }

        this.domAttach.update(!!this.currentMetaBuilding.get());
        this.variantsAttach.update(!!this.currentMetaBuilding.get());
        const metaBuilding = this.currentMetaBuilding.get();

        if (!metaBuilding) {
            return;
        }

        // Draw direction lock
        if (this.isDirectionLockActive) {
            this.drawDirectionLock(parameters);
        } else {
            this.drawRegularPlacement(parameters);
        }

        const layer = metaBuilding.getShowLayerPreview(this.currentVariant.get());

        if (layer && layer != this.root.currentLayer) {
            this.drawLayerPeek(parameters, layer);
        }
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    drawLayerPeek(parameters, layer) {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const worldPosition = this.root.camera.screenToWorld(mousePosition);

        // Draw peeker
        this.root.hud.parts.layerPreview.renderPreview(
            parameters,
            worldPosition,
            1 / this.root.camera.zoomLevel,
            layer
        );
    }

    /**
     * @param {DrawParameters} parameters
     */
    drawRegularPlacement(parameters) {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const metaBuilding = this.currentMetaBuilding.get();

        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const mouseTile = worldPos.toTileSpace();

        // Compute best rotation variant
        const {
            rotation,
            rotationVariant,
            connectedEntities,
        } = metaBuilding.computeOptimalDirectionAndRotationVariantAtTile({
            root: this.root,
            tile: mouseTile,
            rotation: this.currentBaseRotation,
            variant: this.currentVariant.get(),
            layer: metaBuilding.getLayer(this.root, this.currentVariant.get()),
        });

        // Check if there are connected entities
        if (connectedEntities) {
            for (let i = 0; i < connectedEntities.length; ++i) {
                const connectedEntity = connectedEntities[i];
                const connectedWsPoint = connectedEntity.components.StaticMapEntity.getTileSpaceBounds()
                    .getCenter()
                    .toWorldSpace();

                const startWsPoint = mouseTile.toWorldSpaceCenterOfTile();

                const startOffset = connectedWsPoint
                    .sub(startWsPoint)
                    .normalize()
                    .multiplyScalar(globalConfig.tileSize * 0.3);
                const effectiveStartPoint = startWsPoint.add(startOffset);
                const effectiveEndPoint = connectedWsPoint.sub(startOffset);

                parameters.context.globalAlpha = 0.6;

                // parameters.context.lineCap = "round";
                parameters.context.strokeStyle = "#7f7";
                parameters.context.lineWidth = 10;
                parameters.context.beginPath();
                parameters.context.moveTo(effectiveStartPoint.x, effectiveStartPoint.y);
                parameters.context.lineTo(effectiveEndPoint.x, effectiveEndPoint.y);
                parameters.context.stroke();
                parameters.context.globalAlpha = 1;
                // parameters.context.lineCap = "square";
            }
        }

        // Synchronize rotation and origin
        this.fakeEntity.layer = metaBuilding.getLayer(this.root, this.currentVariant.get());
        const staticComp = this.fakeEntity.components.StaticMapEntity;
        staticComp.origin = mouseTile;
        staticComp.rotation = rotation;
        metaBuilding.updateVariants(this.fakeEntity, rotationVariant, this.currentVariant.get());
        staticComp.code = getCodeFromBuildingData(
            this.currentMetaBuilding.get(),
            this.currentVariant.get(),
            rotationVariant
        );

        const canBuild = this.root.logic.checkCanPlaceEntity(this.fakeEntity);

        // Fade in / out
        parameters.context.lineWidth = 1;

        // Determine the bounds and visualize them
        const entityBounds = staticComp.getTileSpaceBounds();
        const drawBorder = -3;
        if (canBuild) {
            parameters.context.strokeStyle = "rgba(56, 235, 111, 0.5)";
            parameters.context.fillStyle = "rgba(56, 235, 111, 0.2)";
        } else {
            parameters.context.strokeStyle = "rgba(255, 0, 0, 0.2)";
            parameters.context.fillStyle = "rgba(255, 0, 0, 0.2)";
        }

        parameters.context.beginRoundedRect(
            entityBounds.x * globalConfig.tileSize - drawBorder,
            entityBounds.y * globalConfig.tileSize - drawBorder,
            entityBounds.w * globalConfig.tileSize + 2 * drawBorder,
            entityBounds.h * globalConfig.tileSize + 2 * drawBorder,
            4
        );
        parameters.context.stroke();
        // parameters.context.fill();
        parameters.context.globalAlpha = 1;

        // HACK to draw the entity sprite
        const previewSprite = metaBuilding.getBlueprintSprite(rotationVariant, this.currentVariant.get());
        staticComp.origin = worldPos.divideScalar(globalConfig.tileSize).subScalars(0.5, 0.5);
        staticComp.drawSpriteOnBoundsClipped(parameters, previewSprite);
        staticComp.origin = mouseTile;

        // Draw ejectors
        if (canBuild) {
            this.drawMatchingAcceptorsAndEjectors(parameters);
        }
    }

    /**
     * @param {DrawParameters} parameters
     */
    drawDirectionLock(parameters) {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const mouseWorld = this.root.camera.screenToWorld(mousePosition);
        const mouseTile = mouseWorld.toTileSpace();
        parameters.context.fillStyle = THEME.map.directionLock[this.root.currentLayer].color;
        parameters.context.strokeStyle = THEME.map.directionLock[this.root.currentLayer].background;
        parameters.context.lineWidth = 10;

        parameters.context.beginCircle(mouseWorld.x, mouseWorld.y, 4);
        parameters.context.fill();

        if (this.lastDragTile) {
            const startLine = this.lastDragTile.toWorldSpaceCenterOfTile();
            const endLine = mouseTile.toWorldSpaceCenterOfTile();
            const midLine = this.currentDirectionLockCorner.toWorldSpaceCenterOfTile();

            parameters.context.beginCircle(startLine.x, startLine.y, 8);
            parameters.context.fill();

            parameters.context.beginPath();
            parameters.context.moveTo(startLine.x, startLine.y);
            parameters.context.lineTo(midLine.x, midLine.y);
            parameters.context.lineTo(endLine.x, endLine.y);
            parameters.context.stroke();

            parameters.context.beginCircle(endLine.x, endLine.y, 5);
            parameters.context.fill();

            // Draw arrow
            const arrowSprite = this.lockIndicatorSprites[this.root.currentLayer];
            const path = this.computeDirectionLockPath();
            for (let i = 0; i < path.length - 1; i += 1) {
                const { rotation, tile } = path[i];
                const worldPos = tile.toWorldSpaceCenterOfTile();
                const angle = Math.radians(rotation);

                parameters.context.translate(worldPos.x, worldPos.y);
                parameters.context.rotate(angle);
                parameters.context.drawImage(
                    arrowSprite,
                    -6,
                    -globalConfig.halfTileSize -
                        clamp((this.root.time.realtimeNow() * 1.5) % 1.0, 0, 1) * 1 * globalConfig.tileSize +
                        globalConfig.halfTileSize -
                        6,
                    12,
                    12
                );
                parameters.context.rotate(-angle);
                parameters.context.translate(-worldPos.x, -worldPos.y);
            }
        }
    }

    /**
     * @param {DrawParameters} parameters
     */
    drawMatchingAcceptorsAndEjectors(parameters) {
        const acceptorComp = this.fakeEntity.components.ItemAcceptor;
        const ejectorComp = this.fakeEntity.components.ItemEjector;
        const staticComp = this.fakeEntity.components.StaticMapEntity;
        const beltComp = this.fakeEntity.components.Belt;
        const minerComp = this.fakeEntity.components.Miner;

        const goodArrowSprite = Loader.getSprite("sprites/misc/slot_good_arrow.png");
        const badArrowSprite = Loader.getSprite("sprites/misc/slot_bad_arrow.png");

        // Just ignore the following code please ... thanks!

        const offsetShift = 10;

        let acceptorSlots = [];
        let ejectorSlots = [];

        if (ejectorComp) {
            ejectorSlots = ejectorComp.slots.slice();
        }

        if (acceptorComp) {
            acceptorSlots = acceptorComp.slots.slice();
        }

        if (beltComp) {
            const fakeEjectorSlot = beltComp.getFakeEjectorSlot();
            const fakeAcceptorSlot = beltComp.getFakeAcceptorSlot();
            ejectorSlots.push(fakeEjectorSlot);
            acceptorSlots.push(fakeAcceptorSlot);
        }

        for (let acceptorSlotIndex = 0; acceptorSlotIndex < acceptorSlots.length; ++acceptorSlotIndex) {
            const slot = acceptorSlots[acceptorSlotIndex];

            const acceptorSlotWsTile = staticComp.localTileToWorld(slot.pos);
            const acceptorSlotWsPos = acceptorSlotWsTile.toWorldSpaceCenterOfTile();

            // Go over all slots
            for (
                let acceptorDirectionIndex = 0;
                acceptorDirectionIndex < slot.directions.length;
                ++acceptorDirectionIndex
            ) {
                const direction = slot.directions[acceptorDirectionIndex];
                const worldDirection = staticComp.localDirectionToWorld(direction);

                // Figure out which tile ejects to this slot
                const sourceTile = acceptorSlotWsTile.add(enumDirectionToVector[worldDirection]);

                let isBlocked = false;
                let isConnected = false;

                // Find all entities which are on that tile
                const sourceEntities = this.root.map.getLayersContentsMultipleXY(sourceTile.x, sourceTile.y);

                // Check for every entity:
                for (let i = 0; i < sourceEntities.length; ++i) {
                    const sourceEntity = sourceEntities[i];
                    const sourceEjector = sourceEntity.components.ItemEjector;
                    const sourceBeltComp = sourceEntity.components.Belt;
                    const sourceStaticComp = sourceEntity.components.StaticMapEntity;
                    const ejectorAcceptLocalTile = sourceStaticComp.worldToLocalTile(acceptorSlotWsTile);

                    // If this entity is on the same layer as the slot - if so, it can either be
                    // connected, or it can not be connected and thus block the input
                    if (sourceEjector && sourceEjector.anySlotEjectsToLocalTile(ejectorAcceptLocalTile)) {
                        // This one is connected, all good
                        isConnected = true;
                    } else if (
                        sourceBeltComp &&
                        sourceStaticComp.localDirectionToWorld(sourceBeltComp.direction) ===
                            enumInvertedDirections[worldDirection]
                    ) {
                        // Belt connected
                        isConnected = true;
                    } else {
                        // This one is blocked
                        isBlocked = true;
                    }
                }

                const alpha = isConnected || isBlocked ? 1.0 : 0.3;
                const sprite = isBlocked ? badArrowSprite : goodArrowSprite;

                parameters.context.globalAlpha = alpha;
                drawRotatedSprite({
                    parameters,
                    sprite,
                    x: acceptorSlotWsPos.x,
                    y: acceptorSlotWsPos.y,
                    angle: Math.radians(enumDirectionToAngle[enumInvertedDirections[worldDirection]]),
                    size: 13,
                    offsetY: offsetShift + 13,
                });
                parameters.context.globalAlpha = 1;
            }
        }

        // Go over all slots
        for (let ejectorSlotIndex = 0; ejectorSlotIndex < ejectorSlots.length; ++ejectorSlotIndex) {
            const slot = ejectorSlots[ejectorSlotIndex];

            const ejectorSlotLocalTile = slot.pos.add(enumDirectionToVector[slot.direction]);
            const ejectorSlotWsTile = staticComp.localTileToWorld(ejectorSlotLocalTile);

            const ejectorSLotWsPos = ejectorSlotWsTile.toWorldSpaceCenterOfTile();
            const ejectorSlotWsDirection = staticComp.localDirectionToWorld(slot.direction);

            let isBlocked = false;
            let isConnected = false;

            // Find all entities which are on that tile
            const destEntities = this.root.map.getLayersContentsMultipleXY(
                ejectorSlotWsTile.x,
                ejectorSlotWsTile.y
            );

            // Check for every entity:
            for (let i = 0; i < destEntities.length; ++i) {
                const destEntity = destEntities[i];
                const destAcceptor = destEntity.components.ItemAcceptor;
                const destStaticComp = destEntity.components.StaticMapEntity;
                const destMiner = destEntity.components.Miner;

                const destLocalTile = destStaticComp.worldToLocalTile(ejectorSlotWsTile);
                const destLocalDir = destStaticComp.worldDirectionToLocal(ejectorSlotWsDirection);
                if (destAcceptor && destAcceptor.findMatchingSlot(destLocalTile, destLocalDir)) {
                    // This one is connected, all good
                    isConnected = true;
                } else if (destEntity.components.Belt && destLocalDir === enumDirection.top) {
                    // Connected to a belt
                    isConnected = true;
                } else if (minerComp && minerComp.chainable && destMiner && destMiner.chainable) {
                    // Chainable miners connected to eachother
                    isConnected = true;
                } else {
                    // This one is blocked
                    isBlocked = true;
                }
            }

            const alpha = isConnected || isBlocked ? 1.0 : 0.3;
            const sprite = isBlocked ? badArrowSprite : goodArrowSprite;

            parameters.context.globalAlpha = alpha;
            drawRotatedSprite({
                parameters,
                sprite,
                x: ejectorSLotWsPos.x,
                y: ejectorSLotWsPos.y,
                angle: Math.radians(enumDirectionToAngle[ejectorSlotWsDirection]),
                size: 13,
                offsetY: offsetShift,
            });
            parameters.context.globalAlpha = 1;
        }
    }
}
