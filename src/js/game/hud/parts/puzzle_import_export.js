import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { ReadWriteProxy } from "../../../core/read_write_proxy";
import { generateFileDownload, makeDiv, startFileChoose, waitNextFrame } from "../../../core/utils";
import { PuzzleSerializer } from "../../../savegame/puzzle_serializer";
import { T } from "../../../translations";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { PuzzleGameMode } from "../../modes/puzzle";
import { BaseHUDPart } from "../base_hud_part";

export class HUDPuzzleImportExport extends BaseHUDPart {
    constructor(root) {
        super(root);
    }

    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_PuzzleImportExport");
        this.importButton = document.createElement("button");
        this.importButton.classList.add("button", "import");
        this.element.appendChild(this.importButton);

        this.exportButton = document.createElement("button");
        this.exportButton.classList.add("button", "export");
        this.element.appendChild(this.exportButton);

        this.trackClicks(this.importButton, this.importPuzzle);

        this.trackClicks(this.exportButton, () => {
            const { yes } = this.root.hud.parts.dialogs.showWarning(
                T.dialogs.puzzleExport.title,
                T.dialogs.puzzleExport.desc,
                ["no", "yes:good:enter"]
            );
            yes.add(() => this.exportPuzzle());
        });
    }

    initialize() {}

    importPuzzle() {
        startFileChoose(".bin").then(file => {
            if (file) {
                const closeLoader = this.root.hud.parts.dialogs.showLoadingDialog("Importing Puzzle");
                waitNextFrame().then(() => {
                    const reader = new FileReader();
                    reader.addEventListener("load", event => {
                        const fileContents = String(event.target.result);

                        /** @type {import("../../../savegame/savegame_typedefs").PuzzleGameData} */
                        let gameData;

                        try {
                            gameData = ReadWriteProxy.deserializeObject(fileContents);
                        } catch (err) {
                            closeLoader();
                            this.root.hud.parts.dialogs.showWarning(T.global.error, String(err));
                            return;
                        }

                        const mode = /** @type {PuzzleGameMode} */ (this.root.gameMode);
                        let errorText;
                        try {
                            // set excluded buildings first so if we get an error we haven't removed buildings yet
                            const toolbar = this.root.hud.parts.buildingsToolbar;
                            const handles = toolbar.buildingHandles;
                            const ids = gMetaBuildingRegistry.getAllIds();

                            for (let i = 0; i < ids.length; ++i) {
                                const handle = handles[ids[i]];
                                if (handle && !toolbar.inRequiredBuildings(handle.metaBuilding)) {
                                    const locked = gameData.excludedBuildings.includes(ids[i]);

                                    toolbar.toggleBuildingLock(handle.metaBuilding, locked);
                                }
                            }

                            for (const entity of this.root.entityMgr.getAllWithComponent(
                                StaticMapEntityComponent
                            )) {
                                this.root.map.removeStaticEntity(entity);
                                this.root.entityMgr.destroyEntity(entity);
                            }
                            this.root.entityMgr.processDestroyList();

                            mode.zoneWidth = gameData.bounds.w;
                            mode.zoneHeight = gameData.bounds.h;
                            this.root.hud.parts.puzzleEditorSettings.updateZoneValues();

                            errorText = new PuzzleSerializer().deserializePuzzle(this.root, gameData);
                        } catch (ex) {
                            errorText = ex.message || ex;
                        }

                        if (errorText) {
                            this.root.hud.parts.dialogs.showWarning(
                                T.dialogs.puzzleLoadError.title,
                                T.dialogs.puzzleLoadError.desc + " " + errorText
                            );
                        } else {
                            this.root.hud.parts.dialogs.showInfo(
                                T.dialogs.puzzleImport.title,
                                T.dialogs.puzzleImport.desc
                            );
                        }
                        closeLoader();
                    });
                    reader.readAsText(file);
                });
            }
        });
    }

    exportPuzzle() {
        const serialized = new PuzzleSerializer().generateDumpFromGameRoot(this.root);

        const data = ReadWriteProxy.serializeObject(serialized);
        const filename = "puzzle.bin";
        generateFileDownload(filename, data);
    }
}
