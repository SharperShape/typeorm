import { QueryRunner } from "../query-runner/QueryRunner";
import { EntityTarget, MongoEntityManager } from "..";
import { MongoRepository } from "./MongoRepository";
/**
 * Repository is supposed to work with your entity objects. Find entities, insert, update, delete, etc.
 */
export declare function createLiteralMongoRepository<Entity>({ manager, target, queryRunner }: {
    manager: MongoEntityManager;
    target: EntityTarget<Entity>;
    queryRunner?: QueryRunner;
}): MongoRepository<Entity>;
