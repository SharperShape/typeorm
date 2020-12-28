import { Connection } from "../connection/Connection";
import { EntityManager } from "../index";
import { QueryRunner } from "../query-runner/QueryRunner";
/**
 * Entity manager supposed to work with any entity, automatically find its repository and call its methods,
 * whatever entity type are you passing.
 */
export declare function createLiteralEntityManager({ connection, queryRunner }: {
    connection: Connection;
    queryRunner?: QueryRunner;
}): EntityManager;
