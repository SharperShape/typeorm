import { ConnectionIsNotSetError } from "../../error/ConnectionIsNotSetError";
import { DriverPackageNotInstalledError } from "../../error/DriverPackageNotInstalledError";
import { DriverUtils } from "../DriverUtils";
import { MysqlQueryRunner } from "./MysqlQueryRunner";
import { DateUtils } from "../../util/DateUtils";
import { PlatformTools } from "../../platform/PlatformTools";
import { RdbmsSchemaBuilder } from "../../schema-builder/RdbmsSchemaBuilder";
import { OrmUtils } from "../../util/OrmUtils";
import { ApplyValueTransformers } from "../../util/ApplyValueTransformers";
/**
 * Organizes communication with MySQL DBMS.
 */
export class MysqlDriver {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(connection) {
        /**
         * Indicates if replication is enabled.
         */
        this.isReplicated = false;
        /**
         * Indicates if tree tables are supported by this driver.
         */
        this.treeSupport = true;
        /**
         * Gets list of supported column data types by a driver.
         *
         * @see https://www.tutorialspoint.com/mysql/mysql-data-types.htm
         * @see https://dev.mysql.com/doc/refman/8.0/en/data-types.html
         */
        this.supportedDataTypes = [
            // numeric types
            "bit",
            "int",
            "integer",
            "tinyint",
            "smallint",
            "mediumint",
            "bigint",
            "float",
            "double",
            "double precision",
            "real",
            "decimal",
            "dec",
            "numeric",
            "fixed",
            "bool",
            "boolean",
            // date and time types
            "date",
            "datetime",
            "timestamp",
            "time",
            "year",
            // string types
            "char",
            "nchar",
            "national char",
            "varchar",
            "nvarchar",
            "national varchar",
            "blob",
            "text",
            "tinyblob",
            "tinytext",
            "mediumblob",
            "mediumtext",
            "longblob",
            "longtext",
            "enum",
            "set",
            "binary",
            "varbinary",
            // json data type
            "json",
            // spatial data types
            "geometry",
            "point",
            "linestring",
            "polygon",
            "multipoint",
            "multilinestring",
            "multipolygon",
            "geometrycollection"
        ];
        /**
         * Gets list of spatial column data types.
         */
        this.spatialTypes = [
            "geometry",
            "point",
            "linestring",
            "polygon",
            "multipoint",
            "multilinestring",
            "multipolygon",
            "geometrycollection"
        ];
        /**
         * Gets list of column data types that support length by a driver.
         */
        this.withLengthColumnTypes = [
            "char",
            "varchar",
            "nvarchar",
            "binary",
            "varbinary"
        ];
        /**
         * Gets list of column data types that support length by a driver.
         */
        this.withWidthColumnTypes = [
            "bit",
            "tinyint",
            "smallint",
            "mediumint",
            "int",
            "integer",
            "bigint"
        ];
        /**
         * Gets list of column data types that support precision by a driver.
         */
        this.withPrecisionColumnTypes = [
            "decimal",
            "dec",
            "numeric",
            "fixed",
            "float",
            "double",
            "double precision",
            "real",
            "time",
            "datetime",
            "timestamp"
        ];
        /**
         * Gets list of column data types that supports scale by a driver.
         */
        this.withScaleColumnTypes = [
            "decimal",
            "dec",
            "numeric",
            "fixed",
            "float",
            "double",
            "double precision",
            "real"
        ];
        /**
         * Gets list of column data types that supports UNSIGNED and ZEROFILL attributes.
         */
        this.unsignedAndZerofillTypes = [
            "int",
            "integer",
            "smallint",
            "tinyint",
            "mediumint",
            "bigint",
            "decimal",
            "dec",
            "numeric",
            "fixed",
            "float",
            "double",
            "double precision",
            "real"
        ];
        /**
         * ORM has special columns and we need to know what database column types should be for those columns.
         * Column types are driver dependant.
         */
        this.mappedDataTypes = {
            createDate: "datetime",
            createDatePrecision: 6,
            createDateDefault: "CURRENT_TIMESTAMP(6)",
            updateDate: "datetime",
            updateDatePrecision: 6,
            updateDateDefault: "CURRENT_TIMESTAMP(6)",
            deleteDate: "datetime",
            deleteDatePrecision: 6,
            deleteDateNullable: true,
            version: "int",
            treeLevel: "int",
            migrationId: "int",
            migrationName: "varchar",
            migrationTimestamp: "bigint",
            cacheId: "int",
            cacheIdentifier: "varchar",
            cacheTime: "bigint",
            cacheDuration: "int",
            cacheQuery: "text",
            cacheResult: "text",
            metadataType: "varchar",
            metadataDatabase: "varchar",
            metadataSchema: "varchar",
            metadataTable: "varchar",
            metadataName: "varchar",
            metadataValue: "text",
        };
        /**
         * Default values of length, precision and scale depends on column data type.
         * Used in the cases when length/precision/scale is not specified by user.
         */
        this.dataTypeDefaults = {
            "varchar": { length: 255 },
            "nvarchar": { length: 255 },
            "national varchar": { length: 255 },
            "char": { length: 1 },
            "binary": { length: 1 },
            "varbinary": { length: 255 },
            "decimal": { precision: 10, scale: 0 },
            "dec": { precision: 10, scale: 0 },
            "numeric": { precision: 10, scale: 0 },
            "fixed": { precision: 10, scale: 0 },
            "float": { precision: 12 },
            "double": { precision: 22 },
            "time": { precision: 0 },
            "datetime": { precision: 0 },
            "timestamp": { precision: 0 },
            "bit": { width: 1 },
            "int": { width: 11 },
            "integer": { width: 11 },
            "tinyint": { width: 4 },
            "smallint": { width: 6 },
            "mediumint": { width: 9 },
            "bigint": { width: 20 }
        };
        /**
         * Max length allowed by MySQL for aliases.
         * @see https://dev.mysql.com/doc/refman/5.5/en/identifiers.html
         */
        this.maxAliasLength = 63;
        this.connection = connection;
        this.options = Object.assign({ legacySpatialSupport: true }, connection.options);
        this.isReplicated = this.options.replication ? true : false;
        // load mysql package
        this.loadDependencies();
        this.database = this.options.replication ? this.options.replication.master.database : this.options.database;
        // validate options to make sure everything is set
        // todo: revisit validation with replication in mind
        // if (!(this.options.host || (this.options.extra && this.options.extra.socketPath)) && !this.options.socketPath)
        //     throw new DriverOptionNotSetError("socketPath and host");
        // if (!this.options.username)
        //     throw new DriverOptionNotSetError("username");
        // if (!this.options.database)
        //     throw new DriverOptionNotSetError("database");
        // todo: check what is going on when connection is setup without database and how to connect to a database then?
        // todo: provide options to auto-create a database if it does not exist yet
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    /**
     * Performs connection to the database.
     */
    async connect() {
        if (this.options.replication) {
            this.poolCluster = this.mysql.createPoolCluster(this.options.replication);
            this.options.replication.slaves.forEach((slave, index) => {
                this.poolCluster.add("SLAVE" + index, this.createConnectionOptions(this.options, slave));
            });
            this.poolCluster.add("MASTER", this.createConnectionOptions(this.options, this.options.replication.master));
        }
        else {
            this.pool = await this.createPool(this.createConnectionOptions(this.options, this.options));
        }
    }
    /**
     * Makes any action after connection (e.g. create extensions in Postgres driver).
     */
    afterConnect() {
        return Promise.resolve();
    }
    /**
     * Closes connection with the database.
     */
    async disconnect() {
        if (!this.poolCluster && !this.pool)
            return Promise.reject(new ConnectionIsNotSetError("mysql"));
        if (this.poolCluster) {
            return new Promise((ok, fail) => {
                this.poolCluster.end((err) => err ? fail(err) : ok());
                this.poolCluster = undefined;
            });
        }
        if (this.pool) {
            return new Promise((ok, fail) => {
                this.pool.end((err) => {
                    if (err)
                        return fail(err);
                    this.pool = undefined;
                    ok();
                });
            });
        }
    }
    /**
     * Creates a schema builder used to build and sync a schema.
     */
    createSchemaBuilder() {
        return new RdbmsSchemaBuilder(this.connection);
    }
    /**
     * Creates a query runner used to execute database queries.
     */
    createQueryRunner(mode) {
        return new MysqlQueryRunner(this, mode);
    }
    /**
     * Replaces parameters in the given sql with special escaping character
     * and an array of parameter names to be passed to a query.
     */
    escapeQueryWithParameters(sql, parameters, nativeParameters) {
        const escapedParameters = Object.keys(nativeParameters).map(key => nativeParameters[key]);
        if (!parameters || !Object.keys(parameters).length)
            return [sql, escapedParameters];
        const keys = Object.keys(parameters).map(parameter => "(:(\\.\\.\\.)?" + parameter + "\\b)").join("|");
        sql = sql.replace(new RegExp(keys, "g"), (key) => {
            let value;
            if (key.substr(0, 4) === ":...") {
                value = parameters[key.substr(4)];
            }
            else {
                value = parameters[key.substr(1)];
            }
            if (value instanceof Function) {
                return value();
            }
            else {
                escapedParameters.push(value);
                return "?";
            }
        }); // todo: make replace only in value statements, otherwise problems
        return [sql, escapedParameters];
    }
    /**
     * Escapes a column name.
     */
    escape(columnName) {
        return "`" + columnName + "`";
    }
    /**
     * Build full table name with database name, schema name and table name.
     * E.g. "myDB"."mySchema"."myTable"
     */
    buildTableName(tableName, schema, database) {
        return database ? `${database}.${tableName}` : tableName;
    }
    /**
     * Prepares given value to a value to be persisted, based on its column type and metadata.
     */
    preparePersistentValue(value, columnMetadata) {
        if (columnMetadata.transformer)
            value = ApplyValueTransformers.transformTo(columnMetadata.transformer, value);
        if (value === null || value === undefined)
            return value;
        if (columnMetadata.type === Boolean) {
            return value === true ? 1 : 0;
        }
        else if (columnMetadata.type === "date") {
            return DateUtils.mixedDateToDateString(value);
        }
        else if (columnMetadata.type === "time") {
            return DateUtils.mixedDateToTimeString(value);
        }
        else if (columnMetadata.type === "json") {
            return JSON.stringify(value);
        }
        else if (columnMetadata.type === "timestamp" || columnMetadata.type === "datetime" || columnMetadata.type === Date) {
            return DateUtils.mixedDateToDate(value);
        }
        else if (columnMetadata.type === "simple-array") {
            return DateUtils.simpleArrayToString(value);
        }
        else if (columnMetadata.type === "simple-json") {
            return DateUtils.simpleJsonToString(value);
        }
        else if (columnMetadata.type === "enum" || columnMetadata.type === "simple-enum") {
            return "" + value;
        }
        else if (columnMetadata.type === "set") {
            return DateUtils.simpleArrayToString(value);
        }
        return value;
    }
    /**
     * Prepares given value to a value to be persisted, based on its column type or metadata.
     */
    prepareHydratedValue(value, columnMetadata) {
        if (value === null || value === undefined)
            return columnMetadata.transformer ? ApplyValueTransformers.transformFrom(columnMetadata.transformer, value) : value;
        if (columnMetadata.type === Boolean || columnMetadata.type === "bool" || columnMetadata.type === "boolean") {
            value = value ? true : false;
        }
        else if (columnMetadata.type === "datetime" || columnMetadata.type === Date) {
            value = DateUtils.normalizeHydratedDate(value);
        }
        else if (columnMetadata.type === "date") {
            value = DateUtils.mixedDateToDateString(value);
        }
        else if (columnMetadata.type === "json") {
            value = typeof value === "string" ? JSON.parse(value) : value;
        }
        else if (columnMetadata.type === "time") {
            value = DateUtils.mixedTimeToString(value);
        }
        else if (columnMetadata.type === "simple-array") {
            value = DateUtils.stringToSimpleArray(value);
        }
        else if (columnMetadata.type === "simple-json") {
            value = DateUtils.stringToSimpleJson(value);
        }
        else if ((columnMetadata.type === "enum" || columnMetadata.type === "simple-enum")
            && columnMetadata.enum
            && !isNaN(value)
            && columnMetadata.enum.indexOf(parseInt(value)) >= 0) {
            // convert to number if that exists in possible enum options
            value = parseInt(value);
        }
        else if (columnMetadata.type === "set") {
            value = DateUtils.stringToSimpleArray(value);
        }
        if (columnMetadata.transformer)
            value = ApplyValueTransformers.transformFrom(columnMetadata.transformer, value);
        return value;
    }
    /**
     * Creates a database type from a given column metadata.
     */
    normalizeType(column) {
        if (column.type === Number || column.type === "integer") {
            return "int";
        }
        else if (column.type === String) {
            return "varchar";
        }
        else if (column.type === Date) {
            return "datetime";
        }
        else if (column.type === Buffer) {
            return "blob";
        }
        else if (column.type === Boolean) {
            return "tinyint";
        }
        else if (column.type === "uuid") {
            return "varchar";
        }
        else if (column.type === "json" && this.options.type === "mariadb") {
            /*
             * MariaDB implements this as a LONGTEXT rather, as the JSON data type contradicts the SQL standard,
             * and MariaDB's benchmarks indicate that performance is at least equivalent.
             *
             * @see https://mariadb.com/kb/en/json-data-type/
             */
            return "longtext";
        }
        else if (column.type === "simple-array" || column.type === "simple-json") {
            return "text";
        }
        else if (column.type === "simple-enum") {
            return "enum";
        }
        else if (column.type === "double precision" || column.type === "real") {
            return "double";
        }
        else if (column.type === "dec" || column.type === "numeric" || column.type === "fixed") {
            return "decimal";
        }
        else if (column.type === "bool" || column.type === "boolean") {
            return "tinyint";
        }
        else if (column.type === "nvarchar" || column.type === "national varchar") {
            return "varchar";
        }
        else if (column.type === "nchar" || column.type === "national char") {
            return "char";
        }
        else {
            return column.type || "";
        }
    }
    /**
     * Normalizes "default" value of the column.
     */
    normalizeDefault(columnMetadata) {
        const defaultValue = columnMetadata.default;
        if ((columnMetadata.type === "enum" || columnMetadata.type === "simple-enum") && defaultValue !== undefined) {
            return `'${defaultValue}'`;
        }
        if ((columnMetadata.type === "set") && defaultValue !== undefined) {
            return `'${DateUtils.simpleArrayToString(defaultValue)}'`;
        }
        if (typeof defaultValue === "number") {
            return "" + defaultValue;
        }
        else if (typeof defaultValue === "boolean") {
            return defaultValue === true ? "1" : "0";
        }
        else if (typeof defaultValue === "function") {
            return defaultValue();
        }
        else if (typeof defaultValue === "string") {
            return `'${defaultValue}'`;
        }
        else if (defaultValue === null) {
            return `NULL`;
        }
        else {
            return defaultValue;
        }
    }
    /**
     * Normalizes "isUnique" value of the column.
     */
    normalizeIsUnique(column) {
        return column.entityMetadata.indices.some(idx => idx.isUnique && idx.columns.length === 1 && idx.columns[0] === column);
    }
    /**
     * Returns default column lengths, which is required on column creation.
     */
    getColumnLength(column) {
        if (column.length)
            return column.length.toString();
        /**
         * fix https://github.com/typeorm/typeorm/issues/1139
         */
        if (column.generationStrategy === "uuid")
            return "36";
        switch (column.type) {
            case String:
            case "varchar":
            case "nvarchar":
            case "national varchar":
                return "255";
            case "varbinary":
                return "255";
            default:
                return "";
        }
    }
    /**
     * Creates column type definition including length, precision and scale
     */
    createFullType(column) {
        let type = column.type;
        // used 'getColumnLength()' method, because MySQL requires column length for `varchar`, `nvarchar` and `varbinary` data types
        if (this.getColumnLength(column)) {
            type += `(${this.getColumnLength(column)})`;
        }
        else if (column.width) {
            type += `(${column.width})`;
        }
        else if (column.precision !== null && column.precision !== undefined && column.scale !== null && column.scale !== undefined) {
            type += `(${column.precision},${column.scale})`;
        }
        else if (column.precision !== null && column.precision !== undefined) {
            type += `(${column.precision})`;
        }
        if (column.isArray)
            type += " array";
        return type;
    }
    /**
     * Obtains a new database connection to a master server.
     * Used for replication.
     * If replication is not setup then returns default connection's database connection.
     */
    obtainMasterConnection() {
        return new Promise((ok, fail) => {
            if (this.poolCluster) {
                this.poolCluster.getConnection("MASTER", (err, dbConnection) => {
                    err ? fail(err) : ok(this.prepareDbConnection(dbConnection));
                });
            }
            else if (this.pool) {
                this.pool.getConnection((err, dbConnection) => {
                    err ? fail(err) : ok(this.prepareDbConnection(dbConnection));
                });
            }
            else {
                fail(new Error(`Connection is not established with mysql database`));
            }
        });
    }
    /**
     * Obtains a new database connection to a slave server.
     * Used for replication.
     * If replication is not setup then returns master (default) connection's database connection.
     */
    obtainSlaveConnection() {
        if (!this.poolCluster)
            return this.obtainMasterConnection();
        return new Promise((ok, fail) => {
            this.poolCluster.getConnection("SLAVE*", (err, dbConnection) => {
                err ? fail(err) : ok(dbConnection);
            });
        });
    }
    /**
     * Creates generated map of values generated or returned by database after INSERT query.
     */
    createGeneratedMap(metadata, insertResult, entityIndex) {
        const generatedMap = metadata.generatedColumns.reduce((map, generatedColumn) => {
            let value;
            if (generatedColumn.generationStrategy === "increment" && insertResult.insertId) {
                // NOTE: When multiple rows is inserted by a single INSERT statement,
                // `insertId` is the value generated for the first inserted row only.
                value = insertResult.insertId + entityIndex;
                // } else if (generatedColumn.generationStrategy === "uuid") {
                //     console.log("getting db value:", generatedColumn.databaseName);
                //     value = generatedColumn.getEntityValue(uuidMap);
            }
            return OrmUtils.mergeDeep(map, generatedColumn.createValueMap(value));
        }, {});
        return Object.keys(generatedMap).length > 0 ? generatedMap : undefined;
    }
    /**
     * Differentiate columns of this table and columns from the given column metadatas columns
     * and returns only changed.
     */
    findChangedColumns(tableColumns, columnMetadatas) {
        return columnMetadatas.filter(columnMetadata => {
            const tableColumn = tableColumns.find(c => c.name === columnMetadata.databaseName);
            if (!tableColumn)
                return false; // we don't need new columns, we only need exist and changed
            // console.log("table:", columnMetadata.entityMetadata.tableName);
            // console.log("name:", tableColumn.name, columnMetadata.databaseName);
            // console.log("type:", tableColumn.type, this.normalizeType(columnMetadata));
            // console.log("length:", tableColumn.length, columnMetadata.length);
            // console.log("width:", tableColumn.width, columnMetadata.width);
            // console.log("precision:", tableColumn.precision, columnMetadata.precision);
            // console.log("scale:", tableColumn.scale, columnMetadata.scale);
            // console.log("zerofill:", tableColumn.zerofill, columnMetadata.zerofill);
            // console.log("unsigned:", tableColumn.unsigned, columnMetadata.unsigned);
            // console.log("asExpression:", tableColumn.asExpression, columnMetadata.asExpression);
            // console.log("generatedType:", tableColumn.generatedType, columnMetadata.generatedType);
            // console.log("comment:", tableColumn.comment, columnMetadata.comment);
            // console.log("default:", tableColumn.default, columnMetadata.default);
            // console.log("enum:", tableColumn.enum, columnMetadata.enum);
            // console.log("default changed:", !this.compareDefaultValues(this.normalizeDefault(columnMetadata), tableColumn.default));
            // console.log("onUpdate:", tableColumn.onUpdate, columnMetadata.onUpdate);
            // console.log("isPrimary:", tableColumn.isPrimary, columnMetadata.isPrimary);
            // console.log("isNullable:", tableColumn.isNullable, columnMetadata.isNullable);
            // console.log("isUnique:", tableColumn.isUnique, this.normalizeIsUnique(columnMetadata));
            // console.log("isGenerated:", tableColumn.isGenerated, columnMetadata.isGenerated);
            // console.log((columnMetadata.generationStrategy !== "uuid" && tableColumn.isGenerated !== columnMetadata.isGenerated));
            // console.log("==========================================");
            let columnMetadataLength = columnMetadata.length;
            if (!columnMetadataLength && columnMetadata.generationStrategy === "uuid") { // fixing #3374
                columnMetadataLength = this.getColumnLength(columnMetadata);
            }
            return tableColumn.name !== columnMetadata.databaseName
                || tableColumn.type !== this.normalizeType(columnMetadata)
                || tableColumn.length !== columnMetadataLength
                || tableColumn.width !== columnMetadata.width
                || tableColumn.precision !== columnMetadata.precision
                || tableColumn.scale !== columnMetadata.scale
                || tableColumn.zerofill !== columnMetadata.zerofill
                || tableColumn.unsigned !== columnMetadata.unsigned
                || tableColumn.asExpression !== columnMetadata.asExpression
                || tableColumn.generatedType !== columnMetadata.generatedType
                // || tableColumn.comment !== columnMetadata.comment // todo
                || !this.compareDefaultValues(this.normalizeDefault(columnMetadata), tableColumn.default)
                || (tableColumn.enum && columnMetadata.enum && !OrmUtils.isArraysEqual(tableColumn.enum, columnMetadata.enum.map(val => val + "")))
                || tableColumn.onUpdate !== columnMetadata.onUpdate
                || tableColumn.isPrimary !== columnMetadata.isPrimary
                || tableColumn.isNullable !== columnMetadata.isNullable
                || tableColumn.isUnique !== this.normalizeIsUnique(columnMetadata)
                || (columnMetadata.generationStrategy !== "uuid" && tableColumn.isGenerated !== columnMetadata.isGenerated);
        });
    }
    /**
     * Returns true if driver supports RETURNING / OUTPUT statement.
     */
    isReturningSqlSupported() {
        return false;
    }
    /**
     * Returns true if driver supports uuid values generation on its own.
     */
    isUUIDGenerationSupported() {
        return false;
    }
    /**
     * Returns true if driver supports fulltext indices.
     */
    isFullTextColumnTypeSupported() {
        return true;
    }
    /**
     * Creates an escaped parameter.
     */
    createParameter(parameterName, index) {
        return "?";
    }
    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------
    /**
     * Loads all driver dependencies.
     */
    loadDependencies() {
        try {
            this.mysql = PlatformTools.load("mysql"); // try to load first supported package
            /*
             * Some frameworks (such as Jest) may mess up Node's require cache and provide garbage for the 'mysql' module
             * if it was not installed. We check that the object we got actually contains something otherwise we treat
             * it as if the `require` call failed.
             *
             * @see https://github.com/typeorm/typeorm/issues/1373
             */
            if (Object.keys(this.mysql).length === 0) {
                throw new Error("'mysql' was found but it is empty. Falling back to 'mysql2'.");
            }
        }
        catch (e) {
            try {
                this.mysql = PlatformTools.load("mysql2"); // try to load second supported package
            }
            catch (e) {
                throw new DriverPackageNotInstalledError("Mysql", "mysql");
            }
        }
    }
    /**
     * Creates a new connection pool for a given database credentials.
     */
    createConnectionOptions(options, credentials) {
        credentials = Object.assign({}, credentials, DriverUtils.buildDriverOptions(credentials)); // todo: do it better way
        // build connection options for the driver
        return Object.assign({}, {
            charset: options.charset,
            timezone: options.timezone,
            connectTimeout: options.connectTimeout,
            insecureAuth: options.insecureAuth,
            supportBigNumbers: options.supportBigNumbers !== undefined ? options.supportBigNumbers : true,
            bigNumberStrings: options.bigNumberStrings !== undefined ? options.bigNumberStrings : true,
            dateStrings: options.dateStrings,
            debug: options.debug,
            trace: options.trace,
            multipleStatements: options.multipleStatements,
            flags: options.flags
        }, {
            host: credentials.host,
            user: credentials.username,
            password: credentials.password,
            database: credentials.database,
            port: credentials.port,
            ssl: options.ssl
        }, options.acquireTimeout === undefined
            ? {}
            : { acquireTimeout: options.acquireTimeout }, options.extra || {});
    }
    /**
     * Creates a new connection pool for a given database credentials.
     */
    createPool(connectionOptions) {
        // create a connection pool
        const pool = this.mysql.createPool(connectionOptions);
        // make sure connection is working fine
        return new Promise((ok, fail) => {
            // (issue #610) we make first connection to database to make sure if connection credentials are wrong
            // we give error before calling any other method that creates actual query runner
            pool.getConnection((err, connection) => {
                if (err)
                    return pool.end(() => fail(err));
                connection.release();
                ok(pool);
            });
        });
    }
    /**
     * Attaches all required base handlers to a database connection, such as the unhandled error handler.
     */
    prepareDbConnection(connection) {
        const { logger } = this.connection;
        /*
          Attaching an error handler to connection errors is essential, as, otherwise, errors raised will go unhandled and
          cause the hosting app to crash.
         */
        if (connection.listeners("error").length === 0) {
            connection.on("error", (error) => logger.log("warn", `MySQL connection raised an error. ${error}`));
        }
        return connection;
    }
    /**
     * Checks if "DEFAULT" values in the column metadata and in the database are equal.
     */
    compareDefaultValues(columnMetadataValue, databaseValue) {
        if (typeof columnMetadataValue === "string" && typeof databaseValue === "string") {
            // we need to cut out "'" because in mysql we can understand returned value is a string or a function
            // as result compare cannot understand if default is really changed or not
            columnMetadataValue = columnMetadataValue.replace(/^'+|'+$/g, "");
            databaseValue = databaseValue.replace(/^'+|'+$/g, "");
        }
        return columnMetadataValue === databaseValue || (columnMetadataValue === null && typeof databaseValue === "undefined");
    }
}

//# sourceMappingURL=MysqlDriver.js.map
