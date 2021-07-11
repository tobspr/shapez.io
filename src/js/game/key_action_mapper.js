/* typehints:start */
import { GameRoot } from "./root";
import { InputReceiver } from "../core/input_receiver";
import { Application } from "../application";
/* typehints:end */

import { Signal, STOP_PROPAGATION } from "../core/signal";
import { IS_MOBILE } from "../core/config";
import { T } from "../translations";
function key(str) {
    return str.toUpperCase().charCodeAt(0);
}

const KEYCODE_UP_ARROW = 38;
const KEYCODE_DOWN_ARROW = 40;
const KEYCODE_LEFT_ARROW = 37;
const KEYCODE_RIGHT_ARROW = 39;

export const KEYMAPPINGS = {
    general: {
        confirm: { keyCode: 13 }, // enter
        back: { keyCode: 27, builtin: true }, // escape
    },

    ingame: {
        menuOpenShop: { keyCode: key("F") },
        menuOpenStats: { keyCode: key("G") },
        menuOpenAchievements: { keyCode: key("H") },
        menuClose: { keyCode: key("Q") },

        toggleHud: { keyCode: 113 }, // F2
        exportScreenshot: { keyCode: 114 }, // F3PS
        toggleFPSInfo: { keyCode: 115 }, // F4

        switchLayers: { keyCode: key("E") },
    },

    navigation: {
        mapMoveUp: { keyCode: key("W") },
        mapMoveRight: { keyCode: key("D") },
        mapMoveDown: { keyCode: key("S") },
        mapMoveLeft: { keyCode: key("A") },
        mapMoveFaster: { keyCode: 16 }, //shift

        centerMap: { keyCode: 32 }, // SPACE
        mapZoomIn: { keyCode: 187, repeated: true }, // "+"
        mapZoomOut: { keyCode: 189, repeated: true }, // "-"

        createMarker: { keyCode: key("M") },
    },

    buildings: {
        // Puzzle buildings
        constant_producer: { keyCode: key("H") },
        goal_acceptor: { keyCode: key("N") },
        block: { keyCode: key("4") },

        // Primary Toolbar
        belt: { keyCode: key("1") },
        balancer: { keyCode: key("2") },
        underground_belt: { keyCode: key("3") },
        miner: { keyCode: key("4") },
        cutter: { keyCode: key("5") },
        rotater: { keyCode: key("6") },
        stacker: { keyCode: key("7") },
        mixer: { keyCode: key("8") },
        painter: { keyCode: key("9") },
        trash: { keyCode: key("0") },

        // Sandbox
        item_producer: { keyCode: key("L") },

        // Secondary toolbar
        storage: { keyCode: key("Y") },
        reader: { keyCode: key("U") },
        lever: { keyCode: key("I") },
        filter: { keyCode: key("O") },
        display: { keyCode: key("P") },

        // Wires toolbar
        wire: { keyCode: key("1") },
        wire_tunnel: { keyCode: key("2") },
        constant_signal: { keyCode: key("3") },
        logic_gate: { keyCode: key("4") },
        virtual_processor: { keyCode: key("5") },
        analyzer: { keyCode: key("6") },
        comparator: { keyCode: key("7") },
        transistor: { keyCode: key("8") },
    },

    placement: {
        pipette: { keyCode: key("Q") },
        rotateWhilePlacing: { keyCode: key("R") },
        rotateInverseModifier: { keyCode: 16 }, // SHIFT
        rotateToUp: { keyCode: KEYCODE_UP_ARROW },
        rotateToDown: { keyCode: KEYCODE_DOWN_ARROW },
        rotateToRight: { keyCode: KEYCODE_RIGHT_ARROW },
        rotateToLeft: { keyCode: KEYCODE_LEFT_ARROW },
        cycleBuildingVariants: { keyCode: key("T") },
        cycleBuildings: { keyCode: 9 }, // TAB
        switchDirectionLockSide: { keyCode: key("R") },

        copyWireValue: { keyCode: key("Z") },
    },

    massSelect: {
        massSelectStart: { keyCode: 17 }, // CTRL
        massSelectSelectMultiple: { keyCode: 16 }, // SHIFT
        massSelectCopy: { keyCode: key("C") },
        massSelectCut: { keyCode: key("X") },
        massSelectClear: { keyCode: key("B") },
        confirmMassDelete: { keyCode: 46 }, // DEL
        pasteLastBlueprint: { keyCode: key("V") },
    },

    placementModifiers: {
        lockBeltDirection: { keyCode: 16 }, // SHIFT
        placementDisableAutoOrientation: { keyCode: 17 }, // CTRL
        placeMultiple: { keyCode: 16 }, // SHIFT
        placeInverse: { keyCode: 18 }, // ALT
    },
};

// Assign ids
for (const categoryId in KEYMAPPINGS) {
    for (const mappingId in KEYMAPPINGS[categoryId]) {
        KEYMAPPINGS[categoryId][mappingId].id = mappingId;
    }
}

export const KEYCODE_LMB = 1;
export const KEYCODE_MMB = 2;
export const KEYCODE_RMB = 3;

/**
 * Returns a keycode -> string
 * @param {number} code
 * @returns {string}
 */
export function getStringForKeyCode(code) {
    // @todo: Refactor into dictionary
    switch (code) {
        case KEYCODE_LMB:
            return "LMB";
        case KEYCODE_MMB:
            return "MMB";
        case KEYCODE_RMB:
            return "RMB";
        case 4:
            return "MB4";
        case 5:
            return "MB5";
        case 8:
            return "⌫";
        case 9:
            return T.global.keys.tab;
        case 13:
            return "⏎";
        case 16:
            return "⇪";
        case 17:
            return T.global.keys.control;
        case 18:
            return T.global.keys.alt;
        case 19:
            return "PAUSE";
        case 20:
            return "CAPS";
        case 27:
            return T.global.keys.escape;
        case 32:
            return T.global.keys.space;
        case 33:
            return "PGUP";
        case 34:
            return "PGDOWN";
        case 35:
            return "END";
        case 36:
            return "HOME";
        case KEYCODE_LEFT_ARROW:
            return "⬅";
        case KEYCODE_UP_ARROW:
            return "⬆";
        case KEYCODE_RIGHT_ARROW:
            return "➡";
        case KEYCODE_DOWN_ARROW:
            return "⬇";
        case 44:
            return "PRNT";
        case 45:
            return "INS";
        case 46:
            return "DEL";
        case 93:
            return "SEL";
        case 96:
            return "NUM 0";
        case 97:
            return "NUM 1";
        case 98:
            return "NUM 2";
        case 99:
            return "NUM 3";
        case 100:
            return "NUM 4";
        case 101:
            return "NUM 5";
        case 102:
            return "NUM 6";
        case 103:
            return "NUM 7";
        case 104:
            return "NUM 8";
        case 105:
            return "NUM 9";
        case 106:
            return "*";
        case 107:
            return "+";
        case 109:
            return "-";
        case 110:
            return ".";
        case 111:
            return "/";
        case 112:
            return "F1";
        case 113:
            return "F2";
        case 114:
            return "F3";
        case 115:
            return "F4";
        case 116:
            return "F5";
        case 117:
            return "F6";
        case 118:
            return "F7";
        case 119:
            return "F8";
        case 120:
            return "F9";
        case 121:
            return "F10";
        case 122:
            return "F11";
        case 123:
            return "F12";

        case 144:
            return "NUMLOCK";
        case 145:
            return "SCRLOCK";
        case 182:
            return "COMP";
        case 183:
            return "CALC";
        case 186:
            return ";";
        case 187:
            return "+";
        case 188:
            return ",";
        case 189:
            return "-";
        case 190:
            return ".";
        case 191:
            return "/";
        case 192:
            return "`";
        case 219:
            return "[";
        case 220:
            return "\\";
        case 221:
            return "]";
        case 222:
            return "'";
    }

    return (48 <= code && code <= 57) || (65 <= code && code <= 90)
        ? String.fromCharCode(code)
        : "[" + code + "]";
}

export class Keybinding {
    /**
     *
     * @param {KeyActionMapper} keyMapper
     * @param {Application} app
     * @param {object} param0
     * @param {number} param0.keyCode
     * @param {boolean=} param0.builtin
     * @param {boolean=} param0.repeated
     */
    constructor(keyMapper, app, { keyCode, builtin = false, repeated = false }) {
        assert(keyCode && Number.isInteger(keyCode), "Invalid key code: " + keyCode);
        this.keyMapper = keyMapper;
        this.app = app;
        this.keyCode = keyCode;
        this.builtin = builtin;
        this.repeated = repeated;

        this.signal = new Signal();
        this.toggled = new Signal();
    }

    /**
     * Returns whether this binding is currently pressed
     * @returns {boolean}
     */
    get pressed() {
        // Check if the key is down
        if (this.app.inputMgr.keysDown.has(this.keyCode)) {
            // Check if it is the top reciever
            const reciever = this.keyMapper.inputReceiver;
            return this.app.inputMgr.getTopReciever() === reciever;
        }
        return false;
    }

    /**
     * Adds an event listener
     * @param {function() : void} receiver
     * @param {object=} scope
     */
    add(receiver, scope = null) {
        this.signal.add(receiver, scope);
    }

    /**
     * Adds an event listener
     * @param {function() : void} receiver
     * @param {object=} scope
     */
    addToTop(receiver, scope = null) {
        this.signal.addToTop(receiver, scope);
    }

    /**
     * @param {Element} elem
     * @returns {HTMLElement} the created element, or null if the keybindings are not shown
     *  */
    appendLabelToElement(elem) {
        if (IS_MOBILE) {
            return null;
        }
        const spacer = document.createElement("code");
        spacer.classList.add("keybinding");
        spacer.innerHTML = getStringForKeyCode(this.keyCode);
        elem.appendChild(spacer);
        return spacer;
    }

    /**
     * Returns the key code as a nice string
     */
    getKeyCodeString() {
        return getStringForKeyCode(this.keyCode);
    }

    /**
     * Remvoes all signal receivers
     */
    clearSignalReceivers() {
        this.signal.removeAll();
    }
}

export class KeyActionMapper {
    /**
     *
     * @param {GameRoot} root
     * @param {InputReceiver} inputReciever
     */
    constructor(root, inputReciever) {
        this.root = root;
        this.inputReceiver = inputReciever;

        inputReciever.keydown.add(this.handleKeydown, this);
        inputReciever.keyup.add(this.handleKeyup, this);

        /** @type {Object.<string, Keybinding>} */
        this.keybindings = {};

        const overrides = root.app.settings.getKeybindingOverrides();

        for (const category in KEYMAPPINGS) {
            for (const key in KEYMAPPINGS[category]) {
                let payload = Object.assign({}, KEYMAPPINGS[category][key]);
                if (overrides[key]) {
                    payload.keyCode = overrides[key];
                }

                this.keybindings[key] = new Keybinding(this, this.root.app, payload);

                if (G_IS_DEV) {
                    // Sanity
                    if (!T.keybindings.mappings[key]) {
                        assertAlways(false, "Keybinding " + key + " has no translation!");
                    }
                }
            }
        }

        inputReciever.pageBlur.add(this.onPageBlur, this);
        inputReciever.destroyed.add(this.cleanup, this);
    }

    /**
     * Returns all keybindings starting with the given id
     * @param {string} pattern
     * @returns {Array<Keybinding>}
     */
    getKeybindingsStartingWith(pattern) {
        let result = [];
        for (const key in this.keybindings) {
            if (key.startsWith(pattern)) {
                result.push(this.keybindings[key]);
            }
        }
        return result;
    }

    /**
     * Forwards the given events to the other mapper (used in tooltips)
     * @param {KeyActionMapper} receiver
     * @param {Array<string>} bindings
     */
    forward(receiver, bindings) {
        for (let i = 0; i < bindings.length; ++i) {
            const key = bindings[i];
            this.keybindings[key].signal.add((...args) => receiver.keybindings[key].signal.dispatch(...args));
        }
    }

    cleanup() {
        for (const key in this.keybindings) {
            this.keybindings[key].signal.removeAll();
        }
    }

    onPageBlur() {
        // Reset all down states
        // Find mapping
        for (const key in this.keybindings) {
            /** @type {Keybinding} */
            const binding = this.keybindings[key];
        }
    }

    /**
     * Internal keydown handler
     * @param {object} param0
     * @param {number} param0.keyCode
     * @param {boolean} param0.shift
     * @param {boolean} param0.alt
     * @param {boolean=} param0.initial
     */
    handleKeydown({ keyCode, shift, alt, initial }) {
        let stop = false;

        // Find mapping
        for (const key in this.keybindings) {
            /** @type {Keybinding} */
            const binding = this.keybindings[key];
            if (binding.keyCode === keyCode && (initial || binding.repeated)) {
                /** @type {Signal} */
                const signal = this.keybindings[key].signal;
                if (signal.dispatch() === STOP_PROPAGATION) {
                    return;
                }
            }
        }

        if (stop) {
            return STOP_PROPAGATION;
        }
    }

    /**
     * Internal keyup handler
     * @param {object} param0
     * @param {number} param0.keyCode
     * @param {boolean} param0.shift
     * @param {boolean} param0.alt
     */
    handleKeyup({ keyCode, shift, alt }) {
        // Empty
    }

    /**
     * Returns a given keybinding
     * @param {{ keyCode: number }} binding
     * @returns {Keybinding}
     */
    getBinding(binding) {
        // @ts-ignore
        const id = binding.id;
        assert(id, "Not a valid keybinding: " + JSON.stringify(binding));
        assert(this.keybindings[id], "Keybinding " + id + " not known!");
        return this.keybindings[id];
    }
}
