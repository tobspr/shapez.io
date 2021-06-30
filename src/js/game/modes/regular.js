/* typehints:start */
import { GameRoot } from "../root";
import { MetaBuilding } from "../meta_building";
/* typehints:end */

import { findNiceIntegerValue } from "../../core/utils";
import { MetaConstantProducerBuilding } from "../buildings/constant_producer";
import { MetaGoalAcceptorBuilding } from "../buildings/goal_acceptor";
import { enumGameModeIds, enumGameModeTypes, GameMode } from "../game_mode";
import { ShapeDefinition } from "../shape_definition";
import { enumHubGoalRewards } from "../tutorial_goals";
import { HUDWiresToolbar } from "../hud/parts/wires_toolbar";
import { HUDUnlockNotification } from "../hud/parts/unlock_notification";
import { HUDMassSelector } from "../hud/parts/mass_selector";
import { HUDShop } from "../hud/parts/shop";
import { HUDWaypoints } from "../hud/parts/waypoints";
import { HUDStatistics } from "../hud/parts/statistics";
import { HUDWireInfo } from "../hud/parts/wire_info";
import { HUDLeverToggle } from "../hud/parts/lever_toggle";
import { HUDPinnedShapes } from "../hud/parts/pinned_shapes";
import { HUDNotifications } from "../hud/parts/notifications";
import { HUDScreenshotExporter } from "../hud/parts/screenshot_exporter";
import { HUDWiresOverlay } from "../hud/parts/wires_overlay";
import { HUDShapeViewer } from "../hud/parts/shape_viewer";
import { HUDLayerPreview } from "../hud/parts/layer_preview";
import { HUDTutorialVideoOffer } from "../hud/parts/tutorial_video_offer";
import { HUDMinerHighlight } from "../hud/parts/miner_highlight";
import { HUDGameMenu } from "../hud/parts/game_menu";
import { HUDConstantSignalEdit } from "../hud/parts/constant_signal_edit";
import { IS_MOBILE } from "../../core/config";
import { HUDKeybindingOverlay } from "../hud/parts/keybinding_overlay";
import { HUDWatermark } from "../hud/parts/watermark";
import { HUDStandaloneAdvantages } from "../hud/parts/standalone_advantages";
import { HUDCatMemes } from "../hud/parts/cat_memes";
import { HUDPartTutorialHints } from "../hud/parts/tutorial_hints";
import { HUDInteractiveTutorial } from "../hud/parts/interactive_tutorial";
import { HUDSandboxController } from "../hud/parts/sandbox_controller";
import { queryParamOptions } from "../../core/query_parameters";
import { MetaBlockBuilding } from "../buildings/block";
import { MetaItemProducerBuilding } from "../buildings/item_producer";

/** @typedef {{
 *   shape: string,
 *   amount: number
 * }} UpgradeRequirement */

/** @typedef {{
 *   required: Array<UpgradeRequirement>
 *   improvement?: number,
 *   excludePrevious?: boolean
 * }} TierRequirement */

/** @typedef {Array<TierRequirement>} UpgradeTiers */

/** @typedef {{
 *   shape: string,
 *   required: number,
 *   reward: enumHubGoalRewards,
 *   throughputOnly?: boolean
 * }} LevelDefinition */

export const rocketShape = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw";
export const finalGameShape = "RuCw--Cw:----Ru--";
const preparementShape = "CpRpCp--:SwSwSwSw";

// Tiers need % of the previous tier as requirement too
const tierGrowth = 2.5;

const chinaShapes = G_WEGAME_VERSION || G_CHINA_VERSION;

/**
 * Generates all upgrades
 * @returns {Object<string, UpgradeTiers>} */
function generateUpgrades(limitedVersion = false) {
    const fixedImprovements = [0.5, 0.5, 1, 1, 2, 1, 1];
    const numEndgameUpgrades = limitedVersion ? 0 : 1000 - fixedImprovements.length - 1;

    function generateInfiniteUnlocks() {
        return new Array(numEndgameUpgrades).fill(null).map((_, i) => ({
            required: [
                { shape: preparementShape, amount: 30000 + i * 10000 },
                { shape: finalGameShape, amount: 20000 + i * 5000 },
                { shape: rocketShape, amount: 20000 + i * 5000 },
            ],
            excludePrevious: true,
        }));
    }

    // Fill in endgame upgrades
    for (let i = 0; i < numEndgameUpgrades; ++i) {
        if (i < 20) {
            fixedImprovements.push(0.1);
        } else if (i < 50) {
            fixedImprovements.push(0.05);
        } else if (i < 100) {
            fixedImprovements.push(0.025);
        } else {
            fixedImprovements.push(0.0125);
        }
    }

    const upgrades = {
        belt: [
            {
                required: [{ shape: "CuCuCuCu", amount: 30 }],
            },
            {
                required: [{ shape: "--CuCu--", amount: 500 }],
            },
            {
                required: [{ shape: "CpCpCpCp", amount: 1000 }],
            },
            {
                required: [{ shape: "SrSrSrSr:CyCyCyCy", amount: 6000 }],
            },
            {
                required: [{ shape: "SrSrSrSr:CyCyCyCy:SwSwSwSw", amount: 25000 }],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],

        miner: [
            {
                required: [{ shape: "RuRuRuRu", amount: 300 }],
            },
            {
                required: [{ shape: "Cu------", amount: 800 }],
            },
            {
                required: [{ shape: "ScScScSc", amount: 3500 }],
            },
            {
                required: [{ shape: "CwCwCwCw:WbWbWbWb", amount: 23000 }],
            },
            {
                required: [
                    {
                        shape: chinaShapes
                            ? "CyCyCyCy:CyCyCyCy:RyRyRyRy:RuRuRuRu"
                            : "CbRbRbCb:CwCwCwCw:WbWbWbWb",
                        amount: 50000,
                    },
                ],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],

        processors: [
            {
                required: [{ shape: "SuSuSuSu", amount: 500 }],
            },
            {
                required: [{ shape: "RuRu----", amount: 600 }],
            },
            {
                required: [{ shape: "CgScScCg", amount: 3500 }],
            },
            {
                required: [{ shape: "CwCrCwCr:SgSgSgSg", amount: 25000 }],
            },
            {
                required: [{ shape: "WrRgWrRg:CwCrCwCr:SgSgSgSg", amount: 50000 }],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],

        painting: [
            {
                required: [{ shape: "RbRb----", amount: 600 }],
            },
            {
                required: [{ shape: "WrWrWrWr", amount: 3800 }],
            },
            {
                required: [
                    {
                        shape: chinaShapes ? "CuCuCuCu:CwCwCwCw:Sb--Sr--" : "RpRpRpRp:CwCwCwCw",
                        amount: 6500,
                    },
                ],
            },
            {
                required: [{ shape: "WpWpWpWp:CwCwCwCw:WpWpWpWp", amount: 25000 }],
            },
            {
                required: [{ shape: "WpWpWpWp:CwCwCwCw:WpWpWpWp:CwCwCwCw", amount: 50000 }],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],
    };

    // Automatically generate tier levels
    for (const upgradeId in upgrades) {
        const upgradeTiers = upgrades[upgradeId];

        let currentTierRequirements = [];
        for (let i = 0; i < upgradeTiers.length; ++i) {
            const tierHandle = upgradeTiers[i];
            tierHandle.improvement = fixedImprovements[i];
            const originalRequired = tierHandle.required.slice();

            for (let k = currentTierRequirements.length - 1; k >= 0; --k) {
                const oldTierRequirement = currentTierRequirements[k];
                if (!tierHandle.excludePrevious) {
                    tierHandle.required.unshift({
                        shape: oldTierRequirement.shape,
                        amount: oldTierRequirement.amount,
                    });
                }
            }
            currentTierRequirements.push(
                ...originalRequired.map(req => ({
                    amount: req.amount,
                    shape: req.shape,
                }))
            );
            currentTierRequirements.forEach(tier => {
                tier.amount = findNiceIntegerValue(tier.amount * tierGrowth);
            });
        }
    }

    // VALIDATE
    if (G_IS_DEV) {
        for (const upgradeId in upgrades) {
            upgrades[upgradeId].forEach(tier => {
                tier.required.forEach(({ shape }) => {
                    try {
                        ShapeDefinition.fromShortKey(shape);
                    } catch (ex) {
                        throw new Error("Invalid upgrade goal: '" + ex + "' for shape" + shape);
                    }
                });
            });
        }
    }

    return upgrades;
}

/**
 * Generates the level definitions
 * @param {boolean} limitedVersion
 */
export function generateLevelDefinitions(limitedVersion = false) {
    const levelDefinitions = [
        // 1
        // Circle
        {
            shape: "CuCuCuCu", // belts t1
            required: 30,
            reward: enumHubGoalRewards.reward_cutter_and_trash,
        },

        // 2
        // Cutter
        {
            shape: "----CuCu", //
            required: 40,
            reward: enumHubGoalRewards.no_reward,
        },

        // 3
        // Rectangle
        {
            shape: "RuRuRuRu", // miners t1
            required: 70,
            reward: enumHubGoalRewards.reward_balancer,
        },

        // 4
        {
            shape: "RuRu----", // processors t2
            required: 70,
            reward: enumHubGoalRewards.reward_rotater,
        },

        // 5
        // Rotater
        {
            shape: "Cu----Cu", // belts t2
            required: 170,
            reward: enumHubGoalRewards.reward_tunnel,
        },

        // 6
        {
            shape: "Cu------", // miners t2
            required: 270,
            reward: enumHubGoalRewards.reward_painter,
        },

        // 7
        // Painter
        {
            shape: "CrCrCrCr", // unused
            required: 300,
            reward: enumHubGoalRewards.reward_rotater_ccw,
        },

        // DEMO STOPS HERE
        ...(limitedVersion
            ? [
                  {
                      shape: "CrCrCrCr",
                      required: 0,
                      reward: enumHubGoalRewards.reward_demo_end,
                  },
              ]
            : [
                  // 8
                  {
                      shape: "RbRb----", // painter t2
                      required: 480,
                      reward: enumHubGoalRewards.reward_mixer,
                  },

                  // 9
                  // Mixing (purple)
                  {
                      shape: "CpCpCpCp", // belts t3
                      required: 600,
                      reward: enumHubGoalRewards.reward_merger,
                  },

                  // 10
                  // STACKER: Star shape + cyan
                  {
                      shape: "ScScScSc", // miners t3
                      required: 800,
                      reward: enumHubGoalRewards.reward_stacker,
                  },

                  // 11
                  // Chainable miner
                  {
                      shape: "CgScScCg", // processors t3
                      required: 1000,
                      reward: enumHubGoalRewards.reward_miner_chainable,
                  },

                  // 12
                  // Blueprints
                  {
                      shape: "CbCbCbRb:CwCwCwCw",
                      required: 1000,
                      reward: enumHubGoalRewards.reward_blueprints,
                  },

                  // 13
                  // Tunnel Tier 2
                  {
                      shape: chinaShapes ? "CuCuCuCu:CwCwCwCw:Sb--Sr--" : "RpRpRpRp:CwCwCwCw", // painting t3
                      required: 3800,
                      reward: enumHubGoalRewards.reward_underground_belt_tier_2,
                  },

                  // 14
                  // Belt reader
                  {
                      shape: "--Cg----:--Cr----", // unused
                      required: 8, // Per second!
                      reward: enumHubGoalRewards.reward_belt_reader,
                      throughputOnly: true,
                  },

                  // 15
                  // Storage
                  {
                      shape: "SrSrSrSr:CyCyCyCy", // unused
                      required: 10000,
                      reward: enumHubGoalRewards.reward_storage,
                  },

                  // 16
                  // Quad Cutter
                  {
                      shape: "SrSrSrSr:CyCyCyCy:SwSwSwSw", // belts t4 (two variants)
                      required: 6000,
                      reward: enumHubGoalRewards.reward_cutter_quad,
                  },

                  // 17
                  // Double painter
                  {
                      shape: chinaShapes
                          ? "CyCyCyCy:CyCyCyCy:RyRyRyRy:RuRuRuRu"
                          : "CbRbRbCb:CwCwCwCw:WbWbWbWb", // miner t4 (two variants)
                      required: 20000,
                      reward: enumHubGoalRewards.reward_painter_double,
                  },

                  // 18
                  // Rotater (180deg)
                  {
                      shape: "Sg----Sg:CgCgCgCg:--CyCy--", // unused
                      required: 20000,
                      reward: enumHubGoalRewards.reward_rotater_180,
                  },

                  // 19
                  // Compact splitter
                  {
                      shape: "CpRpCp--:SwSwSwSw",
                      required: 25000,
                      reward: enumHubGoalRewards.reward_splitter,
                  },

                  // 20
                  // WIRES
                  {
                      shape: finalGameShape,
                      required: 25000,
                      reward: enumHubGoalRewards.reward_wires_painter_and_levers,
                  },

                  // 21
                  // Filter
                  {
                      shape: "CrCwCrCw:CwCrCwCr:CrCwCrCw:CwCrCwCr",
                      required: 25000,
                      reward: enumHubGoalRewards.reward_filter,
                  },

                  // 22
                  // Constant signal
                  {
                      shape: chinaShapes
                          ? "RrSySrSy:RyCrCwCr:CyCyRyCy"
                          : "Cg----Cr:Cw----Cw:Sy------:Cy----Cy",
                      required: 25000,
                      reward: enumHubGoalRewards.reward_constant_signal,
                  },

                  // 23
                  // Display
                  {
                      shape: chinaShapes
                          ? "CrCrCrCr:CwCwCwCw:WwWwWwWw:CrCrCrCr"
                          : "CcSyCcSy:SyCcSyCc:CcSyCcSy",
                      required: 25000,
                      reward: enumHubGoalRewards.reward_display,
                  },

                  // 24 Logic gates
                  {
                      shape: chinaShapes
                          ? "Su----Su:RwRwRwRw:Cu----Cu:CwCwCwCw"
                          : "CcRcCcRc:RwCwRwCw:Sr--Sw--:CyCyCyCy",
                      required: 25000,
                      reward: enumHubGoalRewards.reward_logic_gates,
                  },

                  // 25 Virtual Processing
                  {
                      shape: "Rg--Rg--:CwRwCwRw:--Rg--Rg",
                      required: 25000,
                      reward: enumHubGoalRewards.reward_virtual_processing,
                  },

                  // 26 Freeplay
                  {
                      shape: "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw",
                      required: 50000,
                      reward: enumHubGoalRewards.reward_freeplay,
                  },
              ]),
    ];

    if (G_IS_DEV) {
        levelDefinitions.forEach(({ shape }) => {
            try {
                ShapeDefinition.fromShortKey(shape);
            } catch (ex) {
                throw new Error("Invalid tutorial goal: '" + ex + "' for shape" + shape);
            }
        });
    }

    return levelDefinitions;
}

const fullVersionUpgrades = generateUpgrades(false);
const demoVersionUpgrades = generateUpgrades(true);

const fullVersionLevels = generateLevelDefinitions(false);
const demoVersionLevels = generateLevelDefinitions(true);

export class RegularGameMode extends GameMode {
    static getId() {
        return enumGameModeIds.regular;
    }

    static getType() {
        return enumGameModeTypes.default;
    }

    /** @param {GameRoot} root */
    constructor(root) {
        super(root);

        this.additionalHudParts = {
            wiresToolbar: HUDWiresToolbar,
            unlockNotification: HUDUnlockNotification,
            massSelector: HUDMassSelector,
            shop: HUDShop,
            statistics: HUDStatistics,
            waypoints: HUDWaypoints,
            wireInfo: HUDWireInfo,
            leverToggle: HUDLeverToggle,
            pinnedShapes: HUDPinnedShapes,
            notifications: HUDNotifications,
            screenshotExporter: HUDScreenshotExporter,
            wiresOverlay: HUDWiresOverlay,
            shapeViewer: HUDShapeViewer,
            layerPreview: HUDLayerPreview,
            minerHighlight: HUDMinerHighlight,
            tutorialVideoOffer: HUDTutorialVideoOffer,
            gameMenu: HUDGameMenu,
            constantSignalEdit: HUDConstantSignalEdit,
        };

        if (!IS_MOBILE) {
            this.additionalHudParts.keybindingOverlay = HUDKeybindingOverlay;
        }

        if (this.root.app.restrictionMgr.getIsStandaloneMarketingActive()) {
            this.additionalHudParts.watermark = HUDWatermark;
            this.additionalHudParts.standaloneAdvantages = HUDStandaloneAdvantages;
            this.additionalHudParts.catMemes = HUDCatMemes;
        }

        if (this.root.app.settings.getAllSettings().offerHints) {
            this.additionalHudParts.tutorialHints = HUDPartTutorialHints;
            this.additionalHudParts.interactiveTutorial = HUDInteractiveTutorial;
        }

        // @ts-ignore
        if (queryParamOptions.sandboxMode || window.sandboxMode || G_IS_DEV) {
            this.additionalHudParts.sandboxController = HUDSandboxController;
        }

        /** @type {(typeof MetaBuilding)[]} */
        this.hiddenBuildings = [
            MetaConstantProducerBuilding,
            MetaGoalAcceptorBuilding,
            MetaBlockBuilding,
            MetaItemProducerBuilding,
        ];
    }

    /**
     * Should return all available upgrades
     * @returns {Object<string, UpgradeTiers>}
     */
    getUpgrades() {
        return this.root.app.restrictionMgr.getHasExtendedUpgrades()
            ? fullVersionUpgrades
            : demoVersionUpgrades;
    }

    /**
     * Returns the goals for all levels including their reward
     * @returns {Array<LevelDefinition>}
     */
    getLevelDefinitions() {
        return this.root.app.restrictionMgr.getHasExtendedLevelsAndFreeplay()
            ? fullVersionLevels
            : demoVersionLevels;
    }

    /**
     * Should return whether free play is available or if the game stops
     * after the predefined levels
     * @returns {boolean}
     */
    getIsFreeplayAvailable() {
        return this.root.app.restrictionMgr.getHasExtendedLevelsAndFreeplay();
    }

    /** @returns {boolean} */
    hasAchievements() {
        return true;
    }
}
