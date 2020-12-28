import { MongoDriver } from "../driver/mongodb/MongoDriver";
import { OracleDriver } from "../driver/oracle/OracleDriver";
import { CustomRepositoryCannotInheritRepositoryError } from "../error/CustomRepositoryCannotInheritRepositoryError";
import { CustomRepositoryNotFoundError } from "../error/CustomRepositoryNotFoundError";
import { EntityNotFoundError } from "../error/EntityNotFoundError";
import { NoNeedToReleaseEntityManagerError } from "../error/NoNeedToReleaseEntityManagerError";
import { QueryRunnerProviderAlreadyReleasedError } from "../error/QueryRunnerProviderAlreadyReleasedError";
import { TreeRepositoryNotSupportedError } from "../error/TreeRepositoryNotSupportedError";
import { FindOptionsUtils } from "../find-options/FindOptionsUtils";
import { EntitySchema, getMetadataArgsStorage } from "../index";
import { ObserverExecutor } from "../observer/ObserverExecutor";
import { QueryObserver } from "../observer/QueryObserver";
import { EntityPersistExecutor } from "../persistence/EntityPersistExecutor";
import { PlainObjectToDatabaseEntityTransformer } from "../query-builder/transformer/PlainObjectToDatabaseEntityTransformer";
import { PlainObjectToNewEntityTransformer } from "../query-builder/transformer/PlainObjectToNewEntityTransformer";
import { AbstractRepository } from "../repository/AbstractRepository";
import { ObjectUtils } from "../util/ObjectUtils";
import { createLiteralTreeRepository } from "../repository/LiteralTreeRepository";
import { createLiteralMongoRepository } from "../repository/LiteralMongoRepository";
import { createLiteralRepository } from "../repository/LiteralRepository";
/**
 * Entity manager supposed to work with any entity, automatically find its repository and call its methods,
 * whatever entity type are you passing.
 */
export function createLiteralEntityManager({ connection, queryRunner }) {
    /**
     * Once created and then reused by repositories.
     */
    const repositories = [];
    /**
     * Once created and then reused by repositories.
     */
    const treeRepositories = [];
    /**
     * Plain to object transformer used in create and merge operations.
     */
    const plainObjectToEntityTransformer = new PlainObjectToNewEntityTransformer();
    const manager = {
        typeof: "EntityManager",
        connection: connection,
        queryRunner: queryRunner,
        async transaction(isolationOrRunInTransaction, runInTransactionParam) {
            const isolation = typeof isolationOrRunInTransaction === "string" ? isolationOrRunInTransaction : undefined;
            const runInTransaction = typeof isolationOrRunInTransaction === "function" ? isolationOrRunInTransaction : runInTransactionParam;
            if (!runInTransaction) {
                throw new Error(`Transaction method requires callback in second paramter if isolation level is supplied.`);
            }
            if (this.connection.driver instanceof MongoDriver)
                throw new Error(`Transactions aren't supported by MongoDB.`);
            if (this.queryRunner && this.queryRunner.isReleased)
                throw new QueryRunnerProviderAlreadyReleasedError();
            if (this.queryRunner && this.queryRunner.isTransactionActive)
                throw new Error(`Cannot start transaction because its already started`);
            // if query runner is already defined in this class, it means this entity manager was already created for a single connection
            // if its not defined we create a new query runner - single connection where we'll execute all our operations
            const queryRunner = this.queryRunner || this.connection.createQueryRunner();
            try {
                if (isolation) {
                    await queryRunner.startTransaction(isolation);
                }
                else {
                    await queryRunner.startTransaction();
                }
                const result = await runInTransaction(queryRunner.manager);
                await queryRunner.commitTransaction();
                await new ObserverExecutor(this.connection.observers).execute();
                return result;
            }
            catch (err) {
                try { // we throw original error even if rollback thrown an error
                    await queryRunner.rollbackTransaction();
                }
                catch (rollbackError) {
                }
                throw err;
            }
            finally {
                if (!this.queryRunner) // if we used a new query runner provider then release it
                    await queryRunner.release();
            }
        },
        async query(query, parameters) {
            return this.connection.query(query, parameters, this.queryRunner);
        },
        createQueryBuilder(entityClass, alias, queryRunner) {
            if (alias) {
                return this.connection.createQueryBuilder(entityClass, alias, queryRunner || this.queryRunner);
            }
            else {
                return this.connection.createQueryBuilder(entityClass || queryRunner || this.queryRunner);
            }
        },
        hasId(targetOrEntity, maybeEntity) {
            const target = arguments.length === 2 ? targetOrEntity : targetOrEntity.constructor;
            const entity = arguments.length === 2 ? maybeEntity : targetOrEntity;
            const metadata = this.connection.getMetadata(target);
            return metadata.hasId(entity);
        },
        getId(targetOrEntity, maybeEntity) {
            const target = arguments.length === 2 ? targetOrEntity : targetOrEntity.constructor;
            const entity = arguments.length === 2 ? maybeEntity : targetOrEntity;
            const metadata = this.connection.getMetadata(target);
            return metadata.getEntityIdMixedMap(entity);
        },
        create(entityClass, plainObjectOrObjects) {
            const metadata = this.connection.getMetadata(entityClass);
            if (!plainObjectOrObjects)
                return metadata.create(this.queryRunner);
            if (Array.isArray(plainObjectOrObjects))
                return plainObjectOrObjects.map(plainEntityLike => this.create(entityClass, plainEntityLike));
            const mergeIntoEntity = metadata.create(this.queryRunner);
            plainObjectToEntityTransformer.transform(mergeIntoEntity, plainObjectOrObjects, metadata, true);
            return mergeIntoEntity;
        },
        merge(entityClass, mergeIntoEntity, ...entityLikes) {
            const metadata = this.connection.getMetadata(entityClass);
            entityLikes.forEach(object => plainObjectToEntityTransformer.transform(mergeIntoEntity, object, metadata));
            return mergeIntoEntity;
        },
        async preload(entityClass, entityLike) {
            const metadata = this.connection.getMetadata(entityClass);
            const plainObjectToDatabaseEntityTransformer = new PlainObjectToDatabaseEntityTransformer(this.connection.manager);
            const transformedEntity = await plainObjectToDatabaseEntityTransformer.transform(entityLike, metadata);
            if (transformedEntity)
                return this.merge(entityClass, transformedEntity, entityLike);
            return undefined;
        },
        save(targetOrEntity, maybeEntityOrOptions, maybeOptions) {
            // normalize mixed parameters
            let target = (arguments.length > 1 && (targetOrEntity instanceof Function || targetOrEntity instanceof EntitySchema || typeof targetOrEntity === "string")) ? targetOrEntity : undefined;
            const entity = target ? maybeEntityOrOptions : targetOrEntity;
            const options = target ? maybeOptions : maybeEntityOrOptions;
            if (target instanceof EntitySchema)
                target = target.options.name;
            // if user passed empty array of entities then we don't need to do anything
            if (Array.isArray(entity) && entity.length === 0)
                return Promise.resolve(entity);
            // execute save operation
            return new EntityPersistExecutor(this.connection, this.queryRunner, "save", target, entity, options)
                .execute()
                .then(() => entity);
        },
        remove(targetOrEntity, maybeEntityOrOptions, maybeOptions) {
            // normalize mixed parameters
            const target = (arguments.length > 1 && (targetOrEntity instanceof Function || typeof targetOrEntity === "string")) ? targetOrEntity : undefined;
            const entity = target ? maybeEntityOrOptions : targetOrEntity;
            const options = target ? maybeOptions : maybeEntityOrOptions;
            // if user passed empty array of entities then we don't need to do anything
            if (Array.isArray(entity) && entity.length === 0)
                return Promise.resolve(entity);
            // execute save operation
            return new EntityPersistExecutor(this.connection, this.queryRunner, "remove", target, entity, options)
                .execute()
                .then(() => entity);
        },
        softRemove(targetOrEntity, maybeEntityOrOptions, maybeOptions) {
            // normalize mixed parameters
            let target = (arguments.length > 1 && (targetOrEntity instanceof Function || targetOrEntity instanceof EntitySchema || typeof targetOrEntity === "string")) ? targetOrEntity : undefined;
            const entity = target ? maybeEntityOrOptions : targetOrEntity;
            const options = target ? maybeOptions : maybeEntityOrOptions;
            if (target instanceof EntitySchema)
                target = target.options.name;
            // if user passed empty array of entities then we don't need to do anything
            if (Array.isArray(entity) && entity.length === 0)
                return Promise.resolve(entity);
            // execute soft-remove operation
            return new EntityPersistExecutor(this.connection, this.queryRunner, "soft-remove", target, entity, options)
                .execute()
                .then(() => entity);
        },
        recover(targetOrEntity, maybeEntityOrOptions, maybeOptions) {
            // normalize mixed parameters
            let target = (arguments.length > 1 && (targetOrEntity instanceof Function || targetOrEntity instanceof EntitySchema || typeof targetOrEntity === "string")) ? targetOrEntity : undefined;
            const entity = target ? maybeEntityOrOptions : targetOrEntity;
            const options = target ? maybeOptions : maybeEntityOrOptions;
            if (target instanceof EntitySchema)
                target = target.options.name;
            // if user passed empty array of entities then we don't need to do anything
            if (Array.isArray(entity) && entity.length === 0)
                return Promise.resolve(entity);
            // execute recover operation
            return new EntityPersistExecutor(this.connection, this.queryRunner, "recover", target, entity, options)
                .execute()
                .then(() => entity);
        },
        async insert(target, entity) {
            // TODO: Oracle does not support multiple values. Need to create another nice solution.
            if (this.connection.driver instanceof OracleDriver && Array.isArray(entity)) {
                const results = await Promise.all(entity.map(entity => this.insert(target, entity)));
                return results.reduce((mergedResult, result) => Object.assign(mergedResult, result), {});
            }
            return this.createQueryBuilder()
                .insert()
                .into(target)
                .values(entity)
                .execute();
        },
        update(target, criteria, partialEntity) {
            // if user passed empty criteria or empty list of criterias, then throw an error
            if (criteria === undefined ||
                criteria === null ||
                criteria === "" ||
                (Array.isArray(criteria) && criteria.length === 0)) {
                return Promise.reject(new Error(`Empty criteria(s) are not allowed for the update method.`));
            }
            if (typeof criteria === "string" ||
                typeof criteria === "number" ||
                criteria instanceof Date ||
                Array.isArray(criteria)) {
                return this.createQueryBuilder()
                    .update(target)
                    .set(partialEntity)
                    .whereInIds(criteria)
                    .execute();
            }
            else {
                return this.createQueryBuilder()
                    .update(target)
                    .set(partialEntity)
                    .where(criteria)
                    .execute();
            }
        },
        delete(targetOrEntity, criteria) {
            // if user passed empty criteria or empty list of criterias, then throw an error
            if (criteria === undefined ||
                criteria === null ||
                criteria === "" ||
                (Array.isArray(criteria) && criteria.length === 0)) {
                return Promise.reject(new Error(`Empty criteria(s) are not allowed for the delete method.`));
            }
            if (typeof criteria === "string" ||
                typeof criteria === "number" ||
                criteria instanceof Date ||
                Array.isArray(criteria)) {
                return this.createQueryBuilder()
                    .delete()
                    .from(targetOrEntity)
                    .whereInIds(criteria)
                    .execute();
            }
            else {
                return this.createQueryBuilder()
                    .delete()
                    .from(targetOrEntity)
                    .where(criteria)
                    .execute();
            }
        },
        softDelete(targetOrEntity, criteria) {
            // if user passed empty criteria or empty list of criterias, then throw an error
            if (criteria === undefined ||
                criteria === null ||
                criteria === "" ||
                (Array.isArray(criteria) && criteria.length === 0)) {
                return Promise.reject(new Error(`Empty criteria(s) are not allowed for the delete method.`));
            }
            if (typeof criteria === "string" ||
                typeof criteria === "number" ||
                criteria instanceof Date ||
                Array.isArray(criteria)) {
                return this.createQueryBuilder()
                    .softDelete()
                    .from(targetOrEntity)
                    .whereInIds(criteria)
                    .execute();
            }
            else {
                return this.createQueryBuilder()
                    .softDelete()
                    .from(targetOrEntity)
                    .where(criteria)
                    .execute();
            }
        },
        restore(targetOrEntity, criteria) {
            // if user passed empty criteria or empty list of criterias, then throw an error
            if (criteria === undefined ||
                criteria === null ||
                criteria === "" ||
                (Array.isArray(criteria) && criteria.length === 0)) {
                return Promise.reject(new Error(`Empty criteria(s) are not allowed for the delete method.`));
            }
            if (typeof criteria === "string" ||
                typeof criteria === "number" ||
                criteria instanceof Date ||
                Array.isArray(criteria)) {
                return this.createQueryBuilder()
                    .restore()
                    .from(targetOrEntity)
                    .whereInIds(criteria)
                    .execute();
            }
            else {
                return this.createQueryBuilder()
                    .restore()
                    .from(targetOrEntity)
                    .where(criteria)
                    .execute();
            }
        },
        async count(entityClass, conditions, options) {
            const metadata = this.connection.getMetadata(entityClass);
            const qb = this.createQueryBuilder(entityClass, metadata.name);
            qb.setFindOptions({
                where: conditions,
                options: options
            });
            return qb.getCount();
        },
        async find(entityClass, optionsOrConditions) {
            const metadata = this.connection.getMetadata(entityClass);
            const qb = this.createQueryBuilder(entityClass, metadata.name);
            if (optionsOrConditions)
                qb.setFindOptions(FindOptionsUtils.isFindOptions(optionsOrConditions) ? optionsOrConditions : { where: optionsOrConditions });
            return qb.getMany();
        },
        async findAndCount(entityClass, optionsOrConditions) {
            const metadata = this.connection.getMetadata(entityClass);
            const qb = this.createQueryBuilder(entityClass, metadata.name);
            if (optionsOrConditions)
                qb.setFindOptions(FindOptionsUtils.isFindOptions(optionsOrConditions) ? optionsOrConditions : { where: optionsOrConditions });
            return qb.getManyAndCount();
        },
        async findByIds(entityClass, ids, optionsOrConditions) {
            // if no ids passed, no need to execute a query - just return an empty array of values
            if (!ids.length)
                return Promise.resolve([]);
            const metadata = this.connection.getMetadata(entityClass);
            const qb = this.createQueryBuilder(entityClass, metadata.name);
            // FindOptionsUtils.applyFindOptionsOrConditionsToQueryBuilder(qb, optionsOrConditions);
            // todo: implement only-find options it later
            // let options: FindOptions<any> = { };
            // if (optionsOrConditions) {
            //     if (FindOptionsUtils.isFindOptions(optionsOrConditions)) {
            //         options = optionsOrConditions;
            //     } else {
            //         options = { where: optionsOrConditions };
            //     }
            // }
            // if (!options.where) {
            //     options.where = {  };
            // }
            // return qb.setFindOptions(optionsOrConditions).getMany();
            const findOptions = {};
            if (FindOptionsUtils.isFindOptions(optionsOrConditions)) {
                Object.assign(findOptions, optionsOrConditions);
            }
            else if (optionsOrConditions) {
                Object.assign(findOptions, { where: optionsOrConditions });
            }
            // if (findOptions.where || metadata.primaryColumns.length > 1) {
            return qb
                .setFindOptions(findOptions)
                .andWhereInIds(ids)
                .getMany();
            // }
            // this is for optimization purpose
            // findOptions.where = {};
            // const primaryColumn = metadata.primaryColumns[0];
            // const normalizedIds = ids.map(id => {
            //     return typeof id === "object" ? primaryColumn.getEntityValue(id) : id;
            // });
            // primaryColumn.setEntityValue(findOptions.where, In(normalizedIds));
            // console.log("WHERE:", findOptions);
            // qb.setFindOptions(findOptions);
            // const results = await qb.getMany();
            // console.log("results", results);
            // return results;
        },
        /**
         * @param entityClass
         * @param {string | string[] | number | number[] | Date | Date[] | ObjectID | ObjectID[] | FindOptions<Entity> | any} [idOrOptionsOrConditions]
         * @param {FindOptions<Entity>} [maybeOptions]
         */
        findOne(entityClass, ...args) {
            if (args.length > 2) {
                throw new Error("Too many arguments.");
            }
            const idOrOptionsOrConditions = args[0];
            const maybeOptions = args[1];
            if (args.length >= 1) {
                if (idOrOptionsOrConditions === undefined || idOrOptionsOrConditions === null || idOrOptionsOrConditions === false) {
                    return Promise.resolve(undefined);
                }
            }
            let findOptions = undefined;
            if (FindOptionsUtils.isFindOptions(idOrOptionsOrConditions)) {
                findOptions = idOrOptionsOrConditions;
            }
            else if (maybeOptions && FindOptionsUtils.isFindOptions(maybeOptions)) {
                findOptions = maybeOptions;
            }
            let options = undefined;
            if (idOrOptionsOrConditions instanceof Object && !FindOptionsUtils.isFindOptions(idOrOptionsOrConditions))
                options = idOrOptionsOrConditions;
            const metadata = this.connection.getMetadata(entityClass);
            const qb = this.createQueryBuilder(entityClass, metadata.name);
            // if (!findOptions || findOptions.loadEagerRelations !== false)
            //     FindOptionsUtils.joinEagerRelations(qb, qb.alias, qb.expressionMap.mainAlias!.metadata);
            const findById = typeof idOrOptionsOrConditions === "string" || typeof idOrOptionsOrConditions === "number" || idOrOptionsOrConditions instanceof Date;
            if (!findById) {
                findOptions = Object.assign(Object.assign({}, (findOptions || {})), { take: 1 });
            }
            if (findOptions) {
                qb.setFindOptions(findOptions);
            }
            if (options) {
                qb.where(options);
            }
            else if (findById) {
                qb.andWhereInIds(metadata.ensureEntityIdMap(idOrOptionsOrConditions));
            }
            return qb.getOne();
        },
        async findOneOrFail(entityClass, ...args) {
            return this.findOne(entityClass, ...args).then((value) => {
                if (value === undefined) {
                    return Promise.reject(new EntityNotFoundError(entityClass, args.length > 0 ? args[0] : undefined));
                }
                return Promise.resolve(value);
            });
        },
        observe(entityClass, optionsOrConditions) {
            const metadata = this.connection.getMetadata(entityClass);
            return new QueryObserver(this.connection, "find", metadata, optionsOrConditions).observe();
        },
        observeManyAndCount(entityClass, optionsOrConditions) {
            const metadata = this.connection.getMetadata(entityClass);
            return new QueryObserver(this.connection, "findAndCount", metadata, optionsOrConditions).observe();
        },
        observeOne(entityClass, optionsOrConditions) {
            const metadata = this.connection.getMetadata(entityClass);
            return new QueryObserver(this.connection, "findOne", metadata, optionsOrConditions).observe();
        },
        observeCount(entityClass, optionsOrConditions) {
            const metadata = this.connection.getMetadata(entityClass);
            return new QueryObserver(this.connection, "count", metadata, optionsOrConditions).observe();
        },
        async clear(entityClass) {
            const metadata = this.connection.getMetadata(entityClass);
            const queryRunner = this.queryRunner || this.connection.createQueryRunner();
            try {
                return await queryRunner.clearTable(metadata.tablePath); // await is needed here because we are using finally
            }
            finally {
                if (!this.queryRunner)
                    await queryRunner.release();
            }
        },
        async increment(entityClass, conditions, propertyPath, value) {
            const metadata = this.connection.getMetadata(entityClass);
            const column = metadata.findColumnWithPropertyPath(propertyPath);
            if (!column)
                throw new Error(`Column ${propertyPath} was not found in ${metadata.targetName} entity.`);
            if (isNaN(Number(value)))
                throw new Error(`Value "${value}" is not a number.`);
            // convert possible embeded path "social.likes" into object { social: { like: () => value } }
            const values = propertyPath
                .split(".")
                .reduceRight((value, key) => ({ [key]: value }), () => this.connection.driver.escape(column.databaseName) + " + " + value);
            return this
                .createQueryBuilder(entityClass, "entity")
                .update(entityClass)
                .set(values)
                .where(conditions)
                .execute();
        },
        async decrement(entityClass, conditions, propertyPath, value) {
            const metadata = this.connection.getMetadata(entityClass);
            const column = metadata.findColumnWithPropertyPath(propertyPath);
            if (!column)
                throw new Error(`Column ${propertyPath} was not found in ${metadata.targetName} entity.`);
            if (isNaN(Number(value)))
                throw new Error(`Value "${value}" is not a number.`);
            // convert possible embeded path "social.likes" into object { social: { like: () => value } }
            const values = propertyPath
                .split(".")
                .reduceRight((value, key) => ({ [key]: value }), () => this.connection.driver.escape(column.databaseName) + " - " + value);
            return this
                .createQueryBuilder(entityClass, "entity")
                .update(entityClass)
                .set(values)
                .where(conditions)
                .execute();
        },
        getRepository(target) {
            // find already created repository instance and return it if found
            const repository = repositories.find(repository => repository.target === target);
            if (repository)
                return repository;
            // if repository was not found then create it, store its instance and return it
            if (this.connection.driver instanceof MongoDriver) {
                const newRepository = createLiteralMongoRepository({
                    manager: this,
                    target,
                    queryRunner: this.queryRunner,
                });
                repositories.push(newRepository);
                return newRepository;
            }
            else {
                const newRepository = createLiteralRepository({
                    manager: this,
                    target,
                    queryRunner: this.queryRunner,
                });
                repositories.push(newRepository);
                return newRepository;
            }
        },
        getTreeRepository(target) {
            // tree tables aren't supported by some drivers (mongodb)
            if (this.connection.driver.treeSupport === false)
                throw new TreeRepositoryNotSupportedError(this.connection.driver);
            // find already created repository instance and return it if found
            const repository = treeRepositories.find(repository => repository.target === target);
            if (repository)
                return repository;
            // check if repository is real tree repository
            const newRepository = createLiteralTreeRepository({
                manager: this,
                target,
                queryRunner: this.queryRunner,
            });
            treeRepositories.push(newRepository);
            return newRepository;
        },
        getMongoRepository(target) {
            return connection.getMongoRepository(target);
        },
        getCustomRepository(customRepository) {
            const entityRepositoryMetadataArgs = getMetadataArgsStorage().entityRepositories.find(repository => {
                return repository.target === (customRepository instanceof Function ? customRepository : customRepository.constructor);
            });
            if (!entityRepositoryMetadataArgs)
                throw new CustomRepositoryNotFoundError(customRepository);
            const entityMetadata = entityRepositoryMetadataArgs.entity ? this.connection.getMetadata(entityRepositoryMetadataArgs.entity) : undefined;
            const entityRepositoryInstance = new entityRepositoryMetadataArgs.target(this, entityMetadata);
            // NOTE: dynamic access to protected properties. We need this to prevent unwanted properties in those classes to be exposed,
            // however we need these properties for internal work of the class
            if (entityRepositoryInstance instanceof AbstractRepository) {
                if (!entityRepositoryInstance["manager"])
                    entityRepositoryInstance["manager"] = this;
            }
            else {
                if (!entityMetadata)
                    throw new CustomRepositoryCannotInheritRepositoryError(customRepository);
                entityRepositoryInstance["manager"] = this;
                entityRepositoryInstance["metadata"] = entityMetadata;
            }
            return entityRepositoryInstance;
        },
        async release() {
            if (!this.queryRunner)
                throw new NoNeedToReleaseEntityManagerError();
            return this.queryRunner.release();
        }
    };
    if (queryRunner) {
        // dynamic: this.queryRunner = manager;
        ObjectUtils.assign(queryRunner, { manager });
    }
    return manager;
}

//# sourceMappingURL=LiteralEntityManager.js.map
