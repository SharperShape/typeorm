import { Connection } from "../connection/Connection";
import { MongoEntityManager } from "../index";
/**
 * Entity manager supposed to work with any entity, automatically find its repository and call its methods,
 * whatever entity type are you passing.
 *
 * This implementation is used for MongoDB driver which has some specifics in its EntityManager.
 */
export declare function createLiteralMongoEntityManager({ connection }: {
    connection: Connection;
}): MongoEntityManager;
