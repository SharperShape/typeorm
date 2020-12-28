"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLiteralMongoEntityManager = void 0;
const FindOptionsUtils_1 = require("../find-options/FindOptionsUtils");
const PlatformTools_1 = require("../platform/PlatformTools");
const DeleteResult_1 = require("../query-builder/result/DeleteResult");
const InsertResult_1 = require("../query-builder/result/InsertResult");
const UpdateResult_1 = require("../query-builder/result/UpdateResult");
const DocumentToEntityTransformer_1 = require("../query-builder/transformer/DocumentToEntityTransformer");
const BroadcasterResult_1 = require("../subscriber/BroadcasterResult");
const LiteralEntityManager_1 = require("./LiteralEntityManager");
/**
 * Entity manager supposed to work with any entity, automatically find its repository and call its methods,
 * whatever entity type are you passing.
 *
 * This implementation is used for MongoDB driver which has some specifics in its EntityManager.
 */
function createLiteralMongoEntityManager({ connection }) {
    function getQueryRunner() {
        return connection.driver.queryRunner;
    }
    /**
     * Overrides cursor's toArray and next methods to convert results to entity automatically.
     */
    function applyEntityTransformationToCursor(metadata, cursor) {
        const ParentCursor = PlatformTools_1.PlatformTools.load("mongodb").Cursor;
        cursor.toArray = function (callback) {
            if (callback) {
                ParentCursor.prototype.toArray.call(this, (error, results) => {
                    if (error) {
                        callback(error, results);
                        return;
                    }
                    const transformer = new DocumentToEntityTransformer_1.DocumentToEntityTransformer();
                    const entities = transformer.transformAll(results, metadata);
                    // broadcast "load" events
                    const broadcastResult = new BroadcasterResult_1.BroadcasterResult();
                    getQueryRunner().broadcaster.broadcastLoadEventsForAll(broadcastResult, metadata, entities);
                    Promise.all(broadcastResult.promises).then(() => callback(error, entities));
                });
            }
            else {
                return ParentCursor.prototype.toArray.call(this).then((results) => {
                    const transformer = new DocumentToEntityTransformer_1.DocumentToEntityTransformer();
                    const entities = transformer.transformAll(results, metadata);
                    // broadcast "load" events
                    const broadcastResult = new BroadcasterResult_1.BroadcasterResult();
                    getQueryRunner().broadcaster.broadcastLoadEventsForAll(broadcastResult, metadata, entities);
                    return Promise.all(broadcastResult.promises).then(() => entities);
                });
            }
        };
        cursor.next = function (callback) {
            if (callback) {
                ParentCursor.prototype.next.call(this, (error, result) => {
                    if (error || !result) {
                        callback(error, result);
                        return;
                    }
                    const transformer = new DocumentToEntityTransformer_1.DocumentToEntityTransformer();
                    const entity = transformer.transform(result, metadata);
                    // broadcast "load" events
                    const broadcastResult = new BroadcasterResult_1.BroadcasterResult();
                    getQueryRunner().broadcaster.broadcastLoadEventsForAll(broadcastResult, metadata, [entity]);
                    Promise.all(broadcastResult.promises).then(() => callback(error, entity));
                });
            }
            else {
                return ParentCursor.prototype.next.call(this).then((result) => {
                    if (!result)
                        return result;
                    const transformer = new DocumentToEntityTransformer_1.DocumentToEntityTransformer();
                    const entity = transformer.transform(result, metadata);
                    // broadcast "load" events
                    const broadcastResult = new BroadcasterResult_1.BroadcasterResult();
                    getQueryRunner().broadcaster.broadcastLoadEventsForAll(broadcastResult, metadata, [entity]);
                    return Promise.all(broadcastResult.promises).then(() => entity);
                });
            }
        };
    }
    /**
     * Converts FindOptions to mongodb query.
     */
    function convertFindOptionsOrConditionsToMongodbQuery(optionsOrConditions) {
        if (!optionsOrConditions)
            return undefined;
        if (FindOptionsUtils_1.FindOptionsUtils.isFindOptions(optionsOrConditions))
            return optionsOrConditions.where;
        return optionsOrConditions;
    }
    /**
     * Converts FindOneOptions to mongodb query.
     */
    function convertFindOneOptionsOrConditionsToMongodbQuery(optionsOrConditions) {
        if (!optionsOrConditions)
            return undefined;
        if (FindOptionsUtils_1.FindOptionsUtils.isFindOptions(optionsOrConditions))
            // If where condition is passed as a string which contains sql we have to ignore
            // as mongo is not a sql database
            return typeof optionsOrConditions.where === "string"
                ? {}
                : optionsOrConditions.where;
        return optionsOrConditions;
    }
    /**
     * Converts FindOptions into mongodb order by criteria.
     */
    function convertFindOptionsOrderToOrderCriteria(order) {
        return Object.keys(order).reduce((orderCriteria, key) => {
            switch (order[key]) {
                case "DESC":
                    orderCriteria[key] = -1;
                    break;
                case "ASC":
                    orderCriteria[key] = 1;
                    break;
                default:
                    orderCriteria[key] = order[key];
            }
            return orderCriteria;
        }, {});
    }
    /**
     * Converts FindOptions into mongodb select by criteria.
     */
    function convertFindOptionsSelectToProjectCriteria(select) {
        if (select instanceof Array) {
            return select.reduce((projectCriteria, key) => {
                projectCriteria[key] = 1;
                return projectCriteria;
            }, {});
        }
        else {
            return Object.keys(select).reduce((projectCriteria, key) => {
                if (select[key] === true) {
                    projectCriteria[key] = 1;
                }
                // todo: do we need to make this recursive?
                return projectCriteria;
            }, {});
        }
    }
    /**
     * Ensures given id is an id for query.
     */
    function convertMixedCriteria(metadata, idMap) {
        if (idMap instanceof Object) {
            return metadata.columns.reduce((query, column) => {
                const columnValue = column.getEntityValue(idMap);
                if (columnValue !== undefined)
                    query[column.databasePath] = columnValue;
                return query;
            }, {});
        }
        // means idMap is just object id
        const objectIdInstance = PlatformTools_1.PlatformTools.load("mongodb").ObjectID;
        return {
            "_id": (idMap instanceof objectIdInstance) ? idMap : new objectIdInstance(idMap)
        };
    }
    return Object.assign(Object.assign({}, LiteralEntityManager_1.createLiteralEntityManager({ connection })), { connection: connection, get queryRunner() {
            return getQueryRunner();
        }, typeof: "MongoEntityManager", // todo: fix as any
        // -------------------------------------------------------------------------
        // Overridden Methods
        // -------------------------------------------------------------------------
        async find(entityClassOrName, optionsOrConditions) {
            const query = convertFindOptionsOrConditionsToMongodbQuery(optionsOrConditions);
            const cursor = await this.createEntityCursor(entityClassOrName, query);
            if (FindOptionsUtils_1.FindOptionsUtils.isFindOptions(optionsOrConditions)) {
                if (optionsOrConditions.select)
                    cursor.project(convertFindOptionsSelectToProjectCriteria(optionsOrConditions.select));
                if (optionsOrConditions.skip)
                    cursor.skip(optionsOrConditions.skip);
                if (optionsOrConditions.take)
                    cursor.limit(optionsOrConditions.take);
                if (optionsOrConditions.order)
                    cursor.sort(convertFindOptionsOrderToOrderCriteria(optionsOrConditions.order));
            }
            return cursor.toArray();
        },
        async findAndCount(entityClassOrName, optionsOrConditions) {
            const query = convertFindOptionsOrConditionsToMongodbQuery(optionsOrConditions);
            const cursor = await this.createEntityCursor(entityClassOrName, query);
            if (FindOptionsUtils_1.FindOptionsUtils.isFindOptions(optionsOrConditions)) {
                if (optionsOrConditions.select)
                    cursor.project(convertFindOptionsSelectToProjectCriteria(optionsOrConditions.select));
                if (optionsOrConditions.skip)
                    cursor.skip(optionsOrConditions.skip);
                if (optionsOrConditions.take)
                    cursor.limit(optionsOrConditions.take);
                if (optionsOrConditions.order)
                    cursor.sort(convertFindOptionsOrderToOrderCriteria(optionsOrConditions.order));
            }
            const [results, count] = await Promise.all([
                cursor.toArray(),
                this.count(entityClassOrName, query),
            ]);
            return [results, parseInt(count)];
        },
        async findByIds(entityClassOrName, ids, optionsOrConditions) {
            const metadata = connection.getMetadata(entityClassOrName);
            const query = convertFindOptionsOrConditionsToMongodbQuery(optionsOrConditions) || {};
            const objectIdInstance = PlatformTools_1.PlatformTools.load("mongodb").ObjectID;
            query["_id"] = {
                $in: ids.map(id => {
                    if (id instanceof objectIdInstance)
                        return id;
                    return id[metadata.objectIdColumn.propertyName];
                })
            };
            const cursor = await this.createEntityCursor(entityClassOrName, query);
            if (FindOptionsUtils_1.FindOptionsUtils.isFindOptions(optionsOrConditions)) {
                if (optionsOrConditions.select)
                    cursor.project(convertFindOptionsSelectToProjectCriteria(optionsOrConditions.select));
                if (optionsOrConditions.skip)
                    cursor.skip(optionsOrConditions.skip);
                if (optionsOrConditions.take)
                    cursor.limit(optionsOrConditions.take);
                if (optionsOrConditions.order)
                    cursor.sort(convertFindOptionsOrderToOrderCriteria(optionsOrConditions.order));
            }
            return await cursor.toArray();
        },
        /**
         * @param entityClassOrName
         * @param {string | string[] | number | number[] | Date | Date[] | ObjectID | ObjectID[] | FindOptions<Entity> | FindOptionsWhere<Entity>} [optionsOrConditions]
         * @param {FindOptions<Entity>} [maybeOptions]
         */
        async findOne(entityClassOrName, ...args) {
            if (args.length > 2) {
                throw new Error("Too many arguments.");
            }
            const optionsOrConditions = args[0];
            const maybeOptions = args[1];
            if (args.length >= 1) {
                if (optionsOrConditions === undefined || optionsOrConditions === null || optionsOrConditions === false) {
                    return Promise.resolve(undefined);
                }
            }
            const objectIdInstance = PlatformTools_1.PlatformTools.load("mongodb").ObjectID;
            const id = (optionsOrConditions instanceof objectIdInstance) || typeof optionsOrConditions === "string" ? optionsOrConditions : undefined;
            const findOneOptionsOrConditions = (id ? maybeOptions : optionsOrConditions);
            const query = convertFindOneOptionsOrConditionsToMongodbQuery(findOneOptionsOrConditions) || {};
            if (id) {
                query["_id"] = (id instanceof objectIdInstance) ? id : new objectIdInstance(id);
            }
            const cursor = await this.createEntityCursor(entityClassOrName, query);
            if (FindOptionsUtils_1.FindOptionsUtils.isFindOptions(findOneOptionsOrConditions)) {
                if (findOneOptionsOrConditions.select)
                    cursor.project(convertFindOptionsSelectToProjectCriteria(findOneOptionsOrConditions.select));
                if (findOneOptionsOrConditions.order)
                    cursor.sort(convertFindOptionsOrderToOrderCriteria(findOneOptionsOrConditions.order));
            }
            // const result = await cursor.limit(1).next();
            const result = await cursor.limit(1).toArray();
            return result.length > 0 ? result[0] : undefined;
        },
        async insert(target, entity) {
            // todo: convert entity to its database name
            const result = new InsertResult_1.InsertResult();
            if (Array.isArray(entity)) {
                result.raw = await this.insertMany(target, entity);
                Object.keys(result.raw.insertedIds).forEach((key) => {
                    let insertedId = result.raw.insertedIds[key];
                    result.generatedMaps.push(connection.driver.createGeneratedMap(connection.getMetadata(target), insertedId));
                    result.identifiers.push(connection.driver.createGeneratedMap(connection.getMetadata(target), insertedId));
                });
            }
            else {
                result.raw = await this.insertOne(target, entity);
                result.generatedMaps.push(connection.driver.createGeneratedMap(connection.getMetadata(target), result.raw.insertedId));
                result.identifiers.push(connection.driver.createGeneratedMap(connection.getMetadata(target), result.raw.insertedId));
            }
            return result;
        },
        async update(target, criteria, partialEntity) {
            if (Array.isArray(criteria)) {
                await Promise.all(criteria.map(criteriaItem => {
                    return this.update(target, criteriaItem, partialEntity);
                }));
            }
            else {
                const metadata = connection.getMetadata(target);
                await this.updateOne(target, convertMixedCriteria(metadata, criteria), { $set: partialEntity });
            }
            return new UpdateResult_1.UpdateResult();
        },
        async delete(target, criteria) {
            if (Array.isArray(criteria)) {
                await Promise.all(criteria.map(criteriaItem => {
                    return this.delete(target, criteriaItem);
                }));
            }
            else {
                await this.deleteOne(target, convertMixedCriteria(connection.getMetadata(target), criteria));
            }
            return new DeleteResult_1.DeleteResult();
        },
        // -------------------------------------------------------------------------
        // Public Methods
        // -------------------------------------------------------------------------
        createCursor(entityClassOrName, query) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().cursor(metadata.tableName, query);
        },
        createEntityCursor(entityClassOrName, query) {
            const metadata = connection.getMetadata(entityClassOrName);
            const cursor = this.createCursor(entityClassOrName, query);
            applyEntityTransformationToCursor(metadata, cursor);
            return cursor;
        },
        aggregate(entityClassOrName, pipeline, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().aggregate(metadata.tableName, pipeline, options);
        },
        aggregateEntity(entityClassOrName, pipeline, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            const cursor = getQueryRunner().aggregate(metadata.tableName, pipeline, options);
            applyEntityTransformationToCursor(metadata, cursor);
            return cursor;
        },
        bulkWrite(entityClassOrName, operations, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().bulkWrite(metadata.tableName, operations, options);
        },
        count(entityClassOrName, query, options, mongoOptions) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().count(metadata.tableName, query, mongoOptions);
        },
        createCollectionIndex(entityClassOrName, fieldOrSpec, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().createCollectionIndex(metadata.tableName, fieldOrSpec, options);
        },
        createCollectionIndexes(entityClassOrName, indexSpecs) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().createCollectionIndexes(metadata.tableName, indexSpecs);
        },
        deleteMany(entityClassOrName, query, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().deleteMany(metadata.tableName, query, options);
        },
        deleteOne(entityClassOrName, query, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().deleteOne(metadata.tableName, query, options);
        },
        distinct(entityClassOrName, key, query, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().distinct(metadata.tableName, key, query, options);
        },
        dropCollectionIndex(entityClassOrName, indexName, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().dropCollectionIndex(metadata.tableName, indexName, options);
        },
        dropCollectionIndexes(entityClassOrName) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().dropCollectionIndexes(metadata.tableName);
        },
        findOneAndDelete(entityClassOrName, query, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().findOneAndDelete(metadata.tableName, query, options);
        },
        findOneAndReplace(entityClassOrName, query, replacement, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().findOneAndReplace(metadata.tableName, query, replacement, options);
        },
        findOneAndUpdate(entityClassOrName, query, update, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().findOneAndUpdate(metadata.tableName, query, update, options);
        },
        geoHaystackSearch(entityClassOrName, x, y, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().geoHaystackSearch(metadata.tableName, x, y, options);
        },
        geoNear(entityClassOrName, x, y, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().geoNear(metadata.tableName, x, y, options);
        },
        group(entityClassOrName, keys, condition, initial, reduce, finalize, command, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().group(metadata.tableName, keys, condition, initial, reduce, finalize, command, options);
        },
        collectionIndexes(entityClassOrName) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().collectionIndexes(metadata.tableName);
        },
        collectionIndexExists(entityClassOrName, indexes) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().collectionIndexExists(metadata.tableName, indexes);
        },
        collectionIndexInformation(entityClassOrName, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().collectionIndexInformation(metadata.tableName, options);
        },
        initializeOrderedBulkOp(entityClassOrName, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().initializeOrderedBulkOp(metadata.tableName, options);
        },
        initializeUnorderedBulkOp(entityClassOrName, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().initializeUnorderedBulkOp(metadata.tableName, options);
        },
        insertMany(entityClassOrName, docs, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().insertMany(metadata.tableName, docs, options);
        },
        insertOne(entityClassOrName, doc, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().insertOne(metadata.tableName, doc, options);
        },
        isCapped(entityClassOrName) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().isCapped(metadata.tableName);
        },
        listCollectionIndexes(entityClassOrName, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().listCollectionIndexes(metadata.tableName, options);
        },
        mapReduce(entityClassOrName, map, reduce, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().mapReduce(metadata.tableName, map, reduce, options);
        },
        parallelCollectionScan(entityClassOrName, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().parallelCollectionScan(metadata.tableName, options);
        },
        reIndex(entityClassOrName) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().reIndex(metadata.tableName);
        },
        rename(entityClassOrName, newName, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().rename(metadata.tableName, newName, options);
        },
        replaceOne(entityClassOrName, query, doc, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().replaceOne(metadata.tableName, query, doc, options);
        },
        stats(entityClassOrName, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().stats(metadata.tableName, options);
        },
        watch(entityClassOrName, pipeline, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().watch(metadata.tableName, pipeline, options);
        },
        updateMany(entityClassOrName, query, update, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().updateMany(metadata.tableName, query, update, options);
        },
        updateOne(entityClassOrName, query, update, options) {
            const metadata = connection.getMetadata(entityClassOrName);
            return getQueryRunner().updateOne(metadata.tableName, query, update, options);
        } });
}
exports.createLiteralMongoEntityManager = createLiteralMongoEntityManager;

//# sourceMappingURL=LiteralMongoEntityManager.js.map
