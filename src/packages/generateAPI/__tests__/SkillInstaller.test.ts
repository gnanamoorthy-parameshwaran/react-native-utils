import fs from 'fs';
import os from 'os';
import path from 'path';

import SkillInstaller from '../support/SkillInstaller.ts';

describe('SkillInstaller', () => {
    let target: string;

    beforeEach(() => {
        target = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-install-'));
    });

    afterEach(() => {
        fs.rmSync(target, {recursive: true, force: true});
    });

    it('finds the package root from inside the package', () => {
        const root = SkillInstaller.findPackageRoot(__dirname);
        expect(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')).name).toBe('@gnanamoorthy/react-native-utils');
    });

    it('copies the bundled skill, references and examples into the skills directory', () => {
        const destination = new SkillInstaller().install(path.join(target, '.claude/skills'));

        expect(destination).toBe(path.join(target, '.claude/skills/react-native-utils'));
        expect(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf-8')).toMatch(/^---\nname: react-native-utils\n/);
        expect(fs.existsSync(path.join(destination, 'references/runtime.md'))).toBe(true);
        expect(fs.existsSync(path.join(destination, 'examples/create-api-setup.ts'))).toBe(true);
    });

    it('replaces an earlier install, removing files the new version no longer has', () => {
        const skillsDir = path.join(target, '.claude/skills');
        const stale = path.join(skillsDir, 'react-native-utils/references/removed.md');
        fs.mkdirSync(path.dirname(stale), {recursive: true});
        fs.writeFileSync(stale, 'old');

        new SkillInstaller().install(skillsDir);
        expect(fs.existsSync(stale)).toBe(false);
    });

    it('fails clearly when the bundled skill is missing', () => {
        expect(() => new SkillInstaller(target).install(path.join(target, 'out'))).toThrow('The bundled skill was not found');
    });
});
