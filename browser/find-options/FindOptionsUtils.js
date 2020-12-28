import { Any, Between, Equal, ILike, In, LessThan, Like, MoreThan, Not, Raw } from "..";
import { FindOperator } from "./FindOperator";
/**
 * Utilities to work with FindOptions.
 */
export class FindOptionsUtils {
    /**
     * Checks if given object is really instance of FindOneOptions interface.
     */
    static isFindOptions(obj) {
        const possibleOptions = obj;
        return possibleOptions && (possibleOptions.select instanceof Object ||
            possibleOptions.where instanceof Object ||
            possibleOptions.relations instanceof Object ||
            possibleOptions.order instanceof Object ||
            possibleOptions.options instanceof Object ||
            possibleOptions.cache instanceof Object ||
            possibleOptions.lock instanceof Object ||
            typeof possibleOptions.cache === "boolean" ||
            typeof possibleOptions.cache === "number" ||
            typeof possibleOptions.skip === "number" ||
            typeof possibleOptions.take === "number" ||
            typeof possibleOptions.skip === "string" ||
            typeof possibleOptions.take === "string");
    }
}
/**
 * Normalizes find options.
 */
export function normalizeFindOptions(options) {
    const where = options.where;
    if (!where)
        return Object.assign({}, options);
    if (!(where instanceof Object))
        return Object.assign({}, options);
    if (where instanceof FindOperator)
        return Object.assign({}, options);
    const recursively$FindOption = (obj) => {
        const valueKeys = Object.keys(obj);
        if (valueKeys.length === 1) {
            let value = obj[valueKeys[0]];
            if (value instanceof Object && !(value instanceof Array) && !(value instanceof Function))
                value = recursively$FindOption(value);
            if (valueKeys[0] === "$any") {
                return Any(value);
            }
            else if (valueKeys[0] === "$between") {
                return Between(value[0], value[1]);
            }
            else if (valueKeys[0] === "$equal") {
                return Equal(value);
            }
            else if (valueKeys[0] === "$iLike") {
                return ILike(value);
            }
            else if (valueKeys[0] === "$in") {
                return In(value);
            }
            else if (valueKeys[0] === "$lessThan") {
                return LessThan(value);
            }
            else if (valueKeys[0] === "$like") {
                return Like(value);
            }
            else if (valueKeys[0] === "$moreThan") {
                return MoreThan(value);
            }
            else if (valueKeys[0] === "$not") {
                return Not(value);
            }
            else if (valueKeys[0] === "$raw") {
                return Raw(value);
            }
        }
        return false;
    };
    const recursivelyWhere = (where) => {
        if (Array.isArray(where)) {
            return where.map((where) => recursivelyWhere(where));
        }
        return Object.keys(where).reduce((newWhere, key) => {
            const value = where[key];
            if (value instanceof Object && !(value instanceof FindOperator)) {
                newWhere[key] = recursively$FindOption(value);
                // in the case if $find operator was not found we'll have a false as a value
                // we need to recursive where because it can be another where options
                if (newWhere[key] === false)
                    newWhere[key] = recursivelyWhere(value);
            }
            else {
                newWhere[key] = value;
            }
            return newWhere;
        }, {});
    };
    // todo: broken after merge
    // if (options.lock) {
    //     if (options.lock.mode === "optimistic") {
    //         qb.setLock(options.lock.mode, options.lock.version as any);
    //     } else if (options.lock.mode === "pessimistic_read" || options.lock.mode === "pessimistic_write" || options.lock.mode === "dirty_read" || options.lock.mode === "pessimistic_partial_write" || options.lock.mode === "pessimistic_write_or_fail") {
    //         qb.setLock(options.lock.mode);
    //     }
    // }
    return Object.assign(Object.assign({}, options), { where: recursivelyWhere(options.where) });
}

//# sourceMappingURL=FindOptionsUtils.js.map
