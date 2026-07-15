/**
 * Example custom generator: emits plain framework-free API functions (one file
 * per resource, flat layout) instead of the built-in React hooks -- a
 * demonstration of `framework: "./codegen/flat-functions-generator.js"`.
 *
 * A custom generator module exports a factory `(context) => ({ generate() })`.
 *   - context.parsed  -- the framework-neutral IR: info, operations, schemas, schemaGroups.
 *   - context.config  -- the resolved client-generator config.
 *   - context.support -- reusable built-in pieces: groupOperations, reconcilePathParams,
 *                        generateTypeFiles, stringUtil, docUtil.
 *
 * `generate()` returns every file to write: `{ directory, name, content }[]`,
 * with `directory` relative to the config file's folder. This one keeps the
 * built-in type files and only replaces the client output.
 */
module.exports = ({parsed, config, support}) => ({
    generate() {
        const clientFiles = support.groupOperations(parsed.operations).map(group => {
            const operations = support.reconcilePathParams(group);
            const first = operations[0];

            const functions = operations.map(operation => {
                const params = [...operation.hookParams, ...operation.methodParams];
                const args = params.map(param => `${param.name}: ${param.type}`).join(', ');
                const endpoint = operation.pathTemplate.replace(/\{([^}]+)\}/g, (_match, name) => '${' + name + '}');

                const doc = support.docUtil.block([operation.docs.summary ?? `Calls \`${operation.httpMethod} ${operation.pathTemplate}\`.`]);
                return `${doc}\nexport function ${operation.methodName}(${args}) {\n    return fetch(\`${endpoint}\`, { method: '${operation.httpMethod}' });\n}`;
            });

            // A nested resource (folder !== resource, e.g. BusinessUnit/Employee) keeps
            // the folder in its file name so it can't overwrite the top-level one.
            const base = first.folder === first.resource ? first.resource : `${first.folder}${first.resource}`;

            return {
                directory: `${config.clientOutputDir}/${first.version}`,
                name: `${base.charAt(0).toLowerCase()}${base.slice(1)}Api.ts`,
                content: `${functions.join('\n\n')}\n`,
            };
        });

        return [...support.generateTypeFiles(), ...clientFiles];
    },
});
