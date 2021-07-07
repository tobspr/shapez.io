import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { clamp, lerp } from "../../core/utils";
import { Vector } from "../../core/vector";
import { GoalAcceptorComponent } from "../components/goal_acceptor";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunk } from "../map_chunk";
import { GameRoot } from "../root";

export class GoalAcceptorSystem extends GameSystemWithFilter {
    /** @param {GameRoot} root */
    constructor(root) {
        super(root, [GoalAcceptorComponent]);

        this.puzzleCompleted = false;
    }

    update() {
        const now = this.root.time.now();

        let allAccepted = true;

        for (let i = this.allEntitiesArray.length - 1; i >= 0; --i) {
            const entity = this.allEntitiesArray[i];
            const goalComp = entity.components.GoalAcceptor;

            if (!goalComp.lastDelivery) {
                allAccepted = false;
                continue;
            }

            if (now - goalComp.lastDelivery.time > goalComp.getRequiredSecondsPerItem()) {
                goalComp.clearItems();
            }

            if (goalComp.currentDeliveredItems < globalConfig.goalAcceptorItemsRequired) {
                allAccepted = false;
            }
        }

        if (
            !this.puzzleCompleted &&
            this.root.gameInitialized &&
            allAccepted &&
            !this.root.gameMode.getIsEditor()
        ) {
            this.root.signals.puzzleComplete.dispatch();
            this.puzzleCompleted = true;
        }
    }

    /**
     *
     * @param {DrawParameters} parameters
     * @param {MapChunk} chunk
     * @returns
     */
    drawChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const goalComp = contents[i].components.GoalAcceptor;

            if (!goalComp) {
                continue;
            }

            const staticComp = contents[i].components.StaticMapEntity;
            const item = goalComp.item;

            const requiredItems = globalConfig.goalAcceptorItemsRequired;

            const fillPercentage = clamp(goalComp.currentDeliveredItems / requiredItems, 0, 1);

            const center = staticComp.getTileSpaceBounds().getCenter().toWorldSpace();
            if (item) {
                const localOffset = new Vector(0, -1.8).rotateFastMultipleOf90(staticComp.rotation);
                item.drawItemCenteredClipped(
                    center.x + localOffset.x,
                    center.y + localOffset.y,
                    parameters,
                    globalConfig.tileSize * 0.65
                );
            }

            const isValid = item && goalComp.currentDeliveredItems >= requiredItems;

            parameters.context.translate(center.x, center.y);
            parameters.context.rotate((staticComp.rotation / 180) * Math.PI);

            parameters.context.lineWidth = 1;
            parameters.context.fillStyle = "#8de255";
            parameters.context.strokeStyle = "#64666e";
            parameters.context.lineCap = "round";

            // progress arc

            goalComp.displayPercentage = lerp(goalComp.displayPercentage, fillPercentage, 0.2);

            const startAngle = Math.PI * 0.595;
            const maxAngle = Math.PI * 1.82;
            parameters.context.beginPath();
            parameters.context.arc(
                0.25,
                -1.5,
                11.6,
                startAngle,
                startAngle + goalComp.displayPercentage * maxAngle,
                false
            );
            parameters.context.arc(
                0.25,
                -1.5,
                15.5,
                startAngle + goalComp.displayPercentage * maxAngle,
                startAngle,
                true
            );
            parameters.context.closePath();
            parameters.context.fill();
            parameters.context.stroke();
            parameters.context.lineCap = "butt";

            // LED indicator

            parameters.context.lineWidth = 1.2;
            parameters.context.strokeStyle = "#64666e";
            parameters.context.fillStyle = isValid ? "#8de255" : "#ff666a";
            parameters.context.beginCircle(10, 11.8, 5);
            parameters.context.fill();
            parameters.context.stroke();

            parameters.context.rotate((-staticComp.rotation / 180) * Math.PI);
            parameters.context.translate(-center.x, -center.y);
        }
    }
}
