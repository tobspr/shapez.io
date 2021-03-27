import { makeDiv } from "../../../core/utils";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { enumNotificationType } from "./notifications";
import { ShapeDefinition } from "../../shape_definition";
import { DialogWithForm } from "../../../core/modal_dialog_elements";
import { FormElementInput, FormElementItemChooser } from "../../../core/modal_dialog_forms";
import { HubGoals } from "../../hub_goals";

export class HUDSandboxController extends BaseHUDPart {
    createElements(parent) {
        this.element = makeDiv(
            parent,
            "ingame_HUD_SandboxController",
            [],
            `
            <label>Sandbox Options</label>
            <span class="sandboxHint">Use F6 to toggle this overlay</span>

            <div class="buttons">
                <div class="levelToggle plusMinus">
                    <label>Level</label>
                    <button class="styledButton reset">⮂</button>
                    <button class="styledButton minus">-</button>
                    <button class="styledButton plus">+</button>
                </div>
                
                <div class="upgradesBelt plusMinus">
                    <label>&rarr; Belts</label>
                    <button class="styledButton reset">⮂</button>
                    <button class="styledButton minus">-</button>
                    <button class="styledButton plus">+</button>
                </div>
                
                <div class="upgradesExtraction plusMinus">
                    <label>&rarr; Extraction</label>
                    <button class="styledButton reset">⮂</button>
                    <button class="styledButton minus">-</button>
                    <button class="styledButton plus">+</button>
                </div>
                
                <div class="upgradesProcessing plusMinus">
                    <label>&rarr; Processing</label>
                    <button class="styledButton reset">⮂</button>
                    <button class="styledButton minus">-</button>
                    <button class="styledButton plus">+</button>
                </div>
                
                <div class="upgradesPainting plusMinus">
                    <label>&rarr; Painting</label>
                    <button class="styledButton reset">⮂</button>
                    <button class="styledButton minus">-</button>
                    <button class="styledButton plus">+</button>
                </div>

                <div class="additionalOptions">
                    <div class="bigPlusMinus">
                        <button class="styledButton levelOverride">Override</button>
                        <button class="styledButton levelUp">Level up</button> 
                    </div>
                    <div class="bigPlusMinus">
                        <button class="styledButton bigMinus">-100 All</button>
                        <button class="styledButton bigPlus">+100 All</button> 
                    </div>
                    <button class="styledButton giveBlueprints">Fill blueprint shapes</button>
                </div>
            </div>
        `
        );

        const bind = (selector, handler) => this.trackClicks(this.element.querySelector(selector), handler);

        bind(".levelOverride", this.promptOverrideLevel);
        bind(".levelUp", this.tryLevelUp);
        bind(".bigMinus", () => this.modifyAll(-100));
        bind(".bigPlus", () => this.modifyAll(100));
        bind(".giveBlueprints", this.giveBlueprints);

        bind(".levelToggle .reset", this.resetLevel);
        bind(".levelToggle .minus", () => this.modifyLevel(-1));
        bind(".levelToggle .plus", () => this.modifyLevel(1));

        bind(".upgradesBelt .reset", () => this.resetUpgrade("belt"));
        bind(".upgradesBelt .minus", () => this.modifyUpgrade("belt", -1));
        bind(".upgradesBelt .plus", () => this.modifyUpgrade("belt", 1));

        bind(".upgradesExtraction .reset", () => this.resetUpgrade("miner"));
        bind(".upgradesExtraction .minus", () => this.modifyUpgrade("miner", -1));
        bind(".upgradesExtraction .plus", () => this.modifyUpgrade("miner", 1));

        bind(".upgradesProcessing .reset", () => this.resetUpgrade("processors"));
        bind(".upgradesProcessing .minus", () => this.modifyUpgrade("processors", -1));
        bind(".upgradesProcessing .plus", () => this.modifyUpgrade("processors", 1));

        bind(".upgradesPainting .reset", () => this.resetUpgrade("painting"));
        bind(".upgradesPainting .minus", () => this.modifyUpgrade("painting", -1));
        bind(".upgradesPainting .plus", () => this.modifyUpgrade("painting", 1));
    }

    giveBlueprints() {
        const shape = this.root.gameMode.getBlueprintShapeKey();
        if (!this.root.hubGoals.storedShapes[shape]) {
            this.root.hubGoals.storedShapes[shape] = 0;
        }
        this.root.hubGoals.storedShapes[shape] += 1e9;
    }

    modifyAll(amount) {
        this.modifyUpgrade("belt", amount);
        this.modifyUpgrade("miner", amount);
        this.modifyUpgrade("processors", amount);
        this.modifyUpgrade("painting", amount);
    }

    resetUpgrade(id) {
        const maxLevel = this.root.gameMode.getUpgrades()[id].length;

        if (this.root.hubGoals.upgradeLevels[id] === maxLevel) {
            this.modifyUpgrade(id, -this.root.hubGoals.upgradeLevels[id]);
        } else {
            this.modifyUpgrade(id, maxLevel - this.root.hubGoals.upgradeLevels[id]);
        }
    }

    modifyUpgrade(id, amount) {
        const upgradeTiers = this.root.gameMode.getUpgrades()[id];
        const maxLevel = upgradeTiers.length;

        this.root.hubGoals.upgradeLevels[id] = Math.max(
            0,
            Math.min(maxLevel, (this.root.hubGoals.upgradeLevels[id] || 0) + amount)
        );

        // Compute improvement
        let improvement = 1;
        for (let i = 0; i < this.root.hubGoals.upgradeLevels[id]; ++i) {
            improvement += upgradeTiers[i].improvement;
        }
        this.root.hubGoals.upgradeImprovements[id] = improvement;
        this.root.signals.upgradePurchased.dispatch(id);
        this.root.hud.signals.notification.dispatch(
            "Upgrade '" + id + "' is now at tier " + (this.root.hubGoals.upgradeLevels[id] + 1),
            enumNotificationType.upgrade
        );
    }

    resetLevel(a) {
        const level = this.root.hubGoals.level;
        const levelCount = this.root.gameMode.getLevelDefinitions().length;
        if (level === levelCount + 1) {
            this.modifyLevel(1 - level);
        } else {
            this.modifyLevel(levelCount + 1 - level);
        }
    }

    modifyLevel(amount) {
        const hubGoals = this.root.hubGoals;
        hubGoals.level = Math.max(1, hubGoals.level + amount);
        hubGoals.computeNextGoal();

        // Clear all shapes of this level
        hubGoals.storedShapes[hubGoals.currentGoal.definition.getHash()] = 0;

        // Compute gained rewards
        hubGoals.gainedRewards = {};
        const levels = this.root.gameMode.getLevelDefinitions();
        for (let i = 0; i < hubGoals.level - 1; ++i) {
            if (i < levels.length) {
                const reward = levels[i].reward;
                hubGoals.gainedRewards[reward] = (hubGoals.gainedRewards[reward] || 0) + 1;
            }
        }

        this.root.buffers.cache.get("hub") && this.root.buffers.cache.get("hub").clear();
        this.root.hud.parts.pinnedShapes.rerenderFull();

        this.root.hud.signals.notification.dispatch(
            "Changed level to " + hubGoals.level,
            enumNotificationType.upgrade
        );
    }

    promptOverrideLevel() {
        const signalValueInput = new FormElementInput({
            id: "signalValue",
            label: null,
            placeholder: "",
            defaultValue: "",
            validator: val => ShapeDefinition.isValidShortKey(val),
        });

        const dialog = new DialogWithForm({
            app: this.root.app,
            title: "Override Level",
            desc: "Enter a shape to override with:",
            formElements: [signalValueInput],
            buttons: ["cancel:bad:escape", "ok:good:enter"],
            closeButton: false,
        });
        this.root.hud.parts.dialogs.internalShowDialog(dialog);

        dialog.buttonSignals.ok.add(() => this.overrideLevel(signalValueInput.getValue()));
    }

    overrideLevel(shape) {
        const hubGoals = this.root.hubGoals;
        hubGoals.currentGoal.definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(shape);

        hubGoals.storedShapes[hubGoals.currentGoal.definition.getHash()] = 0;

        this.root.buffers.cache.get("hub") && this.root.buffers.cache.get("hub").clear();
        this.root.hud.parts.pinnedShapes.rerenderFull();

        this.root.hud.signals.notification.dispatch(
            "Overrode level to " + hubGoals.currentGoal.definition.getHash(),
            enumNotificationType.upgrade
        );
    }

    tryLevelUp() {
        if (!this.root.hubGoals.isEndOfDemoReached()) {
            this.root.hubGoals.onGoalCompleted();
        }
    }

    initialize() {
        // Allow toggling the controller overlay
        this.root.gameState.inputReciever.keydown.add(key => {
            if (key.keyCode === 117) {
                // F6
                this.toggle();
            }
        });

        this.visible = !G_IS_DEV;
        this.domAttach = new DynamicDomAttach(this.root, this.element);
    }

    toggle() {
        this.visible = !this.visible;
    }

    update() {
        this.domAttach.update(this.visible);
    }
}
