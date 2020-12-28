"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryCommand = void 0;
const tslib_1 = require("tslib");
const index_1 = require("../index");
const ConnectionOptionsReader_1 = require("../connection/ConnectionOptionsReader");
const PlatformTools_1 = require("../platform/PlatformTools");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
/**
 * Executes an sql query on the given connection.
 */
class QueryCommand {
    constructor() {
        this.command = "query";
        this.describe = "Executes given SQL query on a default connection. Specify connection name to run query on a specific connection.";
    }
    builder(args) {
        return args
            .option("c", {
            alias: "connection",
            default: "default",
            describe: "Name of the connection on which to run a query."
        })
            .option("f", {
            alias: "config",
            default: "ormconfig",
            describe: "Name of the file with connection configuration."
        });
    }
    async handler(args) {
        let connection = undefined;
        let queryRunner = undefined;
        try {
            // create a connection
            const connectionOptionsReader = new ConnectionOptionsReader_1.ConnectionOptionsReader({
                root: process.cwd(),
                configName: args.config
            });
            const connectionOptions = await connectionOptionsReader.get(args.connection);
            Object.assign(connectionOptions, {
                synchronize: false,
                migrationsRun: false,
                dropSchema: false,
                logging: false
            });
            connection = await index_1.createConnection(connectionOptions);
            // create a query runner and execute query using it
            queryRunner = connection.createQueryRunner();
            console.log(chalk_1.default.green("Running query: ") + PlatformTools_1.PlatformTools.highlightSql(String(args._[1])));
            const queryResult = await queryRunner.query(String(args._[1]));
            console.log(chalk_1.default.green("Query has been executed. Result: "));
            console.log(PlatformTools_1.PlatformTools.highlightJson(JSON.stringify(queryResult, undefined, 2)));
            await queryRunner.release();
            await connection.close();
        }
        catch (err) {
            if (queryRunner)
                await queryRunner.release();
            if (connection)
                await connection.close();
            console.log(chalk_1.default.black.bgRed("Error during query execution:"));
            console.error(err);
            process.exit(1);
        }
    }
}
exports.QueryCommand = QueryCommand;

//# sourceMappingURL=QueryCommand.js.map
