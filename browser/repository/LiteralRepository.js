/**
 * Repository is supposed to work with your entity objects. Find entities, insert, update, delete, etc.
 */
export function createLiteralRepository({ manager, target, queryRunner }) {
    return {
        typeof: "Repository",
        manager: manager,
        queryRunner: queryRunner,
        // get instance() { // todo: implement it later
        //     return this.getMetadata().instance
        // },
        get target() {
            // if there is a metadata for this object, first we see if
            // this creates unpredictable result (and its a source of bugs), when before initialization target has one value,
            // and after initialization it has another value
            // todo: later we need to refactor this part to prevent confusion (maybe better to separate "target" from "instance")
            // todo: to make it, we need to replace all places where .target used as instance
            if (this.manager.connection.hasMetadata(target)) {
                return this.manager.connection.getMetadata(target).target;
            }
            return target;
        },
        getMetadata() {
            return this.manager.connection.getMetadata(target);
        },
        createQueryBuilder(alias, queryRunner) {
            return this.manager.createQueryBuilder(this.getMetadata().target, alias || this.getMetadata().targetName, queryRunner || this.queryRunner);
        },
        hasId(entity) {
            return this.manager.hasId(this.getMetadata().target, entity);
        },
        getId(entity) {
            return this.manager.getId(this.getMetadata().target, entity);
        },
        create(plainEntityLikeOrPlainEntityLikes) {
            return this.manager.create(this.getMetadata().target, plainEntityLikeOrPlainEntityLikes);
        },
        merge(mergeIntoEntity, ...entityLikes) {
            return this.manager.merge(this.getMetadata().target, mergeIntoEntity, ...entityLikes);
        },
        preload(entityLike) {
            return this.manager.preload(this.getMetadata().target, entityLike);
        },
        save(entityOrEntities, options) {
            return this.manager.save(this.getMetadata().target, entityOrEntities, options);
        },
        remove(entityOrEntities, options) {
            return this.manager.remove(this.getMetadata().target, entityOrEntities, options);
        },
        softRemove(entityOrEntities, options) {
            return this.manager.softRemove(this.getMetadata().target, entityOrEntities, options);
        },
        recover(entityOrEntities, options) {
            return this.manager.recover(this.getMetadata().target, entityOrEntities, options);
        },
        insert(entity) {
            return this.manager.insert(this.getMetadata().target, entity);
        },
        update(criteria, partialEntity) {
            return this.manager.update(this.getMetadata().target, criteria, partialEntity);
        },
        delete(criteria) {
            return this.manager.delete(this.getMetadata().target, criteria);
        },
        softDelete(criteria) {
            return this.manager.softDelete(this.getMetadata().target, criteria);
        },
        restore(criteria) {
            return this.manager.restore(this.getMetadata().target, criteria);
        },
        count(optionsOrConditions) {
            return this.manager.count(this.getMetadata().target, optionsOrConditions);
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
        findOneOrFail(...args) {
            return this.manager.findOneOrFail(this.getMetadata().target, ...args);
        },
        observe(optionsOrConditions) {
            return this.manager.observe(this.getMetadata().target, optionsOrConditions);
        },
        observeManyAndCount(optionsOrConditions) {
            return this.manager.observeManyAndCount(this.getMetadata().target, optionsOrConditions);
        },
        observeOne(optionsOrConditions) {
            return this.manager.observeOne(this.getMetadata().target, optionsOrConditions);
        },
        observeCount(optionsOrConditions) {
            return this.manager.observeCount(this.getMetadata().target, optionsOrConditions);
        },
        query(query, parameters) {
            return this.manager.query(query, parameters);
        },
        clear() {
            return this.manager.clear(this.getMetadata().target);
        },
        increment(conditions, propertyPath, value) {
            return this.manager.increment(this.getMetadata().target, conditions, propertyPath, value);
        },
        decrement(conditions, propertyPath, value) {
            return this.manager.decrement(this.getMetadata().target, conditions, propertyPath, value);
        },
        extend(custom) {
            return Object.assign(Object.assign({}, this), custom);
        }
    };
}

//# sourceMappingURL=LiteralRepository.js.map
