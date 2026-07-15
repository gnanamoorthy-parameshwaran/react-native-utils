import fs from 'fs';
import path from 'path';

export default class FileBuilder {
    constructor(protected rootDir: string) {}

    public createFile({name, content, directory = ''}: {name: string; content: string; directory?: string}) {
        const dir = path.join(this.rootDir, directory);
        const filePath = path.join(dir, name);

        fs.mkdirSync(dir, {recursive: true});

        fs.writeFileSync(filePath, content, 'utf-8');
    }
}
