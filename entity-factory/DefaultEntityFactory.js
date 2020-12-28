"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultEntityFactory = void 0;
class DefaultEntityFactory {
    /**
     * Returns an entity object
     */
    createEntity(target) {
        let ret = {};
        Reflect.setPrototypeOf(ret, target.prototype);
        return ret;
    }
}
exports.DefaultEntityFactory = DefaultEntityFactory;

//# sourceMappingURL=DefaultEntityFactory.js.map
