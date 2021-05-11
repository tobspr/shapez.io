/* typehints:start */
import { GameRoot } from "./root";
/* typehints:end */

import { createLogger } from "../core/logging";
import { BeltSystem } from "./systems/belt";
import { ItemEjectorSystem } from "./systems/item_ejector";
import { MapResourcesSystem } from "./systems/map_resources";
import { MinerSystem } from "./systems/miner";
import { ItemProcessorSystem } from "./systems/item_processor";
import { UndergroundBeltSystem } from "./systems/underground_belt";
import { HubSystem } from "./systems/hub";
import { StaticMapEntitySystem } from "./systems/static_map_entity";
import { ItemAcceptorSystem } from "./systems/item_acceptor";
import { StorageSystem } from "./systems/storage";
import { WiredPinsSystem } from "./systems/wired_pins";
import { BeltUnderlaysSystem } from "./systems/belt_underlays";
import { WireSystem } from "./systems/wire";
import { ConstantSignalSystem } from "./systems/constant_signal";
import { LogicGateSystem } from "./systems/logic_gate";
import { LeverSystem } from "./systems/lever";
import { DisplaySystem } from "./systems/display";
import { ItemProcessorOverlaysSystem } from "./systems/item_processor_overlays";
import { BeltReaderSystem } from "./systems/belt_reader";
import { FilterSystem } from "./systems/filter";
import { ItemProducerSystem } from "./systems/item_producer";
import { ItemAcceptorComponent } from "./components/item_acceptor";
import { GameSystem } from "./game_system";

const logger = createLogger("game_system_manager");

export function addVanillaSystemsToAPI() {
    shapezAPI.ingame["systems"] = [
        // Order is important!

        // IMPORTANT: Item acceptor must be before the belt, because it may not tick after the belt
        // has put in the item into the acceptor animation, otherwise its off

        ItemAcceptorSystem,

        BeltSystem,

        UndergroundBeltSystem,

        MinerSystem,

        StorageSystem,

        ItemProcessorSystem,

        FilterSystem,

        ItemProducerSystem,

        ItemEjectorSystem,

        MapResourcesSystem,

        HubSystem,

        StaticMapEntitySystem,

        WiredPinsSystem,

        BeltUnderlaysSystem,

        ConstantSignalSystem,

        // WIRES section
        LeverSystem,

        // Wires must be before all gate, signal etc logic!
        WireSystem,

        // IMPORTANT: We have 2 phases: In phase 1 we compute the output values of all gates,
        // processors etc. In phase 2 we propagate it through the wires network
        LogicGateSystem,
        BeltReaderSystem,

        DisplaySystem,

        ItemProcessorOverlaysSystem,
    ];

    shapezAPI.ingame["systemsRenderOrderBackground"] = [MapResourcesSystem, BeltUnderlaysSystem, BeltSystem];

    shapezAPI.ingame["systemsRenderOrderDynamic"] = [ItemEjectorSystem, ItemAcceptorSystem, MinerSystem];

    shapezAPI.ingame["systemsRenderOrderStatic"] = [
        StaticMapEntitySystem,
        LeverSystem,
        DisplaySystem,
        StorageSystem,
        ItemProcessorOverlaysSystem,
    ];
    shapezAPI.ingame["systemsRenderOrderForeground"] = [StaticMapEntitySystem];

    shapezAPI.ingame["systemsRenderOrderWires"] = [WireSystem, StaticMapEntitySystem, WiredPinsSystem];
}

export class GameSystemManager {
    /**
     * @param {GameRoot} root
     */
    constructor(root) {
        this.root = root;

        this.systems = {};

        this.systemUpdateOrder = [];

        this.renderOrderForeground = [];
        this.renderOrderBackground = [];
        this.renderOrderDynamic = [];
        this.renderOrderStatic = [];
        this.renderOrderWires = [];

        this.internalInitSystems();
    }

    /**
     * Initializes all systems
     */
    internalInitSystems() {
        const systems = shapezAPI.ingame["systems"];
        for (let i = 0; i < systems.length; i++) {
            const system = systems[i];
            this.systems[system.getId()] = new system(this.root);
            this.systemUpdateOrder.push(system.getId());
        }

        for (let i = 0; i < shapezAPI.ingame["systemsRenderOrderForeground"].length; i++) {
            this.renderOrderForeground.push(shapezAPI.ingame["systemsRenderOrderForeground"][i].getId());
        }
        for (let i = 0; i < shapezAPI.ingame["systemsRenderOrderBackground"].length; i++) {
            this.renderOrderBackground.push(shapezAPI.ingame["systemsRenderOrderBackground"][i].getId());
        }
        for (let i = 0; i < shapezAPI.ingame["systemsRenderOrderDynamic"].length; i++) {
            this.renderOrderDynamic.push(shapezAPI.ingame["systemsRenderOrderDynamic"][i].getId());
        }
        for (let i = 0; i < shapezAPI.ingame["systemsRenderOrderStatic"].length; i++) {
            this.renderOrderStatic.push(shapezAPI.ingame["systemsRenderOrderStatic"][i].getId());
        }
        for (let i = 0; i < shapezAPI.ingame["systemsRenderOrderWires"].length; i++) {
            this.renderOrderWires.push(shapezAPI.ingame["systemsRenderOrderWires"][i].getId());
        }

        logger.log("📦 There are", this.systemUpdateOrder.length, "game systems");
    }

    /**
     * Updates all systems
     */
    update() {
        for (let i = 0; i < this.systemUpdateOrder.length; ++i) {
            const system = this.systems[this.systemUpdateOrder[i]];
            system.update();
        }
    }

    refreshCaches() {
        for (let i = 0; i < this.systemUpdateOrder.length; ++i) {
            const system = this.systems[this.systemUpdateOrder[i]];
            system.refreshCaches();
        }
    }
}
