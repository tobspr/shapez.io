import { ReadWriteProxy } from "../../../core/read_write_proxy";
import { generateFileDownload, makeDiv } from "../../../core/utils";
import { PuzzleSerializer } from "../../../savegame/puzzle_serializer";
import { T } from "../../../translations";
import { BaseHUDPart } from "../base_hud_part";

export class HUDPuzzleEditorDownload extends BaseHUDPart {
    constructor(root) {
        super(root);
    }

    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_PuzzleEditorDownload");
        this.button = document.createElement("button");
        this.button.classList.add("button");
        this.element.appendChild(this.button);

        this.trackClicks(this.button, () => {
            const { ok } = this.root.hud.parts.dialogs.showWarning(
                T.dialogs.puzzleDownload.title,
                T.dialogs.puzzleDownload.desc,
                ["cancel", "ok:good:enter"]
            );
            ok.add(() => this.downloadPuzzle());
        });
    }

    initialize() {}

    downloadPuzzle() {
        const serialized = new PuzzleSerializer().generateDumpFromGameRoot(this.root);

        const data = ReadWriteProxy.serializeObject(serialized);
        const filename = "puzzle.bin";
        generateFileDownload(filename, data);
    }
}
