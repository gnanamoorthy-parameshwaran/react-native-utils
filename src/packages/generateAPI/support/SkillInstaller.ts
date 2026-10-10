import fs from 'fs';
import path from 'path';

const PACKAGE_NAME = '@gnanamoorthy/react-native-utils';

/**
 * Copies the package's bundled AI agent skill (`skills/react-native-utils`) into
 * a project, so the project's AI tools know how to use the package. The copy is
 * replaced wholesale on every install, which keeps it in step with the
 * installed package version.
 */
export default class SkillInstaller {
    static readonly SKILL_NAME = 'react-native-utils';

    constructor(private readonly packageRoot: string = SkillInstaller.findPackageRoot(__dirname)) {}

    /** Installs into `<skillsDir>/react-native-utils` and returns that path. */
    install(skillsDir: string): string {
        const source = path.join(this.packageRoot, 'skills', SkillInstaller.SKILL_NAME);
        if (!fs.existsSync(path.join(source, 'SKILL.md'))) {
            throw new Error(`The bundled skill was not found at ${source}.`);
        }

        const destination = path.resolve(skillsDir, SkillInstaller.SKILL_NAME);
        fs.rmSync(destination, {recursive: true, force: true});
        fs.mkdirSync(path.dirname(destination), {recursive: true});
        fs.cpSync(source, destination, {recursive: true});

        return destination;
    }

    /**
     * Walks up from `start` to this package's own `package.json`, so the skill is
     * found both from the compiled CLI (`lib/cli/...`) and from the TS source.
     */
    static findPackageRoot(start: string): string {
        let directory = start;

        while (true) {
            const manifest = path.join(directory, 'package.json');
            if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf-8')).name === PACKAGE_NAME) return directory;

            const parent = path.dirname(directory);
            if (parent === directory) throw new Error(`Could not locate the ${PACKAGE_NAME} package root from ${start}.`);
            directory = parent;
        }
    }
}
