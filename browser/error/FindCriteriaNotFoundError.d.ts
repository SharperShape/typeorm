import { EntityMetadata } from "..";
import { EntityColumnNotFound } from "./EntityColumnNotFound";
/**
 * Thrown when specified entity property in the find options were not found.
 */
export declare class FindCriteriaNotFoundError extends EntityColumnNotFound {
    constructor(propertyPath: string, metadata: EntityMetadata);
}
