"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CordovaDriver = void 0;
const AbstractSqliteDriver_1 = require("../sqlite-abstract/AbstractSqliteDriver");
const CordovaQueryRunner_1 = require("./CordovaQueryRunner");
const DriverOptionNotSetError_1 = require("../../error/DriverOptionNotSetError");
const DriverPackageNotInstalledError_1 = require("../../error/DriverPackageNotInstalledError");
class CordovaDriver extends AbstractSqliteDriver_1.AbstractSqliteDriver {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(connection) {
        super(connection);
        // this.connection = connection;
        // this.options = connection.options as CordovaConnectionOptions;
        this.database = this.options.database;
        // validate options to make sure everything is set
        if (!this.options.database)
            throw new DriverOptionNotSetError_1.DriverOptionNotSetError("database");
        if (!this.options.location)
            throw new DriverOptionNotSetError_1.DriverOptionNotSetError("location");
        // load sqlite package
        this.loadDependencies();
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    /**
     * Closes connection with database.
     */
    async disconnect() {
        return new Promise((ok, fail) => {
            this.queryRunner = undefined;
            this.databaseConnection.close(ok, fail);
        });
    }
    /**
     * Creates a query runner used to execute database queries.
     */
    createQueryRunner(mode) {
        if (!this.queryRunner)
            this.queryRunner = new CordovaQueryRunner_1.CordovaQueryRunner(this);
        return this.queryRunner;
    }
    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------
    /**
     * Creates connection with the database.
     */
    createDatabaseConnection() {
        return new Promise((ok, fail) => {
            const options = Object.assign({}, {
                name: this.options.database,
                location: this.options.location,
            }, this.options.extra || {});
            this.sqlite.openDatabase(options, (db) => {
                const databaseConnection = db;
                // we need to enable foreign keys in sqlite to make sure all foreign key related features
                // working properly. this also makes onDelete to work with sqlite.
                databaseConnection.executeSql(`PRAGMA foreign_keys = ON;`, [], (result) => {
                    ok(databaseConnection);
                }, (error) => {
                    fail(error);
                });
            }, (error) => {
                fail(error);
            });
        });
    }
    /**
     * If driver dependency is not given explicitly, then try to load it via "require".
     */
    loadDependencies() {
        try {
            this.sqlite = window.sqlitePlugin;
        }
        catch (e) {
            throw new DriverPackageNotInstalledError_1.DriverPackageNotInstalledError("Cordova-SQLite", "cordova-sqlite-storage");
        }
    }
}
exports.CordovaDriver = CordovaDriver;

//# sourceMappingURL=CordovaDriver.js.map
