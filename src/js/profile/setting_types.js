// @ts-nocheck
/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { createLogger } from "../core/logging";
import { T } from "../translations";

const logger = createLogger("setting_types");

/*
 * ***************************************************
 *
 *  LEGACY CODE WARNING
 *
 *  This is old code from yorg3.io and needs to be refactored
 *  @TODO
 *
 * ***************************************************
 */

export class BaseSetting {
    /**
     *
     * @param {string} id
     * @param {string} categoryId
     * @param {function(Application,any):void} changeCb
     * @param {function(app:Application) : boolean=} enabledCb
     */
    constructor(id, categoryId, changeCb, enabledCb = null) {
        this.id = id;
        this.categoryId = categoryId;
        this.changeCb = changeCb;
        this.enabledCb = enabledCb;

        /** @type {Application} */
        this.app = null;

        this.element = null;
        this.dialogs = null;
    }

    /**
     * @param {Application} app
     * @param {any} value
     */
    apply(app, value) {
        if (this.changeCb) {
            this.changeCb(app, value);
        }
    }

    /**
     * Binds all parameters
     * @param {Application} app
     * @param {HTMLElement} element
     * @param {any} dialogs
     */
    bind(app, element, dialogs) {
        this.app = app;
        this.element = element;
        this.dialogs = dialogs;
    }

    /**
     * Returns the HTML for this setting
     * @param {Application} app
     */
    getHtml(app) {
        abstract;
        return "";
    }

    /**
     * Returns whether this setting is enabled and available
     * @param {Application} app
     */
    getIsAvailable(app) {
        return this.enabledCb ? this.enabledCb(app) : true;
    }

    syncValueToElement() {
        abstract;
    }

    /**
     * Attempts to modify the setting
     */
    modify() {
        abstract;
    }

    /**
     * Shows the dialog that a restart is required
     */
    showRestartRequiredDialog() {
        const { restart } = this.dialogs.showInfo(
            T.dialogs.restartRequired.title,
            T.dialogs.restartRequired.text,
            this.app.platformWrapper.getSupportsRestart() ? ["later:grey", "restart:misc"] : ["ok:good"]
        );
        if (restart) {
            restart.add(() => this.app.platformWrapper.performRestart());
        }
    }

    /**
     * Validates the set value
     * @param {any} value
     * @returns {boolean}
     */
    validate(value) {
        abstract;
        return false;
    }
}

export class EnumSetting extends BaseSetting {
    constructor(
        id,
        {
            options,
            valueGetter,
            textGetter,
            descGetter = null,
            category,
            restartRequired = true,
            iconPrefix = null,
            changeCb = null,
            magicValue = null,
            enabledCb = null,
        }
    ) {
        super(id, category, changeCb, enabledCb);

        this.options = options;
        this.valueGetter = valueGetter;
        this.textGetter = textGetter;
        this.descGetter = descGetter || (() => null);
        this.restartRequired = restartRequired;
        this.iconPrefix = iconPrefix;
        this.magicValue = magicValue;
    }

    /**
     * @param {Application} app
     */
    getHtml(app) {
        const available = this.getIsAvailable(app);
        return `
            <div class="setting cardbox ${available ? "enabled" : "disabled"}">
                ${available ? "" : `<span class="standaloneOnlyHint">${T.demo.settingNotAvailable}</span>`}
                <div class="row">
                    <label>${T.settings.labels[this.id].title}</label>
                    <div class="value enum" data-setting="${this.id}"></div>
                </div>
                <div class="desc">
                    ${T.settings.labels[this.id].description}
                </div>
            </div>`;
    }

    validate(value) {
        if (value === this.magicValue) {
            return true;
        }

        const availableValues = this.options.map(option => this.valueGetter(option));
        if (availableValues.indexOf(value) < 0) {
            logger.error(
                "Value '" + value + "' is not contained in available values:",
                availableValues,
                "of",
                this.id
            );
            return false;
        }
        return true;
    }

    syncValueToElement() {
        const value = this.app.settings.getSetting(this.id);
        let displayText = "???";
        const matchedInstance = this.options.find(data => this.valueGetter(data) === value);
        if (matchedInstance) {
            displayText = this.textGetter(matchedInstance);
        } else {
            logger.warn("Setting value", value, "not found for", this.id, "!");
        }
        this.element.innerText = displayText;
    }

    modify() {
        const { optionSelected } = this.dialogs.showOptionChooser(T.settings.labels[this.id].title, {
            active: this.app.settings.getSetting(this.id),
            options: this.options.map(option => ({
                value: this.valueGetter(option),
                text: this.textGetter(option),
                desc: this.descGetter(option),
                iconPrefix: this.iconPrefix,
            })),
        });
        optionSelected.add(value => {
            this.app.settings.updateSetting(this.id, value);
            this.syncValueToElement();

            if (this.restartRequired) {
                this.showRestartRequiredDialog();
            }

            if (this.changeCb) {
                this.changeCb(this.app, value);
            }
        }, this);
    }
}

export class BoolSetting extends BaseSetting {
    constructor(id, category, changeCb = null, enabledCb = null) {
        super(id, category, changeCb, enabledCb);
    }

    /**
     * @param {Application} app
     */
    getHtml(app) {
        const available = this.getIsAvailable(app);
        return `
        <div class="setting cardbox ${available ? "enabled" : "disabled"}">
            ${available ? "" : `<span class="standaloneOnlyHint">${T.demo.settingNotAvailable}</span>`}

            <div class="row">
                <label>${T.settings.labels[this.id].title}</label>
                <div class="value checkbox checked" data-setting="${this.id}">
                <span class="knob"></span>
                </div>
            </div>
            <div class="desc">
                ${T.settings.labels[this.id].description}
            </div>
        </div>`;
    }

    syncValueToElement() {
        const value = this.app.settings.getSetting(this.id);
        this.element.classList.toggle("checked", value);
    }

    modify() {
        const newValue = !this.app.settings.getSetting(this.id);
        this.app.settings.updateSetting(this.id, newValue);
        this.syncValueToElement();

        if (this.changeCb) {
            this.changeCb(this.app, newValue);
        }
    }

    validate(value) {
        return typeof value === "boolean";
    }
}

export class RangeSetting extends BaseSetting {
    constructor(
        id,
        category,
        changeCb = null,
        defaultValue = 1.0,
        minValue = 0,
        maxValue = 1.0,
        stepSize = 0.0001,
        enabledCb = null
    ) {
        super(id, category, changeCb, enabledCb);

        this.defaultValue = defaultValue;
        this.minValue = minValue;
        this.maxValue = maxValue;
        this.stepSize = stepSize;
    }

    /**
     * @param {Application} app
     */
    getHtml(app) {
        const available = this.getIsAvailable(app);
        return `
        <div class="setting cardbox ${available ? "enabled" : "disabled"}">
            ${available ? "" : `<span class="standaloneOnlyHint">${T.demo.settingNotAvailable}</span>`}

            <div class="row">
                <label>${T.settings.labels[this.id].title}</label>
                <div class="value rangeInputContainer noPressEffect" data-setting="${this.id}">
                    <label>${this.defaultValue}</label>
                    <input class="rangeInput" type="range" value="${this.defaultValue}" min="${
            this.minValue
        }" max="${this.maxValue}" step="${this.stepSize}">
                </div>
            </div>
            <div class="desc">
                ${T.settings.labels[this.id].description}
            </div>
        </div>`;
    }

    bind(app, element, dialogs) {
        this.app = app;
        this.element = element;
        this.dialogs = dialogs;

        this.getRangeInputElement().addEventListener("input", () => {
            this.updateLabels();
        });

        this.getRangeInputElement().addEventListener("change", () => {
            this.modify();
        });
    }

    syncValueToElement() {
        const value = this.app.settings.getSetting(this.id);
        this.setElementValue(value);
    }

    /**
     * Sets the elements value to the given value
     * @param {number} value
     */
    setElementValue(value) {
        const rangeInput = this.getRangeInputElement();
        const rangeLabel = this.element.querySelector("label");
        rangeInput.value = String(value);
        rangeLabel.innerHTML = T.settings.rangeSliderPercentage.replace(
            "<amount>",
            String(Math.round(value * 100.0))
        );
    }

    updateLabels() {
        const value = Number(this.getRangeInputElement().value);
        this.setElementValue(value);
    }

    /**
     * @returns {HTMLInputElement}
     */
    getRangeInputElement() {
        return this.element.querySelector("input.rangeInput");
    }

    modify() {
        const rangeInput = this.getRangeInputElement();
        const newValue = Math.round(Number(rangeInput.value) * 100.0) / 100.0;
        this.app.settings.updateSetting(this.id, newValue);
        this.syncValueToElement();
        console.log("SET", newValue);
        if (this.changeCb) {
            this.changeCb(this.app, newValue);
        }
    }

    validate(value) {
        return typeof value === "number" && value >= this.minValue && value <= this.maxValue;
    }
}
