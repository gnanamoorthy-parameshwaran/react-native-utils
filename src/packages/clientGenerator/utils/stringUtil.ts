export default class StringUtil {
    public static camelCase(str: string) {
        return str
            .split(/[-_ ]+/) // Splits on spaces, hyphens, or underscores
            .map((word, index) => {
                // If it's the first word, keep it lowercase
                if (index === 0) {
                    return word.toLowerCase();
                }
                // For other words, capitalize the first letter
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join('');
    }

    public static pascalCase(str: string) {
        return (str.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|[0-9]+/g) || [])
            .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
            .join('');
    }
}
