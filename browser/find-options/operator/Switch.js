/**
 * Switch Helper Operator.
 */
export function Switch(condition, cases) {
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

//# sourceMappingURL=Switch.js.map
