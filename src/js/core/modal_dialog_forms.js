import { BaseItem } from "../game/base_item";
import { ClickDetector } from "./click_detector";
import { createLogger } from "./logging";
import { Signal } from "./signal";
import { safeModulo } from "./utils";

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

const logger = createLogger("dialog_forms");

export class FormElement {
    constructor(id, label) {
        this.id = id;
        this.label = label;

        this.valueChosen = new Signal();
    }

    getHtml() {
        abstract;
        return "";
    }

    getFormElement(parent) {
        return parent.querySelector("[data-formId='" + this.id + "']");
    }

    bindEvents(parent, clickTrackers) {
        abstract;
    }

    focus() {}

    isValid() {
        return true;
    }

    /** @returns {any} */
    getValue() {
        abstract;
    }
}

export class FormElementInput extends FormElement {
    constructor({ id, label = null, placeholder, defaultValue = "", inputType = "text", validator = null }) {
        super(id, label);
        this.placeholder = placeholder;
        this.defaultValue = defaultValue;
        this.inputType = inputType;
        this.validator = validator;

        this.element = null;
    }

    getHtml() {
        let classes = [];
        let inputType = "text";
        let maxlength = 256;
        switch (this.inputType) {
            case "text": {
                classes.push("input-text");
                break;
            }

            case "email": {
                classes.push("input-email");
                inputType = "email";
                break;
            }

            case "token": {
                classes.push("input-token");
                inputType = "text";
                maxlength = 4;
                break;
            }
        }

        return `
            <div class="formElement input">
                ${this.label ? `<label>${this.label}</label>` : ""}
                <input
                    type="${inputType}"
                    value="${this.defaultValue.replace(/["\\]+/gi, "")}"
                    maxlength="${maxlength}"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    class="${classes.join(" ")}"
                    placeholder="${this.placeholder.replace(/["\\]+/gi, "")}"
                    data-formId="${this.id}">
            </div>
        `;
    }

    bindEvents(parent, clickTrackers) {
        this.element = this.getFormElement(parent);
        this.element.addEventListener("input", event => this.updateErrorState());
        this.updateErrorState();
    }

    updateErrorState() {
        this.element.classList.toggle("errored", !this.isValid());
    }

    isValid() {
        return !this.validator || this.validator(this.element.value);
    }

    getValue() {
        return this.element.value;
    }

    setValue(value) {
        this.element.value = value;
        this.updateErrorState();
    }

    focus() {
        this.element.focus();
    }
}

export class FormElementCheckbox extends FormElement {
    constructor({ id, label, defaultValue = true }) {
        super(id, label);
        this.defaultValue = defaultValue;
        this.value = this.defaultValue;

        this.element = null;
    }

    getHtml() {
        return `
            <div class="formElement checkBoxFormElem">
                ${this.label ? `<label>${this.label}</label>` : ""}
                <div class="checkbox ${this.defaultValue ? "checked" : ""}" data-formId='${this.id}'>
                    <span class="knob"></span >
                </div >
            </div>
        `;
    }

    bindEvents(parent, clickTrackers) {
        this.element = this.getFormElement(parent);
        const detector = new ClickDetector(this.element, {
            consumeEvents: false,
            preventDefault: false,
        });
        clickTrackers.push(detector);
        detector.click.add(this.toggle, this);
    }

    getValue() {
        return this.value;
    }

    toggle() {
        this.value = !this.value;
        this.element.classList.toggle("checked", this.value);
    }

    focus() {}
}

export class FormElementCheckboxList extends FormElement {
    constructor({ id, label = null, checkboxes = [] }) {
        super(id, label);
        this.checkboxes = checkboxes;
    }

    getHtml() {
        return `
            <div class="formElement checkBoxGridFormElem">
                ${this.checkboxes.map(checkbox => checkbox.getHtml()).join("\n")}
            </div>
        `;
    }

    bindEvents(parent, clickTrackers) {
        this.checkboxes.forEach(checkbox => checkbox.bindEvents(parent, clickTrackers));
    }

    getValue() {
        return this.checkboxes.map(checkbox => checkbox.getValue());
    }

    focus() {}
}

export class FormElementItemChooser extends FormElement {
    /**
     *
     * @param {object} param0
     * @param {string} param0.id
     * @param {string=} param0.label
     * @param {Array<BaseItem>} param0.items
     */
    constructor({ id, label, items = [] }) {
        super(id, label);
        this.items = items;
        this.element = null;

        /**
         * @type {BaseItem}
         */
        this.chosenItem = null;
    }

    getHtml() {
        let classes = [];

        return `
            <div class="formElement">
                ${this.label ? `<label>${this.label}</label>` : ""}
                <div class="ingameItemChooser input" data-formId="${this.id}"></div>
            </div>
            `;
    }

    /**
     * @param {HTMLElement} parent
     * @param {Array<ClickDetector>} clickTrackers
     */
    bindEvents(parent, clickTrackers) {
        this.element = this.getFormElement(parent);

        for (let i = 0; i < this.items.length; ++i) {
            const item = this.items[i];

            const canvas = document.createElement("canvas");
            canvas.width = 128;
            canvas.height = 128;
            const context = canvas.getContext("2d");
            item.drawFullSizeOnCanvas(context, 128);
            this.element.appendChild(canvas);

            const detector = new ClickDetector(canvas, {});
            clickTrackers.push(detector);
            detector.click.add(() => {
                this.chosenItem = item;
                this.valueChosen.dispatch(item);
            });
        }
    }

    isValid() {
        return true;
    }

    getValue() {
        return null;
    }

    focus() {}
}

export class FormElementEnum extends FormElement {
    constructor({ id, label = null, options, defaultValue = null, valueGetter, textGetter }) {
        super(id, label);
        this.options = options;
        this.valueGetter = valueGetter;
        this.textGetter = textGetter;
        this.index = 0;
        if (defaultValue !== null) {
            const index = this.options.findIndex(option => option.id === defaultValue);
            if (index >= 0) {
                this.index = index;
            } else {
                logger.warn("Option ID", defaultValue, "not found in", options, "!");
            }
        }

        this.element = null;
    }

    getHtml() {
        return `
            <div class="formElement enumFormElem">
                ${this.label ? `<label>${this.label}</label>` : ""}
                <div class="enum" data-formId="${this.id}">
                    <div class="toggle prev">⯇</div>
                    <div class="value">${this.textGetter(this.options[this.index])}</div>
                    <div class="toggle next">⯈</div>
                </div>
            </div>
            `;
    }

    /**
     * @param {HTMLElement} parent
     * @param {Array<ClickDetector>} clickTrackers
     */
    bindEvents(parent, clickTrackers) {
        this.element = this.getFormElement(parent);

        const children = this.element.children;
        for (let i = 0; i < children.length; ++i) {
            const child = children[i];
            const detector = new ClickDetector(child, { preventDefault: false });
            clickTrackers.push(detector);
            const change = child.classList.contains("prev") ? -1 : 1;
            detector.click.add(() => this.toggle(change), this);
        }
    }

    getValue() {
        return this.valueGetter(this.options[this.index]);
    }

    toggle(amount) {
        this.index = safeModulo(this.index + amount, this.options.length);
        this.element.querySelector(".value").innerText = this.textGetter(this.options[this.index]);
    }

    focus() {}
}
