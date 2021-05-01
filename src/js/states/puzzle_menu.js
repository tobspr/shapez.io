import { globalConfig } from "../core/config";
import { createLogger } from "../core/logging";
import { TextualGameState } from "../core/textual_game_state";
import { formatBigNumberFull } from "../core/utils";
import { enumGameModeIds } from "../game/game_mode";
import { ShapeDefinition } from "../game/shape_definition";
import { T } from "../translations";

const categories = ["levels", "new", "top-rated", "mine"];

/**
 * @type {import("../savegame/savegame_typedefs").PuzzleMetadata}
 */
const SAMPLE_PUZZLE = {
    id: 1,
    shortKey: "CuCuCuCu",
    downloads: 0,
    likes: 0,
    title: "Level 1",
    author: "verylongsteamnamewhichbreaks",
    completed: false,
};

/**
 * @type {import("../savegame/savegame_typedefs").PuzzleMetadata[]}
 */
const BUILTIN_PUZZLES = G_IS_DEV
    ? [
          //   { ...SAMPLE_PUZZLE, completed: true },
          //   { ...SAMPLE_PUZZLE, completed: true },
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
          //   SAMPLE_PUZZLE,
      ]
    : [];

const logger = createLogger("puzzle-menu");

export class PuzzleMenuState extends TextualGameState {
    constructor() {
        super("PuzzleMenuState");
        this.loading = false;
        this.activeCategory = "";
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
                    ${categories
                        .map(
                            category => `
                             <button data-category="${category}" class="styledButton category">${T.puzzleMenu.categories[category]}</button>
                        `
                        )
                        .join("")}
                </div>

                <div class="puzzles" id="mainContainer">
                    <div class="puzzle"></div>
                    <div class="puzzle"></div>
                    <div class="puzzle"></div>
                    <div class="puzzle"></div>
                </div>
        `;

        return html;
    }

    selectCategory(category) {
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
            elem.classList.toggle("completed", puzzle.completed);

            if (puzzle.title) {
                const title = document.createElement("div");
                title.classList.add("title");
                title.innerText = puzzle.title;
                elem.appendChild(title);
            }

            if (puzzle.author) {
                const author = document.createElement("div");
                author.classList.add("author");
                author.innerText = "by " + puzzle.author;
                elem.appendChild(author);
            }

            const stats = document.createElement("div");
            stats.classList.add("stats");
            elem.appendChild(stats);

            const downloads = document.createElement("div");
            downloads.classList.add("downloads");
            downloads.innerText = String(puzzle.downloads);
            stats.appendChild(downloads);

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
     *
     * @param {*} category
     * @returns {Promise<import("../savegame/savegame_typedefs").PuzzleMetadata[]}
     */
    getPuzzlesForCategory(category) {
        if (category === "levels") {
            return Promise.resolve(BUILTIN_PUZZLES);
        }

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
                const savegame = this.app.savegameMgr.createNewSavegame();
                this.moveToState("InGameState", {
                    gameModeId: enumGameModeIds.puzzlePlay,
                    gameModeParameters: {
                        puzzle: puzzleData,
                    },
                    savegame,
                });
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

    onEnter(payload) {
        this.selectCategory("levels");

        if (payload && payload.error) {
            this.dialogs.showWarning(payload.error.title, payload.error.desc);
        }

        for (const category of categories) {
            const button = this.htmlElement.querySelector(`[data-category="${category}"]`);
            this.trackClicks(button, () => this.selectCategory(category));
        }

        this.trackClicks(this.htmlElement.querySelector("button.createPuzzle"), () => this.createNewPuzzle());

        if (G_IS_DEV && globalConfig.debug.testPuzzleMode) {
            // this.createNewPuzzle();
            this.playPuzzle(SAMPLE_PUZZLE);
        }
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

        const savegame = this.app.savegameMgr.createNewSavegame();
        this.moveToState("InGameState", {
            gameModeId: enumGameModeIds.puzzleEdit,
            savegame,
        });
    }
}