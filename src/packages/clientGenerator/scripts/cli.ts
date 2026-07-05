#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { loadConfig } from '../utils/config.ts';
import APIClientGenerator from './generator.ts';
import type { ClientGeneratorConfig } from '../types/Config.ts';
import type { OpenAPI } from '../types/OpenAPISpec.ts';

async function downloadSpecToTempFile(specUrl: string): Promise<string> {
  const response = await fetch(specUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenAPI spec from ${specUrl}: ${response.status} ${response.statusText}`
    );
  }

  const tempPath = path.join(
    os.tmpdir(),
    `openapi-spec-${crypto.randomUUID()}.json`
  );
  fs.writeFileSync(tempPath, await response.text(), 'utf-8');
  return tempPath;
}

async function generateClient(args: string[]) {
  const configFlagIndex = args.indexOf('--config');
  const configPath =
    configFlagIndex !== -1 ? args[configFlagIndex + 1] : undefined;

  const config = loadConfig(configPath);
  const tempSpecPath = await downloadSpecToTempFile(config.specUrl);

  try {
    const spec = JSON.parse(fs.readFileSync(tempSpecPath, 'utf-8')) as OpenAPI;
    new APIClientGenerator(spec, config).generate();
  } finally {
    fs.rmSync(tempSpecPath, { force: true });
  }

  if (config.formatCommand) formatGeneratedOutput(config);
}

function formatGeneratedOutput(config: ClientGeneratorConfig) {
  const command = `${config.formatCommand} ${config.outputDir}`;
  try {
    execSync(command, { cwd: config.rootDir, stdio: 'inherit' });
  } catch (error) {
    console.error(
      `Warning: formatCommand failed (${command}). Generated files were written unformatted.`,
      error instanceof Error ? error.message : error
    );
  }
}

function printUsage() {
  console.log('Usage: react-native-utils generate-client [--config <path>]');
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);

  if (subcommand === 'generate-client') {
    await generateClient(rest);
    console.log('Client generation complete.');
    return;
  }

  printUsage();
  if (subcommand) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
