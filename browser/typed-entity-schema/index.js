import { EntitySchema } from "..";
export * from "./options/TypedEntitySchemaCommonRelationOptions";
export * from "./options/TypedEntitySchemaEmbeddedOptions";
export * from "./options/TypedEntitySchemaManyToManyRelationOptions";
export * from "./options/TypedEntitySchemaManyToOneRelationOptions";
export * from "./options/TypedEntitySchemaOneToManyRelationOptions";
export * from "./options/TypedEntitySchemaOneToOneRelationOptions";
export * from "./options/TypedEntitySchemaProjection";
export * from "./typed-entity-schema-types";
/**
 * Creates a new Entity Schema.
 */
export function entity(name, options) {
    const entityName = typeof name === "string" ? name : name.name;
    return new EntitySchema(Object.assign({ name: entityName }, options));
}

//# sourceMappingURL=index.js.map
