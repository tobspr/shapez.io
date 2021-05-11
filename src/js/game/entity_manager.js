import { arrayDeleteValue, newEmptyMap, fastArrayDeleteValue } from "../core/utils";
import { Component } from "./component";
import { GameRoot } from "./root";
import { Entity } from "./entity";
import { BasicSerializableObject, types } from "../savegame/serialization";
import { createLogger } from "../core/logging";
import { globalConfig } from "../core/config";

const logger = createLogger("entity_manager");

// Manages all entities

// NOTICE: We use arrayDeleteValue instead of fastArrayDeleteValue since that does not preserve the order
// This is slower but we need it for the street path generation

export class EntityManager extends BasicSerializableObject {
    constructor(root) {
        super();

        /** @type {GameRoot} */
        this.root = root;

        /** @type {Array<Entity>} */
        this.entities = [];

        // We store a separate list with entities to destroy, since we don't destroy
        // them instantly
        /** @type {Array<Entity>} */
        this.destroyList = [];

        // Store a map from componentid to entities - This is used by the game system
        // for faster processing
        /** @type {Object.<string, Array<Entity>>} */
        this.componentToEntity = newEmptyMap();

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
        return this.entities.length + " entities [" + this.destroyList.length + " to kill]";
    }

    // Main update
    update() {
        this.processDestroyList();
    }

    /**
     * Registers a new entity
     * @param {Entity} entity
     * @param {number=} uid Optional predefined uid
     */
    registerEntity(entity, uid = null, blueprint = false) {
        if (G_IS_DEV && !globalConfig.debug.disableSlowAsserts) {
            assert(this.entities.indexOf(entity) < 0, `RegisterEntity() called twice for entity ${entity}`);
        }
        assert(!entity.destroyed, `Attempting to register destroyed entity ${entity}`);

        if (G_IS_DEV && !globalConfig.debug.disableSlowAsserts && uid !== null) {
            assert(!this.findByUid(uid, false), "Entity uid already taken: " + uid);
            assert(uid >= 0 && uid < Number.MAX_SAFE_INTEGER, "Invalid uid passed: " + uid);
        }

        this.entities.push(entity);

        // Register into the componentToEntity map
        for (const componentId in entity.components) {
            if (entity.components[componentId]) {
                if (this.componentToEntity[componentId]) {
                    this.componentToEntity[componentId].push(entity);
                } else {
                    this.componentToEntity[componentId] = [entity];
                }
            }
        }

        // Give each entity a unique id
        entity.uid = uid ? uid : this.generateUid();
        entity.registered = true;

        this.root.signals.entityAdded.dispatch(entity, blueprint);
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
        if (this.componentToEntity[componentId]) {
            this.componentToEntity[componentId].push(entity);
        } else {
            this.componentToEntity[componentId] = [entity];
        }
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

        fastArrayDeleteValue(this.componentToEntity[componentId], entity);
        this.root.signals.entityComponentRemoved.dispatch(entity);
    }

    /**
     * Finds an entity buy its uid, kinda slow since it loops over all entities
     * @param {number} uid
     * @param {boolean=} errorWhenNotFound
     * @returns {Entity}
     */
    findByUid(uid, errorWhenNotFound = true) {
        const arr = this.entities;
        for (let i = 0, len = arr.length; i < len; ++i) {
            const entity = arr[i];
            if (entity.uid === uid) {
                if (entity.queuedForDestroy || entity.destroyed) {
                    if (errorWhenNotFound) {
                        logger.warn("Entity with UID", uid, "not found (destroyed)");
                    }
                    return null;
                }
                return entity;
            }
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
        const result = new Map();
        const array = this.entities;
        for (let i = 0, len = array.length; i < len; ++i) {
            const entity = array[i];
            if (!entity.queuedForDestroy && !entity.destroyed) {
                result.set(entity.uid, entity);
            }
        }
        return result;
    }

    /**
     * Returns all entities having the given component
     * @param {typeof Component} componentHandle
     * @returns {Array<Entity>} entities
     */
    getAllWithComponent(componentHandle) {
        return this.componentToEntity[componentHandle.getId()] || [];
    }

    /**
     * Unregisters all components of an entity from the component to entity mapping
     * @param {Entity} entity
     */
    unregisterEntityComponents(entity) {
        for (const componentId in entity.components) {
            if (entity.components[componentId]) {
                arrayDeleteValue(this.componentToEntity[componentId], entity);
            }
        }
    }

    // Processes the entities to destroy and actually destroys them
    /* eslint-disable max-statements */
    processDestroyList() {
        for (let i = 0; i < this.destroyList.length; ++i) {
            const entity = this.destroyList[i];

            // Remove from entities list
            arrayDeleteValue(this.entities, entity);

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

        if (this.destroyList.indexOf(entity) < 0) {
            this.destroyList.push(entity);
            entity.queuedForDestroy = true;
            this.root.signals.entityQueuedForDestroy.dispatch(entity);
        } else {
            assert(false, "Trying to destroy entity twice");
        }
    }
}
