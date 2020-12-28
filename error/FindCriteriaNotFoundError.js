"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindCriteriaNotFoundError = void 0;
const EntityColumnNotFound_1 = require("./EntityColumnNotFound");
/**
 * Thrown when specified entity property in the find options were not found.
 */
class FindCriteriaNotFoundError extends EntityColumnNotFound_1.EntityColumnNotFound {
    constructor(propertyPath, metadata) {
        super(propertyPath);
        Object.setPrototypeOf(this, FindCriteriaNotFoundError.prototype);
        this.message = `Property "${propertyPath}" was not found in ${metadata.targetName}. Make sure your query is correct.`;
    }
}
exports.FindCriteriaNotFoundError = FindCriteriaNotFoundError;

//# sourceMappingURL=FindCriteriaNotFoundError.js.map
