import ymlParser from 'js-yaml';
import { PlatformTools } from "../../platform/PlatformTools";
/**
 * Reads connection options defined in the yml file.
 */
export class ConnectionOptionsYmlReader {
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    /**
     * Reads connection options from given yml file.
     */
    read(path) {
        const contentsBuffer = PlatformTools.readFileSync(path);
        const contents = contentsBuffer.toString();
        const config = ymlParser.safeLoad(contents);
        if (typeof config !== 'object') {
            return [];
        }
        return Object.keys(config).map(connectionName => {
            return Object.assign({ name: connectionName }, config[connectionName]);
        });
    }
}

//# sourceMappingURL=ConnectionOptionsYmlReader.js.map
