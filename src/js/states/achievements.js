import { TextualGameState } from "../core/textual_game_state";
import { makeDiv } from "../core/utils";
import { ACHIEVEMENTS, HIDDEN_ACHIEVEMENTS } from "../platform/achievement_provider";
import { T } from "../translations";

export class AchievementsState extends TextualGameState {
    constructor() {
        super("AchievementsState");
    }

    getStateHeaderTitle() {
        return T.ingame.achievements.title;
    }

    onEnter(payload) {
        this.app.achievementProvider.unlockUnlocked();

        this.parent = makeDiv(document.querySelector(".content.mainContent"), "ingame_HUD_Achievements", [
            "ingameDialog",
        ]);
        this.contentDiv = makeDiv(this.parent, null, ["content"]);

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

    onRender(dt) {
        let unlocked = 0;
        let hidden = 0;
        for (const achievementKey in this.achievementToElements) {
            const handle = this.achievementToElements[achievementKey];

            //Check if user has achievement
            if (!this.app.achievementProvider.collection.map.get(ACHIEVEMENTS[achievementKey])) {
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
    }
}
