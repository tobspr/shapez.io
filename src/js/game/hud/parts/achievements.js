import { InputReceiver } from "../../../core/input_receiver";
import { makeDiv } from "../../../core/utils";
import { ACHIEVEMENTS, HIDDEN_ACHIEVEMENTS } from "../../../platform/achievement_provider";
import { T } from "../../../translations";
import { KeyActionMapper, KEYMAPPINGS } from "../../key_action_mapper";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

export class HUDAchievements extends BaseHUDPart {
    createElements(parent) {
        this.background = makeDiv(parent, "ingame_HUD_Achievements", ["ingameDialog"]);

        // DIALOG Inner / Wrapper
        this.dialogInner = makeDiv(this.background, null, ["dialogInner"]);
        this.title = makeDiv(this.dialogInner, null, ["title"], T.ingame.achievements.title);
        this.closeButton = makeDiv(this.title, null, ["closeButton"]);
        this.trackClicks(this.closeButton, this.close);
        this.contentDiv = makeDiv(this.dialogInner, null, ["content"]);

        this.resetElement = {};

        // Wrapper
        this.resetElement.elem = makeDiv(this.contentDiv, null, ["achievement", "reset", "unlocked"]);

        // Icon
        this.resetElement.icon = makeDiv(this.resetElement.elem, null, ["icon"]);
        this.resetElement.icon.setAttribute("data-icon", "achievements/reset.png");

        // Info
        this.resetElement.info = makeDiv(this.resetElement.elem, null, ["info"]);

        // Title
        this.resetElement.title = makeDiv(
            this.resetElement.info,
            null,
            ["title"],
            T.achievements.reset.title
        );

        // Description
        this.resetElement.description = makeDiv(
            this.resetElement.info,
            null,
            ["description"],
            T.achievements.reset.description
        );

        // Reset button
        this.resetElement.resetButton = document.createElement("button");
        this.resetElement.resetButton.classList.add("reset", "styledButton");
        this.resetElement.resetButton.innerText = T.ingame.achievements.buttonReset;
        this.resetElement.elem.appendChild(this.resetElement.resetButton);
        this.trackClicks(this.resetElement.resetButton, () => {
            const signals = this.root.hud.parts.dialogs.showWarning(
                T.dialogs.resetAchievements.title,
                T.dialogs.resetAchievements.description,
                ["cancel:bad:escape", "ok:good:enter"]
            );
            signals.ok.add(() => {
                for (const achievementKey in ACHIEVEMENTS) {
                    if (!this.root.achievementProxy.provider.collection.map.has(achievementKey))
                        this.root.achievementProxy.provider.collection.lock(ACHIEVEMENTS[achievementKey]);
                }
            });
        });

        this.achievementToElements = {};

        // ACHIEVEMENTS
        for (const achievementKey in ACHIEVEMENTS) {
            const handle = {};

            // Wrapper
            handle.elem = makeDiv(this.contentDiv, null, ["achievement"]);

            // Icon
            handle.icon = makeDiv(handle.elem, null, ["icon"]);
            handle.icon.setAttribute("data-icon", "achievements/" + achievementKey + ".png");

            // Info
            handle.info = makeDiv(handle.elem, null, ["info"]);

            // Title
            const title = makeDiv(handle.info, null, ["title"], T.achievements[achievementKey].title);

            // Description
            handle.elemDescription = makeDiv(
                handle.info,
                null,
                ["description"],
                T.achievements[achievementKey].description
            );

            // Reset button
            handle.resetButton = document.createElement("button");
            handle.resetButton.classList.add("reset", "styledButton");
            handle.resetButton.innerText = T.ingame.achievements.buttonReset;
            handle.elem.appendChild(handle.resetButton);

            this.trackClicks(handle.resetButton, () => {
                this.root.achievementProxy.provider.collection.lock(ACHIEVEMENTS[achievementKey]);
            });

            // Assign handle
            this.achievementToElements[achievementKey] = handle;
        }

        this.hiddenElement = {};
        // Wrapper
        this.hiddenElement.hidden = makeDiv(this.contentDiv, null, ["achievement"]);

        // Icon
        this.hiddenElement.icon = makeDiv(this.hiddenElement.hidden, null, ["icon"]);
        this.hiddenElement.icon.setAttribute("data-icon", "achievements/hidden.png");

        // Info
        this.hiddenElement.info = makeDiv(this.hiddenElement.hidden, null, ["info"]);

        // Title
        this.hiddenElement.title = makeDiv(
            this.hiddenElement.info,
            null,
            ["title"],
            T.achievements.hidden.title
        );

        // Description
        this.hiddenElement.description = makeDiv(
            this.hiddenElement.info,
            null,
            ["description"],
            T.achievements.hidden.description.replace("<amountHidden>", HIDDEN_ACHIEVEMENTS.length + "")
        );
    }

    renderStatus() {
        let unlocked = 0;
        let hidden = 0;
        for (const achievementKey in this.achievementToElements) {
            const handle = this.achievementToElements[achievementKey];

            //Check if user has achievement
            if (!this.root.achievementProxy.provider.collection.map.get(ACHIEVEMENTS[achievementKey])) {
                if (!handle.elem.classList.contains("unlocked")) handle.elem.classList.add("unlocked");
                if (handle.elem.classList.contains("hidden")) handle.elem.classList.remove("hidden");
                unlocked++;
            } else {
                if (handle.elem.classList.contains("unlocked")) handle.elem.classList.remove("unlocked");

                if (HIDDEN_ACHIEVEMENTS.includes(ACHIEVEMENTS[achievementKey])) {
                    if (!handle.elem.classList.contains("hidden")) handle.elem.classList.add("hidden");
                    hidden++;
                }
            }
        }

        this.hiddenElement.description.innerHTML = T.achievements.hidden.description.replace(
            "<amountHidden>",
            hidden + ""
        );

        if (unlocked > 0) {
            if (!this.resetElement.elem.classList.contains("unlocked"))
                this.resetElement.elem.classList.add("unlocked");
        } else if (this.resetElement.elem.classList.contains("unlocked"))
            this.resetElement.elem.classList.remove("unlocked");
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.background, {
            attachClass: "visible",
        });

        this.inputReciever = new InputReceiver("achievements");
        this.keyActionMapper = new KeyActionMapper(this.root, this.inputReciever);

        this.keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuClose).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuOpenAchievements).add(this.close, this);

        this.close();
    }

    cleanup() {
        // Cleanup detectors
        for (const achievementKey in this.achievementToElements) {
            const handle = this.achievementToElements[achievementKey];
        }
    }

    show() {
        this.visible = true;
        this.root.app.inputMgr.makeSureAttachedAndOnTop(this.inputReciever);
    }

    close() {
        this.visible = false;
        this.root.app.inputMgr.makeSureDetached(this.inputReciever);
        this.update();
    }

    update() {
        this.domAttach.update(this.visible);
        if (this.visible) {
            this.renderStatus();
        }
    }

    isBlockingOverlay() {
        return this.visible;
    }
}
