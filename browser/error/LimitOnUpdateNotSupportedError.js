/**
 * Thrown when user tries to build an UPDATE query with LIMIT but the database does not support it.
*/
export class LimitOnUpdateNotSupportedError extends Error {
    constructor() {
        super();
        this.name = "LimitOnUpdateNotSupportedError";
        Object.setPrototypeOf(this, LimitOnUpdateNotSupportedError.prototype);
        this.message = `Your database does not support LIMIT on UPDATE statements.`;
    }
}

//# sourceMappingURL=LimitOnUpdateNotSupportedError.js.map
