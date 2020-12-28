import { QueryRunner } from "../query-runner/QueryRunner";
import { Repository } from "./Repository";
import { EntityManager } from "..";
import { EntityTarget } from "../common/EntityTarget";
/**
 * Repository is supposed to work with your entity objects. Find entities, insert, update, delete, etc.
 */
export declare function createLiteralRepository<Entity>({ manager, target, queryRunner }: {
    manager: EntityManager;
    target: EntityTarget<Entity>;
    queryRunner?: QueryRunner;
}): Repository<Entity>;
