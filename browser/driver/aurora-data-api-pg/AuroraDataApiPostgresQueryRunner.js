import { QueryRunnerAlreadyReleasedError } from "../../error/QueryRunnerAlreadyReleasedError";
import { TransactionAlreadyStartedError } from "../../error/TransactionAlreadyStartedError";
import { TransactionNotStartedError } from "../../error/TransactionNotStartedError";
import { PostgresQueryRunner } from "../postgres/PostgresQueryRunner";
class PostgresQueryRunnerWrapper extends PostgresQueryRunner {
    constructor(driver, mode) {
        super(driver, mode);
    }
}
/**
 * Runs queries on a single postgres database connection.
 */
export class AuroraDataApiPostgresQueryRunner extends PostgresQueryRunnerWrapper {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(driver, mode) {
        super(driver, mode);
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    /**
     * Creates/uses database connection from the connection pool to perform further operations.
     * Returns obtained database connection.
     */
    connect() {
        if (this.databaseConnection)
            return Promise.resolve(this.databaseConnection);
        if (this.databaseConnectionPromise)
            return this.databaseConnectionPromise;
        if (this.mode === "slave" && this.driver.isReplicated) {
            this.databaseConnectionPromise = this.driver.obtainSlaveConnection().then(([connection, release]) => {
                this.driver.connectedQueryRunners.push(this);
                this.databaseConnection = connection;
                this.releaseCallback = release;
                return this.databaseConnection;
            });
        }
        else { // master
            this.databaseConnectionPromise = this.driver.obtainMasterConnection().then(([connection, release]) => {
                this.driver.connectedQueryRunners.push(this);
                this.databaseConnection = connection;
                this.releaseCallback = release;
                return this.databaseConnection;
            });
        }
        return this.databaseConnectionPromise;
    }
    /**
     * Starts transaction on the current connection.
     */
    async startTransaction(isolationLevel) {
        if (this.isTransactionActive)
            throw new TransactionAlreadyStartedError();
        this.isTransactionActive = true;
        await this.driver.client.startTransaction();
    }
    /**
     * Commits transaction.
     * Error will be thrown if transaction was not started.
     */
    async commitTransaction() {
        if (!this.isTransactionActive)
            throw new TransactionNotStartedError();
        await this.driver.client.commitTransaction();
        this.isTransactionActive = false;
    }
    /**
     * Rollbacks transaction.
     * Error will be thrown if transaction was not started.
     */
    async rollbackTransaction() {
        if (!this.isTransactionActive)
            throw new TransactionNotStartedError();
        await this.driver.client.rollbackTransaction();
        this.isTransactionActive = false;
    }
    /**
     * Executes a given SQL query.
     */
    async query(query, parameters) {
        if (this.isReleased)
            throw new QueryRunnerAlreadyReleasedError();
        const result = await this.driver.client.query(query, parameters);
        if (result.records) {
            return result.records;
        }
        return result;
    }
}

//# sourceMappingURL=AuroraDataApiPostgresQueryRunner.js.map
