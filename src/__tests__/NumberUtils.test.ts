import NumberUtils from '../utils/NumberUtils';

describe('NumberUtils (Laravel Number port)', () => {
    afterEach(() => {
        NumberUtils.useLocale('en');
        NumberUtils.useCurrency('USD');
    });

    it('format and percentage', () => {
        expect(NumberUtils.format({number: 100000})).toBe('100,000');
        expect(NumberUtils.format({number: 100000, precision: 2})).toBe('100,000.00');
        expect(NumberUtils.format({number: 100000.123, maxPrecision: 2})).toBe('100,000.12');
        expect(NumberUtils.format({number: 100000, locale: 'de'})).toBe('100.000');
        expect(NumberUtils.percentage({number: 10})).toBe('10%');
        expect(NumberUtils.percentage({number: 10, precision: 2})).toBe('10.00%');
        expect(NumberUtils.percentage({number: 10.123, maxPrecision: 2})).toBe('10.12%');
    });

    it('currency uses default and overrides', () => {
        expect(NumberUtils.currency({number: 1000})).toBe('$1,000.00');
        expect(NumberUtils.currency({number: 1000, in: 'EUR', precision: 0})).toBe('€1,000');
        expect(NumberUtils.withCurrency({currency: 'GBP', callback: () => NumberUtils.currency({number: 5})})).toBe('£5.00');
        expect(NumberUtils.defaultCurrency()).toBe('USD');
    });

    it('locale defaults', () => {
        expect(NumberUtils.defaultLocale()).toBe('en');
        expect(NumberUtils.withLocale({locale: 'de', callback: () => NumberUtils.format({number: 1500})})).toBe('1.500');
        expect(NumberUtils.defaultLocale()).toBe('en');
    });

    it('abbreviate, forHumans, fileSize', () => {
        expect(NumberUtils.abbreviate({number: 1000})).toBe('1K');
        expect(NumberUtils.abbreviate({number: 489939})).toBe('490K');
        expect(NumberUtils.abbreviate({number: 1230000, precision: 2})).toBe('1.23M');
        expect(NumberUtils.abbreviate({number: 999999})).toBe('1M');
        expect(NumberUtils.forHumans({number: 1000})).toBe('1 thousand');
        expect(NumberUtils.forHumans({number: 1230000, precision: 2})).toBe('1.23 million');
        expect(NumberUtils.fileSize({bytes: 1024})).toBe('1 KB');
        expect(NumberUtils.fileSize({bytes: 1024 * 1024})).toBe('1 MB');
        expect(NumberUtils.fileSize({bytes: 1024, precision: 2})).toBe('1.00 KB');
    });

    it('clamp, pairs, trim', () => {
        expect(NumberUtils.clamp({number: 105, min: 10, max: 100})).toBe(100);
        expect(NumberUtils.clamp({number: 5, min: 10, max: 100})).toBe(10);
        expect(NumberUtils.pairs({to: 25, by: 10})).toEqual([
            [0, 9],
            [10, 19],
            [20, 25],
        ]);
        expect(NumberUtils.pairs({to: 25, by: 10, offset: 0})).toEqual([
            [0, 10],
            [10, 20],
            [20, 25],
        ]);
        expect(NumberUtils.trim('12.30')).toBe(12.3);
    });

    it('parse', () => {
        expect(NumberUtils.parseInt({string: '10.123'})).toBe(10);
        expect(NumberUtils.parseInt({string: '10,123', locale: 'fr'})).toBe(10);
        expect(NumberUtils.parseFloat({string: '1,234.5'})).toBe(1234.5);
        expect(NumberUtils.parse({string: '1.234,5', locale: 'de'})).toBe(1234.5);
        expect(NumberUtils.parse({string: 'abc'})).toBeNull();
    });

    it('ordinal and spelling', () => {
        expect(NumberUtils.ordinal(1)).toBe('1st');
        expect(NumberUtils.ordinal(2)).toBe('2nd');
        expect(NumberUtils.ordinal(11)).toBe('11th');
        expect(NumberUtils.ordinal(21)).toBe('21st');
        expect(NumberUtils.spell({number: 102})).toBe('one hundred and two');
        expect(NumberUtils.spell({number: 1234})).toBe('one thousand two hundred and thirty-four');
        expect(NumberUtils.spell({number: -1.5})).toBe('minus one point five');
        expect(NumberUtils.spell({number: 10, after: 10})).toBe('10');
        expect(NumberUtils.spell({number: 11, after: 10})).toBe('eleven');
        expect(NumberUtils.spell({number: 5, until: 10})).toBe('five');
        expect(NumberUtils.spell({number: 10, until: 10})).toBe('10');
        expect(NumberUtils.spellOrdinal(1)).toBe('first');
        expect(NumberUtils.spellOrdinal(21)).toBe('twenty-first');
        expect(NumberUtils.spellOrdinal(20)).toBe('twentieth');
        expect(NumberUtils.spellOrdinal(100)).toBe('one hundredth');
        expect(() => NumberUtils.spellOrdinal(1.5)).toThrow(RangeError);
    });
});
