/**
 * Thrown when the interface is not implemented for the given adapter.
 */
export class NotImplementedError extends Error {
    constructor() {
        super();
        this.name = "NotImplementedError";
        Object.setPrototypeOf(this, NotImplementedError.prototype);
        this.message = "Function not implemented.";
    }
}

//# sourceMappingURL=NotImplementedError.js.map
