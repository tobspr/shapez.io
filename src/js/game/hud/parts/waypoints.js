import { makeOffscreenBuffer } from "../../../core/buffer_utils";
import { globalConfig, THIRDPARTY_URLS } from "../../../core/config";
import { DrawParameters } from "../../../core/draw_parameters";
import { Loader } from "../../../core/loader";
import { DialogWithForm } from "../../../core/modal_dialog_elements";
import { FormElementCheckbox, FormElementInput } from "../../../core/modal_dialog_forms";
import { Rectangle } from "../../../core/rectangle";
import { STOP_PROPAGATION } from "../../../core/signal";
import {
    arrayDeleteValue,
    fillInLinkIntoTranslation,
    lerp,
    makeDiv,
    removeAllChildren,
} from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { T } from "../../../translations";
import { BaseItem } from "../../base_item";
import { enumMouseButton } from "../../camera";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { ShapeDefinition } from "../../shape_definition";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { enumNotificationType } from "./notifications";

/** @typedef {{
 *   label: string | null,
 *   parts: Array<string> | null,
 *   center: { x: number, y: number },
 *   zoomLevel: number,
 *   hasCompass: boolean
 * }} Waypoint */

const MAX_LABEL_LENGTH = 70;
const SHAPE_TEXT_LENGTH = 2;

export class HUDWaypoints extends BaseHUDPart {
    /**
     * Creates the overview of waypoints
     * @param {HTMLElement} parent
     */
    createElements(parent) {
        // Create the helper box on the lower right when zooming out
        if (this.root.app.settings.getAllSettings().offerHints) {
            this.hintElement = makeDiv(
                parent,
                "ingame_HUD_Waypoints_Hint",
                [],
                `
            <strong class='title'>${T.ingame.waypoints.waypoints}</strong>
            <span class='desc'>${T.ingame.waypoints.description.replace(
                "<keybinding>",
                `<code class='keybinding'>${this.root.keyMapper
                    .getBinding(KEYMAPPINGS.navigation.createMarker)
                    .getKeyCodeString()}</code>`
            )}</span>
        `
            );
        }

        // Create the waypoint list on the upper right
        this.waypointsListElement = makeDiv(parent, "ingame_HUD_Waypoints", [], "Waypoints");
    }

    /**
     * Serializes the waypoints
     */
    serialize() {
        return {
            waypoints: this.waypoints,
        };
    }

    /**
     * Deserializes the waypoints
     * @param {{waypoints: Array<Waypoint>}} data
     */
    deserialize(data) {
        if (!data || !data.waypoints || !Array.isArray(data.waypoints)) {
            return "Invalid waypoints data";
        }
        this.waypoints = data.waypoints;

        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];
            if (!waypoint.label) {
                waypoint.hasCompass = true;
            }
            if (waypoint.hasCompass === undefined) {
                waypoint.hasCompass = false;
            }
            if (waypoint.hasCompass) {
                const [canvas, context] = makeOffscreenBuffer(48, 48, {
                    smooth: true,
                    reusable: false,
                    label: "waypoints-compass",
                });
                canvas.classList.add("compass");
                this.compassBuffers.set(waypoint, { canvas, context, opacity: 0 });
            }
        }

        this.rerenderWaypointList();
    }

    /**
     * Initializes everything
     */
    initialize() {
        // Cache the sprite for the waypoints
        this.waypointSprite = Loader.getSprite("sprites/misc/waypoint.png");
        this.directionIndicatorSprite = Loader.getSprite("sprites/misc/hub_direction_indicator.png");

        const waypoint = {
            label: null,
            parts: null,
            center: { x: 0, y: 0 },
            zoomLevel: 3,
            hasCompass: true,
        };
        /** @type {Array<Waypoint>}
         */
        this.waypoints = [waypoint];

        // Create a buffer we can use to measure text
        this.dummyBuffer = makeOffscreenBuffer(1, 1, {
            reusable: false,
            label: "waypoints-measure-canvas",
        })[1];

        // Dynamically attach/detach the lower right hint in the map overview
        if (this.hintElement) {
            this.domAttach = new DynamicDomAttach(this.root, this.hintElement);
        }

        // Catch mouse and key events
        this.root.camera.downPreHandler.add(this.onMouseDown, this);
        this.root.keyMapper
            .getBinding(KEYMAPPINGS.navigation.createMarker)
            .add(() => this.requestSaveMarker({}));

        /**
         * Stores at how much opacity the markers should be rendered on the map.
         * This is interpolated over multiple frames so we have some sort of fade effect
         */
        this.currentMarkerOpacity = 1;

        // Create buffer which is used to indicate the hub direction
        const [canvas, context] = makeOffscreenBuffer(48, 48, {
            smooth: true,
            reusable: false,
            label: "waypoints-compass",
        });
        canvas.classList.add("compass");
        /**
         * Store all compass buffers
         * @type {WeakMap<Waypoint, {
         *  canvas: HTMLCanvasElement,
         *  context: CanvasRenderingContext2D,
         *  opacity: number
         * }>}
         */
        this.compassBuffers = new WeakMap();
        this.compassBuffers.set(waypoint, { canvas, context, opacity: 0 });

        /**
         * Stores a cache from a shape short key to its canvas representation
         */
        this.cachedKeyToCanvas = {};

        /**
         * Store cached text widths
         * @type {Object<string, Object<string, number>>}
         */
        this.cachedTextWidths = {};

        // Initial render
        this.rerenderWaypointList();
    }

    /**
     * Returns how long a text will be rendered
     * @param {string} text
     * @returns {number}
     */
    getTextWidth(text) {
        const scale = this.getTextScale();
        if (!this.cachedTextWidths[scale]) {
            this.cachedTextWidths[scale] = {};
        }
        if (this.cachedTextWidths[scale][text]) {
            return this.cachedTextWidths[scale][text];
        }

        this.dummyBuffer.font = "bold " + scale + "px GameFont";
        return (this.cachedTextWidths[scale][text] = this.dummyBuffer.measureText(text).width);
    }

    /**
     * Returns how big the text should be rendered
     */
    getTextScale() {
        return this.getWaypointUiScale() * 12;
    }

    /**
     * Returns the scale for rendering waypoints
     */
    getWaypointUiScale() {
        return this.root.app.getEffectiveUiScale();
    }

    /**
     * Re-renders the waypoint list to account for changes
     */
    rerenderWaypointList() {
        removeAllChildren(this.waypointsListElement);
        this.cleanupClickDetectors();

        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];
            const parts = this.getWaypointParts(waypoint);

            const element = makeDiv(this.waypointsListElement, null, ["waypoint"]);

            for (let j = 0; j < parts.length; ++j) {
                const part = parts[j];
                if (ShapeDefinition.isValidShortKey(part)) {
                    const canvas = this.getWaypointCanvas(part);
                    /**
                     * Create a clone of the cached canvas, as calling appendElement when a canvas is
                     * already in the document will move the existing canvas to the new position.
                     */
                    const [newCanvas, context] = makeOffscreenBuffer(48, 48, {
                        smooth: true,
                        label: part + "-waypoint-" + i,
                    });
                    context.drawImage(canvas, 0, 0);
                    newCanvas.classList.add("shapeIcon");
                    element.appendChild(newCanvas);
                } else {
                    element.appendChild(document.createTextNode(part));
                }
            }

            if (this.isWaypointDeletable(waypoint)) {
                makeDiv(element, null, ["editMargin"]);
                const editButton = makeDiv(element, null, ["editButton"]);
                this.trackClicks(editButton, () => this.requestSaveMarker({ waypoint }));
            }

            if (waypoint.hasCompass) {
                // This must be a compass label
                element.classList.add("hasCompass");

                const canvas = this.compassBuffers.get(waypoint).canvas;
                element.insertBefore(canvas, element.childNodes[0]);
            }

            this.trackClicks(element, () => this.moveToWaypoint(waypoint), {
                targetOnly: true,
            });
        }
    }

    /**
     * Moves the camera to a given waypoint
     * @param {Waypoint} waypoint
     */
    moveToWaypoint(waypoint) {
        this.root.camera.setDesiredCenter(new Vector(waypoint.center.x, waypoint.center.y));
        this.root.camera.setDesiredZoom(waypoint.zoomLevel);
    }

    /**
     * Deletes a waypoint from the list
     * @param {Waypoint} waypoint
     */
    deleteWaypoint(waypoint) {
        arrayDeleteValue(this.waypoints, waypoint);
        this.rerenderWaypointList();
    }

    /**
     * Gets the canvas for a given waypoint key
     * @param {string} key
     * @returns {HTMLCanvasElement}
     */
    getWaypointCanvas(key) {
        if (this.cachedKeyToCanvas[key]) {
            return this.cachedKeyToCanvas[key];
        }

        assert(ShapeDefinition.isValidShortKey(key), "Invalid short key: " + key);
        const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(key);
        const preRendered = definition.generateAsCanvas(48);
        return (this.cachedKeyToCanvas[key] = preRendered);
    }

    /**
     * Requests to save a marker at the current camera position. If worldPos is set,
     * uses that position instead.
     * @param {object} param0
     * @param {Vector=} param0.worldPos Override the world pos, otherwise it is the camera position
     * @param {Waypoint=} param0.waypoint Waypoint to be edited. If omitted, create new
     */
    requestSaveMarker({ worldPos = null, waypoint = null }) {
        // Construct dialog with input field
        const markerNameInput = new FormElementInput({
            id: "markerName",
            label: null,
            placeholder: "",
            defaultValue: waypoint ? waypoint.label : "",
            validator: val => val.length > 0 && this.getLabelLength(val) <= MAX_LABEL_LENGTH,
        });
        console.log(waypoint && waypoint.hasCompass);
        const compassInput = new FormElementCheckbox({
            id: "compassChoice",
            // @TODO: Add translation (T.dialogs.createMarker.descCompass)
            label: "Add a compass that points to the marker:",
            defaultValue: waypoint ? waypoint.hasCompass : false,
        });
        const dialog = new DialogWithForm({
            app: this.root.app,
            title: waypoint ? T.dialogs.createMarker.titleEdit : T.dialogs.createMarker.title,
            desc: fillInLinkIntoTranslation(T.dialogs.createMarker.desc, THIRDPARTY_URLS.shapeViewer),
            formElements: [markerNameInput, compassInput],
            buttons: waypoint ? ["delete:bad", "cancel", "ok:good"] : ["cancel", "ok:good"],
        });
        this.root.hud.parts.dialogs.internalShowDialog(dialog);

        // Edit marker
        if (waypoint) {
            dialog.buttonSignals.ok.add(() => {
                // Actually rename the waypoint
                this.renameWaypoint(waypoint, markerNameInput.getValue(), compassInput.getValue());
            });
            dialog.buttonSignals.delete.add(() => {
                // Actually delete the waypoint
                this.deleteWaypoint(waypoint);
            });
        } else {
            // Compute where to create the marker
            const center = worldPos || this.root.camera.center;

            dialog.buttonSignals.ok.add(() => {
                // Show info that you can have only N markers in the demo,
                // actually show this *after* entering the name so you want the
                // standalone even more (I'm evil :P)
                if (this.waypoints.length > this.root.app.restrictionMgr.getMaximumWaypoints()) {
                    this.root.hud.parts.dialogs.showFeatureRestrictionInfo(
                        "",
                        T.dialogs.markerDemoLimit.desc
                    );
                    return;
                }

                // Actually create the waypoint
                this.addWaypoint(markerNameInput.getValue(), center, compassInput.getValue());
            });
        }
    }

    /**
     * Adds a new waypoint at the given location with the given label
     * @param {string} label
     * @param {Vector} position
     * @param {boolean} hasCompass
     */
    addWaypoint(label, position, hasCompass = false) {
        const parts = this.splitLabel(label);

        const waypoint = {
            label,
            parts,
            center: { x: position.x, y: position.y },
            zoomLevel: this.root.camera.zoomLevel,
            hasCompass,
        };

        if (hasCompass) {
            const [canvas, context] = makeOffscreenBuffer(48, 48, {
                smooth: true,
                reusable: false,
                label: "waypoints-compass",
            });
            canvas.classList.add("compass");
            this.compassBuffers.set(waypoint, { canvas, context, opacity: 0 });
        }

        this.waypoints.push(waypoint);

        this.sortWaypoints();

        // Show notification about creation
        this.root.hud.signals.notification.dispatch(
            T.ingame.waypoints.creationSuccessNotification,
            enumNotificationType.success
        );

        // Re-render the list and thus add it
        this.rerenderWaypointList();
    }

    /**
     * Renames a waypoint with the given label
     * @param {Waypoint} waypoint
     * @param {string} label
     * @param {boolean} hasCompass
     */
    renameWaypoint(waypoint, label, hasCompass = false) {
        waypoint.label = label;
        waypoint.parts = this.splitLabel(waypoint.label);
        waypoint.hasCompass = hasCompass;

        if (hasCompass) {
            if (!this.compassBuffers.has(waypoint)) {
                const [canvas, context] = makeOffscreenBuffer(48, 48, {
                    smooth: true,
                    reusable: false,
                    label: "waypoints-compass",
                });
                canvas.classList.add("compass");
                this.compassBuffers.set(waypoint, { canvas, context, opacity: 0 });
            }
        } else {
            if (this.compassBuffers.has(waypoint)) {
                this.compassBuffers.delete(waypoint);
            }
        }

        this.sortWaypoints();

        // Show notification about renamed
        this.root.hud.signals.notification.dispatch(
            // @TODO: Add translation (T.ingame.waypoints.editSuccessNotification)
            "Marker has been edited.",
            enumNotificationType.success
        );

        // Re-render the list and thus add it
        this.rerenderWaypointList();
    }

    /**
     * Splits a label into shortkeys and text
     * @param {string} label
     * @returns {Array<string>}
     */
    splitLabel(label) {
        const words = label.split(" ");
        let part = null;
        let parts = [];
        for (let i = 0; i < words.length; ++i) {
            const word = words[i];
            if (ShapeDefinition.isValidShortKey(word)) {
                if (part !== null) {
                    parts.push(part);
                    part = null;
                }
                parts.push(word);
            } else {
                if (part !== null) {
                    part += " " + word;
                } else {
                    part = word;
                }
            }
        }
        if (part !== null) {
            parts.push(part);
        }
        return parts;
    }

    /**
     * Returns the character length of a label,
     * treating shapes as a constant number of characters
     * @param {string} label
     * @returns {number}
     */
    getLabelLength(label) {
        const parts = this.splitLabel(label);
        let length = 0;
        for (let i = 0; i < parts.length; ++i) {
            const part = parts[i];
            if (ShapeDefinition.isValidShortKey(part)) {
                length += SHAPE_TEXT_LENGTH;
            } else {
                length += part.length;
            }
        }
        return length;
    }

    /**
     * Called every frame to update stuff
     */
    update() {
        if (this.domAttach) {
            this.domAttach.update(this.root.camera.getIsMapOverlayActive());
        }
    }

    /**
     * Sort waypoints by name
     */
    sortWaypoints() {
        this.waypoints.sort((a, b) => {
            if (!a.label) {
                return -1;
            }
            if (!b.label) {
                return 1;
            }
            return this.getWaypointLabel(a).localeCompare(this.getWaypointLabel(b));
        });
    }

    /**
     * Returns the label for a given waypoint
     * @param {Waypoint} waypoint
     * @returns {string}
     */
    getWaypointLabel(waypoint) {
        return waypoint.label || T.ingame.waypoints.hub;
    }

    /**
     * Returns the parts of the label for a given waypoint
     * @param {Waypoint} waypoint
     * @returns {Array<string>}
     */
    getWaypointParts(waypoint) {
        return waypoint.parts || [T.ingame.waypoints.hub];
    }

    /**
     * Returns if a waypoint is deletable
     * @param {Waypoint} waypoint
     * @returns {boolean}
     */
    isWaypointDeletable(waypoint) {
        return waypoint.label !== null;
    }

    /**
     * Returns the screen space bounds of the given waypoint or null
     * if it couldn't be determined. Also returns wheter its a shape or not
     * @param {Waypoint} waypoint
     * @return {{
     *   screenBounds: Rectangle
     *   parts: Array<{
     *   item: boolean,
     *   text: string
     *   }>
     * }}
     */
    getWaypointScreenParams(waypoint) {
        if (!this.root.camera.getIsMapOverlayActive()) {
            return null;
        }

        // Find parameters
        const scale = this.getWaypointUiScale();
        const screenPos = this.root.camera.worldToScreen(new Vector(waypoint.center.x, waypoint.center.y));

        // Distinguish between text and item waypoints -> Figure out parameters
        const originalParts = this.getWaypointParts(waypoint);
        let parts = [];
        let textWidth = 0;

        for (let i = 0; i < originalParts.length; ++i) {
            const originalPart = originalParts[i];
            let item = false;
            const text = originalPart;
            if (ShapeDefinition.isValidShortKey(originalPart)) {
                // If the label is actually a key, render the shape icon
                item = true;
                textWidth += 14 * scale;
            } else {
                // Otherwise render a regular waypoint
                textWidth += this.getTextWidth(text);
            }
            parts.push({ item, text });
        }

        return {
            screenBounds: new Rectangle(
                screenPos.x - 7 * scale,
                screenPos.y - 12 * scale,
                15 * scale + textWidth,
                15 * scale
            ),
            parts,
        };
    }

    /**
     * Finds the currently intersected waypoint on the map overview under
     * the cursor.
     *
     * @returns {Waypoint | null}
     */
    findCurrentIntersectedWaypoint() {
        const mousePos = this.root.app.mousePosition;
        if (!mousePos) {
            return;
        }

        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];
            const params = this.getWaypointScreenParams(waypoint);
            if (params && params.screenBounds.containsPoint(mousePos.x, mousePos.y)) {
                return waypoint;
            }
        }
    }

    /**
     * Mouse-Down handler
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDown(pos, button) {
        const waypoint = this.findCurrentIntersectedWaypoint();
        if (waypoint) {
            if (button === enumMouseButton.left) {
                this.root.soundProxy.playUiClick();
                this.moveToWaypoint(waypoint);
            } else if (button === enumMouseButton.right) {
                if (this.isWaypointDeletable(waypoint)) {
                    this.root.soundProxy.playUiClick();
                    this.requestSaveMarker({ waypoint });
                } else {
                    this.root.soundProxy.playUiError();
                }
            }

            return STOP_PROPAGATION;
        } else {
            // Allow right click to create a marker
            if (button === enumMouseButton.right) {
                if (this.root.camera.getIsMapOverlayActive()) {
                    const worldPos = this.root.camera.screenToWorld(pos);
                    this.requestSaveMarker({ worldPos });
                    return STOP_PROPAGATION;
                }
            }
        }
    }

    /**
     * Rerenders the compass
     * @param {Waypoint} waypoint
     */
    rerenderWaypointsCompass(waypoint) {
        const dims = 48;
        const indicatorSize = 30;
        const relativeCameraPos = new Vector(waypoint.center.x, waypoint.center.y).direction(
            this.root.camera.center
        );

        assert(this.compassBuffers.has(waypoint), "Waypoint " + waypoint.label + " does not have compass");
        const compassBuffer = this.compassBuffers.get(waypoint);
        const { context } = compassBuffer;
        context.clearRect(0, 0, dims, dims);

        const distanceToHub = relativeCameraPos.length();
        const compassVisible = distanceToHub > (10 * globalConfig.tileSize) / this.root.camera.zoomLevel;
        const targetCompassAlpha = compassVisible ? 1 : 0;

        // Fade the compas in / out
        compassBuffer.opacity = lerp(compassBuffer.opacity, targetCompassAlpha, 0.08);

        // Render the compass
        if (compassBuffer.opacity > 0.01) {
            context.globalAlpha = compassBuffer.opacity;
            const angle = relativeCameraPos.angle() + Math.radians(45) + Math.PI / 2;
            context.translate(dims / 2, dims / 2);
            context.rotate(angle);
            this.directionIndicatorSprite.drawCentered(context, 0, 0, indicatorSize);
            context.rotate(-angle);
            context.translate(-dims / 2, -dims / 2);
            context.globalAlpha = 1;
        }

        // Render the regualr icon
        const iconOpacity = 1 - compassBuffer.opacity;
        if (iconOpacity > 0.01) {
            context.globalAlpha = iconOpacity;
            this.waypointSprite.drawCentered(context, dims / 2, dims / 2, dims * 0.7);
            context.globalAlpha = 1;
        }
    }

    /**
     * Draws the waypoints on the map
     * @param {DrawParameters} parameters
     */
    drawOverlays(parameters) {
        const mousePos = this.root.app.mousePosition;
        const desiredOpacity = this.root.camera.getIsMapOverlayActive() ? 1 : 0;
        this.currentMarkerOpacity = lerp(this.currentMarkerOpacity, desiredOpacity, 0.08);

        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];
            if (waypoint.hasCompass) {
                this.rerenderWaypointsCompass(waypoint);
            }
        }

        // Don't render with low opacity
        if (this.currentMarkerOpacity < 0.01) {
            return;
        }

        // Determine rendering scale
        const scale = this.getWaypointUiScale();

        // Set the font size
        const textSize = this.getTextScale();
        parameters.context.font = "bold " + textSize + "px GameFont";
        parameters.context.textBaseline = "middle";

        // Loop over all waypoints
        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];

            const waypointData = this.getWaypointScreenParams(waypoint);
            if (!waypointData) {
                // Not relevant
                continue;
            }

            if (!parameters.visibleRect.containsRect(waypointData.screenBounds)) {
                // Out of screen
                continue;
            }

            const bounds = waypointData.screenBounds;
            const parts = waypointData.parts;
            const contentPaddingX = 7 * scale;
            const isSelected = mousePos && bounds.containsPoint(mousePos.x, mousePos.y);

            // Render the background rectangle
            parameters.context.globalAlpha = this.currentMarkerOpacity * (isSelected ? 1 : 0.7);
            parameters.context.fillStyle = "rgba(255, 255, 255, 0.7)";
            parameters.context.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);

            // Render the text
            let textWidth = 0;
            for (let j = 0; j < parts.length; ++j) {
                const part = parts[j];
                if (part.item) {
                    const canvas = this.getWaypointCanvas(part.text);
                    const itemSize = 14 * scale;
                    parameters.context.drawImage(
                        canvas,
                        bounds.x + contentPaddingX + 6 * scale + textWidth,
                        bounds.y + bounds.h / 2 - itemSize / 2,
                        itemSize,
                        itemSize
                    );
                    textWidth += 14 * scale;
                } else {
                    // Render the text
                    parameters.context.fillStyle = "#000";
                    parameters.context.textBaseline = "middle";
                    parameters.context.fillText(
                        part.text,
                        bounds.x + contentPaddingX + 6 * scale + textWidth,
                        bounds.y + bounds.h / 2
                    );
                    parameters.context.textBaseline = "alphabetic";
                    textWidth += this.getTextWidth(part.text);
                }
            }

            // Render the small icon on the left
            this.waypointSprite.drawCentered(
                parameters.context,
                bounds.x + contentPaddingX,
                bounds.y + bounds.h / 2,
                bounds.h * 0.7
            );
        }

        parameters.context.textBaseline = "alphabetic";
        parameters.context.globalAlpha = 1;
    }
}
