"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteQueryRunner = void 0;
const QueryRunnerAlreadyReleasedError_1 = require("../../error/QueryRunnerAlreadyReleasedError");
const QueryFailedError_1 = require("../../error/QueryFailedError");
const AbstractSqliteQueryRunner_1 = require("../sqlite-abstract/AbstractSqliteQueryRunner");
const Broadcaster_1 = require("../../subscriber/Broadcaster");
/**
 * Runs queries on a single sqlite database connection.
 *
 * Does not support compose primary keys with autoincrement field.
 * todo: need to throw exception for this case.
 */
class SqliteQueryRunner extends AbstractSqliteQueryRunner_1.AbstractSqliteQueryRunner {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(driver) {
        super();
        this.driver = driver;
        this.connection = driver.connection;
        this.broadcaster = new Broadcaster_1.Broadcaster(this);
    }
    /**
     * Executes a given SQL query.
     */
    query(query, parameters) {
        if (this.isReleased)
            throw new QueryRunnerAlreadyReleasedError_1.QueryRunnerAlreadyReleasedError();
        const connection = this.driver.connection;
        const options = connection.options;
        return new Promise(async (ok, fail) => {
            const databaseConnection = await this.connect();
            this.driver.connection.logger.logQuery(query, parameters, this);
            const queryStartTime = +new Date();
            const isInsertQuery = query.substr(0, 11) === "INSERT INTO";
            const execute = async () => {
                if (isInsertQuery) {
                    databaseConnection.run(query, parameters, handler);
                }
                else {
                    databaseConnection.all(query, parameters, handler);
                }
            };
            const handler = function (err, result) {
                if (err && err.toString().indexOf("SQLITE_BUSY:") !== -1) {
                    if (typeof options.busyErrorRetry === "number" && options.busyErrorRetry > 0) {
                        setTimeout(execute, options.busyErrorRetry);
                        return;
                    }
                }
                // log slow queries if maxQueryExecution time is set
                const maxQueryExecutionTime = connection.options.maxQueryExecutionTime;
                const queryEndTime = +new Date();
                const queryExecutionTime = queryEndTime - queryStartTime;
                if (maxQueryExecutionTime && queryExecutionTime > maxQueryExecutionTime)
                    connection.logger.logQuerySlow(queryExecutionTime, query, parameters, this);
                if (err) {
                    connection.logger.logQueryError(err, query, parameters, this);
                    fail(new QueryFailedError_1.QueryFailedError(query, parameters, err));
                }
                else {
                    ok(isInsertQuery ? this["lastID"] : result);
                }
            };
            await execute();
        });
    }
}
exports.SqliteQueryRunner = SqliteQueryRunner;

//# sourceMappingURL=SqliteQueryRunner.js.map
