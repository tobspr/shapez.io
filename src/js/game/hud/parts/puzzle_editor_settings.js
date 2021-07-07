import { globalConfig } from "../../../core/config";
import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { Rectangle } from "../../../core/rectangle";
import { makeDiv } from "../../../core/utils";
import { T } from "../../../translations";
import { MetaBlockBuilding } from "../../buildings/block";
import { MetaConstantProducerBuilding } from "../../buildings/constant_producer";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { Entity } from "../../entity";
import { PuzzleGameMode } from "../../modes/puzzle";
import { BaseHUDPart } from "../base_hud_part";

export class HUDPuzzleEditorSettings extends BaseHUDPart {
    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_PuzzleEditorSettings");

        if (this.root.gameMode.getBuildableZones()) {
            const bind = (selector, handler) =>
                this.trackClicks(this.element.querySelector(selector), handler);
            this.zone = makeDiv(
                this.element,
                null,
                ["section", "zone"],
                `
                <label>${T.ingame.puzzleEditorSettings.zoneTitle}</label>

                <div class="mainButtons">
                    <div class="zoneWidth plusMinus">
                        <label>${T.ingame.puzzleEditorSettings.zoneWidth}</label>
                        <button class="styledButton minus">-</button>
                        <span class="value"></span>
                        <button class="styledButton plus">+</button>
                    </div>

                    <div class="zoneHeight plusMinus">
                        <label>${T.ingame.puzzleEditorSettings.zoneHeight}</label>
                        <button class="styledButton minus">-</button>
                        <span class="value"></span>
                        <button class="styledButton plus">+</button>
                    </div>

                    <div class="buttonBar">
                        <button class="styledButton trim">${T.ingame.puzzleEditorSettings.trimZone}</button>
                        <button class="styledButton clearItems">${T.ingame.puzzleEditorSettings.clearItems}</button>
                    </div>

                </div>

                <div class="testToggle">
                    <button class="styledButton testPuzzle">${T.ingame.puzzleEditorSettings.enableTestMode}</button>
                </div>`
            );

            bind(".zoneWidth .minus", () => this.modifyZone(-1, 0));
            bind(".zoneWidth .plus", () => this.modifyZone(1, 0));
            bind(".zoneHeight .minus", () => this.modifyZone(0, -1));
            bind(".zoneHeight .plus", () => this.modifyZone(0, 1));
            bind("button.trim", this.trim);
            bind("button.clearItems", this.clearItems);
            bind("button.testPuzzle", this.toggleTestMode);

            this.testMode = false;

            /** @type {Entity[]} */
            this.storedSolution = [];
        }
    }

    clearItems() {
        this.root.logic.clearAllBeltsAndItems();
    }

    toggleTestMode() {
        this.testMode = !this.testMode;

        this.element.querySelector(".section > label").classList.toggle("disabled", this.testMode);
        this.element.querySelector(".mainButtons").classList.toggle("disabled", this.testMode);
        const testButton = this.element.querySelector(".testToggle > .testPuzzle");
        testButton.textContent = this.testMode
            ? T.ingame.puzzleEditorSettings.disableTestMode
            : T.ingame.puzzleEditorSettings.enableTestMode;

        testButton.classList.toggle("disabled", true);

        const buildingsToolbar = this.root.hud.parts.buildingsToolbar;
        buildingsToolbar.switchingTestMode = true;
        this.root.signals.testModeChanged.dispatch(this.testMode);

        setTimeout(() => {
            buildingsToolbar.switchingTestMode = false;
            buildingsToolbar.toggleTestMode(this.testMode);

            testButton.classList.toggle("disabled", false);
        }, 140);

        if (this.testMode) {
            for (const entity of this.root.entityMgr.getAllWithComponent(StaticMapEntityComponent)) {
                this.storedSolution.push(entity.clone());

                const metaBuilding = entity.components.StaticMapEntity.getMetaBuilding();
                const goalComp = entity.components.GoalAcceptor;
                if (goalComp) {
                    goalComp.clear();
                    continue;
                }

                if (
                    [MetaConstantProducerBuilding, MetaBlockBuilding]
                        .map(metaClass => gMetaBuildingRegistry.findByClass(metaClass).id)
                        .includes(metaBuilding.id)
                ) {
                    continue;
                }

                this.root.map.removeStaticEntity(entity);
                this.root.entityMgr.destroyEntity(entity);
            }
            this.root.entityMgr.processDestroyList();
        } else if (this.storedSolution.length) {
            this.root.logic.performBulkOperation(() => {
                this.root.logic.performImmutableOperation(() => {
                    for (const entity of this.root.entityMgr.getAllWithComponent(StaticMapEntityComponent)) {
                        this.root.map.removeStaticEntity(entity);
                        this.root.entityMgr.destroyEntity(entity);
                    }
                    this.root.entityMgr.processDestroyList();

                    for (const entity of this.storedSolution) {
                        const placedEntity = this.root.logic.tryPlaceEntity(entity);

                        for (const key in entity.components) {
                            /** @type {import("../../../core/global_registries").Component} */ (entity
                                .components[key]).copyAdditionalStateTo(placedEntity.components[key]);
                        }
                    }
                    this.storedSolution = [];
                });
            });
        }
    }

    trim() {
        // Now, find the center
        const buildings = this.root.entityMgr.entities.slice();

        if (buildings.length === 0) {
            // nothing to do
            return;
        }

        let minRect = null;

        for (const building of buildings) {
            const staticComp = building.components.StaticMapEntity;
            const bounds = staticComp.getTileSpaceBounds();

            if (!minRect) {
                minRect = bounds;
            } else {
                minRect = minRect.getUnion(bounds);
            }
        }

        const mode = /** @type {PuzzleGameMode} */ (this.root.gameMode);
        const moveByInverse = minRect.getCenter().round();

        // move buildings
        if (moveByInverse.length() > 0) {
            // increase area size
            mode.zoneWidth = globalConfig.puzzleMaxBoundsSize;
            mode.zoneHeight = globalConfig.puzzleMaxBoundsSize;

            // First, remove any items etc
            this.root.logic.clearAllBeltsAndItems();

            this.root.logic.performImmutableOperation(() => {
                // 1. remove all buildings
                for (const building of buildings) {
                    if (!this.root.logic.tryDeleteBuilding(building)) {
                        assertAlways(false, "Failed to remove building in trim");
                    }
                }

                // 2. place them again, but centered
                for (const building of buildings) {
                    const staticComp = building.components.StaticMapEntity;
                    const result = this.root.logic.tryPlaceBuilding({
                        origin: staticComp.origin.sub(moveByInverse),
                        building: staticComp.getMetaBuilding(),
                        originalRotation: staticComp.originalRotation,
                        rotation: staticComp.rotation,
                        rotationVariant: staticComp.getRotationVariant(),
                        variant: staticComp.getVariant(),
                    });
                    if (!result) {
                        this.root.bulkOperationRunning = false;
                        assertAlways(false, "Failed to re-place building in trim");
                    }

                    if (building.components.ConstantSignal) {
                        result.components.ConstantSignal.signal = building.components.ConstantSignal.signal;
                    }
                }
            });
        }

        // 3. Actually trim
        let w = mode.zoneWidth;
        let h = mode.zoneHeight;

        while (!this.anyBuildingOutsideZone(w - 1, h)) {
            --w;
        }

        while (!this.anyBuildingOutsideZone(w, h - 1)) {
            --h;
        }

        mode.zoneWidth = w;
        mode.zoneHeight = h;
        this.updateZoneValues();
    }

    initialize() {
        this.visible = true;
        this.updateZoneValues();
    }

    anyBuildingOutsideZone(width, height) {
        if (Math.min(width, height) < globalConfig.puzzleMinBoundsSize) {
            return true;
        }
        const newZone = Rectangle.centered(width, height);
        const entities = this.root.entityMgr.getAllWithComponent(StaticMapEntityComponent);

        for (const entity of entities) {
            const staticComp = entity.components.StaticMapEntity;
            const bounds = staticComp.getTileSpaceBounds();
            if (!newZone.intersectsFully(bounds)) {
                return true;
            }
        }
    }

    modifyZone(deltaW, deltaH) {
        const mode = /** @type {PuzzleGameMode} */ (this.root.gameMode);

        const newWidth = mode.zoneWidth + deltaW;
        const newHeight = mode.zoneHeight + deltaH;

        if (Math.min(newWidth, newHeight) < globalConfig.puzzleMinBoundsSize) {
            return;
        }

        if (Math.max(newWidth, newHeight) > globalConfig.puzzleMaxBoundsSize) {
            return;
        }

        if (this.anyBuildingOutsideZone(newWidth, newHeight)) {
            this.root.hud.parts.dialogs.showWarning(
                T.dialogs.puzzleResizeBadBuildings.title,
                T.dialogs.puzzleResizeBadBuildings.desc
            );
            return;
        }

        mode.zoneWidth = newWidth;
        mode.zoneHeight = newHeight;
        this.updateZoneValues();
    }

    updateZoneValues() {
        const mode = /** @type {PuzzleGameMode} */ (this.root.gameMode);

        this.element.querySelector(".zoneWidth > .value").textContent = String(mode.zoneWidth);
        this.element.querySelector(".zoneHeight > .value").textContent = String(mode.zoneHeight);
    }
}
