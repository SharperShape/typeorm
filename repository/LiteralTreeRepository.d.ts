import { EntityManager, QueryRunner, TreeRepository } from "..";
import { EntityTarget } from "../common/EntityTarget";
/**
 * Repository is supposed to work with your entity objects. Find entities, insert, update, delete, etc.
 */
export declare function createLiteralTreeRepository<Entity>({ manager, target, queryRunner }: {
    manager: EntityManager;
    target: EntityTarget<Entity>;
    queryRunner?: QueryRunner;
}): TreeRepository<Entity>;
