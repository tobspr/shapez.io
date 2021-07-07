import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { Vector } from "../../core/vector";
import { ConstantSignalComponent } from "../components/constant_signal";
import { ItemProducerComponent } from "../components/item_producer";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunk } from "../map_chunk";
import { GameRoot } from "../root";

export class ConstantProducerSystem extends GameSystemWithFilter {
    /** @param {GameRoot} root */
    constructor(root) {
        super(root, [ConstantSignalComponent, ItemProducerComponent]);
    }

    update() {
        for (let i = this.allEntitiesArray.length - 1; i >= 0; --i) {
            const entity = this.allEntitiesArray[i];
            const signalComp = entity.components.ConstantSignal;
            const ejectorComp = entity.components.ItemEjector;
            if (!ejectorComp) {
                continue;
            }
            ejectorComp.tryEject(0, signalComp.signal);
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
            const producerComp = contents[i].components.ItemProducer;
            const signalComp = contents[i].components.ConstantSignal;

            if (!producerComp || !signalComp) {
                continue;
            }

            const staticComp = contents[i].components.StaticMapEntity;
            const item = signalComp.signal;

            if (!item) {
                continue;
            }

            const center = staticComp.getTileSpaceBounds().getCenter().toWorldSpace();

            const localOffset = new Vector(0, 1).rotateFastMultipleOf90(staticComp.rotation);
            item.drawItemCenteredClipped(
                center.x + localOffset.x,
                center.y + localOffset.y,
                parameters,
                globalConfig.tileSize * 0.65
            );
        }
    }
}
