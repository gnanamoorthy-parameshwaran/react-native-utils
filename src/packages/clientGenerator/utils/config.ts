import fs from 'fs';
import path from 'path';
import type {ClientGeneratorConfig, RawClientGeneratorConfig} from '../types/Config.ts';

const DEFAULT_CONFIG_FILE = 'client-generator.config.json';
const REQUIRED_KEYS: Array<keyof RawClientGeneratorConfig> = ['specUrl', 'useAPIImportPath', 'clientOutputDir', 'typeOutputDir'];

export function loadConfig(configPathArg?: string): ClientGeneratorConfig {
    const resolvedPath = path.resolve(process.cwd(), configPathArg ?? DEFAULT_CONFIG_FILE);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Client generator config not found at ${resolvedPath}. Pass --config <path> or create a ${DEFAULT_CONFIG_FILE} file.`);
    }

    const raw = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8')) as Partial<RawClientGeneratorConfig>;

    const missingKeys = REQUIRED_KEYS.filter(key => !raw[key]);
    if (missingKeys.length > 0) {
        throw new Error(`Client generator config at ${resolvedPath} is missing required field(s): ${missingKeys.join(', ')}`);
    }

    return {
        specUrl: raw.specUrl!,
        useAPIImportPath: raw.useAPIImportPath!,
        clientOutputDir: raw.clientOutputDir!,
        typeOutputDir: raw.typeOutputDir!,
        formatCommand: raw.formatCommand,
        rootDir: path.dirname(resolvedPath),
    };
}
