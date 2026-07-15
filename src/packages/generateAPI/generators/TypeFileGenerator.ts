import TypeResolver from '../resolvers/TypeResolver.ts';
import DocUtil from '../support/DocUtil.ts';
import StringUtil from '../support/StringUtil.ts';
import type {GeneratedFile} from '../contracts/FrameworkGenerator.ts';
import type {ClientGeneratorConfig} from '../types/Config.ts';
import type {ParsedAPI} from '../types/ResolvedOperation.ts';

type SynthesizedType = {name: string; text: string; refs: Set<string>};
type SchemaGroup = {schemaKeys: string[]; synthesized: SynthesizedType[]};

/**
 * Emits the TS type files: the shared index.ts plus one file per schema group
 * (Contact.ts holds BaseContactResource, UpdateContactRequest, synthesized
 * response/body types, ...). Types are framework-neutral, so every framework
 * driver shares this output.
 */
export default class TypeFileGenerator {
    protected typeResolver = new TypeResolver();

    constructor(
        protected parsed: ParsedAPI,
        protected config: ClientGeneratorConfig,
    ) {}

    public generate(): GeneratedFile[] {
        return [this.sharedTypesFile(), ...this.typeFiles()];
    }

    private sharedTypesFile(): GeneratedFile {
        return {
            name: 'index.ts',
            content: `/** Success envelope: the API wraps every payload in \`{ data: T }\`. */\nexport type ResponseSuccessType<T> = { data: T };\n`,
            directory: this.config.typeOutputDir,
        };
    }

    private typeFiles(): GeneratedFile[] {
        const groups = new Map<string, SchemaGroup>();
        const getGroup = (name: string): SchemaGroup => {
            let group = groups.get(name);
            if (!group) {
                group = {schemaKeys: [], synthesized: []};
                groups.set(name, group);
            }
            return group;
        };

        this.parsed.schemaGroups.forEach((groupName, schemaKey) => {
            getGroup(groupName).schemaKeys.push(schemaKey);
        });

        this.parsed.operations.forEach(operation => {
            const group = getGroup(operation.resource);
            const responseName = `${StringUtil.pascalCase(operation.methodName)}Response`;
            this.addSynthesized(group, {
                name: responseName,
                text: `ResponseSuccessType<${operation.responseInner.text}>`,
                refs: operation.responseInner.refs,
            });

            if (operation.requestBody?.inlineType) {
                this.addSynthesized(group, {
                    name: operation.requestBody.inlineType.name,
                    text: operation.requestBody.inlineType.text,
                    refs: operation.requestBody.refs,
                });
            }
        });

        return [...groups.entries()].map(([groupName, group]) => this.typeFile(groupName, group));
    }

    /** Two operations (e.g. a top-level and a nested route) can synthesize the same name for the same resource -- dedupe identical ones, otherwise disambiguate so neither declaration is lost. */
    private addSynthesized(group: SchemaGroup, entry: SynthesizedType) {
        const existing = group.synthesized.find(item => item.name === entry.name);
        if (!existing) {
            group.synthesized.push(entry);
            return;
        }
        if (existing.text === entry.text) return;

        let suffix = 2;
        while (group.synthesized.some(item => item.name === `${entry.name}${suffix}`)) {
            suffix += 1;
        }
        group.synthesized.push({...entry, name: `${entry.name}${suffix}`});
    }

    private typeFile(groupName: string, group: SchemaGroup): GeneratedFile {
        const ownKeys = new Set(group.schemaKeys);
        const refs = new Set<string>();
        const bodyParts: string[] = [];
        let usesResponseWrapper = false;

        group.schemaKeys.forEach(key => {
            const schema = this.parsed.schemas[key];
            if (!schema) return;

            const {statements, refs: memberRefs} = this.typeResolver.resolveMembers(schema);
            memberRefs.forEach(ref => refs.add(ref));
            const body = statements.length ? `{ ${statements.join(' ')} }` : 'Record<string, unknown>';
            const doc = DocUtil.block([schema.description ?? schema.title, schema.deprecated ? '@deprecated' : undefined]);
            bodyParts.push(`${doc ? `${doc}\n` : ''}export type ${key} = ${body};`);
        });

        group.synthesized.forEach(entry => {
            entry.refs.forEach(ref => refs.add(ref));
            if (entry.text.startsWith('ResponseSuccessType<')) usesResponseWrapper = true;
            bodyParts.push(`export type ${entry.name} = ${entry.text};`);
        });

        const importsByGroup = new Map<string, Set<string>>();
        refs.forEach(ref => {
            if (ownKeys.has(ref)) return;
            const targetGroup = this.parsed.schemaGroups.get(ref);
            if (!targetGroup || targetGroup === groupName) return;
            const names = importsByGroup.get(targetGroup) ?? new Set<string>();
            names.add(ref);
            importsByGroup.set(targetGroup, names);
        });

        const importLines: string[] = [];
        if (usesResponseWrapper) {
            importLines.push(`import type { ResponseSuccessType } from './index';`);
        }
        importsByGroup.forEach((names, targetGroup) => {
            importLines.push(`import type { ${[...names].join(', ')} } from './${targetGroup}';`);
        });

        const content = `${importLines.length ? `${importLines.join('\n')}\n\n` : ''}${bodyParts.join('\n\n')}\n`;

        return {
            name: `${groupName}.ts`,
            content,
            directory: this.config.typeOutputDir,
        };
    }
}
