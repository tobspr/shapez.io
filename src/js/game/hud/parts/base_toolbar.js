import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { STOP_PROPAGATION } from "../../../core/signal";
import { makeDiv, safeModulo } from "../../../core/utils";
import { MetaBlockBuilding } from "../../buildings/block";
import { MetaConstantProducerBuilding } from "../../buildings/constant_producer";
import { MetaGoalAcceptorBuilding } from "../../buildings/goal_acceptor";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { MetaBuilding } from "../../meta_building";
import { GameRoot } from "../../root";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

export class HUDBaseToolbar extends BaseHUDPart {
    /**
     * @param {GameRoot} root
     * @param {object} param0
     * @param {Array<typeof MetaBuilding>} param0.primaryBuildings
     * @param {Array<typeof MetaBuilding>=} param0.secondaryBuildings
     * @param {function} param0.visibilityCondition
     * @param {string} param0.htmlElementId
     * @param {Layer=} param0.layer
     */
    constructor(
        root,
        { primaryBuildings, secondaryBuildings = [], visibilityCondition, htmlElementId, layer = "regular" }
    ) {
        super(root);

        this.primaryBuildings = this.filterBuildings(primaryBuildings);
        this.secondaryBuildings = this.filterBuildings(secondaryBuildings);
        this.visibilityCondition = visibilityCondition;
        this.htmlElementId = htmlElementId;
        this.layer = layer;

        this.requiredBuildings = [
            gMetaBuildingRegistry.findByClass(MetaConstantProducerBuilding),
            gMetaBuildingRegistry.findByClass(MetaGoalAcceptorBuilding),
            gMetaBuildingRegistry.findByClass(MetaBlockBuilding),
        ];

        /** @type {Object.<string, {
         * metaBuilding: MetaBuilding,
         * unlocked: boolean,
         * selected: boolean,
         * element: HTMLElement,
         * index: number
         * puzzleLocked: boolean;
         * }>} */
        this.buildingHandles = {};
    }

    /**
     * Should create all require elements
     * @param {HTMLElement} parent
     */
    createElements(parent) {
        this.element = makeDiv(parent, this.htmlElementId, ["ingame_buildingsToolbar"], "");
    }

    /**
     * @param {Array<typeof MetaBuilding>} buildings
     * @returns {Array<typeof MetaBuilding>}
     */
    filterBuildings(buildings) {
        const filtered = [];

        for (let i = 0; i < buildings.length; i++) {
            if (!this.root.gameMode.isBuildingExcluded(buildings[i])) {
                filtered.push(buildings[i]);
            }
        }

        return filtered;
    }

    /**
     * Returns all buildings
     * @returns {Array<typeof MetaBuilding>}
     */
    get allBuildings() {
        return [...this.primaryBuildings, ...this.secondaryBuildings];
    }

    initialize() {
        const actionMapper = this.root.keyMapper;
        let rowSecondary;
        if (this.secondaryBuildings.length > 0) {
            rowSecondary = makeDiv(this.element, null, ["buildings", "secondary"]);

            this.secondaryDomAttach = new DynamicDomAttach(this.root, rowSecondary, {
                attachClass: "visible",
            });
        }

        const rowPrimary = makeDiv(this.element, null, ["buildings", "primary"]);

        const allBuildings = this.allBuildings;

        for (let i = 0; i < allBuildings.length; ++i) {
            const metaBuilding = gMetaBuildingRegistry.findByClass(allBuildings[i]);

            let rawBinding = KEYMAPPINGS.buildings[metaBuilding.getId() + "_" + this.layer];
            if (!rawBinding) {
                rawBinding = KEYMAPPINGS.buildings[metaBuilding.getId()];
            }

            const binding = actionMapper.getBinding(rawBinding);

            const itemContainer = makeDiv(
                this.primaryBuildings.includes(allBuildings[i]) ? rowPrimary : rowSecondary,
                null,
                ["building"]
            );
            itemContainer.setAttribute("data-icon", "building_icons/" + metaBuilding.getId() + ".png");
            itemContainer.setAttribute("data-id", metaBuilding.getId());
            binding.add(() => this.selectBuildingForPlacement(metaBuilding));

            const icon = makeDiv(itemContainer, null, ["icon"]);

            this.trackClicks(icon, () => this.selectBuildingForPlacement(metaBuilding), {
                clickSound: null,
            });

            //lock icon for puzzle editor
            if (this.root.gameMode.getIsEditor()) {
                itemContainer.classList.toggle("editor", true);
                if (!this.inRequiredBuildings(metaBuilding)) {
                    const puzzleLock = makeDiv(itemContainer, null, ["puzzle-lock"]);
                    puzzleLock.classList.add("active");

                    this.trackClicks(puzzleLock, () => this.toggleBuildingLock(metaBuilding));
                }
            }

            this.buildingHandles[metaBuilding.id] = {
                metaBuilding: metaBuilding,
                element: itemContainer,
                unlocked: false,
                selected: false,
                index: i,
                puzzleLocked: false,
            };
        }

        this.root.hud.signals.selectedPlacementBuildingChanged.add(
            this.onSelectedPlacementBuildingChanged,
            this
        );

        this.domAttach = new DynamicDomAttach(this.root, this.element, {
            timeToKeepSeconds: 0.12,
            attachClass: "visible",
        });
        this.lastSelectedIndex = 0;
        actionMapper.getBinding(KEYMAPPINGS.placement.cycleBuildings).add(this.cycleBuildings, this);

        this.switchingTestMode = false;
    }

    /**
     * Updates the toolbar
     */
    update() {
        const visible = this.visibilityCondition() && !this.switchingTestMode;
        this.domAttach.update(visible);

        if (visible) {
            let recomputeSecondaryToolbarVisibility = false;
            for (const buildingId in this.buildingHandles) {
                const handle = this.buildingHandles[buildingId];
                const newStatus = !handle.puzzleLocked && handle.metaBuilding.getIsUnlocked(this.root);
                if (handle.unlocked !== newStatus) {
                    handle.unlocked = newStatus;
                    handle.element.classList.toggle("unlocked", newStatus);
                    recomputeSecondaryToolbarVisibility = true;
                }
            }

            if (recomputeSecondaryToolbarVisibility && this.secondaryDomAttach) {
                let anyUnlocked = false;
                for (let i = 0; i < this.secondaryBuildings.length; ++i) {
                    const metaClass = gMetaBuildingRegistry.findByClass(this.secondaryBuildings[i]);
                    if (metaClass.getIsUnlocked(this.root)) {
                        anyUnlocked = true;
                        break;
                    }
                }

                this.secondaryDomAttach.update(anyUnlocked);
            }
        }
    }

    /**
     * Cycles through all buildings
     */
    cycleBuildings() {
        const visible = this.visibilityCondition();
        if (!visible) {
            return;
        }

        let newBuildingFound = false;
        let newIndex = this.lastSelectedIndex;
        const direction = this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateInverseModifier).pressed
            ? -1
            : 1;

        for (let i = 0; i <= this.primaryBuildings.length; ++i) {
            newIndex = safeModulo(newIndex + direction, this.primaryBuildings.length);
            const metaBuilding = gMetaBuildingRegistry.findByClass(this.primaryBuildings[newIndex]);
            const handle = this.buildingHandles[metaBuilding.id];
            if (!handle.selected && handle.unlocked) {
                newBuildingFound = true;
                break;
            }
        }
        if (!newBuildingFound) {
            return;
        }
        const metaBuildingClass = this.primaryBuildings[newIndex];
        const metaBuilding = gMetaBuildingRegistry.findByClass(metaBuildingClass);
        this.selectBuildingForPlacement(metaBuilding);
    }

    /**
     * Called when the selected building got changed
     * @param {MetaBuilding} metaBuilding
     */
    onSelectedPlacementBuildingChanged(metaBuilding) {
        for (const buildingId in this.buildingHandles) {
            const handle = this.buildingHandles[buildingId];
            const newStatus = handle.metaBuilding === metaBuilding;
            if (handle.selected !== newStatus) {
                handle.selected = newStatus;
                handle.element.classList.toggle("selected", newStatus);
            }
            if (handle.selected) {
                this.lastSelectedIndex = handle.index;
            }
        }

        this.element.classList.toggle("buildingSelected", !!metaBuilding);
    }

    /**
     * @param {MetaBuilding} metaBuilding
     */
    selectBuildingForPlacement(metaBuilding) {
        if (!this.visibilityCondition()) {
            // Not active
            return;
        }

        if (!metaBuilding.getIsUnlocked(this.root)) {
            this.root.soundProxy.playUiError();
            return STOP_PROPAGATION;
        }

        const handle = this.buildingHandles[metaBuilding.getId()];
        if (handle.puzzleLocked) {
            if (this.root.gameMode.getIsEditor()) {
                handle.puzzleLocked = false;
                handle.element.classList.toggle("unlocked", false);
                this.root.soundProxy.playUiClick();
            }
            return;
        }

        // Allow clicking an item again to deselect it
        for (const buildingId in this.buildingHandles) {
            const handle = this.buildingHandles[buildingId];
            if (handle.selected && handle.metaBuilding === metaBuilding) {
                metaBuilding = null;
                break;
            }
        }

        this.root.soundProxy.playUiClick();
        this.root.hud.signals.buildingSelectedForPlacement.dispatch(metaBuilding);
        this.onSelectedPlacementBuildingChanged(metaBuilding);
    }

    /**
     * @param {boolean} testMode
     */
    toggleTestMode(testMode) {
        // toggle the puzzle lock buttons and the editor-only buildings

        this.element.querySelectorAll(".building > .puzzle-lock").forEach(element => {
            element.classList.toggle("active", !testMode);
        });

        for (let i = 0; i < this.requiredBuildings.length; ++i) {
            const metaBuilding = this.requiredBuildings[i];
            const handle = this.buildingHandles[metaBuilding.getId()];
            handle.puzzleLocked = testMode;
            handle.element.classList.toggle("unlocked", !testMode);
        }
    }

    /**
     * @param {MetaBuilding} metaBuilding
     */
    toggleBuildingLock(metaBuilding) {
        if (!this.visibilityCondition()) {
            // Not active
            return;
        }

        if (this.inRequiredBuildings(metaBuilding) || !metaBuilding.getIsUnlocked(this.root)) {
            this.root.soundProxy.playUiError();
            return STOP_PROPAGATION;
        }

        const handle = this.buildingHandles[metaBuilding.getId()];
        handle.puzzleLocked = !handle.puzzleLocked;
        handle.element.classList.toggle("unlocked", !handle.puzzleLocked);

        const entityManager = this.root.entityMgr;
        for (const entity of entityManager.getAllWithComponent(StaticMapEntityComponent)) {
            const staticComp = entity.components.StaticMapEntity;
            if (staticComp.getMetaBuilding().id === metaBuilding.id) {
                this.root.map.removeStaticEntity(entity);
                entityManager.destroyEntity(entity);
            }
        }
        entityManager.processDestroyList();

        const currentMetaBuilding = this.root.hud.parts.buildingPlacer.currentMetaBuilding;
        if (currentMetaBuilding.get() == metaBuilding) {
            currentMetaBuilding.set(null);
        }
    }

    /**
     * @param {MetaBuilding} metaBuilding
     */
    inRequiredBuildings(metaBuilding) {
        return this.requiredBuildings.includes(metaBuilding);
    }
}
