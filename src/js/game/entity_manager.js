import { Component } from "./component";
import { GameRoot } from "./root";
import { Entity } from "./entity";
import { BasicSerializableObject, types } from "../savegame/serialization";
import { createLogger } from "../core/logging";
import { globalConfig } from "../core/config";

const logger = createLogger("entity_manager");

// Manages all entities

/** @typedef {number} EntityUid */
/** @typedef {string} ComponentId */

export class EntityManager extends BasicSerializableObject {
    constructor(root) {
        super();

        /** @type {GameRoot} */
        this.root = root;

        /** @type {Set<Entity>} */
        this.entities = new Set();

        /** @type {Map<EntityUid, Entity>} */
        this.entitiesByUid = new Map();

        /** @type {Map<ComponentId, Set<Entity>>} */
        this.entitiesByComponent = new Map();

        // We store a separate list with entities to destroy, since we don't destroy
        // them instantly
        /** @type {Array<Entity>} */
        this.destroyList = [];

        // Store the next uid to use
        this.nextUid = 10000;
    }

    static getId() {
        return "EntityManager";
    }

    static getSchema() {
        return {
            nextUid: types.uint,
        };
    }

    getStatsText() {
        return this.entities.size + " entities [" + this.destroyList.length + " to kill]";
    }

    // Main update
    update() {
        this.processDestroyList();
    }

    /**
     * @param {Entity} entity
     * @param {ComponentId} componentId
     */
    addToComponentMap(entity, componentId) {
        let set;
        if ((set = this.entitiesByComponent.get(componentId))) {
            set.add(entity);
        } else {
            this.entitiesByComponent.set(componentId, new Set([entity]));
        }
    }

    /**
     * Registers a new entity
     * @param {Entity} entity
     * @param {number=} uid Optional predefined uid
     */
    registerEntity(entity, uid = null) {
        if (G_IS_DEV && !globalConfig.debug.disableSlowAsserts) {
            assert(!this.entities.has(entity), `RegisterEntity() called twice for entity ${entity}`);
        }
        assert(!entity.destroyed, `Attempting to register destroyed entity ${entity}`);

        if (G_IS_DEV && !globalConfig.debug.disableSlowAsserts && uid !== null) {
            assert(!this.findByUid(uid, false), "Entity uid already taken: " + uid);
            assert(uid >= 0 && uid < Number.MAX_SAFE_INTEGER, "Invalid uid passed: " + uid);
        }

        // Give each entity a unique id
        entity.uid = uid || this.generateUid();

        this.entities.add(entity);
        this.entitiesByUid.set(uid, entity);

        // Register into the componentToEntity map
        for (const componentId in entity.components) {
            this.addToComponentMap(entity, componentId);
        }

        entity.registered = true;

        this.root.signals.entityAdded.dispatch(entity);
    }

    /**
     * Generates a new uid
     * @returns {number}
     */
    generateUid() {
        return this.nextUid++;
    }

    /**
     * Call to attach a new component after the creation of the entity
     * @param {Entity} entity
     * @param {Component} component
     */
    attachDynamicComponent(entity, component) {
        entity.addComponent(component, true);
        const componentId = /** @type {typeof Component} */ (component.constructor).getId();

        this.addToComponentMap(entity, componentId);
        this.root.signals.entityGotNewComponent.dispatch(entity);
    }

    /**
     * Call to remove a component after the creation of the entity
     * @param {Entity} entity
     * @param {typeof Component} component
     */
    removeDynamicComponent(entity, component) {
        entity.removeComponent(component, true);
        const componentId = /** @type {typeof Component} */ (component.constructor).getId();

        this.entitiesByComponent.get(componentId).delete(entity);
        this.root.signals.entityComponentRemoved.dispatch(entity);
    }

    /**
     * Finds an entity buy its uid, kinda slow since it loops over all entities
     * @param {number} uid
     * @param {boolean=} errorWhenNotFound
     * @returns {Entity}
     */
    findByUid(uid, errorWhenNotFound = true) {
        const entity = this.entitiesByUid.get(uid);
        if (entity) {
            if (entity.queuedForDestroy || entity.destroyed) {
                if (errorWhenNotFound) {
                    logger.warn("Entity with UID", uid, "not found (destroyed)");
                }
                return null;
            }
            return entity;
        }
        if (errorWhenNotFound) {
            logger.warn("Entity with UID", uid, "not found");
        }
        return null;
    }

    /**
     * Returns a map which gives a mapping from UID to Entity.
     * This map is not updated.
     *
     * @returns {Map<number, Entity>}
     */
    getFrozenUidSearchMap() {
        return this.entitiesByUid;
    }

    /**
     * Returns all entities having the given component
     * @param {typeof Component} componentHandle
     * @returns {Array<Entity>} entities
     */
    getAllWithComponent(componentHandle) {
        const set = this.entitiesByComponent.get(componentHandle.getId());
        if (!set) return [];
        else return [...set.values()];
    }

    /**
     * Unregisters all components of an entity from the component to entity mapping
     * @param {Entity} entity
     */
    unregisterEntityComponents(entity) {
        for (const componentId in entity.components) {
            const set = this.entitiesByComponent.get(componentId);
            if (set) set.delete(entity);
        }
    }

    // Processes the entities to destroy and actually destroys them
    /* eslint-disable max-statements */
    processDestroyList() {
        for (let i = this.destroyList.length - 1; i >= 0; --i) {
            const entity = this.destroyList[i];

            // Remove from entities list
            this.entities.delete(entity);
            this.entitiesByUid.delete(entity.uid);

            // Remove from componentToEntity list
            this.unregisterEntityComponents(entity);

            entity.registered = false;
            entity.destroyed = true;

            this.root.signals.entityDestroyed.dispatch(entity);
        }

        this.destroyList = [];
    }

    /**
     * Queues an entity for destruction
     * @param {Entity} entity
     */
    destroyEntity(entity) {
        if (entity.destroyed) {
            logger.error("Tried to destroy already destroyed entity:", entity.uid);
            return;
        }

        if (entity.queuedForDestroy) {
            logger.error("Trying to destroy entity which is already queued for destroy!", entity.uid);
            return;
        }

        this.destroyList.push(entity);
        entity.queuedForDestroy = true;
        this.root.signals.entityQueuedForDestroy.dispatch(entity);
    }
}
