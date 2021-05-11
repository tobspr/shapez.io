import { globalConfig } from "../../../core/config";
import { formatItemsPerSecond, round2Digits } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { T } from "../../../translations";
import { Entity } from "../../entity";
import { THEME } from "../../theme";
import { BaseHUDPart } from "../base_hud_part";

export class HUDMinerHighlight extends BaseHUDPart {
    initialize() {}

    /**
     *
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     */
    draw(parameters) {
        const mousePos = this.root.app.mousePosition;
        if (!mousePos) {
            // Mouse pos not ready
            return;
        }

        if (this.root.currentLayer !== "regular") {
            // Not within the regular layer
            return;
        }

        if (this.root.camera.getIsMapOverlayActive()) {
            // Not within the map overlay
            return;
        }

        const worldPos = this.root.camera.screenToWorld(mousePos);
        const hoveredTile = worldPos.toTileSpace();

        const contents = this.root.map.getTileContent(hoveredTile, "regular");
        if (!contents) {
            // Empty tile
            return;
        }

        const minerComp = contents.components.Miner;
        if (!minerComp || !minerComp.chainable) {
            // Not a chainable miner
            return;
        }

        const lowerContents = this.root.map.getLowerLayerContentXY(hoveredTile.x, hoveredTile.y);
        if (!lowerContents) {
            // Not connected
            return;
        }

        parameters.context.fillStyle = THEME.map.connectedMiners.overlay;

        const connectedEntities = this.findConnectedMiners(contents);

        for (let i = 0; i < connectedEntities.length; ++i) {
            const entity = connectedEntities[i];
            const staticComp = entity.components.StaticMapEntity;

            parameters.context.beginRoundedRect(
                staticComp.origin.x * globalConfig.tileSize + 5,
                staticComp.origin.y * globalConfig.tileSize + 5,
                globalConfig.tileSize - 10,
                globalConfig.tileSize - 10,
                3
            );
            parameters.context.fill();
        }

        const throughput = round2Digits(connectedEntities.length * this.root.hubGoals.getMinerBaseSpeed());

        const maxThroughput = this.root.hubGoals.getBeltBaseSpeed();

        const tooltipLocation = this.root.camera.screenToWorld(mousePos);

        const scale = (1 / this.root.camera.zoomLevel) * this.root.app.getEffectiveUiScale();

        const isCapped = throughput > maxThroughput;

        // Background
        parameters.context.fillStyle = THEME.map.connectedMiners.background;
        parameters.context.beginRoundedRect(
            tooltipLocation.x + 5 * scale,
            tooltipLocation.y - 3 * scale,
            (isCapped ? 100 : 65) * scale,
            (isCapped ? 45 : 30) * scale,
            2
        );
        parameters.context.fill();

        // Throughput
        parameters.context.fillStyle = THEME.map.connectedMiners.textColor;
        parameters.context.font = "bold " + scale * 10 + "px GameFont";
        parameters.context.fillText(
            formatItemsPerSecond(throughput),
            tooltipLocation.x + 10 * scale,
            tooltipLocation.y + 10 * scale
        );

        // Amount of miners
        parameters.context.globalAlpha = 0.6;
        parameters.context.font = "bold " + scale * 8 + "px GameFont";
        parameters.context.fillText(
            connectedEntities.length === 1
                ? T.ingame.connectedMiners.one_miner
                : T.ingame.connectedMiners.n_miners.replace("<amount>", String(connectedEntities.length)),
            tooltipLocation.x + 10 * scale,
            tooltipLocation.y + 22 * scale
        );

        parameters.context.globalAlpha = 1;

        if (isCapped) {
            parameters.context.fillStyle = THEME.map.connectedMiners.textColorCapped;
            parameters.context.fillText(
                T.ingame.connectedMiners.limited_items.replace(
                    "<max_throughput>",
                    formatItemsPerSecond(maxThroughput)
                ),
                tooltipLocation.x + 10 * scale,
                tooltipLocation.y + 34 * scale
            );
        }
    }

    /**
     * Finds all connected miners to the given entity
     * @param {Entity} entity
     * @param {Set<number>} seenUids Which entities have already been processed
     * @returns {Array<Entity>} The connected miners
     */
    findConnectedMiners(entity, seenUids = new Set()) {
        let results = [];
        const origin = entity.components.StaticMapEntity.origin;

        if (!seenUids.has(entity.uid)) {
            seenUids.add(entity.uid);
            results.push(entity);
        }

        // Check for the miner which we connect to
        const connectedMiner = this.root.systemMgr.systems.miner.findChainedMiner(entity);
        if (connectedMiner && !seenUids.has(connectedMiner.uid)) {
            results.push(connectedMiner);
            seenUids.add(connectedMiner.uid);
            results.push(...this.findConnectedMiners(connectedMiner, seenUids));
        }

        // Search within a 1x1 grid - this assumes miners are always 1x1
        for (let dx = -1; dx <= 1; ++dx) {
            for (let dy = -1; dy <= 1; ++dy) {
                const contents = this.root.map.getTileContent(
                    new Vector(origin.x + dx, origin.y + dy),
                    "regular"
                );
                if (contents) {
                    const minerComp = contents.components.Miner;
                    if (minerComp && minerComp.chainable) {
                        // Found a miner connected to this entity
                        if (!seenUids.has(contents.uid)) {
                            if (this.root.systemMgr.systems.miner.findChainedMiner(contents) === entity) {
                                results.push(contents);
                                seenUids.add(contents.uid);
                                results.push(...this.findConnectedMiners(contents, seenUids));
                            }
                        }
                    }
                }
            }
        }

        return results;
    }
}
