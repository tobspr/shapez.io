import { THIRDPARTY_URLS } from "../../../core/config";
import { makeDiv } from "../../../core/utils";
import { T } from "../../../translations";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

const watermarkShowIntervalSeconds = G_IS_DEV ? 120 : 7 * 60;
const watermarkShowDuration = 5;

export class HUDWatermark extends BaseHUDPart {
    createElements(parent) {
        this.element = makeDiv(
            parent,
            "ingame_HUD_Watermark",
            [],
            `
            <strong>${T.ingame.watermark.title}</strong>
            <p>${T.ingame.watermark.desc}</p>
        `
        );

        this.linkElement = makeDiv(
            parent,
            "ingame_HUD_WatermarkClicker",
            [],
            T.ingame.watermark.get_on_steam
        );
        this.trackClicks(this.linkElement, () => {
            this.root.app.analytics.trackUiClick("watermark_click_2_direct");
            this.root.app.platformWrapper.openExternalLink(THIRDPARTY_URLS.standaloneStorePage + "?ref=wtmd");
        });
    }

    initialize() {
        this.trackClicks(this.element, this.onWatermarkClick);

        this.domAttach = new DynamicDomAttach(this.root, this.element, {
            attachClass: "visible",
            timeToKeepSeconds: 0.5,
        });
    }

    update() {
        this.domAttach.update(
            this.root.time.realtimeNow() % watermarkShowIntervalSeconds < watermarkShowDuration
        );
    }

    onWatermarkClick() {
        this.root.app.analytics.trackUiClick("watermark_click_2_new");
        this.root.hud.parts.standaloneAdvantages.show();
    }

    /**
     *
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     */
    drawOverlays(parameters) {
        const w = this.root.gameWidth;

        parameters.context.fillStyle = "rgba(230, 230, 230, 0.9)";
        parameters.context.font = "bold " + this.root.app.getEffectiveUiScale() * 40 + "px GameFont";
        parameters.context.textAlign = "center";
        parameters.context.fillText(
            T.demoBanners.title.toUpperCase(),
            w / 2,
            this.root.app.getEffectiveUiScale() * 50
        );

        parameters.context.textAlign = "left";
    }
}
