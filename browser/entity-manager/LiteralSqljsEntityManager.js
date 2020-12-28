import { createLiteralEntityManager } from "./LiteralEntityManager";
/**
 * A special EntityManager that includes import/export and load/save function
 * that are unique to Sql.js.
 */
export function createLiteralSqljsEntityManager({ connection, queryRunner }) {
    const driver = connection.driver;
    return Object.assign(Object.assign({}, createLiteralEntityManager({ connection, queryRunner })), { typeof: "SqljsEntityManager", // todo: fix as any
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

//# sourceMappingURL=LiteralSqljsEntityManager.js.map
