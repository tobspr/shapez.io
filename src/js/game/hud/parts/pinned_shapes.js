import { ClickDetector } from "../../../core/click_detector";
import { globalConfig } from "../../../core/config";
import { arrayDeleteValue, formatBigNumber, makeDiv } from "../../../core/utils";
import { T } from "../../../translations";
import { enumAnalyticsDataSource } from "../../production_analytics";
import { ShapeDefinition } from "../../shape_definition";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { BaseHUDPart } from "../base_hud_part";

/**
 * Manages the pinned shapes on the left side of the screen
 */
export class HUDPinnedShapes extends BaseHUDPart {
    constructor(root) {
        super(root);
        /**
         * Store a list of pinned shapes
         * @type {Array<string>}
         */
        this.pinnedShapes = [];

        /**
         * Store handles to the currently rendered elements, so we can update them more
         * convenient. Also allows for cleaning up handles.
         * @type {Array<{
         *  key: string,
         *  definition: ShapeDefinition,
         *  amountLabel: HTMLElement,
         *  lastRenderedValue: string,
         *  element: HTMLElement,
         *  detector?: ClickDetector,
         *  infoDetector?: ClickDetector,
         *  throughputOnly?: boolean
         * }>}
         */
        this.handles = [];
    }

    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_PinnedShapes", []);
    }

    /**
     * Serializes the pinned shapes
     */
    serialize() {
        return {
            shapes: this.pinnedShapes,
        };
    }

    /**
     * Deserializes the pinned shapes
     * @param {{ shapes: Array<string>}} data
     */
    deserialize(data) {
        if (!data || !data.shapes || !Array.isArray(data.shapes)) {
            return "Invalid pinned shapes data: " + JSON.stringify(data);
        }
        this.pinnedShapes = data.shapes;
    }

    /**
     * Initializes the hud component
     */
    initialize() {
        // Connect to any relevant signals
        this.root.signals.storyGoalCompleted.add(this.rerenderFull, this);
        this.root.signals.upgradePurchased.add(this.updateShapesAfterUpgrade, this);
        this.root.signals.postLoadHook.add(this.rerenderFull, this);
        this.root.hud.signals.shapePinRequested.add(this.pinNewShape, this);
        this.root.hud.signals.shapeUnpinRequested.add(this.unpinShape, this);

        // Perform initial render
        this.updateShapesAfterUpgrade();
    }

    /**
     * Updates all shapes after an upgrade has been purchased and removes the unused ones
     */
    updateShapesAfterUpgrade() {
        for (let i = 0; i < this.pinnedShapes.length; ++i) {
            const key = this.pinnedShapes[i];
            if (key === this.root.gameMode.getBlueprintShapeKey()) {
                // Ignore blueprint shapes
                continue;
            }
            let goal = this.findGoalValueForShape(key);
            if (!goal) {
                // Seems no longer relevant
                this.pinnedShapes.splice(i, 1);
                i -= 1;
            }
        }

        this.rerenderFull();
    }

    /**
     * Finds the current goal for the given key. If the key is the story goal, returns
     * the story goal. If its the blueprint shape, no goal is returned. Otherwise
     * it's searched for upgrades.
     * @param {string} key
     */
    findGoalValueForShape(key) {
        const goalIndex = this.root.hubGoals.currentGoal.definitions.findIndex(
            goal => goal.shape.getHash() === key
        );
        if (goalIndex > -1) {
            return this.root.hubGoals.currentGoal.definitions[goalIndex].amount;
        }
        if (key === this.root.gameMode.getBlueprintShapeKey()) {
            return null;
        }

        // Check if this shape is required for any upgrade
        const upgrades = this.root.gameMode.getUpgrades();
        for (const upgradeId in upgrades) {
            const upgradeTiers = upgrades[upgradeId];
            const currentTier = this.root.hubGoals.getUpgradeLevel(upgradeId);
            const tierHandle = upgradeTiers[currentTier];

            if (!tierHandle) {
                // Max level
                continue;
            }

            for (let i = 0; i < tierHandle.required.length; ++i) {
                const { shape, amount } = tierHandle.required[i];
                if (shape === key) {
                    return amount;
                }
            }
        }

        return null;
    }

    /**
     * Returns whether a given shape is currently pinned
     * @param {string} key
     */
    isShapePinned(key) {
        const goalIndex = this.root.hubGoals.currentGoal.definitions.findIndex(
            goal => goal.shape.getHash() === key
        );
        if (goalIndex > -1 || key === this.root.gameMode.getBlueprintShapeKey()) {
            // This is a "special" shape which is always pinned
            return true;
        }

        return this.pinnedShapes.indexOf(key) >= 0;
    }

    /**
     * Rerenders the whole component
     */
    rerenderFull() {
        const currentGoal = this.root.hubGoals.currentGoal;

        // First, remove all old shapes
        for (let i = 0; i < this.handles.length; ++i) {
            this.handles[i].element.remove();
            const detector = this.handles[i].detector;
            if (detector) {
                detector.cleanup();
            }
            const infoDetector = this.handles[i].infoDetector;
            if (infoDetector) {
                infoDetector.cleanup();
            }
        }
        this.handles = [];

        // Pin story goal
        for (let i = 0; i < currentGoal.definitions.length; i++) {
            this.internalPinShape({
                key: currentGoal.definitions[i].shape.getHash(),
                canUnpin: false,
                className: "goal",
                throughputOnly: currentGoal.definitions[i].throughputOnly,
            });
        }

        // Pin blueprint shape as well
        if (this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_blueprints)) {
            this.internalPinShape({
                key: this.root.gameMode.getBlueprintShapeKey(),
                canUnpin: false,
                className: "blueprint",
            });
        }

        // Pin manually pinned shapes
        for (let i = 0; i < this.pinnedShapes.length; ++i) {
            const key = this.pinnedShapes[i];
            const goalIndex = currentGoal.definitions.findIndex(goal => goal.shape.getHash() === key);
            if (goalIndex < 0) {
                this.internalPinShape({ key });
            }
        }
    }

    /**
     * Pins a new shape
     * @param {object} param0
     * @param {string} param0.key
     * @param {boolean=} param0.canUnpin
     * @param {string=} param0.className
     * @param {boolean=} param0.throughputOnly
     */
    internalPinShape({ key, canUnpin = true, className = null, throughputOnly = false }) {
        const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(key);

        const element = makeDiv(this.element, null, ["shape"]);
        const canvas = definition.generateAsCanvas(120);
        element.appendChild(canvas);

        if (className) {
            element.classList.add(className);
        }

        let detector = null;
        if (canUnpin) {
            const unpinButton = document.createElement("button");
            unpinButton.classList.add("unpinButton");
            element.appendChild(unpinButton);
            element.classList.add("removable");
            detector = new ClickDetector(unpinButton, {
                consumeEvents: true,
                preventDefault: true,
                targetOnly: true,
            });
            detector.click.add(() => this.unpinShape(key));
        } else {
            element.classList.add("marked");
        }

        // Show small info icon
        const infoButton = document.createElement("button");
        infoButton.classList.add("infoButton");
        element.appendChild(infoButton);
        const infoDetector = new ClickDetector(infoButton, {
            consumeEvents: true,
            preventDefault: true,
            targetOnly: true,
        });
        infoDetector.click.add(() => this.root.hud.signals.viewShapeDetailsRequested.dispatch(definition));

        const amountLabel = makeDiv(element, null, ["amountLabel"], "");

        const goal = this.findGoalValueForShape(key);
        if (goal) {
            makeDiv(element, null, ["goalLabel"], "/" + formatBigNumber(goal));
        }

        this.handles.push({
            key,
            definition,
            element,
            amountLabel,
            lastRenderedValue: "",
            detector,
            infoDetector,
            throughputOnly,
        });
    }

    /**
     * Updates all amount labels
     */
    update() {
        for (let i = 0; i < this.handles.length; ++i) {
            const handle = this.handles[i];

            let currentValue = this.root.hubGoals.getShapesStoredByKey(handle.key);
            let currentValueFormatted = formatBigNumber(currentValue);

            if (handle.throughputOnly) {
                currentValue =
                    this.root.productionAnalytics.getCurrentShapeRateRaw(
                        enumAnalyticsDataSource.delivered,
                        handle.definition
                    ) / globalConfig.analyticsSliceDurationSeconds;
                currentValueFormatted = T.ingame.statistics.shapesDisplayUnits.second.replace(
                    "<shapes>",
                    String(currentValue)
                );
            }

            if (currentValueFormatted !== handle.lastRenderedValue) {
                handle.lastRenderedValue = currentValueFormatted;
                handle.amountLabel.innerText = currentValueFormatted;
                const goal = this.findGoalValueForShape(handle.key);
                handle.element.classList.toggle("completed", goal && currentValue > goal);
            }
        }
    }

    /**
     * Unpins a shape
     * @param {string} key
     */
    unpinShape(key) {
        console.log("unpin", key);
        arrayDeleteValue(this.pinnedShapes, key);
        this.rerenderFull();
    }

    /**
     * Requests to pin a new shape
     * @param {ShapeDefinition} definition
     */
    pinNewShape(definition) {
        const key = definition.getHash();
        const goalIndex = this.root.hubGoals.currentGoal.definitions.findIndex(
            goal => goal.shape.getHash() === key
        );
        if (goalIndex > -1) {
            // Can not pin current goal
            return;
        }

        if (key === this.root.gameMode.getBlueprintShapeKey()) {
            // Can not pin the blueprint shape
            return;
        }

        // Check if its already pinned
        if (this.pinnedShapes.indexOf(key) >= 0) {
            return;
        }

        this.pinnedShapes.push(key);
        this.rerenderFull();
    }
}
