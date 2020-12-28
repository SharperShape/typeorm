export class DefaultEntityFactory {
    /**
     * Returns an entity object
     */
    createEntity(target) {
        let ret = {};
        Reflect.setPrototypeOf(ret, target.prototype);
        return ret;
    }
}

//# sourceMappingURL=DefaultEntityFactory.js.map
