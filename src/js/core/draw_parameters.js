import { globalConfig } from "./config";

export class DrawParameters {
    constructor({ context, visibleRect, desiredAtlasScale, zoomLevel, root }) {
        /** @type {CanvasRenderingContext2D} */
        this.context = context;

        /** @type {import("./rectangle").Rectangle} */
        this.visibleRect = visibleRect;

        /** @type {string} */
        this.desiredAtlasScale = desiredAtlasScale;

        /** @type {number} */
        this.zoomLevel = zoomLevel;

        /** @type {import("../game/root").GameRoot} */
        this.root = root;
    }
}
