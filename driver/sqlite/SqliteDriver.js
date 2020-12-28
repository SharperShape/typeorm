"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteDriver = void 0;
const tslib_1 = require("tslib");
const mkdirp_1 = tslib_1.__importDefault(require("mkdirp"));
const path_1 = tslib_1.__importDefault(require("path"));
const DriverPackageNotInstalledError_1 = require("../../error/DriverPackageNotInstalledError");
const SqliteQueryRunner_1 = require("./SqliteQueryRunner");
const DriverOptionNotSetError_1 = require("../../error/DriverOptionNotSetError");
const PlatformTools_1 = require("../../platform/PlatformTools");
const AbstractSqliteDriver_1 = require("../sqlite-abstract/AbstractSqliteDriver");
/**
 * Organizes communication with sqlite DBMS.
 */
class SqliteDriver extends AbstractSqliteDriver_1.AbstractSqliteDriver {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(connection) {
        super(connection);
        this.connection = connection;
        this.options = connection.options;
        this.database = this.options.database;
        // validate options to make sure everything is set
        if (!this.options.database)
            throw new DriverOptionNotSetError_1.DriverOptionNotSetError("database");
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
            this.databaseConnection.close((err) => err ? fail(err) : ok());
        });
    }
    /**
     * Creates a query runner used to execute database queries.
     */
    createQueryRunner(mode) {
        if (!this.queryRunner)
            this.queryRunner = new SqliteQueryRunner_1.SqliteQueryRunner(this);
        return this.queryRunner;
    }
    normalizeType(column) {
        if (column.type === Buffer) {
            return "blob";
        }
        return super.normalizeType(column);
    }
    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------
    /**
     * Creates connection with the database.
     */
    async createDatabaseConnection() {
        await this.createDatabaseDirectory(this.options.database);
        const databaseConnection = await new Promise((ok, fail) => {
            const connection = new this.sqlite.Database(this.options.database, (err) => {
                if (err)
                    return fail(err);
                ok(connection);
            });
        });
        // Internal function to run a command on the connection and fail if an error occured.
        function run(line) {
            return new Promise((ok, fail) => {
                databaseConnection.run(line, (err) => {
                    if (err)
                        return fail(err);
                    ok();
                });
            });
        }
        if (this.options.enableWAL) {
            await run(`PRAGMA journal_mode = WAL;`);
        }
        // we need to enable foreign keys in sqlite to make sure all foreign key related features
        // working properly. this also makes onDelete to work with sqlite.
        await run(`PRAGMA foreign_keys = ON;`);
        // in the options, if encryption key for SQLCipher is setted.
        if (this.options.key) {
            await run(`PRAGMA key = ${JSON.stringify(this.options.key)};`);
        }
        return databaseConnection;
    }
    /**
     * If driver dependency is not given explicitly, then try to load it via "require".
     */
    loadDependencies() {
        try {
            this.sqlite = PlatformTools_1.PlatformTools.load("sqlite3").verbose();
        }
        catch (e) {
            throw new DriverPackageNotInstalledError_1.DriverPackageNotInstalledError("SQLite", "sqlite3");
        }
    }
    /**
     * Auto creates database directory if it does not exist.
     */
    async createDatabaseDirectory(fullPath) {
        await mkdirp_1.default(path_1.default.dirname(fullPath));
    }
}
exports.SqliteDriver = SqliteDriver;

//# sourceMappingURL=SqliteDriver.js.map
