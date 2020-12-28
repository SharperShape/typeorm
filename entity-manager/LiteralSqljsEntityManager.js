"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLiteralSqljsEntityManager = void 0;
const LiteralEntityManager_1 = require("./LiteralEntityManager");
/**
 * A special EntityManager that includes import/export and load/save function
 * that are unique to Sql.js.
 */
function createLiteralSqljsEntityManager({ connection, queryRunner }) {
    const driver = connection.driver;
    return Object.assign(Object.assign({}, LiteralEntityManager_1.createLiteralEntityManager({ connection, queryRunner })), { typeof: "SqljsEntityManager", // todo: fix as any
        async loadDatabase(fileNameOrLocalStorageOrData) {
            await driver.load(fileNameOrLocalStorageOrData);
        },
        async saveDatabase(fileNameOrLocalStorage) {
            await driver.save(fileNameOrLocalStorage);
        },
        exportDatabase() {
            return driver.export();
        } });
}
exports.createLiteralSqljsEntityManager = createLiteralSqljsEntityManager;

//# sourceMappingURL=LiteralSqljsEntityManager.js.map
