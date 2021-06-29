import { BaseHUDPart } from "../base_hud_part";
import { makeDiv } from "../../../core/utils";
import { GameRoot } from "../../root";
import { MinerComponent } from "../../components/miner";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { TrackedState } from "../../../core/tracked_state";
import { cachebust } from "../../../core/cachebust";
import { T } from "../../../translations";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../../components/item_processor";
import { ShapeItem } from "../../items/shape_item";
import { WireComponent } from "../../components/wire";
import { LeverComponent } from "../../components/lever";

// @todo: Make dictionary
const tutorialsByLevel = [
    // Level 1
    [
        // 1.1. place an extractor
        {
            id: "1_1_extractor",
            condition: /** @param {GameRoot} root */ root =>
                root.entityMgr.getAllWithComponent(MinerComponent).length === 0,
        },
        // 1.2. connect to hub
        {
            id: "1_2_conveyor",
            condition: /** @param {GameRoot} root */ root => root.hubGoals.getCurrentGoalDelivered()[0] === 0,
        },
        // 1.3 wait for completion
        {
            id: "1_3_expand",
            condition: () => true,
        },
    ],
    // Level 2
    [
        // 2.1 place a cutter
        {
            id: "2_1_place_cutter",
            condition: /** @param {GameRoot} root */ root =>
                root.entityMgr
                    .getAllWithComponent(ItemProcessorComponent)
                    .filter(e => e.components.ItemProcessor.type === enumItemProcessorTypes.cutter).length ===
                0,
        },
        // 2.2 place trash
        {
            id: "2_2_place_trash",
            condition: /** @param {GameRoot} root */ root =>
                root.entityMgr
                    .getAllWithComponent(ItemProcessorComponent)
                    .filter(e => e.components.ItemProcessor.type === enumItemProcessorTypes.trash).length ===
                0,
        },
        // 2.3 place more cutters
        {
            id: "2_3_more_cutters",
            condition: /** @param {GameRoot} root */ root =>
                root.entityMgr
                    .getAllWithComponent(ItemProcessorComponent)
                    .filter(e => e.components.ItemProcessor.type === enumItemProcessorTypes.cutter).length <
                3,
        },
    ],

    // Level 3
    [
        // 3.1. rectangles
        {
            id: "3_1_rectangles",
            condition: /** @param {GameRoot} root */ root =>
                // 4 miners placed above rectangles and 10 delivered
                root.hubGoals.getCurrentGoalDelivered()[0] < 10 ||
                root.entityMgr.getAllWithComponent(MinerComponent).filter(entity => {
                    const tile = entity.components.StaticMapEntity.origin;
                    const below = root.map.getLowerLayerContentXY(tile.x, tile.y);
                    if (below && below.getItemType() === "shape") {
                        const shape = /** @type {ShapeItem} */ (below).definition.getHash();
                        return shape === "RuRuRuRu";
                    }
                    return false;
                }).length < 4,
        },
    ],

    [], // Level 4
    [], // Level 5
    [], // Level 6
    [], // Level 7
    [], // Level 8
    [], // Level 9
    [], // Level 10
    [], // Level 11
    [], // Level 12
    [], // Level 13
    [], // Level 14
    [], // Level 15
    [], // Level 16
    [], // Level 17
    [], // Level 18
    [], // Level 19
    [], // Level 20

    // Level 21
    [
        // 21.1 place quad painter
        {
            id: "21_1_place_quad_painter",
            condition: /** @param {GameRoot} root */ root =>
                root.entityMgr
                    .getAllWithComponent(ItemProcessorComponent)
                    .filter(e => e.components.ItemProcessor.type === enumItemProcessorTypes.painterQuad)
                    .length === 0,
        },

        // 21.2 switch to wires layer
        {
            id: "21_2_switch_to_wires",
            condition: /** @param {GameRoot} root */ root =>
                root.entityMgr.getAllWithComponent(WireComponent).length < 5,
        },

        // 21.3 place button
        {
            id: "21_3_place_button",
            condition: /** @param {GameRoot} root */ root =>
                root.entityMgr.getAllWithComponent(LeverComponent).length === 0,
        },

        // 21.4 activate button
        {
            id: "21_4_press_button",
            condition: /** @param {GameRoot} root */ root =>
                root.entityMgr.getAllWithComponent(LeverComponent).some(e => !e.components.Lever.toggled),
        },
    ],
];

export class HUDInteractiveTutorial extends BaseHUDPart {
    createElements(parent) {
        this.element = makeDiv(
            parent,
            "ingame_HUD_InteractiveTutorial",
            ["animEven"],
            `
            <strong class="title">${T.ingame.interactiveTutorial.title}</strong>
            `
        );

        this.elementDescription = makeDiv(this.element, null, ["desc"]);
        this.elementGif = makeDiv(this.element, null, ["helperGif"]);
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.element, { trackHover: true });
        this.currentHintId = new TrackedState(this.onHintChanged, this);
    }

    onHintChanged(hintId) {
        this.elementDescription.innerHTML = T.ingame.interactiveTutorial.hints[hintId];
        this.elementGif.style.backgroundImage =
            "url('" + cachebust("res/ui/interactive_tutorial.noinline/" + hintId + ".gif") + "')";
        this.element.classList.toggle("animEven");
        this.element.classList.toggle("animOdd");
    }

    update() {
        // Compute current hint
        const thisLevelHints = tutorialsByLevel[this.root.hubGoals.level - 1];
        let targetHintId = null;

        if (thisLevelHints) {
            for (let i = 0; i < thisLevelHints.length; ++i) {
                const hint = thisLevelHints[i];
                if (hint.condition(this.root)) {
                    targetHintId = hint.id;
                    break;
                }
            }
        }

        this.currentHintId.set(targetHintId);
        this.domAttach.update(!!targetHintId);
    }
}
