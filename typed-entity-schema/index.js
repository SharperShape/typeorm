"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entity = void 0;
const tslib_1 = require("tslib");
const __1 = require("..");
tslib_1.__exportStar(require("./options/TypedEntitySchemaCommonRelationOptions"), exports);
tslib_1.__exportStar(require("./options/TypedEntitySchemaEmbeddedOptions"), exports);
tslib_1.__exportStar(require("./options/TypedEntitySchemaManyToManyRelationOptions"), exports);
tslib_1.__exportStar(require("./options/TypedEntitySchemaManyToOneRelationOptions"), exports);
tslib_1.__exportStar(require("./options/TypedEntitySchemaOneToManyRelationOptions"), exports);
tslib_1.__exportStar(require("./options/TypedEntitySchemaOneToOneRelationOptions"), exports);
tslib_1.__exportStar(require("./options/TypedEntitySchemaProjection"), exports);
tslib_1.__exportStar(require("./typed-entity-schema-types"), exports);
/**
 * Creates a new Entity Schema.
 */
function entity(name, options) {
    const entityName = typeof name === "string" ? name : name.name;
    return new __1.EntitySchema(Object.assign({ name: entityName }, options));
}
exports.entity = entity;

//# sourceMappingURL=index.js.map
