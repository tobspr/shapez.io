import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { gMetaBuildingRegistry } from "../../core/global_registries";
import { Loader } from "../../core/loader";
import { createLogger } from "../../core/logging";
import { AtlasSprite } from "../../core/sprites";
import { fastArrayDeleteValue } from "../../core/utils";
import { enumDirection, enumDirectionToVector, enumInvertedDirections, Vector } from "../../core/vector";
import { BeltPath } from "../belt_path";
import { MetaBeltBuilding } from "../buildings/belt";
import { getCodeFromBuildingData } from "../building_codes";
import { BeltComponent } from "../components/belt";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";
import { defaultBuildingVariant } from "../meta_building";

export const BELT_ANIM_COUNT = 14;

const logger = createLogger("belt");

/**
 * Manages all belts
 */
export class BeltSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [BeltComponent]);
        /**
         * @type {Object.<enumDirection, Array<AtlasSprite>>}
         */
        this.beltSprites = {
            [enumDirection.top]: Loader.getSprite("sprites/belt/built/forward_0.png"),
            [enumDirection.left]: Loader.getSprite("sprites/belt/built/left_0.png"),
            [enumDirection.right]: Loader.getSprite("sprites/belt/built/right_0.png"),
        };

        /**
         * @type {Object.<enumDirection, Array<AtlasSprite>>}
         */
        this.beltAnimations = {
            [enumDirection.top]: [],
            [enumDirection.left]: [],
            [enumDirection.right]: [],
        };

        for (let i = 0; i < BELT_ANIM_COUNT; ++i) {
            this.beltAnimations[enumDirection.top].push(
                Loader.getSprite("sprites/belt/built/forward_" + i + ".png")
            );
            this.beltAnimations[enumDirection.left].push(
                Loader.getSprite("sprites/belt/built/left_" + i + ".png")
            );
            this.beltAnimations[enumDirection.right].push(
                Loader.getSprite("sprites/belt/built/right_" + i + ".png")
            );
        }

        this.root.signals.entityDestroyed.add(this.onEntityDestroyed, this);
        this.root.signals.entityDestroyed.add(this.updateSurroundingBeltPlacement, this);

        // Notice: These must come *after* the entity destroyed signals
        this.root.signals.entityAdded.add(this.onEntityAdded, this);
        this.root.signals.entityAdded.add(this.updateSurroundingBeltPlacement, this);

        /** @type {Array<BeltPath>} */
        this.beltPaths = [];
    }

    static getId() {
        return "belt";
    }

    /**
     * Serializes all belt paths
     * @returns {Array<object>}
     */
    serializePaths() {
        let data = [];
        for (let i = 0; i < this.beltPaths.length; ++i) {
            data.push(this.beltPaths[i].serialize());
        }
        return data;
    }

    /**
     * Deserializes all belt paths
     * @param {Array<any>} data
     */
    deserializePaths(data) {
        if (!Array.isArray(data)) {
            return "Belt paths are not an array: " + typeof data;
        }

        for (let i = 0; i < data.length; ++i) {
            const path = BeltPath.fromSerialized(this.root, data[i]);
            // If path is a string, that means its an error
            if (!(path instanceof BeltPath)) {
                return "Failed to create path from belt data: " + path;
            }
            this.beltPaths.push(path);
        }

        if (this.beltPaths.length === 0) {
            // Old savegames might not have paths yet
            logger.warn("Recomputing belt paths (most likely the savegame is old or empty)");
            this.recomputeAllBeltPaths();
        } else {
            logger.warn("Restored", this.beltPaths.length, "belt paths");
        }

        if (G_IS_DEV && globalConfig.debug.checkBeltPaths) {
            this.debug_verifyBeltPaths();
        }
    }

    /**
     * Updates the belt placement after an entity has been added / deleted
     * @param {Entity} entity
     */
    updateSurroundingBeltPlacement(entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        const staticComp = entity.components.StaticMapEntity;
        if (!staticComp) {
            return;
        }

        const metaBelt = gMetaBuildingRegistry.findByClass(MetaBeltBuilding);
        // Compute affected area
        const originalRect = staticComp.getTileSpaceBounds();
        const affectedArea = originalRect.expandedInAllDirections(1);

        /** @type {Set<BeltPath>} */
        const changedPaths = new Set();

        for (let x = affectedArea.x; x < affectedArea.right(); ++x) {
            for (let y = affectedArea.y; y < affectedArea.bottom(); ++y) {
                if (originalRect.containsPoint(x, y)) {
                    // Make sure we don't update the original entity
                    continue;
                }

                const targetEntities = this.root.map.getLayersContentsMultipleXY(x, y);
                for (let i = 0; i < targetEntities.length; ++i) {
                    const targetEntity = targetEntities[i];

                    const targetBeltComp = targetEntity.components.Belt;
                    const targetStaticComp = targetEntity.components.StaticMapEntity;

                    if (!targetBeltComp) {
                        // Not a belt
                        continue;
                    }

                    const {
                        rotation,
                        rotationVariant,
                    } = metaBelt.computeOptimalDirectionAndRotationVariantAtTile({
                        root: this.root,
                        tile: new Vector(x, y),
                        rotation: targetStaticComp.originalRotation,
                        variant: defaultBuildingVariant,
                        layer: targetEntity.layer,
                    });

                    // Compute delta to see if anything changed
                    const newDirection = MetaBeltBuilding.variantToRotation[rotationVariant];

                    if (targetStaticComp.rotation !== rotation || newDirection !== targetBeltComp.direction) {
                        const originalPath = targetBeltComp.assignedPath;

                        // Ok, first remove it from its current path
                        this.deleteEntityFromPath(targetBeltComp.assignedPath, targetEntity);

                        // Change stuff
                        targetStaticComp.rotation = rotation;
                        metaBelt.updateVariants(targetEntity, rotationVariant, defaultBuildingVariant);

                        // Update code as well
                        targetStaticComp.code = getCodeFromBuildingData(
                            metaBelt,
                            defaultBuildingVariant,
                            rotationVariant
                        );

                        // Update the original path since it might have picked up the entit1y
                        originalPath.onPathChanged();

                        // Now add it again
                        this.addEntityToPaths(targetEntity);

                        // Sanity
                        if (G_IS_DEV && globalConfig.debug.checkBeltPaths) {
                            this.debug_verifyBeltPaths();
                        }

                        // Make sure the chunks know about the update
                        this.root.signals.entityChanged.dispatch(targetEntity);
                    }

                    if (targetBeltComp.assignedPath) {
                        changedPaths.add(targetBeltComp.assignedPath);
                    }
                }
            }
        }

        // notify all paths *afterwards* to avoid multi-updates
        changedPaths.forEach(path => path.onSurroundingsChanged());

        if (G_IS_DEV && globalConfig.debug.checkBeltPaths) {
            this.debug_verifyBeltPaths();
        }
    }

    /**
     * Called when an entity got destroyed
     * @param {Entity} entity
     */
    onEntityDestroyed(entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        if (!entity.components.Belt) {
            return;
        }

        const assignedPath = entity.components.Belt.assignedPath;
        assert(assignedPath, "Entity has no belt path assigned");
        this.deleteEntityFromPath(assignedPath, entity);
        if (G_IS_DEV && globalConfig.debug.checkBeltPaths) {
            this.debug_verifyBeltPaths();
        }
    }

    /**
     * Attempts to delete the belt from its current path
     * @param {BeltPath} path
     * @param {Entity} entity
     */
    deleteEntityFromPath(path, entity) {
        if (path.entityPath.length === 1) {
            // This is a single entity path, easy to do, simply erase whole path
            fastArrayDeleteValue(this.beltPaths, path);
            return;
        }

        // Notice: Since there might be circular references, it is important to check
        // which role the entity has
        if (path.isStartEntity(entity)) {
            // We tried to delete the start
            path.deleteEntityOnStart(entity);
        } else if (path.isEndEntity(entity)) {
            // We tried to delete the end
            path.deleteEntityOnEnd(entity);
        } else {
            // We tried to delete something inbetween
            const newPath = path.deleteEntityOnPathSplitIntoTwo(entity);
            this.beltPaths.push(newPath);
        }

        // Sanity
        entity.components.Belt.assignedPath = null;
    }

    /**
     * Adds the given entity to the appropriate paths
     * @param {Entity} entity
     */
    addEntityToPaths(entity) {
        const fromEntity = this.findSupplyingEntity(entity);
        const toEntity = this.findFollowUpEntity(entity);

        // Check if we can add the entity to the previous path
        if (fromEntity) {
            const fromPath = fromEntity.components.Belt.assignedPath;
            fromPath.extendOnEnd(entity);

            // Check if we now can extend the current path by the next path
            if (toEntity) {
                const toPath = toEntity.components.Belt.assignedPath;

                if (fromPath === toPath) {
                    // This is a circular dependency -> Ignore
                } else {
                    fromPath.extendByPath(toPath);

                    // Delete now obsolete path
                    fastArrayDeleteValue(this.beltPaths, toPath);
                }
            }
        } else {
            if (toEntity) {
                // Prepend it to the other path
                const toPath = toEntity.components.Belt.assignedPath;
                toPath.extendOnBeginning(entity);
            } else {
                // This is an empty belt path
                const path = new BeltPath(this.root, [entity]);
                this.beltPaths.push(path);
            }
        }
    }

    /**
     * Called when an entity got added
     * @param {Entity} entity
     */
    onEntityAdded(entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        if (!entity.components.Belt) {
            return;
        }

        this.addEntityToPaths(entity);
        if (G_IS_DEV && globalConfig.debug.checkBeltPaths) {
            this.debug_verifyBeltPaths();
        }
    }

    /**
     * Draws all belt paths
     * @param {DrawParameters} parameters
     */
    drawBeltItems(parameters) {
        for (let i = 0; i < this.beltPaths.length; ++i) {
            this.beltPaths[i].draw(parameters);
        }
    }

    /**
     * Verifies all belt paths
     */
    debug_verifyBeltPaths() {
        for (let i = 0; i < this.beltPaths.length; ++i) {
            this.beltPaths[i].debug_checkIntegrity("general-verify");
        }

        const belts = this.root.entityMgr.getAllWithComponent(BeltComponent);
        for (let i = 0; i < belts.length; ++i) {
            const path = belts[i].components.Belt.assignedPath;
            if (!path) {
                throw new Error("Belt has no path: " + belts[i].uid);
            }
            if (this.beltPaths.indexOf(path) < 0) {
                throw new Error("Path of entity not contained: " + belts[i].uid);
            }
        }
    }

    /**
     * Finds the follow up entity for a given belt. Used for building the dependencies
     * @param {Entity} entity
     * @returns {Entity|null}
     */
    findFollowUpEntity(entity) {
        const staticComp = entity.components.StaticMapEntity;
        const beltComp = entity.components.Belt;

        const followUpDirection = staticComp.localDirectionToWorld(beltComp.direction);
        const followUpVector = enumDirectionToVector[followUpDirection];

        const followUpTile = staticComp.origin.add(followUpVector);
        const followUpEntity = this.root.map.getLayerContentXY(followUpTile.x, followUpTile.y, entity.layer);

        // Check if there's a belt at the tile we point to
        if (followUpEntity) {
            const followUpBeltComp = followUpEntity.components.Belt;
            if (followUpBeltComp) {
                const followUpStatic = followUpEntity.components.StaticMapEntity;

                const acceptedDirection = followUpStatic.localDirectionToWorld(enumDirection.top);
                if (acceptedDirection === followUpDirection) {
                    return followUpEntity;
                }
            }
        }

        return null;
    }

    /**
     * Finds the supplying belt for a given belt. Used for building the dependencies
     * @param {Entity} entity
     * @returns {Entity|null}
     */
    findSupplyingEntity(entity) {
        const staticComp = entity.components.StaticMapEntity;

        const supplyDirection = staticComp.localDirectionToWorld(enumDirection.bottom);
        const supplyVector = enumDirectionToVector[supplyDirection];

        const supplyTile = staticComp.origin.add(supplyVector);
        const supplyEntity = this.root.map.getLayerContentXY(supplyTile.x, supplyTile.y, entity.layer);

        // Check if there's a belt at the tile we point to
        if (supplyEntity) {
            const supplyBeltComp = supplyEntity.components.Belt;
            if (supplyBeltComp) {
                const supplyStatic = supplyEntity.components.StaticMapEntity;
                const otherDirection = supplyStatic.localDirectionToWorld(
                    enumInvertedDirections[supplyBeltComp.direction]
                );

                if (otherDirection === supplyDirection) {
                    return supplyEntity;
                }
            }
        }

        return null;
    }

    /**
     * Recomputes the belt path network. Only required for old savegames
     */
    recomputeAllBeltPaths() {
        logger.warn("Recomputing all belt paths");
        const visitedUids = new Set();

        const result = [];

        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            if (visitedUids.has(entity.uid)) {
                continue;
            }

            // Mark entity as visited
            visitedUids.add(entity.uid);

            // Compute path, start with entity and find precedors / successors
            const path = [entity];

            // Prevent infinite loops
            let maxIter = 99999;

            // Find precedors
            let prevEntity = this.findSupplyingEntity(entity);
            while (prevEntity && --maxIter > 0) {
                if (visitedUids.has(prevEntity.uid)) {
                    break;
                }
                path.unshift(prevEntity);
                visitedUids.add(prevEntity.uid);
                prevEntity = this.findSupplyingEntity(prevEntity);
            }

            // Find succedors
            let nextEntity = this.findFollowUpEntity(entity);
            while (nextEntity && --maxIter > 0) {
                if (visitedUids.has(nextEntity.uid)) {
                    break;
                }

                path.push(nextEntity);
                visitedUids.add(nextEntity.uid);
                nextEntity = this.findFollowUpEntity(nextEntity);
            }

            assert(maxIter > 1, "Ran out of iterations");
            result.push(new BeltPath(this.root, path));
        }

        logger.log("Found", this.beltPaths.length, "belt paths");
        this.beltPaths = result;
    }

    /**
     * Updates all belts
     */
    update() {
        if (G_IS_DEV && globalConfig.debug.checkBeltPaths) {
            this.debug_verifyBeltPaths();
        }

        for (let i = 0; i < this.beltPaths.length; ++i) {
            this.beltPaths[i].update();
        }

        if (G_IS_DEV && globalConfig.debug.checkBeltPaths) {
            this.debug_verifyBeltPaths();
        }
    }

    /**
     * Draws a given chunk
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk_BackgroundLayer(parameters, chunk) {
        // Limit speed to avoid belts going backwards
        const speedMultiplier = Math.min(this.root.hubGoals.getBeltBaseSpeed(), 10);

        // SYNC with systems/item_acceptor.js:drawEntityUnderlays!
        // 126 / 42 is the exact animation speed of the png animation
        const animationIndex = Math.floor(
            ((this.root.time.realtimeNow() * speedMultiplier * BELT_ANIM_COUNT * 126) / 42) *
                globalConfig.itemSpacingOnBelts
        );
        const contents = chunk.containedEntitiesByLayer.regular;

        if (this.root.app.settings.getAllSettings().simplifiedBelts) {
            // POTATO Mode: Only show items when belt is hovered
            let hoveredBeltPath = null;
            const mousePos = this.root.app.mousePosition;
            if (mousePos && this.root.currentLayer === "regular") {
                const tile = this.root.camera.screenToWorld(mousePos).toTileSpace();
                const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
                if (contents && contents.components.Belt) {
                    hoveredBeltPath = contents.components.Belt.assignedPath;
                }
            }

            for (let i = 0; i < contents.length; ++i) {
                const entity = contents[i];
                if (entity.components.Belt) {
                    const direction = entity.components.Belt.direction;
                    let sprite = this.beltAnimations[direction][0];

                    if (entity.components.Belt.assignedPath === hoveredBeltPath) {
                        sprite = this.beltAnimations[direction][animationIndex % BELT_ANIM_COUNT];
                    }

                    // Culling happens within the static map entity component
                    entity.components.StaticMapEntity.drawSpriteOnBoundsClipped(parameters, sprite, 0);
                }
            }
        } else {
            for (let i = 0; i < contents.length; ++i) {
                const entity = contents[i];
                if (entity.components.Belt) {
                    const direction = entity.components.Belt.direction;
                    const sprite = this.beltAnimations[direction][animationIndex % BELT_ANIM_COUNT];

                    // Culling happens within the static map entity component
                    entity.components.StaticMapEntity.drawSpriteOnBoundsClipped(parameters, sprite, 0);
                }
            }
        }
    }

    /**
     * Draws the belt path debug overlays
     * @param {DrawParameters} parameters
     */
    drawBeltPathDebug(parameters) {
        for (let i = 0; i < this.beltPaths.length; ++i) {
            this.beltPaths[i].drawDebug(parameters);
        }
    }
}
