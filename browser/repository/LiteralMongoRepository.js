import { createLiteralRepository } from "./LiteralRepository";
/**
 * Repository is supposed to work with your entity objects. Find entities, insert, update, delete, etc.
 */
export function createLiteralMongoRepository({ manager, target, queryRunner }) {
    return Object.assign(Object.assign({}, createLiteralRepository({ manager, target, queryRunner })), { typeof: "MongoRepository", manager: manager, query(query, parameters) {
            throw new Error(`Queries aren't supported by MongoDB.`);
        },
        createQueryBuilder(alias, queryRunner) {
            throw new Error(`Query Builder is not supported by MongoDB.`);
        },
        find(optionsOrConditions) {
            return this.manager.find(this.getMetadata().target, optionsOrConditions);
        },
        findAndCount(optionsOrConditions) {
            return this.manager.findAndCount(this.getMetadata().target, optionsOrConditions);
        },
        findByIds(ids, optionsOrConditions) {
            return this.manager.findByIds(this.getMetadata().target, ids, optionsOrConditions);
        },
        /**
         * @param {string | number | Date | ObjectID | FindOptions<Entity> | FindOptionsWhere<Entity>} [optionsOrConditions]
         * @param {FindOptions<Entity>} [maybeOptions]
         */
        findOne(...args) {
            return this.manager.findOne(this.getMetadata().target, ...args);
        },
        createCursor(query) {
            return this.manager.createCursor(this.getMetadata().target, query);
        },
        createEntityCursor(query) {
            return this.manager.createEntityCursor(this.getMetadata().target, query);
        },
        aggregate(pipeline, options) {
            return this.manager.aggregate(this.getMetadata().target, pipeline, options);
        },
        aggregateEntity(pipeline, options) {
            return this.manager.aggregateEntity(this.getMetadata().target, pipeline, options);
        },
        bulkWrite(operations, options) {
            return this.manager.bulkWrite(this.getMetadata().target, operations, options);
        },
        count(query, options, mongoOptions) {
            return this.manager.count(this.getMetadata().target, query || {}, options, mongoOptions);
        },
        createCollectionIndex(fieldOrSpec, options) {
            return this.manager.createCollectionIndex(this.getMetadata().target, fieldOrSpec, options);
        },
        createCollectionIndexes(indexSpecs) {
            return this.manager.createCollectionIndexes(this.getMetadata().target, indexSpecs);
        },
        deleteMany(query, options) {
            return this.manager.deleteMany(this.getMetadata().tableName, query, options);
        },
        deleteOne(query, options) {
            return this.manager.deleteOne(this.getMetadata().tableName, query, options);
        },
        distinct(key, query, options) {
            return this.manager.distinct(this.getMetadata().tableName, key, query, options);
        },
        dropCollectionIndex(indexName, options) {
            return this.manager.dropCollectionIndex(this.getMetadata().tableName, indexName, options);
        },
        dropCollectionIndexes() {
            return this.manager.dropCollectionIndexes(this.getMetadata().tableName);
        },
        findOneAndDelete(query, options) {
            return this.manager.findOneAndDelete(this.getMetadata().tableName, query, options);
        },
        findOneAndReplace(query, replacement, options) {
            return this.manager.findOneAndReplace(this.getMetadata().tableName, query, replacement, options);
        },
        findOneAndUpdate(query, update, options) {
            return this.manager.findOneAndUpdate(this.getMetadata().tableName, query, update, options);
        },
        geoHaystackSearch(x, y, options) {
            return this.manager.geoHaystackSearch(this.getMetadata().tableName, x, y, options);
        },
        geoNear(x, y, options) {
            return this.manager.geoNear(this.getMetadata().tableName, x, y, options);
        },
        group(keys, condition, initial, reduce, finalize, command, options) {
            return this.manager.group(this.getMetadata().tableName, keys, condition, initial, reduce, finalize, command, options);
        },
        collectionIndexes() {
            return this.manager.collectionIndexes(this.getMetadata().tableName);
        },
        collectionIndexExists(indexes) {
            return this.manager.collectionIndexExists(this.getMetadata().tableName, indexes);
        },
        collectionIndexInformation(options) {
            return this.manager.collectionIndexInformation(this.getMetadata().tableName, options);
        },
        initializeOrderedBulkOp(options) {
            return this.manager.initializeOrderedBulkOp(this.getMetadata().tableName, options);
        },
        initializeUnorderedBulkOp(options) {
            return this.manager.initializeUnorderedBulkOp(this.getMetadata().tableName, options);
        },
        insertMany(docs, options) {
            return this.manager.insertMany(this.getMetadata().tableName, docs, options);
        },
        insertOne(doc, options) {
            return this.manager.insertOne(this.getMetadata().tableName, doc, options);
        },
        isCapped() {
            return this.manager.isCapped(this.getMetadata().tableName);
        },
        listCollectionIndexes(options) {
            return this.manager.listCollectionIndexes(this.getMetadata().tableName, options);
        },
        mapReduce(map, reduce, options) {
            return this.manager.mapReduce(this.getMetadata().tableName, map, reduce, options);
        },
        parallelCollectionScan(options) {
            return this.manager.parallelCollectionScan(this.getMetadata().tableName, options);
        },
        reIndex() {
            return this.manager.reIndex(this.getMetadata().tableName);
        },
        rename(newName, options) {
            return this.manager.rename(this.getMetadata().tableName, newName, options);
        },
        replaceOne(query, doc, options) {
            return this.manager.replaceOne(this.getMetadata().tableName, query, doc, options);
        },
        stats(options) {
            return this.manager.stats(this.getMetadata().tableName, options);
        },
        updateMany(query, update, options) {
            return this.manager.updateMany(this.getMetadata().tableName, query, update, options);
        },
        updateOne(query, update, options) {
            return this.manager.updateOne(this.getMetadata().tableName, query, update, options);
        } });
}

//# sourceMappingURL=LiteralMongoRepository.js.map
