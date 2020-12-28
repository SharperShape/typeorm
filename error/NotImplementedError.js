"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotImplementedError = void 0;
/**
 * Thrown when the interface is not implemented for the given adapter.
 */
class NotImplementedError extends Error {
    constructor() {
        super();
        this.name = "NotImplementedError";
        Object.setPrototypeOf(this, NotImplementedError.prototype);
        this.message = "Function not implemented.";
    }
}
exports.NotImplementedError = NotImplementedError;

//# sourceMappingURL=NotImplementedError.js.map
