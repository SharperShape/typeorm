import { EntitySchema } from "./EntitySchema";
import { MetadataArgsStorage } from "../metadata-args/MetadataArgsStorage";
import { Connection } from "..";
/**
 * Transforms entity schema into metadata args storage.
 * The result will be just like entities read from decorators.
 */
export declare class EntitySchemaTransformer {
    /**
     * Transforms entity schema into new metadata args storage object.
     *
     * todo: we need to add embeddeds support
     */
    transform(connection: Connection, schemas: EntitySchema<any>[]): MetadataArgsStorage;
}
