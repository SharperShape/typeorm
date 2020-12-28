"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDateColumn = void 0;
const __1 = require("../../");
/**
 * This column will store an update date of the updated object.
 * This date is being updated each time you persist the object.
 */
function UpdateDateColumn(options) {
    return function (object, propertyName) {
        __1.getMetadataArgsStorage().columns.push({
            target: object.constructor,
            propertyName: propertyName,
            mode: "updateDate",
            options: options ? options : {}
        });
    };
}
exports.UpdateDateColumn = UpdateDateColumn;

//# sourceMappingURL=UpdateDateColumn.js.map
