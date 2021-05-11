import { gComponentRegistry } from "../core/global_registries";
import { StaticMapEntityComponent } from "./components/static_map_entity";
import { BeltComponent } from "./components/belt";
import { ItemEjectorComponent } from "./components/item_ejector";
import { ItemAcceptorComponent } from "./components/item_acceptor";
import { MinerComponent } from "./components/miner";
import { ItemProcessorComponent } from "./components/item_processor";
import { UndergroundBeltComponent } from "./components/underground_belt";
import { HubComponent } from "./components/hub";
import { StorageComponent } from "./components/storage";
import { WiredPinsComponent } from "./components/wired_pins";
import { BeltUnderlaysComponent } from "./components/belt_underlays";
import { WireComponent } from "./components/wire";
import { ConstantSignalComponent } from "./components/constant_signal";
import { LogicGateComponent } from "./components/logic_gate";
import { LeverComponent } from "./components/lever";
import { WireTunnelComponent } from "./components/wire_tunnel";
import { DisplayComponent } from "./components/display";
import { BeltReaderComponent } from "./components/belt_reader";
import { FilterComponent } from "./components/filter";
import { ItemProducerComponent } from "./components/item_producer";
import { Component } from "./component";

export function addVanillaComponentsToAPI() {
    const components = shapezAPI.ingame["components"];

    /** @typedef {typeof Component[]}*/
    const vanillaComponents = [
        StaticMapEntityComponent,
        BeltComponent,
        ItemEjectorComponent,
        ItemAcceptorComponent,
        MinerComponent,
        ItemProcessorComponent,
        UndergroundBeltComponent,
        HubComponent,
        StorageComponent,
        WiredPinsComponent,
        BeltUnderlaysComponent,
        WireComponent,
        ConstantSignalComponent,
        LogicGateComponent,
        LeverComponent,
        WireTunnelComponent,
        DisplayComponent,
        BeltReaderComponent,
        FilterComponent,
        ItemProducerComponent,
    ];
    // IMPORTANT ^^^^^ UPDATE ENTITY COMPONENT STORAGE AFTERWARDS

    for (let i = 0; i < vanillaComponents.length; i++) {
        components[vanillaComponents[i].getId()] = vanillaComponents[i];
    }
}

export function initComponentRegistry() {
    const components = shapezAPI.ingame["components"];
    for (const componentId in components) {
        if (!components.hasOwnProperty(componentId)) continue;
        const component = components[componentId];
        gComponentRegistry.register(component);
    }

    // Sanity check - If this is thrown, you (=me, lol) forgot to add a new component here

    assert(
        // @ts-ignore
        require.context("./components", false, /.*\.js/i).keys().length <= gComponentRegistry.getNumEntries(),
        "Not all components are registered"
    );

    console.log("📦 There are", gComponentRegistry.getNumEntries(), "components");
}
