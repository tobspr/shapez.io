import { Entity } from "./entity";
import { SOUNDS } from "../platform/sound";
import { KEYMAPPINGS } from "./key_action_mapper";
import { createLogger } from "../core/logging";
const logger = createLogger("ingame/history");

class UserAction {
    constructor(size = 1) {
        this.size = size;
    }

    get canUndo() {
        assert(false, "NOT IMPLEMENTED !!!");
        return false;
    }

    undo() {
        assert(false, "NOT IMPLEMENTED !!!");
    }

    postUndo() {
        assert(false, "NOT IMPLEMENTED !!!");
    }

    /**
     * @return {UserAction}
     */
    redoAction() {
        assert(false, "NOT IMPLEMENTED !!!");
        return this;
    }
}

class ActionBuildOne extends UserAction {
    constructor(root, entity) {
        super();
        this.root = root;
        this.entity = entity;
    }

    undo() {
        this.root.map.removeStaticEntity(this.entity);
        this.root.entityMgr.destroyEntity(this.entity);
    }

    postUndo() {
        this.root.entityMgr.processDestroyList();
        this.root.soundProxy.playUi(SOUNDS.destroyBuilding);
    }

    redoAction() {
        return new ActionRemoveOne(this.root, this.entity);
    }

    get canUndo() {
        return this.root.logic.canDeleteBuilding(this.entity);
    }
}

class ActionRemoveOne extends UserAction {
    constructor(root, entity) {
        super();
        this.root = root;
        this.entity = entity;
    }

    undo() {
        const entity = this.entity;
        entity.destroyed = false;
        entity.queuedForDestroy = false;
        this.root.logic.freeEntityAreaBeforeBuild(entity);
        this.root.map.placeStaticEntity(entity);
        this.root.entityMgr.registerEntity(entity);
    }

    postUndo() {
        this.root.soundProxy.playUi(SOUNDS.placeBuilding);
    }

    get canUndo() {
        return this.root.logic.checkCanPlaceEntity(this.entity);
    }

    redoAction() {
        return new ActionBuildOne(this.root, this.entity);
    }
}

class ComplexAction extends UserAction {
    constructor(root, actionArray) {
        super();
        this.root = root;
        this.actionArray = [...actionArray].reverse();
    }

    get canUndo() {
        return this.actionArray.every(a => a.canUndo);
    }

    undo() {
        this.actionArray.forEach(a => a.undo());
    }

    postUndo() {
        const haveRemove = this.actionArray.some(e => e instanceof ActionRemoveOne);
        const haveBuild = this.actionArray.some(e => e instanceof ActionBuildOne);

        if (haveRemove) {
            this.root.soundProxy.playUi(SOUNDS.placeBuilding);
        }

        if (haveBuild) {
            this.root.entityMgr.processDestroyList();
            this.root.soundProxy.playUi(SOUNDS.destroyBuilding);
        }
    }

    redoAction() {
        const redoActions = this.actionArray.map(a => a.redoAction());
        return new ComplexAction(this.root, redoActions);
    }
}

export class ActionBuilder {
    constructor(root) {
        this.root = root;
        this.actionArray = [];
    }

    /**
     * @param {Entity} entity - newly build entity
     * @param {Entity[]} removed - entities in the way
     */
    placeBuilding(entity, removed = []) {
        removed.forEach(e => this.removeBuilding(e));
        this.actionArray.push(new ActionBuildOne(this.root, entity));
        return this;
    }

    /**
     * @param {Entity} entity
     */
    removeBuilding(entity) {
        this.actionArray.push(new ActionRemoveOne(this.root, entity));
        return this;
    }

    /**
     * @param {Entity[]} entities
     */
    bulkRemoveBuildings(entities) {
        entities.forEach(e => this.actionArray.push(new ActionRemoveOne(this.root, e)));
        return this;
    }

    build() {
        if (this.actionArray.length > 1) {
            return new ComplexAction(this.root, this.actionArray);
        }
        if (this.actionArray.length === 1) {
            return this.actionArray.pop();
        }
    }
}

class LiFoQueue {
    constructor(size = 20) {
        this._size = size;
        this.items = [];
    }

    enqueue(element) {
        if (this._size < this.items.length + 1) {
            this.items.shift();
        }
        this.items.push(element);
    }

    dequeue() {
        return this.items.pop();
    }

    clear() {
        this.items = [];
    }

    isEmpty() {
        return !this.items.length;
    }
}

export class HistoryManager {
    constructor(root) {
        this.root = root;
        this._forUndo = new LiFoQueue(100);
        this._forRedo = new LiFoQueue(20);

        this.initializeBindings();
    }

    initializeBindings() {
        this.root.keyMapper.getBinding(KEYMAPPINGS.placement.undo).add(this._undo, this);
        this.root.keyMapper.getBinding(KEYMAPPINGS.placement.redo).add(this._redo, this);
    }

    get canUndo() {
        return !this._forUndo.isEmpty();
    }

    get canRedo() {
        return !this._forRedo.isEmpty();
    }

    addAction(action) {
        this._forRedo.clear();
        this._forUndo.enqueue(action);
    }

    _undo() {
        const action = this._forUndo.dequeue();
        if (!action) {
            return;
        }
        if (!action.canUndo) {
            return;
        }
        action.undo();
        action.postUndo();
        this._forRedo.enqueue(action.redoAction());
    }

    _redo() {
        const action = this._forRedo.dequeue();
        if (!action) {
            return;
        }
        if (!action.canUndo) {
            return;
        }
        action.undo();
        action.postUndo();
        this._forUndo.enqueue(action.redoAction());
    }
}
