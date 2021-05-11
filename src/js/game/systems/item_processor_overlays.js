import { globalConfig } from "../../core/config";
import { Loader } from "../../core/loader";
import { round1DigitLocalized, smoothPulse } from "../../core/utils";
import { enumItemProcessorRequirements, enumItemProcessorTypes } from "../components/item_processor";
import { Entity } from "../entity";
import { GameSystem } from "../game_system";
import { isTruthyItem } from "../items/boolean_item";
import { MapChunkView } from "../map_chunk_view";

export class ItemProcessorOverlaysSystem extends GameSystem {
    constructor(root) {
        super(root);

        this.spriteDisabled = Loader.getSprite("sprites/misc/processor_disabled.png");
        this.spriteDisconnected = Loader.getSprite("sprites/misc/processor_disconnected.png");

        this.readerOverlaySprite = Loader.getSprite("sprites/misc/reader_overlay.png");

        this.drawnUids = new Set();
        this.root.signals.gameFrameStarted.add(this.clearDrawnUids, this);
    }

    static getId() {
        return "itemProcessorOverlays";
    }

    clearDrawnUids() {
        this.drawnUids.clear();
    }

    /**
     *
     * @param {import("../../core/draw_parameters").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk_ForegroundStaticLayer(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const processorComp = entity.components.ItemProcessor;
            const filterComp = entity.components.Filter;

            // Draw processor overlays
            if (processorComp) {
                const requirement = processorComp.processingRequirement;
                if (!requirement && processorComp.type !== enumItemProcessorTypes.reader) {
                    continue;
                }

                if (this.drawnUids.has(entity.uid)) {
                    continue;
                }
                this.drawnUids.add(entity.uid);

                if (ItemProcessorOverlaysSystem.processorOverlayStatic[requirement])
                    ItemProcessorOverlaysSystem.processorOverlayStatic[requirement].bind(this)(
                        parameters,
                        chunk,
                        entity,
                        processorComp
                    );

                if (processorComp.type === enumItemProcessorTypes.reader) {
                    this.drawReaderOverlays(parameters, entity);
                }
            }

            // Draw filter overlays
            else if (filterComp) {
                if (this.drawnUids.has(entity.uid)) {
                    continue;
                }
                this.drawnUids.add(entity.uid);

                this.drawConnectedSlotRequirement(parameters, entity, { drawIfFalse: false });
            }
        }
    }

    /**
     *
     * @param {import("../../core/draw_parameters").DrawParameters} parameters
     * @param {Entity} entity
     */
    drawReaderOverlays(parameters, entity) {
        const staticComp = entity.components.StaticMapEntity;
        const readerComp = entity.components.BeltReader;

        this.readerOverlaySprite.drawCachedCentered(
            parameters,
            (staticComp.origin.x + 0.5) * globalConfig.tileSize,
            (staticComp.origin.y + 0.5) * globalConfig.tileSize,
            globalConfig.tileSize
        );

        parameters.context.fillStyle = "#333439";
        parameters.context.textAlign = "center";
        parameters.context.font = "bold 10px GameFont";
        parameters.context.fillText(
            round1DigitLocalized(readerComp.lastThroughput),
            (staticComp.origin.x + 0.5) * globalConfig.tileSize,
            (staticComp.origin.y + 0.62) * globalConfig.tileSize
        );

        parameters.context.textAlign = "left";
    }

    /**
     *
     * @param {import("../../core/draw_parameters").DrawParameters} parameters
     * @param {Entity} entity
     * @param {object} param0
     * @param {boolean=} param0.drawIfFalse
     */
    drawConnectedSlotRequirement(parameters, entity, { drawIfFalse = true }) {
        const staticComp = entity.components.StaticMapEntity;
        const pinsComp = entity.components.WiredPins;

        let anySlotConnected = false;

        // Check if any slot has a value
        for (let i = 0; i < pinsComp.slots.length; ++i) {
            const slot = pinsComp.slots[i];
            const network = slot.linkedNetwork;
            if (network && network.hasValue()) {
                anySlotConnected = true;

                if (isTruthyItem(network.currentValue) || !drawIfFalse) {
                    // No need to draw anything
                    return;
                }
            }
        }

        const pulse = smoothPulse(this.root.time.now());
        parameters.context.globalAlpha = 0.6 + 0.4 * pulse;
        const sprite = anySlotConnected ? this.spriteDisabled : this.spriteDisconnected;
        sprite.drawCachedCentered(
            parameters,
            (staticComp.origin.x + 0.5) * globalConfig.tileSize,
            (staticComp.origin.y + 0.5) * globalConfig.tileSize,
            globalConfig.tileSize * (0.7 + 0.2 * pulse)
        );

        parameters.context.globalAlpha = 1;
    }
}

ItemProcessorOverlaysSystem.processorOverlayStatic = {
    [enumItemProcessorRequirements.painterQuad]: function (parameters, chunk, entity, processorComp) {
        this.drawConnectedSlotRequirement(parameters, entity, { drawIfFalse: true });
    },
};
