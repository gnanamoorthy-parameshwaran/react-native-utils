import type {OpenAPI} from '../types/OpenAPISpec.ts';

class OpenAPIParser {
    protected spec: OpenAPI;

    constructor(spec: OpenAPI) {
        this.spec = spec;
    }

    public getVersion() {
        return this.spec.openapi;
    }

    public getInfo() {
        return this.spec.info;
    }

    public getServers() {
        return this.spec.servers;
    }

    public getPaths() {
        return this.spec.paths;
    }

    public getComponents() {
        return this.spec.components;
    }
}

export default OpenAPIParser;
