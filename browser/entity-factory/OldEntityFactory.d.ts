import { EntityFactoryInterface } from "./EntityFactoryInterface";
export declare class OldEntityFactory implements EntityFactoryInterface {
    /**
     * Returns an entity object
     */
    createEntity(target: Function): Object;
}
