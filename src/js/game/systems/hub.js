import { globalConfig } from "../../core/config";
import { smoothenDpi } from "../../core/dpi_manager";
import { DrawParameters } from "../../core/draw_parameters";
import { drawSpriteClipped } from "../../core/draw_utils";
import { Loader } from "../../core/loader";
import { Rectangle } from "../../core/rectangle";
import { ORIGINAL_SPRITE_SCALE } from "../../core/sprites";
import { formatBigNumber } from "../../core/utils";
import { T } from "../../translations";
import { HubComponent } from "../components/hub";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";

const HUB_SIZE_TILES = 4;
const HUB_SIZE_PIXELS = HUB_SIZE_TILES * globalConfig.tileSize;

export class HubSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [HubComponent]);

        this.hubSprite = Loader.getSprite("sprites/buildings/hub.png");
    }

    /**
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        for (let i = this.allEntitiesArray.length - 1; i >= 0; --i) {
            this.drawEntity(parameters, this.allEntitiesArray[i]);
        }
    }

    update() {
        for (let i = 0; i < this.allEntitiesArray.length; ++i) {
            // Set hub goal
            const entity = this.allEntitiesArray[i];
            const pinsComp = entity.components.WiredPins;
            pinsComp.slots[0].value = this.root.shapeDefinitionMgr.getShapeItemFromDefinition(
                this.root.hubGoals.currentGoal.definition
            );
        }
    }
    /**
     *
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} w
     * @param {number} h
     * @param {number} dpi
     */
    redrawHubBaseTexture(canvas, context, w, h, dpi) {
        // This method is quite ugly, please ignore it!

        context.scale(dpi, dpi);

        const parameters = new DrawParameters({
            context,
            visibleRect: new Rectangle(0, 0, w, h),
            desiredAtlasScale: ORIGINAL_SPRITE_SCALE,
            zoomLevel: dpi * 0.75,
            root: this.root,
        });

        context.clearRect(0, 0, w, h);

        this.hubSprite.draw(context, 0, 0, w, h);

        if (this.root.hubGoals.isEndOfDemoReached()) {
            // End of demo
            context.font = "bold 12px GameFont";
            context.fillStyle = "#fd0752";
            context.textAlign = "center";
            context.fillText(T.buildings.hub.endOfDemo.toUpperCase(), w / 2, h / 2 + 6);
            context.textAlign = "left";

            return;
        }

        const definition = this.root.hubGoals.currentGoal.definition;
        definition.drawCentered(45, 58, parameters, 36);

        const goals = this.root.hubGoals.currentGoal;

        const textOffsetX = 70;
        const textOffsetY = 61;

        if (goals.throughputOnly) {
            // Throughput
            const deliveredText = T.ingame.statistics.shapesDisplayUnits.second.replace(
                "<shapes>",
                formatBigNumber(goals.required)
            );

            context.font = "bold 12px GameFont";
            context.fillStyle = "#64666e";
            context.textAlign = "left";
            context.fillText(deliveredText, textOffsetX, textOffsetY);
        } else {
            // Deliver count
            const delivered = this.root.hubGoals.getCurrentGoalDelivered();
            const deliveredText = "" + formatBigNumber(delivered);

            if (delivered > 9999) {
                context.font = "bold 16px GameFont";
            } else if (delivered > 999) {
                context.font = "bold 20px GameFont";
            } else {
                context.font = "bold 25px GameFont";
            }
            context.fillStyle = "#64666e";
            context.textAlign = "left";
            context.fillText(deliveredText, textOffsetX, textOffsetY);

            // Required
            context.font = "13px GameFont";
            context.fillStyle = "#a4a6b0";
            context.fillText("/ " + formatBigNumber(goals.required), textOffsetX, textOffsetY + 13);
        }

        // Reward
        const rewardText = T.storyRewards[goals.reward].title.toUpperCase();
        if (rewardText.length > 12) {
            context.font = "bold 8px GameFont";
        } else {
            context.font = "bold 10px GameFont";
        }
        context.fillStyle = "#fd0752";
        context.textAlign = "center";

        context.fillText(rewardText, HUB_SIZE_PIXELS / 2, 105);

        // Level "8"
        context.font = "bold 10px GameFont";
        context.fillStyle = "#fff";
        context.fillText("" + this.root.hubGoals.level, 27, 32);

        // "LVL"
        context.textAlign = "center";
        context.fillStyle = "#fff";
        context.font = "bold 6px GameFont";
        context.fillText(T.buildings.hub.levelShortcut, 27, 22);

        // "Deliver"
        context.fillStyle = "#64666e";
        context.font = "bold 10px GameFont";
        context.fillText(T.buildings.hub.deliver.toUpperCase(), HUB_SIZE_PIXELS / 2, 30);

        // "To unlock"
        const unlockText = T.buildings.hub.toUnlock.toUpperCase();
        if (unlockText.length > 15) {
            context.font = "bold 8px GameFont";
        } else {
            context.font = "bold 10px GameFont";
        }
        context.fillText(T.buildings.hub.toUnlock.toUpperCase(), HUB_SIZE_PIXELS / 2, 92);

        context.textAlign = "left";
    }

    /**
     * @param {DrawParameters} parameters
     * @param {Entity} entity
     */
    drawEntity(parameters, entity) {
        const staticComp = entity.components.StaticMapEntity;
        if (!staticComp.shouldBeDrawn(parameters)) {
            return;
        }

        // Deliver count
        const delivered = this.root.hubGoals.getCurrentGoalDelivered();
        const deliveredText = "" + formatBigNumber(delivered);

        const dpi = smoothenDpi(globalConfig.shapesSharpness * parameters.zoomLevel);
        const canvas = parameters.root.buffers.getForKey({
            key: "hub",
            subKey: dpi + "/" + this.root.hubGoals.level + "/" + deliveredText,
            w: globalConfig.tileSize * 4,
            h: globalConfig.tileSize * 4,
            dpi,
            redrawMethod: this.redrawHubBaseTexture.bind(this),
        });

        const extrude = 8;
        drawSpriteClipped({
            parameters,
            sprite: canvas,
            x: staticComp.origin.x * globalConfig.tileSize - extrude,
            y: staticComp.origin.y * globalConfig.tileSize - extrude,
            w: HUB_SIZE_PIXELS + 2 * extrude,
            h: HUB_SIZE_PIXELS + 2 * extrude,
            originalW: HUB_SIZE_PIXELS * dpi,
            originalH: HUB_SIZE_PIXELS * dpi,
        });
    }
}
