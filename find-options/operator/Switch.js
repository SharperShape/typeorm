"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Switch = void 0;
/**
 * Switch Helper Operator.
 */
function Switch(condition, cases) {
    let hasMatch = false, result = undefined;
    Object.keys(cases).forEach(key => {
        if (condition === key) {
            hasMatch = true;
            result = cases[key];
        }
    });
    if (!hasMatch && cases._ !== undefined)
        result = cases._;
    return result;
}
exports.Switch = Switch;

//# sourceMappingURL=Switch.js.map
