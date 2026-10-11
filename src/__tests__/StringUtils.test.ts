import StringUtils from '../utils/StringUtils';

describe('StringUtils (Laravel Str port)', () => {
    it('slices around a search string', () => {
        expect(StringUtils.after({subject: 'This is my name', search: 'This is'})).toBe(' my name');
        expect(StringUtils.afterLast({subject: 'App\\Http\\Controllers\\Controller', search: '\\'})).toBe('Controller');
        expect(StringUtils.before({subject: 'This is my name', search: 'my name'})).toBe('This is ');
        expect(StringUtils.beforeLast({subject: 'This is my name', search: 'is'})).toBe('This ');
        expect(StringUtils.between({subject: 'This is my name', from: 'This', to: 'name'})).toBe(' is my ');
        expect(StringUtils.betweenFirst({subject: '[a] bc [d]', from: '[', to: ']'})).toBe('a');
    });

    it('converts case styles', () => {
        expect(StringUtils.camel('foo_bar')).toBe('fooBar');
        expect(StringUtils.studly('foo_bar baz')).toBe('FooBarBaz');
        expect(StringUtils.snake({value: 'fooBar'})).toBe('foo_bar');
        expect(StringUtils.snake({value: 'Foo Bar', delimiter: '-'})).toBe('foo-bar');
        expect(StringUtils.kebab('fooBar')).toBe('foo-bar');
        expect(StringUtils.headline('steve_jobs')).toBe('Steve Jobs');
        expect(StringUtils.headline('EmailNotificationSent')).toBe('Email Notification Sent');
        expect(StringUtils.title('a nice title uses the correct case')).toBe('A Nice Title Uses The Correct Case');
        expect(StringUtils.apa('a nice title uses the correct case')).toBe('A Nice Title Uses the Correct Case');
        expect(StringUtils.ucsplit('FooBar')).toEqual(['Foo', 'Bar']);
        expect(StringUtils.ucwords({value: 'hello world-foo', delimiters: ' -'})).toBe('Hello World-Foo');
    });

    it('checks substrings', () => {
        expect(StringUtils.contains({haystack: 'This is my name', needles: ['MY', 'foo'], ignoreCase: true})).toBe(true);
        expect(StringUtils.containsAll({haystack: 'This is my name', needles: ['my', 'name']})).toBe(true);
        expect(StringUtils.startsWith({haystack: 'Laravel', needles: ['Lar', 'x']})).toBe(true);
        expect(StringUtils.doesntEndWith({haystack: 'Laravel', needles: 'el'})).toBe(false);
        expect(StringUtils.is({pattern: 'foo*', value: 'foobar'})).toBe(true);
        expect(StringUtils.is({pattern: 'FOO*', value: 'foobar', ignoreCase: true})).toBe(true);
        expect(StringUtils.chopStart({subject: 'https://x.com', needle: 'https://'})).toBe('x.com');
        expect(StringUtils.chopEnd({subject: 'app.php', needle: '.php'})).toBe('app');
    });

    it('edits strings', () => {
        expect(StringUtils.deduplicate({string: 'The   Laravel   Framework'})).toBe('The Laravel Framework');
        expect(StringUtils.finish({value: 'this/string//', cap: '/'})).toBe('this/string/');
        expect(StringUtils.start({value: '//this/string', prefix: '/'})).toBe('/this/string');
        expect(StringUtils.wrap({value: 'Laravel', before: '"'})).toBe('"Laravel"');
        expect(StringUtils.unwrap({value: '"Laravel"', before: '"'})).toBe('Laravel');
        expect(StringUtils.limit({value: 'The quick brown fox', limit: 10})).toBe('The quick...');
        expect(StringUtils.limit({value: 'The quick brown fox', limit: 10, preserveWords: true})).toBe('The quick...');
        expect(StringUtils.limit({value: 'The quick brown fox', limit: 12, preserveWords: true})).toBe('The quick...');
        expect(StringUtils.words({value: 'Perfectly balanced, as all things should be.', words: 3})).toBe('Perfectly balanced, as...');
        expect(StringUtils.mask({string: 'taylor@example.com', character: '*', index: 3})).toBe('tay***************');
        expect(StringUtils.mask({string: 'taylor@example.com', character: '*', index: -15, length: 3})).toBe('tay***@example.com');
        expect(StringUtils.padBoth({value: 'James', length: 10, pad: '_'})).toBe('__James___');
        expect(StringUtils.squish('  laravel   framework  ')).toBe('laravel framework');
        expect(StringUtils.trim({value: '--abc--', chars: '-'})).toBe('abc');
        expect(StringUtils.swap({map: {Tacos: 'Burritos', great: 'fantastic'}, subject: 'Tacos are great!'})).toBe('Burritos are fantastic!');
        expect(StringUtils.take({string: 'Build something amazing!', limit: -7})).toBe('mazing!');
        expect(StringUtils.substrCount({haystack: 'If you like ice cream, you will like snow cones.', needle: 'like'})).toBe(2);
        expect(StringUtils.substrReplace({string: 'Hello', replace: 'X', offset: 1, length: 0})).toBe('HXello');
        expect(StringUtils.excerpt({text: 'This is my name', phrase: 'my', radius: 3})).toBe('...is my na...');
        expect(StringUtils.wordWrap({string: 'The quick brown fox sat over the lazy dog', characters: 20, breakStr: '\n'})).toBe(
            'The quick brown fox\nsat over the lazy\ndog',
        );
    });

    it('replaces', () => {
        expect(StringUtils.replace({search: '9.x', replace: '10.x', subject: 'Laravel 9.x'})).toBe('Laravel 10.x');
        expect(StringUtils.replaceArray({search: '?', replace: ['8:30', '9:00'], subject: 'between ? and ?'})).toBe('between 8:30 and 9:00');
        expect(StringUtils.replaceFirst({search: 'the', replace: 'a', subject: 'the quick the'})).toBe('a quick the');
        expect(StringUtils.replaceLast({search: 'the', replace: 'a', subject: 'the quick the'})).toBe('the quick a');
        expect(StringUtils.replaceStart({search: 'Hello', replace: 'Laravel', subject: 'Hello World'})).toBe('Laravel World');
        expect(StringUtils.replaceEnd({search: 'World', replace: 'Laravel', subject: 'Hello World'})).toBe('Hello Laravel');
        expect(StringUtils.replaceMatches({pattern: /[^A-Za-z0-9]+/, replace: '', subject: '(+1) 501-555-1000'})).toBe('15015551000');
        expect(StringUtils.replaceMatches({pattern: /a/, replace: 'b', subject: 'aaa', limit: 2})).toBe('bba');
        expect(StringUtils.remove({search: 'e', subject: 'Peter Piper'})).toBe('Ptr Pipr');
        expect(StringUtils.match({pattern: /bar/, subject: 'foo bar'})).toBe('bar');
        expect(StringUtils.match({pattern: /foo (.*)/, subject: 'foo bar'})).toBe('bar');
        expect(StringUtils.matchAll({pattern: /bar/, subject: 'bar foo bar'})).toEqual(['bar', 'bar']);
    });

    it('validates', () => {
        expect(StringUtils.isAscii('Taylor')).toBe(true);
        expect(StringUtils.isAscii('ü')).toBe(false);
        expect(StringUtils.isJson('{"a":1}')).toBe(true);
        expect(StringUtils.isJson('{a:1}')).toBe(false);
        expect(StringUtils.isUrl({value: 'https://laravel.com'})).toBe(true);
        expect(StringUtils.isUrl({value: 'laravel'})).toBe(false);
        expect(StringUtils.isUrl({value: 'ftp://laravel.com', protocols: ['http', 'https']})).toBe(false);
        expect(StringUtils.isUuid({value: 'a0a2a2d2-0b87-4a18-83f2-2529882be2de'})).toBe(true);
        expect(StringUtils.isUuid({value: 'a0a2a2d2-0b87-4a18-83f2-2529882be2de', version: 1})).toBe(false);
        expect(StringUtils.isUlid('01gd6r360bp37zj17nxb55yhzt')).toBe(true);
    });

    it('transliterates and slugs', () => {
        expect(StringUtils.ascii('û')).toBe('u');
        expect(StringUtils.transliterate({value: 'ⓐ', unknown: '?'})).toBe('?');
        expect(StringUtils.slug({title: 'Laravel 5 Framework'})).toBe('laravel-5-framework');
        expect(StringUtils.slug({title: 'Café au lait @ Zürich', separator: '_'})).toBe('cafe_au_lait_at_zurich');
    });

    it('inflects', () => {
        expect(StringUtils.plural({value: 'car'})).toBe('cars');
        expect(StringUtils.plural({value: 'child'})).toBe('children');
        expect(StringUtils.plural({value: 'Category'})).toBe('Categories');
        expect(StringUtils.plural({value: 'box'})).toBe('boxes');
        expect(StringUtils.plural({value: 'sheep'})).toBe('sheep');
        expect(StringUtils.plural({value: 'person', count: 1})).toBe('person');
        expect(StringUtils.pluralStudly({value: 'VerifiedHuman'})).toBe('VerifiedHumans');
        expect(StringUtils.singular('cars')).toBe('car');
        expect(StringUtils.singular('children')).toBe('child');
        expect(StringUtils.singular('categories')).toBe('category');
        expect(StringUtils.singular('boxes')).toBe('box');
        expect(StringUtils.singular('campus')).toBe('campus');
    });

    it('measures and cuts', () => {
        expect(StringUtils.lengthOf('a😀b')).toBe(3);
        expect(StringUtils.charAt({subject: 'This is my name.', index: -1})).toBe('.');
        expect(StringUtils.initials('Taylor Otwell')).toBe('TO');
        expect(StringUtils.wordCount('Hello, world!')).toBe(2);
        expect(StringUtils.substr({string: 'Laravel Framework', start: 8})).toBe('Framework');
        expect(StringUtils.substr({string: 'Laravel Framework', start: 8, length: -4})).toBe('Frame');
        expect(StringUtils.position({haystack: 'Hello, World!', needle: 'Hello'})).toBe(0);
        expect(StringUtils.position({haystack: 'Hello', needle: 'x'})).toBeNull();
        expect(StringUtils.e('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;');
    });

    it('base64 round trips UTF-8', () => {
        expect(StringUtils.toBase64('Laravel')).toBe('TGFyYXZlbA==');
        expect(StringUtils.fromBase64('TGFyYXZlbA==')).toBe('Laravel');
        expect(StringUtils.fromBase64(StringUtils.toBase64('héllo 😀'))).toBe('héllo 😀');
        expect(StringUtils.fromBase64('***')).toBeNull();
    });

    it('generates identifiers', () => {
        expect(StringUtils.random(40)).toMatch(/^[A-Za-z0-9]{40}$/);
        expect(StringUtils.password({length: 20})).toHaveLength(20);
        expect(StringUtils.password({length: 12, symbols: false, numbers: false})).toMatch(/^[A-Za-z]{12}$/);
        expect(StringUtils.isUuid({value: StringUtils.uuid(), version: 4})).toBe(true);
        expect(StringUtils.isUuid({value: StringUtils.uuid7(), version: 7})).toBe(true);
        expect(StringUtils.isUlid(StringUtils.ulid())).toBe(true);
    });
});
