/**
 * Renders JSDoc comments for generated code from OpenAPI documentation
 * fields. Spec text is arbitrary, so every line is sanitized to keep a
 * literal comment terminator inside a description from breaking out of
 * the generated block.
 */
export default class DocUtil {
    private static sanitize(text: string): string {
        return text.replace(/\*\//g, '*\\/');
    }

    /**
     * A multiline JSDoc block. `undefined` entries are dropped, empty strings
     * act as paragraph separators, and embedded newlines are expanded --
     * callers can push separators blindly and consecutive/edge blanks collapse.
     * Returns '' when nothing renders.
     */
    public static block(lines: (string | undefined)[], indent = ''): string {
        const expanded: string[] = [];
        lines
            .filter((line): line is string => line !== undefined)
            .forEach(line => {
                DocUtil.sanitize(line)
                    .split(/\r?\n/)
                    .forEach(piece => expanded.push(piece.trimEnd()));
            });

        const body: string[] = [];
        expanded.forEach(line => {
            if (line === '' && (body.length === 0 || body[body.length - 1] === '')) return;
            body.push(line);
        });
        while (body[body.length - 1] === '') body.pop();

        if (body.length === 0) return '';

        const rendered = body.map(line => `${indent} * ${line}`.trimEnd()).join('\n');
        return `${indent}/**\n${rendered}\n${indent} */`;
    }

    /** A single-line JSDoc for inline positions (e.g. type members); collapses internal whitespace. Returns '' when the text is blank. */
    public static inline(text: string): string {
        const collapsed = DocUtil.sanitize(text).replace(/\s+/g, ' ').trim();
        return collapsed ? `/** ${collapsed} */` : '';
    }
}
