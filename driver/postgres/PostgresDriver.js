"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuroraDataApiPostgresDriver = exports.PostgresDriver = void 0;
const ConnectionIsNotSetError_1 = require("../../error/ConnectionIsNotSetError");
const DriverPackageNotInstalledError_1 = require("../../error/DriverPackageNotInstalledError");
const DriverUtils_1 = require("../DriverUtils");
const PostgresQueryRunner_1 = require("./PostgresQueryRunner");
const DateUtils_1 = require("../../util/DateUtils");
const PlatformTools_1 = require("../../platform/PlatformTools");
const RdbmsSchemaBuilder_1 = require("../../schema-builder/RdbmsSchemaBuilder");
const OrmUtils_1 = require("../../util/OrmUtils");
const ApplyValueTransformers_1 = require("../../util/ApplyValueTransformers");
const AuroraDataApiPostgresQueryRunner_1 = require("../aurora-data-api-pg/AuroraDataApiPostgresQueryRunner");
/**
 * Organizes communication with PostgreSQL DBMS.
 */
class PostgresDriver {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(connection) {
        /**
         * Pool for slave databases.
         * Used in replication.
         */
        this.slaves = [];
        /**
         * We store all created query runners because we need to release them.
         */
        this.connectedQueryRunners = [];
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
         * @see https://www.tutorialspoint.com/postgresql/postgresql_data_types.htm
         * @see https://www.postgresql.org/docs/9.2/static/datatype.html
         */
        this.supportedDataTypes = [
            "int",
            "int2",
            "int4",
            "int8",
            "smallint",
            "integer",
            "bigint",
            "decimal",
            "numeric",
            "real",
            "float",
            "float4",
            "float8",
            "double precision",
            "money",
            "character varying",
            "varchar",
            "character",
            "char",
            "text",
            "citext",
            "hstore",
            "bytea",
            "bit",
            "varbit",
            "bit varying",
            "timetz",
            "timestamptz",
            "timestamp",
            "timestamp without time zone",
            "timestamp with time zone",
            "date",
            "time",
            "time without time zone",
            "time with time zone",
            "interval",
            "bool",
            "boolean",
            "enum",
            "point",
            "line",
            "lseg",
            "box",
            "path",
            "polygon",
            "circle",
            "cidr",
            "inet",
            "macaddr",
            "tsvector",
            "tsquery",
            "uuid",
            "xml",
            "json",
            "jsonb",
            "int4range",
            "int8range",
            "numrange",
            "tsrange",
            "tstzrange",
            "daterange",
            "geometry",
            "geography",
            "cube",
            "ltree"
        ];
        /**
         * Gets list of spatial column data types.
         */
        this.spatialTypes = [
            "geometry",
            "geography"
        ];
        /**
         * Gets list of column data types that support length by a driver.
         */
        this.withLengthColumnTypes = [
            "character varying",
            "varchar",
            "character",
            "char",
            "bit",
            "varbit",
            "bit varying"
        ];
        /**
         * Gets list of column data types that support precision by a driver.
         */
        this.withPrecisionColumnTypes = [
            "numeric",
            "decimal",
            "interval",
            "time without time zone",
            "time with time zone",
            "timestamp without time zone",
            "timestamp with time zone"
        ];
        /**
         * Gets list of column data types that support scale by a driver.
         */
        this.withScaleColumnTypes = [
            "numeric",
            "decimal"
        ];
        /**
         * Orm has special columns and we need to know what database column types should be for those types.
         * Column types are driver dependant.
         */
        this.mappedDataTypes = {
            createDate: "timestamp",
            createDateDefault: "now()",
            updateDate: "timestamp",
            updateDateDefault: "now()",
            deleteDate: "timestamp",
            deleteDateNullable: true,
            version: "int4",
            treeLevel: "int4",
            migrationId: "int4",
            migrationName: "varchar",
            migrationTimestamp: "int8",
            cacheId: "int4",
            cacheIdentifier: "varchar",
            cacheTime: "int8",
            cacheDuration: "int4",
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
            "character": { length: 1 },
            "bit": { length: 1 },
            "interval": { precision: 6 },
            "time without time zone": { precision: 6 },
            "time with time zone": { precision: 6 },
            "timestamp without time zone": { precision: 6 },
            "timestamp with time zone": { precision: 6 },
        };
        /**
         * Max length allowed by Postgres for aliases.
         * @see https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
         */
        this.maxAliasLength = 63;
        if (!connection) {
            return;
        }
        this.connection = connection;
        this.options = connection.options;
        this.isReplicated = this.options.replication ? true : false;
        // load postgres package
        this.loadDependencies();
        // ObjectUtils.assign(this.options, DriverUtils.buildDriverOptions(connection.options)); // todo: do it better way
        // validate options to make sure everything is set
        // todo: revisit validation with replication in mind
        // if (!this.options.host)
        //     throw new DriverOptionNotSetError("host");
        // if (!this.options.username)
        //     throw new DriverOptionNotSetError("username");
        // if (!this.options.database)
        //     throw new DriverOptionNotSetError("database");
    }
    // -------------------------------------------------------------------------
    // Public Implemented Methods
    // -------------------------------------------------------------------------
    /**
     * Performs connection to the database.
     * Based on pooling options, it can either create connection immediately,
     * either create a pool and create connection when needed.
     */
    async connect() {
        if (this.options.replication) {
            this.slaves = await Promise.all(this.options.replication.slaves.map(slave => {
                return this.createPool(this.options, slave);
            }));
            this.master = await this.createPool(this.options, this.options.replication.master);
            this.database = this.options.replication.master.database;
        }
        else {
            this.master = await this.createPool(this.options, this.options);
            this.database = this.options.database;
        }
    }
    /**
     * Makes any action after connection (e.g. create extensions in Postgres driver).
     */
    async afterConnect() {
        const extensionsMetadata = await this.checkMetadataForExtensions();
        if (extensionsMetadata.hasExtensions) {
            await Promise.all([this.master, ...this.slaves].map(pool => {
                return new Promise((ok, fail) => {
                    pool.connect(async (err, connection, release) => {
                        await this.enableExtensions(extensionsMetadata, connection);
                        if (err)
                            return fail(err);
                        release();
                        ok();
                    });
                });
            }));
        }
        return Promise.resolve();
    }
    async enableExtensions(extensionsMetadata, connection) {
        const { logger } = this.connection;
        const { hasUuidColumns, hasCitextColumns, hasHstoreColumns, hasCubeColumns, hasGeometryColumns, hasLtreeColumns, hasExclusionConstraints, } = extensionsMetadata;
        if (hasUuidColumns)
            try {
                await this.executeQuery(connection, `CREATE EXTENSION IF NOT EXISTS "${this.options.uuidExtension || "uuid-ossp"}"`);
            }
            catch (_) {
                logger.log("warn", `At least one of the entities has uuid column, but the '${this.options.uuidExtension || "uuid-ossp"}' extension cannot be installed automatically. Please install it manually using superuser rights, or select another uuid extension.`);
            }
        if (hasCitextColumns)
            try {
                await this.executeQuery(connection, `CREATE EXTENSION IF NOT EXISTS "citext"`);
            }
            catch (_) {
                logger.log("warn", "At least one of the entities has citext column, but the 'citext' extension cannot be installed automatically. Please install it manually using superuser rights");
            }
        if (hasHstoreColumns)
            try {
                await this.executeQuery(connection, `CREATE EXTENSION IF NOT EXISTS "hstore"`);
            }
            catch (_) {
                logger.log("warn", "At least one of the entities has hstore column, but the 'hstore' extension cannot be installed automatically. Please install it manually using superuser rights");
            }
        if (hasGeometryColumns)
            try {
                await this.executeQuery(connection, `CREATE EXTENSION IF NOT EXISTS "postgis"`);
            }
            catch (_) {
                logger.log("warn", "At least one of the entities has a geometry column, but the 'postgis' extension cannot be installed automatically. Please install it manually using superuser rights");
            }
        if (hasCubeColumns)
            try {
                await this.executeQuery(connection, `CREATE EXTENSION IF NOT EXISTS "cube"`);
            }
            catch (_) {
                logger.log("warn", "At least one of the entities has a cube column, but the 'cube' extension cannot be installed automatically. Please install it manually using superuser rights");
            }
        if (hasLtreeColumns)
            try {
                await this.executeQuery(connection, `CREATE EXTENSION IF NOT EXISTS "ltree"`);
            }
            catch (_) {
                logger.log("warn", "At least one of the entities has a cube column, but the 'ltree' extension cannot be installed automatically. Please install it manually using superuser rights");
            }
        if (hasExclusionConstraints)
            try {
                // The btree_gist extension provides operator support in PostgreSQL exclusion constraints
                await this.executeQuery(connection, `CREATE EXTENSION IF NOT EXISTS "btree_gist"`);
            }
            catch (_) {
                logger.log("warn", "At least one of the entities has an exclusion constraint, but the 'btree_gist' extension cannot be installed automatically. Please install it manually using superuser rights");
            }
    }
    async checkMetadataForExtensions() {
        const hasUuidColumns = this.connection.entityMetadatas.some(metadata => {
            return metadata.generatedColumns.filter(column => column.generationStrategy === "uuid").length > 0;
        });
        const hasCitextColumns = this.connection.entityMetadatas.some(metadata => {
            return metadata.columns.filter(column => column.type === "citext").length > 0;
        });
        const hasHstoreColumns = this.connection.entityMetadatas.some(metadata => {
            return metadata.columns.filter(column => column.type === "hstore").length > 0;
        });
        const hasCubeColumns = this.connection.entityMetadatas.some(metadata => {
            return metadata.columns.filter(column => column.type === "cube").length > 0;
        });
        const hasGeometryColumns = this.connection.entityMetadatas.some(metadata => {
            return metadata.columns.filter(column => this.spatialTypes.indexOf(column.type) >= 0).length > 0;
        });
        const hasLtreeColumns = this.connection.entityMetadatas.some(metadata => {
            return metadata.columns.filter(column => column.type === 'ltree').length > 0;
        });
        const hasExclusionConstraints = this.connection.entityMetadatas.some(metadata => {
            return metadata.exclusions.length > 0;
        });
        return {
            hasUuidColumns,
            hasCitextColumns,
            hasHstoreColumns,
            hasCubeColumns,
            hasGeometryColumns,
            hasLtreeColumns,
            hasExclusionConstraints,
            hasExtensions: hasUuidColumns || hasCitextColumns || hasHstoreColumns || hasGeometryColumns || hasCubeColumns || hasLtreeColumns || hasExclusionConstraints,
        };
    }
    /**
     * Closes connection with database.
     */
    async disconnect() {
        if (!this.master)
            return Promise.reject(new ConnectionIsNotSetError_1.ConnectionIsNotSetError("postgres"));
        await this.closePool(this.master);
        await Promise.all(this.slaves.map(slave => this.closePool(slave)));
        this.master = undefined;
        this.slaves = [];
    }
    /**
     * Creates a schema builder used to build and sync a schema.
     */
    createSchemaBuilder() {
        return new RdbmsSchemaBuilder_1.RdbmsSchemaBuilder(this.connection);
    }
    /**
     * Creates a query runner used to execute database queries.
     */
    createQueryRunner(mode) {
        return new PostgresQueryRunner_1.PostgresQueryRunner(this, mode);
    }
    /**
     * Prepares given value to a value to be persisted, based on its column type and metadata.
     */
    preparePersistentValue(value, columnMetadata) {
        if (columnMetadata.transformer)
            value = ApplyValueTransformers_1.ApplyValueTransformers.transformTo(columnMetadata.transformer, value);
        if (value === null || value === undefined)
            return value;
        if (columnMetadata.type === Boolean) {
            return value === true ? 1 : 0;
        }
        else if (columnMetadata.type === "date") {
            return DateUtils_1.DateUtils.mixedDateToDateString(value);
        }
        else if (columnMetadata.type === "time") {
            return DateUtils_1.DateUtils.mixedDateToTimeString(value);
        }
        else if (columnMetadata.type === "datetime"
            || columnMetadata.type === Date
            || columnMetadata.type === "timestamp"
            || columnMetadata.type === "timestamp with time zone"
            || columnMetadata.type === "timestamp without time zone") {
            return DateUtils_1.DateUtils.mixedDateToDate(value);
        }
        else if (["json", "jsonb", ...this.spatialTypes].indexOf(columnMetadata.type) >= 0) {
            return JSON.stringify(value);
        }
        else if (columnMetadata.type === "hstore") {
            if (typeof value === "string") {
                return value;
            }
            else {
                // https://www.postgresql.org/docs/9.0/hstore.html
                const quoteString = (value) => {
                    // If a string to be quoted is `null` or `undefined`, we return a literal unquoted NULL.
                    // This way, NULL values can be stored in the hstore object.
                    if (value === null || typeof value === "undefined") {
                        return "NULL";
                    }
                    // Convert non-null values to string since HStore only stores strings anyway.
                    // To include a double quote or a backslash in a key or value, escape it with a backslash.
                    return `"${`${value}`.replace(/(?=["\\])/g, "\\")}"`;
                };
                return Object.keys(value).map(key => quoteString(key) + "=>" + quoteString(value[key])).join(",");
            }
        }
        else if (columnMetadata.type === "simple-array") {
            return DateUtils_1.DateUtils.simpleArrayToString(value);
        }
        else if (columnMetadata.type === "simple-json") {
            return DateUtils_1.DateUtils.simpleJsonToString(value);
        }
        else if (columnMetadata.type === "cube") {
            if (columnMetadata.isArray) {
                return `{${value.map((cube) => `"(${cube.join(",")})"`).join(",")}}`;
            }
            return `(${value.join(",")})`;
        }
        else if (columnMetadata.type === "ltree") {
            return value.split(".").filter(Boolean).join('.').replace(/[\s]+/g, "_");
        }
        else if ((columnMetadata.type === "enum"
            || columnMetadata.type === "simple-enum")
            && !columnMetadata.isArray) {
            return "" + value;
        }
        return value;
    }
    /**
     * Prepares given value to a value to be persisted, based on its column type or metadata.
     */
    prepareHydratedValue(value, columnMetadata) {
        if (value === null || value === undefined)
            return columnMetadata.transformer ? ApplyValueTransformers_1.ApplyValueTransformers.transformFrom(columnMetadata.transformer, value) : value;
        if (columnMetadata.type === Boolean) {
            value = value ? true : false;
        }
        else if (columnMetadata.type === "datetime"
            || columnMetadata.type === Date
            || columnMetadata.type === "timestamp"
            || columnMetadata.type === "timestamp with time zone"
            || columnMetadata.type === "timestamp without time zone") {
            value = DateUtils_1.DateUtils.normalizeHydratedDate(value);
        }
        else if (columnMetadata.type === "date") {
            value = DateUtils_1.DateUtils.mixedDateToDateString(value);
        }
        else if (columnMetadata.type === "time") {
            value = DateUtils_1.DateUtils.mixedTimeToString(value);
        }
        else if (columnMetadata.type === "hstore") {
            if (columnMetadata.hstoreType === "object") {
                const unescapeString = (str) => str.replace(/\\./g, (m) => m[1]);
                const regexp = /"([^"\\]*(?:\\.[^"\\]*)*)"=>(?:(NULL)|"([^"\\]*(?:\\.[^"\\]*)*)")(?:,|$)/g;
                const object = {};
                `${value}`.replace(regexp, (_, key, nullValue, stringValue) => {
                    object[unescapeString(key)] = nullValue ? null : unescapeString(stringValue);
                    return "";
                });
                return object;
            }
            else {
                return value;
            }
        }
        else if (columnMetadata.type === "simple-array") {
            value = DateUtils_1.DateUtils.stringToSimpleArray(value);
        }
        else if (columnMetadata.type === "simple-json") {
            value = DateUtils_1.DateUtils.stringToSimpleJson(value);
        }
        else if (columnMetadata.type === "cube") {
            value = value.replace(/[\(\)\s]+/g, ""); // remove whitespace
            if (columnMetadata.isArray) {
                /**
                 * Strips these groups from `{"1,2,3","",NULL}`:
                 * 1. ["1,2,3", undefined]  <- cube of arity 3
                 * 2. ["", undefined]         <- cube of arity 0
                 * 3. [undefined, "NULL"]     <- NULL
                 */
                const regexp = /(?:\"((?:[\d\s\.,])*)\")|(?:(NULL))/g;
                const unparsedArrayString = value;
                value = [];
                let cube = null;
                // Iterate through all regexp matches for cubes/null in array
                while ((cube = regexp.exec(unparsedArrayString)) !== null) {
                    if (cube[1] !== undefined) {
                        value.push(cube[1].split(",").filter(Boolean).map(Number));
                    }
                    else {
                        value.push(undefined);
                    }
                }
            }
            else {
                value = value.split(",").filter(Boolean).map(Number);
            }
        }
        else if (columnMetadata.type === "enum" || columnMetadata.type === "simple-enum") {
            if (columnMetadata.isArray) {
                // manually convert enum array to array of values (pg does not support, see https://github.com/brianc/node-pg-types/issues/56)
                value = value !== "{}" ? value.substr(1, value.length - 2).split(",") : [];
                // convert to number if that exists in poosible enum options
                value = value.map((val) => {
                    return !isNaN(+val) && columnMetadata.enum.indexOf(parseInt(val)) >= 0 ? parseInt(val) : val;
                });
            }
            else {
                // convert to number if that exists in poosible enum options
                value = !isNaN(+value) && columnMetadata.enum.indexOf(parseInt(value)) >= 0 ? parseInt(value) : value;
            }
        }
        if (columnMetadata.transformer)
            value = ApplyValueTransformers_1.ApplyValueTransformers.transformFrom(columnMetadata.transformer, value);
        return value;
    }
    /**
     * Replaces parameters in the given sql with special escaping character
     * and an array of parameter names to be passed to a query.
     */
    escapeQueryWithParameters(sql, parameters, nativeParameters) {
        const builtParameters = Object.keys(nativeParameters).map(key => nativeParameters[key]);
        if (!parameters || !Object.keys(parameters).length)
            return [sql, builtParameters];
        const keys = Object.keys(parameters).map(parameter => "(:(\\.\\.\\.)?" + parameter + "\\b)").join("|");
        sql = sql.replace(new RegExp(keys, "g"), (key) => {
            let value;
            let isArray = false;
            if (key.substr(0, 4) === ":...") {
                isArray = true;
                value = parameters[key.substr(4)];
            }
            else {
                value = parameters[key.substr(1)];
            }
            if (isArray) {
                return value.map((v) => {
                    builtParameters.push(v);
                    return "$" + builtParameters.length;
                }).join(", ");
            }
            else if (value instanceof Function) {
                return value();
            }
            else {
                builtParameters.push(value);
                return "$" + builtParameters.length;
            }
        }); // todo: make replace only in value statements, otherwise problems
        return [sql, builtParameters];
    }
    /**
     * Escapes a column name.
     */
    escape(columnName) {
        return "\"" + columnName + "\"";
    }
    /**
     * Build full table name with schema name and table name.
     * E.g. "mySchema"."myTable"
     */
    buildTableName(tableName, schema) {
        return schema ? `${schema}.${tableName}` : tableName;
    }
    /**
     * Creates a database type from a given column metadata.
     */
    normalizeType(column) {
        if (column.type === Number || column.type === "int" || column.type === "int4") {
            return "integer";
        }
        else if (column.type === String || column.type === "varchar") {
            return "character varying";
        }
        else if (column.type === Date || column.type === "timestamp") {
            return "timestamp without time zone";
        }
        else if (column.type === "timestamptz") {
            return "timestamp with time zone";
        }
        else if (column.type === "time") {
            return "time without time zone";
        }
        else if (column.type === "timetz") {
            return "time with time zone";
        }
        else if (column.type === Boolean || column.type === "bool") {
            return "boolean";
        }
        else if (column.type === "simple-array") {
            return "text";
        }
        else if (column.type === "simple-json") {
            return "text";
        }
        else if (column.type === "simple-enum") {
            return "enum";
        }
        else if (column.type === "int2") {
            return "smallint";
        }
        else if (column.type === "int8") {
            return "bigint";
        }
        else if (column.type === "decimal") {
            return "numeric";
        }
        else if (column.type === "float8" || column.type === "float") {
            return "double precision";
        }
        else if (column.type === "float4") {
            return "real";
        }
        else if (column.type === "char") {
            return "character";
        }
        else if (column.type === "varbit") {
            return "bit varying";
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
        const arrayCast = columnMetadata.isArray ? `::${columnMetadata.type}[]` : "";
        if ((columnMetadata.type === "enum"
            || columnMetadata.type === "simple-enum") && defaultValue !== undefined) {
            if (columnMetadata.isArray && Array.isArray(defaultValue)) {
                return `'{${defaultValue.map((val) => `${val}`).join(",")}}'`;
            }
            return `'${defaultValue}'`;
        }
        if (typeof defaultValue === "number") {
            return "" + defaultValue;
        }
        else if (typeof defaultValue === "boolean") {
            return defaultValue === true ? "true" : "false";
        }
        else if (typeof defaultValue === "function") {
            return defaultValue();
        }
        else if (typeof defaultValue === "string") {
            return `'${defaultValue}'${arrayCast}`;
        }
        else if (defaultValue === null) {
            return `null`;
        }
        else if (typeof defaultValue === "object") {
            return `'${JSON.stringify(defaultValue)}'`;
        }
        else {
            return defaultValue;
        }
    }
    /**
     * Normalizes "isUnique" value of the column.
     */
    normalizeIsUnique(column) {
        return column.entityMetadata.uniques.some(uq => uq.columns.length === 1 && uq.columns[0] === column);
    }
    /**
     * Returns default column lengths, which is required on column creation.
     */
    getColumnLength(column) {
        return column.length ? column.length.toString() : "";
    }
    /**
     * Creates column type definition including length, precision and scale
     */
    createFullType(column) {
        let type = column.type;
        if (column.length) {
            type += "(" + column.length + ")";
        }
        else if (column.precision !== null && column.precision !== undefined && column.scale !== null && column.scale !== undefined) {
            type += "(" + column.precision + "," + column.scale + ")";
        }
        else if (column.precision !== null && column.precision !== undefined) {
            type += "(" + column.precision + ")";
        }
        if (column.type === "time without time zone") {
            type = "TIME" + (column.precision !== null && column.precision !== undefined ? "(" + column.precision + ")" : "");
        }
        else if (column.type === "time with time zone") {
            type = "TIME" + (column.precision !== null && column.precision !== undefined ? "(" + column.precision + ")" : "") + " WITH TIME ZONE";
        }
        else if (column.type === "timestamp without time zone") {
            type = "TIMESTAMP" + (column.precision !== null && column.precision !== undefined ? "(" + column.precision + ")" : "");
        }
        else if (column.type === "timestamp with time zone") {
            type = "TIMESTAMP" + (column.precision !== null && column.precision !== undefined ? "(" + column.precision + ")" : "") + " WITH TIME ZONE";
        }
        else if (this.spatialTypes.indexOf(column.type) >= 0) {
            if (column.spatialFeatureType != null && column.srid != null) {
                type = `${column.type}(${column.spatialFeatureType},${column.srid})`;
            }
            else if (column.spatialFeatureType != null) {
                type = `${column.type}(${column.spatialFeatureType})`;
            }
            else {
                type = column.type;
            }
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
            this.master.connect((err, connection, release) => {
                err ? fail(err) : ok([connection, release]);
            });
        });
    }
    /**
     * Obtains a new database connection to a slave server.
     * Used for replication.
     * If replication is not setup then returns master (default) connection's database connection.
     */
    obtainSlaveConnection() {
        if (!this.slaves.length)
            return this.obtainMasterConnection();
        return new Promise((ok, fail) => {
            const random = Math.floor(Math.random() * this.slaves.length);
            this.slaves[random].connect((err, connection, release) => {
                err ? fail(err) : ok([connection, release]);
            });
        });
    }
    /**
     * Creates generated map of values generated or returned by database after INSERT query.
     *
     * todo: slow. optimize Object.keys(), OrmUtils.mergeDeep and column.createValueMap parts
     */
    createGeneratedMap(metadata, insertResult) {
        if (!insertResult)
            return undefined;
        return Object.keys(insertResult).reduce((map, key) => {
            const column = metadata.findColumnWithDatabaseName(key);
            if (column) {
                OrmUtils_1.OrmUtils.mergeDeep(map, column.createValueMap(insertResult[key]));
                // OrmUtils.mergeDeep(map, column.createValueMap(this.prepareHydratedValue(insertResult[key], column))); // TODO: probably should be like there, but fails on enums, fix later
            }
            return map;
        }, {});
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
            return tableColumn.name !== columnMetadata.databaseName
                || tableColumn.type !== this.normalizeType(columnMetadata)
                || tableColumn.length !== columnMetadata.length
                || tableColumn.precision !== columnMetadata.precision
                || tableColumn.scale !== columnMetadata.scale
                // || tableColumn.comment !== columnMetadata.comment // todo
                || (!tableColumn.isGenerated && this.lowerDefaultValueIfNecessary(this.normalizeDefault(columnMetadata)) !== tableColumn.default) // we included check for generated here, because generated columns already can have default values
                || tableColumn.isPrimary !== columnMetadata.isPrimary
                || tableColumn.isNullable !== columnMetadata.isNullable
                || tableColumn.isUnique !== this.normalizeIsUnique(columnMetadata)
                || (tableColumn.enum && columnMetadata.enum && !OrmUtils_1.OrmUtils.isArraysEqual(tableColumn.enum, columnMetadata.enum.map(val => val + ""))) // enums in postgres are always strings
                || tableColumn.isGenerated !== columnMetadata.isGenerated
                || (tableColumn.spatialFeatureType || "").toLowerCase() !== (columnMetadata.spatialFeatureType || "").toLowerCase()
                || tableColumn.srid !== columnMetadata.srid;
        });
    }
    lowerDefaultValueIfNecessary(value) {
        // Postgres saves function calls in default value as lowercase #2733
        if (!value) {
            return value;
        }
        return value.split(`'`).map((v, i) => {
            return i % 2 === 1 ? v : v.toLowerCase();
        }).join(`'`);
    }
    /**
     * Returns true if driver supports RETURNING / OUTPUT statement.
     */
    isReturningSqlSupported() {
        return true;
    }
    /**
     * Returns true if driver supports uuid values generation on its own.
     */
    isUUIDGenerationSupported() {
        return true;
    }
    /**
     * Returns true if driver supports fulltext indices.
     */
    isFullTextColumnTypeSupported() {
        return false;
    }
    get uuidGenerator() {
        return this.options.uuidExtension === "pgcrypto" ? "gen_random_uuid()" : "uuid_generate_v4()";
    }
    /**
     * Creates an escaped parameter.
     */
    createParameter(parameterName, index) {
        return "$" + (index + 1);
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    /**
     * Loads postgres query stream package.
     */
    loadStreamDependency() {
        try {
            return PlatformTools_1.PlatformTools.load("pg-query-stream");
        }
        catch (e) { // todo: better error for browser env
            throw new Error(`To use streams you should install pg-query-stream package. Please run npm i pg-query-stream --save command.`);
        }
    }
    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------
    /**
     * If driver dependency is not given explicitly, then try to load it via "require".
     */
    loadDependencies() {
        try {
            this.postgres = PlatformTools_1.PlatformTools.load("pg");
            try {
                const pgNative = PlatformTools_1.PlatformTools.load("pg-native");
                if (pgNative && this.postgres.native)
                    this.postgres = this.postgres.native;
            }
            catch (e) { }
        }
        catch (e) { // todo: better error for browser env
            throw new DriverPackageNotInstalledError_1.DriverPackageNotInstalledError("Postgres", "pg");
        }
    }
    /**
     * Creates a new connection pool for a given database credentials.
     */
    async createPool(options, credentials) {
        credentials = Object.assign({}, credentials, DriverUtils_1.DriverUtils.buildDriverOptions(credentials)); // todo: do it better way
        // build connection options for the driver
        // See: https://github.com/brianc/node-postgres/tree/master/packages/pg-pool#create
        const connectionOptions = Object.assign({}, {
            host: credentials.host,
            user: credentials.username,
            password: credentials.password,
            database: credentials.database,
            port: credentials.port,
            ssl: credentials.ssl,
            connectionTimeoutMillis: options.connectTimeoutMS
        }, options.extra || {});
        // create a connection pool
        const pool = new this.postgres.Pool(connectionOptions);
        const { logger } = this.connection;
        const poolErrorHandler = options.poolErrorHandler || ((error) => logger.log("warn", `Postgres pool raised an error. ${error}`));
        /*
          Attaching an error handler to pool errors is essential, as, otherwise, errors raised will go unhandled and
          cause the hosting app to crash.
         */
        pool.on("error", poolErrorHandler);
        return new Promise((ok, fail) => {
            pool.connect((err, connection, release) => {
                if (err)
                    return fail(err);
                if (options.logNotifications) {
                    connection.on("notice", (msg) => {
                        msg && this.connection.logger.log("info", msg.message);
                    });
                    connection.on("notification", (msg) => {
                        msg && this.connection.logger.log("info", `Received NOTIFY on channel ${msg.channel}: ${msg.payload}.`);
                    });
                }
                release();
                ok(pool);
            });
        });
    }
    /**
     * Closes connection pool.
     */
    async closePool(pool) {
        await Promise.all(this.connectedQueryRunners.map(queryRunner => queryRunner.release()));
        return new Promise((ok, fail) => {
            pool.end((err) => err ? fail(err) : ok());
        });
    }
    /**
     * Executes given query.
     */
    executeQuery(connection, query) {
        return new Promise((ok, fail) => {
            connection.query(query, (err, result) => {
                if (err)
                    return fail(err);
                ok(result);
            });
        });
    }
}
exports.PostgresDriver = PostgresDriver;
class PostgresWrapper extends PostgresDriver {
}
class AuroraDataApiPostgresDriver extends PostgresWrapper {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(connection) {
        super();
        this.connection = connection;
        this.options = connection.options;
        this.isReplicated = false;
        // load data-api package
        this.loadDependencies();
        this.client = new this.DataApiDriver(this.options.region, this.options.secretArn, this.options.resourceArn, this.options.database, (query, parameters) => this.connection.logger.logQuery(query, parameters), this.options.serviceConfigOptions, this.options.formatOptions);
    }
    // -------------------------------------------------------------------------
    // Public Implemented Methods
    // -------------------------------------------------------------------------
    /**
     * Performs connection to the database.
     * Based on pooling options, it can either create connection immediately,
     * either create a pool and create connection when needed.
     */
    async connect() {
    }
    /**
     * Closes connection with database.
     */
    async disconnect() {
    }
    /**
     * Creates a query runner used to execute database queries.
     */
    createQueryRunner(mode) {
        return new AuroraDataApiPostgresQueryRunner_1.AuroraDataApiPostgresQueryRunner(this, mode);
    }
    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------
    /**
     * If driver dependency is not given explicitly, then try to load it via "require".
     */
    loadDependencies() {
        const { pg } = PlatformTools_1.PlatformTools.load("typeorm-aurora-data-api-driver");
        this.DataApiDriver = pg;
    }
    /**
     * Executes given query.
     */
    executeQuery(connection, query) {
        return this.client.query(query);
    }
    /**
     * Makes any action after connection (e.g. create extensions in Postgres driver).
     */
    async afterConnect() {
        const extensionsMetadata = await this.checkMetadataForExtensions();
        if (extensionsMetadata.hasExtensions) {
            await this.enableExtensions(extensionsMetadata, this.connection);
        }
        return Promise.resolve();
    }
}
exports.AuroraDataApiPostgresDriver = AuroraDataApiPostgresDriver;

//# sourceMappingURL=PostgresDriver.js.map
