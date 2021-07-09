import { createLogger } from "../core/logging";
import { DialogWithForm } from "../core/modal_dialog_elements";
import { FormElementInput } from "../core/modal_dialog_forms";
import { ReadWriteProxy } from "../core/read_write_proxy";
import { TextualGameState } from "../core/textual_game_state";
import { formatBigNumberFull, startFileChoose, waitNextFrame } from "../core/utils";
import { enumGameModeIds } from "../game/game_mode";
import { ShapeDefinition } from "../game/shape_definition";
import { MUSIC } from "../platform/sound";
import { Savegame } from "../savegame/savegame";
import { T } from "../translations";

const navigation = {
    categories: ["official", "top-rated", "trending", "trending-weekly", "new"],
    difficulties: ["easy", "medium", "hard"],
    account: ["mine", "completed"],
};

const logger = createLogger("puzzle-menu");

let lastCategory = "official";

export class PuzzleMenuState extends TextualGameState {
    constructor() {
        super("PuzzleMenuState");
        this.loading = false;
        this.activeCategory = "";
    }

    getThemeMusic() {
        return MUSIC.puzzle;
    }

    getStateHeaderTitle() {
        return T.puzzleMenu.title;
    }
    /**
     * Overrides the GameState implementation to provide our own html
     */
    internalGetFullHtml() {
        let headerHtml = `
            <div class="headerBar">
                <h1><button class="backButton"></button> ${this.getStateHeaderTitle()}</h1>

                <div class="actions">
                    <button class="styledButton loadPuzzle">${T.puzzleMenu.loadPuzzle}</button>
                    <button class="styledButton createPuzzle">+ ${T.puzzleMenu.createPuzzle}</button>
                </div>

            </div>`;

        return `
            ${headerHtml}
            <div class="container">
                    ${this.getInnerHTML()}
            </div>
        `;
    }

    getMainContentHTML() {
        let html = `
                <div class="categoryChooser">

                    <div class="categories rootCategories">
                    ${Object.keys(navigation)
                        .map(
                            rootCategory =>
                                `<button data-root-category="${rootCategory}" class="styledButton category root">${T.puzzleMenu.categories[rootCategory]}</button>`
                        )
                        .join("")}
                    </div>

                    <div class="categories subCategories">
                    </div>

                </div>


                <div class="puzzles" id="mainContainer"></div>
        `;

        return html;
    }

    selectCategory(category) {
        lastCategory = category;
        if (category === this.activeCategory) {
            return;
        }

        if (this.loading) {
            return;
        }

        this.loading = true;
        this.activeCategory = category;

        const activeCategory = this.htmlElement.querySelector(".active[data-category]");
        if (activeCategory) {
            activeCategory.classList.remove("active");
        }

        this.htmlElement.querySelector(`[data-category="${category}"]`).classList.add("active");

        const container = this.htmlElement.querySelector("#mainContainer");
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const loadingElement = document.createElement("div");
        loadingElement.classList.add("loader");
        loadingElement.innerText = T.global.loading + "...";
        container.appendChild(loadingElement);

        this.asyncChannel
            .watch(this.getPuzzlesForCategory(category))
            .then(
                puzzles => this.renderPuzzles(puzzles),
                error => {
                    this.dialogs.showWarning(
                        T.dialogs.puzzleLoadFailed.title,
                        T.dialogs.puzzleLoadFailed.desc + " " + error
                    );
                    this.renderPuzzles([]);
                }
            )
            .then(() => (this.loading = false));
    }

    /**
     * Selects a root category
     * @param {string} rootCategory
     * @param {string=} category
     */
    selectRootCategory(rootCategory, category) {
        const subCategory = category || navigation[rootCategory][0];
        console.warn("Select root category", rootCategory, category, "->", subCategory);

        if (this.loading) {
            return;
        }
        if (this.activeCategory === subCategory) {
            return;
        }

        const activeCategory = this.htmlElement.querySelector(".active[data-root-category]");
        if (activeCategory) {
            activeCategory.classList.remove("active");
        }

        const newActiveCategory = this.htmlElement.querySelector(`[data-root-category="${rootCategory}"]`);
        if (newActiveCategory) {
            newActiveCategory.classList.add("active");
        }

        // Rerender buttons

        const subContainer = this.htmlElement.querySelector(".subCategories");
        while (subContainer.firstChild) {
            subContainer.removeChild(subContainer.firstChild);
        }

        const children = navigation[rootCategory];
        for (const category of children) {
            const button = document.createElement("button");
            button.setAttribute("data-category", category);
            button.classList.add("styledButton", "category", "child");
            button.innerText = T.puzzleMenu.categories[category];
            this.trackClicks(button, () => this.selectCategory(category));
            subContainer.appendChild(button);
        }

        this.selectCategory(subCategory);
    }

    /**
     *
     * @param {import("../savegame/savegame_typedefs").PuzzleMetadata[]} puzzles
     */
    renderPuzzles(puzzles) {
        const container = this.htmlElement.querySelector("#mainContainer");
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        for (const puzzle of puzzles) {
            const elem = document.createElement("div");
            elem.classList.add("puzzle");
            elem.setAttribute("data-puzzle-id", String(puzzle.id));

            if (this.activeCategory !== "mine") {
                elem.classList.toggle("completed", puzzle.completed);
            }

            if (puzzle.title) {
                const title = document.createElement("div");
                title.classList.add("title");
                title.innerText = puzzle.title;
                elem.appendChild(title);
            }

            if (puzzle.author && !["official", "mine"].includes(this.activeCategory)) {
                const author = document.createElement("div");
                author.classList.add("author");
                author.innerText = "by " + puzzle.author;
                elem.appendChild(author);
            }

            const stats = document.createElement("div");
            stats.classList.add("stats");
            elem.appendChild(stats);

            if (
                puzzle.downloads > 3 &&
                !["official", "easy", "medium", "hard"].includes(this.activeCategory)
            ) {
                const difficulty = document.createElement("div");
                difficulty.classList.add("difficulty");

                const completionPercentage = Math.max(
                    0,
                    Math.min(100, Math.round((puzzle.completions / puzzle.downloads) * 100.0))
                );
                difficulty.innerText = completionPercentage + "%";
                stats.appendChild(difficulty);

                if (completionPercentage < 40) {
                    difficulty.classList.add("stage--hard");
                    difficulty.innerText = T.puzzleMenu.difficulties.hard;
                } else if (completionPercentage < 80) {
                    difficulty.classList.add("stage--medium");
                    difficulty.innerText = T.puzzleMenu.difficulties.medium;
                } else {
                    difficulty.classList.add("stage--easy");
                    difficulty.innerText = T.puzzleMenu.difficulties.easy;
                }
            }

            if (this.activeCategory === "mine") {
                const downloads = document.createElement("div");
                downloads.classList.add("downloads");
                downloads.innerText = String(puzzle.downloads);
                stats.appendChild(downloads);
                stats.classList.add("withDownloads");
            }

            const likes = document.createElement("div");
            likes.classList.add("likes");
            likes.innerText = formatBigNumberFull(puzzle.likes);
            stats.appendChild(likes);

            const definition = ShapeDefinition.fromShortKey(puzzle.shortKey);
            const canvas = definition.generateAsCanvas(100 * this.app.getEffectiveUiScale());

            const icon = document.createElement("div");
            icon.classList.add("icon");
            icon.appendChild(canvas);
            elem.appendChild(icon);

            if (this.activeCategory === "mine") {
                const deleteButton = document.createElement("button");
                deleteButton.classList.add("styledButton", "delete");
                this.trackClicks(
                    deleteButton,
                    () => {
                        this.tryDeletePuzzle(puzzle);
                    },
                    {
                        consumeEvents: true,
                        preventClick: true,
                        preventDefault: true,
                    }
                );
                elem.appendChild(deleteButton);
            }

            container.appendChild(elem);

            this.trackClicks(elem, () => this.playPuzzle(puzzle));
        }

        if (puzzles.length === 0) {
            const elem = document.createElement("div");
            elem.classList.add("empty");
            elem.innerText = T.puzzleMenu.noPuzzles;
            container.appendChild(elem);
        }
    }

    /**
     * @param {import("../savegame/savegame_typedefs").PuzzleMetadata} puzzle
     */
    tryDeletePuzzle(puzzle) {
        const signals = this.dialogs.showWarning(
            T.dialogs.puzzleDelete.title,
            T.dialogs.puzzleDelete.desc.replace("<title>", puzzle.title),
            ["delete:bad", "cancel:good"]
        );
        signals.delete.add(() => {
            const closeLoading = this.dialogs.showLoadingDialog();

            this.asyncChannel
                .watch(this.app.clientApi.apiDeletePuzzle(puzzle.id))
                .then(() => {
                    const element = this.htmlElement.querySelector("[data-puzzle-id='" + puzzle.id + "']");
                    if (element) {
                        element.remove();
                    }
                })
                .catch(err => {
                    this.dialogs.showWarning(T.global.error, String(err));
                })
                .then(closeLoading);
        });
    }

    /**
     *
     * @param {*} category
     * @returns {Promise<import("../savegame/savegame_typedefs").PuzzleMetadata[]>}
     */
    getPuzzlesForCategory(category) {
        const result = this.app.clientApi.apiListPuzzles(category);
        return result.catch(err => {
            logger.error("Failed to get", category, ":", err);
            throw err;
        });
    }

    /**
     *
     * @param {import("../savegame/savegame_typedefs").PuzzleMetadata} puzzle
     */
    playPuzzle(puzzle) {
        const closeLoading = this.dialogs.showLoadingDialog();

        this.app.clientApi.apiDownloadPuzzle(puzzle.id).then(
            puzzleData => {
                closeLoading();
                logger.log("Got puzzle:", puzzleData);
                this.startLoadedPuzzle(puzzleData);
            },
            err => {
                closeLoading();
                logger.error("Failed to download puzzle", puzzle.id, ":", err);
                this.dialogs.showWarning(
                    T.dialogs.puzzleDownloadError.title,
                    T.dialogs.puzzleDownloadError.desc + " " + err
                );
            }
        );
    }

    /**
     *
     * @param {import("../savegame/savegame_typedefs").PuzzleFullData} puzzle
     */
    startLoadedPuzzle(puzzle) {
        const savegame = this.createEmptySavegame();
        this.moveToState("InGameState", {
            gameModeId: enumGameModeIds.puzzlePlay,
            gameModeParameters: {
                puzzle,
            },
            savegame,
        });
    }

    onEnter(payload) {
        // Find old category
        let rootCategory = "categories";
        for (const [id, children] of Object.entries(navigation)) {
            if (children.includes(lastCategory)) {
                rootCategory = id;
                break;
            }
        }

        this.selectRootCategory(rootCategory, lastCategory);

        if (payload && payload.error) {
            this.dialogs.showWarning(payload.error.title, payload.error.desc);
        }

        for (const rootCategory of Object.keys(navigation)) {
            const button = this.htmlElement.querySelector(`[data-root-category="${rootCategory}"]`);
            this.trackClicks(button, () => this.selectRootCategory(rootCategory));
        }

        this.trackClicks(this.htmlElement.querySelector("button.createPuzzle"), () => this.createNewPuzzle());
        this.trackClicks(this.htmlElement.querySelector("button.loadPuzzle"), () => this.loadPuzzle());
    }

    createEmptySavegame() {
        return new Savegame(this.app, {
            internalId: "puzzle",
            metaDataRef: {
                internalId: "puzzle",
                lastUpdate: 0,
                version: 0,
                level: 0,
                name: "puzzle",
            },
        });
    }

    loadPuzzle() {
        const shortKeyInput = new FormElementInput({
            id: "shortKey",
            label: null,
            placeholder: "",
            defaultValue: "",
            validator: val => ShapeDefinition.isValidShortKey(val),
        });

        const dialog = new DialogWithForm({
            app: this.app,
            title: T.dialogs.puzzleLoadShortKey.title,
            desc: T.dialogs.puzzleLoadShortKey.desc,
            formElements: [shortKeyInput],
            buttons: ["ok:good:enter"],
        });
        this.dialogs.internalShowDialog(dialog);

        dialog.buttonSignals.ok.add(() => {
            const closeLoading = this.dialogs.showLoadingDialog();

            this.app.clientApi.apiDownloadPuzzleByKey(shortKeyInput.getValue()).then(
                puzzle => {
                    closeLoading();
                    this.startLoadedPuzzle(puzzle);
                },
                err => {
                    closeLoading();
                    this.dialogs.showWarning(
                        T.dialogs.puzzleDownloadError.title,
                        T.dialogs.puzzleDownloadError.desc + " " + err
                    );
                }
            );
        });
    }

    createNewPuzzle(force = false) {
        if (!force && !this.app.clientApi.isLoggedIn()) {
            const signals = this.dialogs.showWarning(
                T.dialogs.puzzleCreateOffline.title,
                T.dialogs.puzzleCreateOffline.desc,
                ["cancel:good", "continue:bad"]
            );
            signals.continue.add(() => this.createNewPuzzle(true));
            return;
        }

        const savegame = this.createEmptySavegame();
        this.moveToState("InGameState", {
            gameModeId: enumGameModeIds.puzzleEdit,
            gameModeParameters: {},
            savegame,
        });
    }

    importPuzzle() {
        startFileChoose(".bin").then(file => {
            if (file) {
                const closeLoader = this.dialogs.showLoadingDialog("Importing Puzzle");
                waitNextFrame().then(() => {
                    const reader = new FileReader();
                    reader.addEventListener("load", event => {
                        const fileContents = event.target.result.toString();

                        /** @type {import("../savegame/savegame_typedefs").PuzzleGameData} */
                        let gameData;

                        try {
                            gameData = ReadWriteProxy.deserializeObject(fileContents);
                        } catch (err) {
                            closeLoader();
                            this.dialogs.showWarning(T.global.error, String(err));
                            return;
                        }

                        const savegame = this.createEmptySavegame();
                        this.moveToState("InGameState", {
                            gameModeId: enumGameModeIds.puzzleEdit,
                            gameModeParameters: {
                                gameData,
                                startInTestMode: true,
                            },
                            savegame,
                        });
                    });
                    reader.readAsText(file);
                });
            }
        });
    }
}
