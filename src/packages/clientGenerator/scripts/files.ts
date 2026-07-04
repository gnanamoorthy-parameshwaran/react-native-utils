import fs from 'fs';
import path from 'path';

export default class FileBuilder {
  protected indent = '    ';

  constructor(protected rootDir: string) {}

  public createFile({
    name,
    content,
    directory = '',
  }: {
    name: string;
    content: string;
    directory?: string;
  }) {
    const dir = path.join(this.rootDir, directory);
    const filePath = path.join(dir, name);

    fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(filePath, content, 'utf-8');
  }

  public createBlock({
    declaration,
    statements,
    indent = this.indent,
  }: {
    declaration: string;
    statements: string[];
    indent?: string;
  }) {
    const formattedStatements = statements
      .map((statement) => `${indent}${statement}`)
      .join('\n');

    return `${declaration} {\n${formattedStatements}\n}`;
  }
}
