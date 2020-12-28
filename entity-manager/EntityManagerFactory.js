"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityManagerFactory = void 0;
const MongoDriver_1 = require("../driver/mongodb/MongoDriver");
const SqljsDriver_1 = require("../driver/sqljs/SqljsDriver");
const LiteralEntityManager_1 = require("./LiteralEntityManager");
const LiteralMongoEntityManager_1 = require("./LiteralMongoEntityManager");
const LiteralSqljsEntityManager_1 = require("./LiteralSqljsEntityManager");
/**
 * Helps to create entity managers.
 */
class EntityManagerFactory {
    /**
     * Creates a new entity manager depend on a given connection's driver.
     */
    create(connection, queryRunner) {
        if (connection.driver instanceof MongoDriver_1.MongoDriver)
            return LiteralMongoEntityManager_1.createLiteralMongoEntityManager({ connection });
        if (connection.driver instanceof SqljsDriver_1.SqljsDriver)
            return LiteralSqljsEntityManager_1.createLiteralSqljsEntityManager({ connection, queryRunner });
        return LiteralEntityManager_1.createLiteralEntityManager({ connection, queryRunner });
    }
}
exports.EntityManagerFactory = EntityManagerFactory;

//# sourceMappingURL=EntityManagerFactory.js.map
