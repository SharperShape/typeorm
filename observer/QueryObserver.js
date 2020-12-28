"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryObserver = void 0;
const zen_observable_ts_1 = require("zen-observable-ts");
// todo: we probably need operation-level subscribers
// todo: right now if we save 1000 entities within a single save call its going to call this code 1000 times
// todo: which is not efficient
/**
 * Entity manager supposed to work with any entity, automatically find its repository and call its methods,
 * whatever entity type are you passing.
 */
class QueryObserver {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(connection, type, metadata, options) {
        this.connection = connection;
        this.type = type;
        this.metadata = metadata;
        this.options = options;
        // -------------------------------------------------------------------------
        // Public Properties
        // -------------------------------------------------------------------------
        this.insertEvents = [];
        this.updateEvents = [];
        this.removeEvents = [];
        // -------------------------------------------------------------------------
        // Private Properties
        // -------------------------------------------------------------------------
        this.isSubscriberActive = false;
        this.lastEmitEntities = [];
        // -------------------------------------------------------------------------
        // Private Properties
        // -------------------------------------------------------------------------
        this.subscriber = {
            listenTo: () => {
                return this.metadata.target;
            },
            afterInsert: (event) => {
                if (!this.subscriptionObserver || !this.isSubscriberActive)
                    return;
                this.insertEvents.push(event);
            },
            afterUpdate: event => {
                if (!this.subscriptionObserver || !this.isSubscriberActive)
                    return;
                this.updateEvents.push(event);
            },
            afterRemove: event => {
                if (!this.subscriptionObserver || !this.isSubscriberActive)
                    return;
                this.removeEvents.push(event);
            }
        };
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    /**
     * Finds entities that match given options and returns observable.
     * Whenever new data appears that matches given query observable emits new value.
     */
    observe() {
        this.connection.observers.push(this);
        return new zen_observable_ts_1.Observable(subscriptionObserver => {
            this.subscriptionObserver = subscriptionObserver;
            this.isSubscriberActive = true;
            // we find entities matching our query
            switch (this.type) {
                case "find":
                    this.connection.manager.find(this.metadata.target, this.options).then(entities => {
                        subscriptionObserver.next(entities);
                        this.lastEmitEntities = entities;
                        this.connection.subscribers.push(this.subscriber);
                    });
                    break;
                case "findOne":
                    this.connection.manager.findOne(this.metadata.target, this.options).then(entity => {
                        subscriptionObserver.next(entity);
                        this.lastEmitEntity = entity;
                        this.connection.subscribers.push(this.subscriber);
                    });
                    break;
                case "findAndCount":
                    this.connection.manager.findAndCount(this.metadata.target, this.options).then(([entities, count]) => {
                        subscriptionObserver.next([entities, count]);
                        this.lastEmitCount = count;
                        this.lastEmitEntities = entities;
                        this.connection.subscribers.push(this.subscriber);
                    });
                    break;
                case "count":
                    this.connection.manager.count(this.metadata.target, this.options, { observers: false }).then(count => {
                        subscriptionObserver.next(count);
                        this.lastEmitCount = count;
                        this.connection.subscribers.push(this.subscriber);
                    });
                    break;
            }
            // remove subscription on cancellation
            return () => {
                // remove registered subscriber
                if (this.subscriber) {
                    const index = this.connection.subscribers.indexOf(this.subscriber);
                    if (index !== -1)
                        this.connection.subscribers.splice(index, 1);
                }
                // remove registered observer
                const index = this.connection.observers.indexOf(this);
                if (index !== -1)
                    this.connection.observers.splice(index, 1);
            };
        });
    }
}
exports.QueryObserver = QueryObserver;

//# sourceMappingURL=QueryObserver.js.map
