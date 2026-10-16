import DateUtils, {Carbon, CarbonInterval, CarbonPeriod, CarbonTimeZone} from '../utils/DateUtils';

const utc = (time: string) => Carbon.parse({time, tz: 'UTC'});

describe('Carbon', () => {
    afterEach(() => {
        Carbon.setTestNow();
        Carbon.resetMonthsOverflow();
        Carbon.resetMacros();
    });

    it('parses and formats', () => {
        const date = utc('2024-03-05 14:30:15');
        expect(date.format('Y-m-d H:i:s')).toBe('2024-03-05 14:30:15');
        expect(date.format('D, d M Y g:i A')).toBe('Tue, 05 Mar 2024 2:30 PM');
        expect(date.format('l jS \\o\\f F Y')).toBe('Tuesday 5th of March 2024');
        expect(date.format('N w z W t L o')).toBe('2 2 64 10 31 1 2024');
        expect(date.toIso8601String()).toBe('2024-03-05T14:30:15+00:00');
        expect(date.toISOString()).toBe('2024-03-05T14:30:15.000Z');
        expect(date.isoFormat('dddd, MMMM Do YYYY, h:mm:ss a')).toBe('Tuesday, March 5th 2024, 2:30:15 pm');
        expect(date.isoFormat('[Q]Q W')).toBe('Q1 10');
        expect(date.toRfc2822String()).toBe('Tue, 05 Mar 2024 14:30:15 +0000');
        expect(date.toDayDateTimeString()).toBe('Tue, Mar 5, 2024 2:30 PM');
        expect(String(date)).toBe('2024-03-05 14:30:15');
        expect(date.timestamp()).toBe(1709649015);
    });

    it('parses ISO strings with offsets and keeps the offset zone', () => {
        const date = Carbon.parse('2024-03-05T10:00:00+05:30');
        expect(date.toIso8601String()).toBe('2024-03-05T10:00:00+05:30');
        expect(date.utc().format('H:i')).toBe('04:30');
        expect(Carbon.parse('2024-03-05T10:00:00Z').utc().format('H')).toBe('10');
    });

    it('parses relative text against the test now', () => {
        Carbon.setTestNow(utc('2024-03-05 10:00:00'));
        const parse = (time: string) => Carbon.parse({time, tz: 'UTC'}).toDateTimeString();
        expect(parse('now')).toBe('2024-03-05 10:00:00');
        expect(parse('tomorrow')).toBe('2024-03-06 00:00:00');
        expect(parse('yesterday noon')).toBe('2024-03-04 12:00:00');
        expect(parse('+2 weeks')).toBe('2024-03-19 10:00:00');
        expect(parse('3 days ago')).toBe('2024-03-02 10:00:00');
        expect(parse('next friday')).toBe('2024-03-08 00:00:00');
        expect(parse('last monday')).toBe('2024-03-04 00:00:00');
        expect(parse('first day of next month')).toBe('2024-04-01 10:00:00');
        expect(parse('last day of this month')).toBe('2024-03-31 10:00:00');
        expect(parse('March 5, 2020')).toBe('2020-03-05 00:00:00');
        expect(parse('5 march 2020 15:45')).toBe('2020-03-05 15:45:00');
        expect(parse('2020-01-31 +1 month')).toBe('2020-03-02 00:00:00');
        expect(parse('+1 weekday')).toBe('2024-03-06 10:00:00');
        expect(() => parse('not a date')).toThrow();
    });

    it('creates from parts, formats and timestamps', () => {
        expect(Carbon.create({year: 2024, month: 2, day: 29, tz: 'UTC'}).toDateTimeString()).toBe('2024-02-29 00:00:00');
        expect(Carbon.createFromDate({year: 2020, month: 5, day: 4, tz: 'UTC'}).toDateString()).toBe('2020-05-04');
        expect(Carbon.createFromFormat({format: 'd/m/Y H:i', time: '25/12/2023 18:45', tz: 'UTC'}).toDateTimeString()).toBe('2023-12-25 18:45:00');
        expect(Carbon.createFromFormat({format: '!Y-m-d', time: '2023-12-25', tz: 'UTC'}).toDateTimeString()).toBe('2023-12-25 00:00:00');
        expect(Carbon.createFromIsoFormat({format: 'DD MMM YYYY, h:mm A', time: '05 Mar 2024, 2:30 PM', tz: 'UTC'}).toDateTimeString()).toBe(
            '2024-03-05 14:30:00',
        );
        expect(Carbon.createFromTimestamp({timestamp: 1709649015, tz: 'UTC'}).toDateTimeString()).toBe('2024-03-05 14:30:15');
        expect(() => Carbon.createSafe({year: 2023, month: 2, day: 30})).toThrow();
        expect(Carbon.canBeCreatedFromFormat({time: '2023-02-30', format: 'Y-m-d'})).toBe(false);
        expect(Carbon.canBeCreatedFromFormat({time: '2023-02-20', format: 'Y-m-d'})).toBe(true);
        expect(Carbon.hasFormat({time: '2023-02-20', format: 'Y-m-d'})).toBe(true);
    });

    it('adds and subtracts with overflow control', () => {
        const date = utc('2024-01-31 10:00:00');
        expect(date.addMonth().toDateString()).toBe('2024-03-02');
        expect(date.addMonthNoOverflow().toDateString()).toBe('2024-02-29');
        expect(date.addMonthsWithoutOverflow(13).toDateString()).toBe('2025-02-28');
        expect(date.addDays(3).toDateString()).toBe('2024-02-03');
        expect(date.subYear().toDateString()).toBe('2023-01-31');
        expect(date.addHours(30).toDateTimeString()).toBe('2024-02-01 16:00:00');
        expect(date.addWeeks(2).toDateString()).toBe('2024-02-14');
        expect(date.addQuarter().toDateString()).toBe('2024-05-01');
        expect(date.addDecade().year()).toBe(2034);
        expect(date.addCenturies(1).year()).toBe(2124);
        expect(date.addUTCDays(1).toDateString()).toBe('2024-02-01');
        expect(date.addUnit({unit: 'minutes', value: 90}).toDateTimeString()).toBe('2024-01-31 11:30:00');
        expect(date.add({years: 1, months: 1, days: 1}).toDateString()).toBe('2025-03-04');
        expect(date.sub('1 day 2 hours').toDateTimeString()).toBe('2024-01-30 08:00:00');
        expect(date.add(CarbonInterval.hours(5)).hour()).toBe(15);
        Carbon.useMonthsOverflow(false);
        expect(date.addMonth().toDateString()).toBe('2024-02-29');
    });

    it('handles weekdays and business days', () => {
        const friday = utc('2024-03-08 09:00:00');
        expect(friday.addWeekdays(1).toDateString()).toBe('2024-03-11');
        expect(friday.addWeekdays(6).toDateString()).toBe('2024-03-18');
        expect(friday.subWeekdays(5).toDateString()).toBe('2024-03-01');
        expect(friday.nextWeekendDay().toDateString()).toBe('2024-03-09');
        Carbon.pushHoliday('03-11');
        expect(friday.addBusinessDays(1).toDateString()).toBe('2024-03-12');
        expect(utc('2024-03-11').isBusinessDay()).toBe(false);
        Carbon.resetHolidays();
        expect(friday.isWeekday()).toBe(true);
        expect(utc('2024-03-09').isWeekend()).toBe(true);
        expect(friday.isFriday()).toBe(true);
        expect(friday.diffInWeekdays(utc('2024-03-15 09:00:00'))).toBe(5);
        expect(friday.diffInWeekendDays(utc('2024-03-15 09:00:00'))).toBe(2);
    });

    it('moves to unit boundaries', () => {
        const date = utc('2024-03-05 14:30:15.123');
        expect(date.startOfDay().toDateTimeString()).toBe('2024-03-05 00:00:00');
        expect(date.endOfDay().format('H:i:s.v')).toBe('23:59:59.999');
        expect(date.startOfWeek().toDateString()).toBe('2024-03-04');
        expect(date.endOfWeek().toDateString()).toBe('2024-03-10');
        expect(date.startOfMonth().toDateString()).toBe('2024-03-01');
        expect(date.endOfMonth().toDateString()).toBe('2024-03-31');
        expect(date.startOfQuarter().toDateString()).toBe('2024-01-01');
        expect(date.endOfQuarter().toDateString()).toBe('2024-03-31');
        expect(date.startOfYear().toDateString()).toBe('2024-01-01');
        expect(date.endOfYear().toDateString()).toBe('2024-12-31');
        expect(date.startOfDecade().year()).toBe(2020);
        expect(date.endOfDecade().year()).toBe(2029);
        expect(date.startOfCentury().year()).toBe(2001);
        expect(date.startOfHour().format('H:i:s')).toBe('14:00:00');
        expect(date.endOfMinute().format('s.v')).toBe('59.999');
        expect(date.startOfSeason().toDateString()).toBe('2024-03-01');
        expect(date.floorMinute(15).format('H:i')).toBe('14:30');
        expect(utc('2024-03-05 14:37:00').floorMinutes(15).format('H:i')).toBe('14:30');
        expect(utc('2024-03-05 14:37:00').ceilMinutes(15).format('H:i')).toBe('14:45');
        expect(utc('2024-03-05 14:37:00').roundHour().format('H:i')).toBe('15:00');
        expect(date.firstOfMonth().toDateString()).toBe('2024-03-01');
        expect(date.lastOfMonth('friday').toDateString()).toBe('2024-03-29');
        expect(date.firstOfMonth('monday').toDateString()).toBe('2024-03-04');
        expect(date.nthOfMonth({nth: 2, dayOfWeek: 'tuesday'})).toEqual(expect.objectContaining({}));
        expect((date.nthOfMonth({nth: 2, dayOfWeek: 'tuesday'}) as Carbon).toDateString()).toBe('2024-03-12');
        expect(date.nthOfMonth({nth: 6, dayOfWeek: 'tuesday'})).toBe(false);
        expect(date.next('friday').toDateString()).toBe('2024-03-08');
        expect(date.previous('monday').toDateString()).toBe('2024-03-04');
    });

    it('compares', () => {
        const a = utc('2024-03-05');
        const b = utc('2024-03-06');
        expect(a.lt(b)).toBe(true);
        expect(b.isAfter(a)).toBe(true);
        expect(a.eq('2024-03-05')).toBe(true);
        expect(a.eq('2024-03-05 00:00:00')).toBe(true);
        expect(a.between({start: '2024-03-01', end: b})).toBe(true);
        expect(a.betweenExcluded({start: a, end: b})).toBe(false);
        expect(a.isSameMonth(b)).toBe(true);
        expect(a.isSameYear(utc('2023-03-05'))).toBe(false);
        expect(a.isSameMonth({date: utc('2023-03-05'), ofSameYear: false})).toBe(true);
        expect(a.isSameAs({format: 'Y-m', date: b})).toBe(true);
        expect(a.isSameWeek(utc('2024-03-10'))).toBe(true);
        expect(a.max(b).eq(b)).toBe(true);
        expect(a.min(b).eq(a)).toBe(true);
        expect(a.closest({dates: [b, utc('2024-04-01')]}).eq(b)).toBe(true);
        expect(a.farthest({dates: [b, utc('2024-04-01')]}).toDateString()).toBe('2024-04-01');
        expect(a.average(b).toDateTimeString()).toBe('2024-03-05 12:00:00');
        expect(utc('2024-03-05 00:00:00').isStartOfDay()).toBe(true);
        expect(utc('2024-03-05 23:59:59').isEndOfDay()).toBe(true);
        expect(utc('2024-03-31').isLastOfMonth()).toBe(true);
        expect(utc('2024-02-29').isLeapYear()).toBe(true);
        expect(utc('2024-12-29').isLongYear()).toBe(false);
        expect(utc('2020-12-31').isLongYear()).toBe(true);
    });

    it('knows "now" relative checks', () => {
        Carbon.setTestNow(utc('2024-03-05 10:00:00'));
        expect(utc('2024-03-05 23:00:00').isToday()).toBe(true);
        expect(utc('2024-03-04').isYesterday()).toBe(true);
        expect(utc('2024-03-06').isTomorrow()).toBe(true);
        expect(utc('2024-03-06').isFuture()).toBe(true);
        expect(utc('2024-03-04').isPast()).toBe(true);
        expect(utc('2024-02-15').isLastMonth()).toBe(true);
        expect(utc('2024-04-15').isNextMonth()).toBe(true);
        expect(utc('2023-06-01').isLastYear()).toBe(true);
        expect(utc('2024-03-01').isCurrentWeek()).toBe(false);
        expect(utc('2024-03-03').isCurrentMonth()).toBe(true);
        expect(Carbon.today('UTC').toDateTimeString()).toBe('2024-03-05 00:00:00');
        expect(Carbon.tomorrow('UTC').toDateString()).toBe('2024-03-06');
        expect(Carbon.hasTestNow()).toBe(true);
        expect(Carbon.withTestNow({testNow: '2000-01-01', callback: () => Carbon.now().year()})).toBe(2000);
    });

    it('computes differences', () => {
        const a = utc('2024-01-31 00:00:00');
        const b = utc('2024-03-02 12:00:00');
        expect(a.diffInDays(b)).toBe(31.5);
        expect(b.diffInDays(a)).toBe(-31.5);
        expect(b.diffInDays({other: a, absolute: true})).toBe(31.5);
        expect(a.diffInHours(b)).toBe(756);
        expect(a.diffInMinutes(utc('2024-01-31 01:30:00'))).toBe(90);
        expect(a.diffInSeconds(utc('2024-01-31 00:01:00'))).toBe(60);
        expect(a.diffInMonths(utc('2024-03-31'))).toBe(2);
        expect(utc('2020-01-01').diffInYears(utc('2022-07-01'))).toBeCloseTo(2.5, 1);
        expect(a.diffInWeeks(utc('2024-02-14'))).toBe(2);
        expect(a.diffInMilliseconds(utc('2024-01-31 00:00:01'))).toBe(1000);
        expect(a.diffInUTCDays(b)).toBe(31.5);

        const diff = utc('2020-02-29 10:00:00').diff(utc('2024-05-31 12:30:45'));
        expect([diff.years(), diff.months(), diff.days(), diff.hours(), diff.minutes(), diff.seconds()]).toEqual([4, 3, 2, 2, 30, 45]);
        expect(diff.totalDays()).toBe(1553);
        expect(b.diff(a).isInverted()).toBe(true);
        expect(b.diff({other: a, absolute: true}).isInverted()).toBe(false);
    });

    it('diffForHumans', () => {
        const now = utc('2024-03-05 10:00:00');
        Carbon.setTestNow(now);
        expect(now.subHours(2).diffForHumans()).toBe('2 hours ago');
        expect(now.addDays(3).diffForHumans()).toBe('3 days from now');
        expect(now.addWeeks(2).diffForHumans()).toBe('2 weeks from now');
        expect(now.subMonths(14).diffForHumans()).toBe('1 year ago');
        expect(now.subMonths(14).diffForHumans({parts: 2})).toBe('1 year and 2 months ago'.replace(' and', ''));
        expect(now.subMonths(14).diffForHumans({parts: 2, join: true})).toBe('1 year and 2 months ago');
        expect(now.subMinutes(5).diffForHumans({short: true})).toBe('5min ago');
        expect(now.subHours(2).diffForHumans({syntax: 'absolute'})).toBe('2 hours');
        expect(now.addHours(1).diffForHumans(now.subHours(1))).toBe('2 hours after');
        expect(now.diffForHumans(now.addHours(1))).toBe('1 hour before');
        expect(now.subDays(1).toNow()).toBe('1 day from now');
        expect(now.subDays(1).diffForHumans({options: ['oneDayWords']})).toBe('yesterday');
        expect(now.longAbsoluteDiffForHumans(now.addMinutes(30))).toBe('30 minutes');
        expect(now.subSeconds(0).diffForHumans()).toBe('0 seconds ago');
    });

    it('calendar', () => {
        const now = utc('2024-03-05 10:00:00');
        expect(utc('2024-03-05 14:30:00').calendar({reference: now})).toBe('Today at 2:30 PM');
        expect(utc('2024-03-06 09:00:00').calendar({reference: now})).toBe('Tomorrow at 9:00 AM');
        expect(utc('2024-03-04 09:00:00').calendar({reference: now})).toBe('Yesterday at 9:00 AM');
        expect(utc('2024-03-08 09:00:00').calendar({reference: now})).toBe('Friday at 9:00 AM');
        expect(utc('2024-02-29 09:00:00').calendar({reference: now})).toBe('Last Thursday at 9:00 AM');
        expect(utc('2023-01-02 09:00:00').calendar({reference: now})).toBe('01/02/2023');
    });

    it('getters and positions', () => {
        const date = utc('2024-03-05 14:30:15');
        expect(date.quarter()).toBe(1);
        expect(date.dayOfWeek()).toBe(2);
        expect(date.dayOfYear()).toBe(65);
        expect(date.daysInMonth()).toBe(31);
        expect(date.weekOfYear()).toBe(10);
        expect(date.weekOfMonth()).toBe(2);
        expect(date.weeksInYear()).toBe(52);
        expect(date.century()).toBe(21);
        expect(date.decade()).toBe(203);
        expect(date.hourOfDay()).toBe(14);
        expect(date.minuteOfHour()).toBe(30);
        expect(date.secondOfMinute()).toBe(15);
        expect(date.monthOfYear()).toBe(3);
        expect(date.dayOfMonth()).toBe(5);
        expect(date.quarterOfYear()).toBe(1);
        expect(date.hoursInDay()).toBe(24);
        expect(date.daysInYear()).toBe(366);
        expect(date.monthsInYear()).toBe(12);
        expect(date.minutesInHour()).toBe(60);
        expect(date.secondsInDay()).toBe(86400);
        expect(date.get('year')).toBe(2024);
        expect(date.ordinal('day')).toBe('5th');
        expect(date.getSeason()).toBe('spring');
        expect(date.secondsSinceMidnight()).toBe(52215);
        expect(date.getTranslatedDayName('fr').toLowerCase()).toBe('mardi');
    });

    it('sets values', () => {
        const date = utc('2024-03-05 14:30:15');
        expect(date.year(2020).toDateString()).toBe('2020-03-05');
        expect(date.setMonth(1).toDateString()).toBe('2024-01-05');
        expect(date.day(31).toDateString()).toBe('2024-03-31');
        expect(date.setHour(1).setMinute(2).setSecond(3).toTimeString()).toBe('01:02:03');
        expect(date.setDate({year: 2000, month: 1, day: 2}).toDateString()).toBe('2000-01-02');
        expect(date.setTime({hour: 8, minute: 9}).toTimeString()).toBe('08:09:00');
        expect(date.set({year: 2001, month: 2, day: 3}).toDateString()).toBe('2001-02-03');
        expect(date.setISODate({year: 2024, week: 1, day: 1}).toDateString()).toBe('2024-01-01');
        expect(date.setTimeFromTimeString('09:15').toTimeString()).toBe('09:15:00');
        expect(date.setUnitNoOverflow({unit: 'month', value: 2}).toDateString()).toBe('2024-02-05');
        expect(utc('2024-01-31').setUnit({unit: 'month', value: 2, overflow: false}).toDateString()).toBe('2024-02-29');
        expect(date.midDay().toTimeString()).toBe('12:00:00');
    });

    it('handles time zones', () => {
        const date = Carbon.parse({time: '2024-03-05 12:00:00', tz: 'UTC'});
        const tokyo = date.setTimezone('Asia/Tokyo');
        expect(tokyo.format('H:i T')).toBe('21:00 GMT+9');
        expect(tokyo.getOffset()).toBe(32400);
        expect(tokyo.toIso8601String()).toBe('2024-03-05T21:00:00+09:00');
        expect(date.shiftTimezone('Asia/Tokyo').toISOString()).toBe('2024-03-05T03:00:00.000Z');
        expect(Carbon.parse({time: '2024-07-01 12:00', tz: 'America/New_York'}).getOffset()).toBe(-4 * 3600);
        expect(Carbon.parse({time: '2024-07-01 12:00', tz: 'America/New_York'}).isDST()).toBe(true);
        expect(Carbon.parse({time: '2024-01-01 12:00', tz: 'America/New_York'}).isDST()).toBe(false);
        expect(date.utcOffset(330).format('P')).toBe('+05:30');
        expect(date.getTimezone().getName()).toBe('UTC');
        expect(date.isUtc()).toBe(true);
        expect(date.setTimezone('+02:00').format('H:i P')).toBe('14:00 +02:00');
        expect(() => date.setTimezone('Mars/Phobos')).toThrow();
    });

    it('is DST aware for days but not for hours', () => {
        const eve = Carbon.parse({time: '2024-03-09 12:00:00', tz: 'America/New_York'});
        expect(eve.addDay().format('Y-m-d H:i')).toBe('2024-03-10 12:00');
        expect(eve.addHours(24).format('Y-m-d H:i')).toBe('2024-03-10 13:00');
        expect(eve.addRealUnit({unit: 'day'}).format('Y-m-d H:i')).toBe('2024-03-10 13:00');
        expect(Carbon.parse({time: '2024-03-10 12:00:00', tz: 'America/New_York'}).hoursInDay()).toBe(23);
        expect(Carbon.parse({time: '2024-11-03 12:00:00', tz: 'America/New_York'}).hoursInDay()).toBe(25);
    });

    it('supports locales and macros', () => {
        const date = utc('2024-03-05 14:30:15');
        expect(date.translatedFormat('l j F', 'fr').toLowerCase()).toBe('mardi 5 mars');
        expect(date.locale('es').getTranslatedMonthName().toLowerCase()).toBe('marzo');
        expect(Carbon.parseFromLocale({time: '5 mars 2024', locale: 'fr', tz: 'UTC'}).toDateString()).toBe('2024-03-05');
        Carbon.macro('endOfWorkday', function (this: Carbon) {
            return this.setTime({hour: 17});
        });
        expect((date as any).endOfWorkday().toTimeString()).toBe('17:00:00');
        expect(Carbon.hasMacro('endOfWorkday')).toBe(true);
    });

    it('modifies with text and serialises', () => {
        const date = utc('2024-03-05 14:30:15');
        expect(date.modify('next monday').toDateString()).toBe('2024-03-11');
        expect(date.modify('+1 week 2 days').toDateString()).toBe('2024-03-14');
        expect(date.modify('last day of next month').toDateString()).toBe('2024-04-30');
        expect(Carbon.fromSerialized(date.serialize()).eq(date)).toBe(true);
        expect(JSON.stringify({d: date})).toContain('2024-03-05T14:30:15.000Z');
        expect(date.toObject().dayOfYear).toBe(65);
        expect(date.toDate().getTime()).toBe(date.valueOf());
    });
});

describe('CarbonInterval', () => {
    it('creates and reads', () => {
        const interval = CarbonInterval.create({years: 1, months: 2, weeks: 1, days: 3, hours: 4, minutes: 5, seconds: 6});
        expect(interval.weeks()).toBe(1);
        expect(interval.days()).toBe(10);
        expect(interval.dayzExcludeWeeks()).toBe(3);
        expect(interval.spec()).toBe('P1Y2M10DT4H5M6S');
        expect(interval.forHumans()).toBe('1 year 2 months 1 week 3 days 4 hours 5 minutes 6 seconds');
        expect(interval.forHumans({parts: 2, join: true})).toBe('1 year and 2 months');
        expect(interval.forHumans({short: true, parts: 3})).toBe('1yr 2mo 1w');
        expect(interval.format('%y-%M-%D %H:%I:%S')).toBe('1-02-10 04:05:06');
        expect(CarbonInterval.make('P1DT2H').hours()).toBe(2);
        expect(CarbonInterval.make('1 day 2 hours').spec()).toBe('P1DT2H');
        expect(CarbonInterval.fromString('3d 4h 30m').minutes()).toBe(30);
        expect(CarbonInterval.make('2 days ago').days()).toBe(-2);
        expect(CarbonInterval.hours(3).hours()).toBe(3);
        expect(CarbonInterval.days(2).hours(5).spec()).toBe('P2DT5H');
        expect(new CarbonInterval().isEmpty()).toBe(true);
        expect(CarbonInterval.create().spec()).toBe('PT0S');
        expect(CarbonInterval.createFromFormat({format: '%d days %h hours', interval: '3 days 4 hours'}).spec()).toBe('P3DT4H');
    });

    it('does arithmetic', () => {
        const a = CarbonInterval.make('1 hour 30 minutes');
        expect(a.add('45 minutes').cascade().spec()).toBe('PT2H15M');
        expect(a.sub({minutes: 30}).spec()).toBe('PT1H');
        expect(a.multiply(2).spec()).toBe('PT2H60M'.replace('PT2H60M', 'PT2H60M'));
        expect(a.multiply(2).cascade().spec()).toBe('PT3H');
        expect(a.divide(2).spec()).toBe('PT45M');
        expect(CarbonInterval.days(1).multiply(0.5).hours()).toBe(12);
        expect(a.invert().isInverted()).toBe(true);
        expect(a.total('minutes')).toBe(90);
        expect(a.total('hours')).toBe(1.5);
        expect(CarbonInterval.make('90 minutes').optimize().spec()).toBe('PT1H30M');
        expect(CarbonInterval.make('2 hours 59 minutes').round('hour').hours()).toBe(3);
        expect(CarbonInterval.make('2 hours 59 minutes').floor('hour').hours()).toBe(2);
        expect(CarbonInterval.hours(2).gt('90 minutes')).toBe(true);
        expect(CarbonInterval.hours(1).eq('60 minutes')).toBe(true);
        expect(CarbonInterval.hours(1).isBetween({start: '30 minutes', end: '2 hours'})).toBe(true);
    });

    it('builds periods', () => {
        const period = CarbonInterval.days(2).start('2024-01-01').end('2024-01-08').toPeriod();
        expect(period.map(date => date.format('d'))).toEqual(['01', '03', '05', '07']);
    });
});

describe('CarbonPeriod', () => {
    it('iterates between dates', () => {
        const period = CarbonPeriod.create({start: '2024-01-01', end: '2024-01-05', interval: '1 day'});
        expect(period.count()).toBe(5);
        expect(period.map(date => date.format('j'))).toEqual(['1', '2', '3', '4', '5']);
        expect([...period].length).toBe(5);
        expect(period.first()?.toDateString()).toBe('2024-01-01');
        expect(period.last()?.toDateString()).toBe('2024-01-05');
        expect(period.excludeStartDate().excludeEndDate().count()).toBe(3);
        expect(period.contains('2024-01-03')).toBe(true);
        expect(period.contains('2024-02-03')).toBe(false);
    });

    it('supports recurrences, filters and cursor', () => {
        const period = CarbonPeriod.create({start: '2024-01-01', recurrences: 4, interval: {weeks: 1}});
        expect(period.map(date => date.toDateString())).toEqual(['2024-01-01', '2024-01-08', '2024-01-15', '2024-01-22']);

        const weekdays = CarbonPeriod.create({start: '2024-03-04', end: '2024-03-10'}).addFilter({filter: date => date.isWeekday(), name: 'weekday'});
        expect(weekdays.count()).toBe(5);
        expect(weekdays.hasFilter('weekday')).toBe(true);
        expect(weekdays.removeFilter('weekday').count()).toBe(7);

        const stopped = CarbonPeriod.create({start: '2024-03-04', end: '2024-03-30'}).addFilter({
            filter: (_date, key) => (key >= 3 ? CarbonPeriod.END_ITERATION : true),
        });
        expect(stopped.count()).toBe(3);

        const cursor = CarbonPeriod.create({start: '2024-01-01', end: '2024-01-03'}).rewind();
        const seen: string[] = [];
        for (; cursor.valid(); cursor.next()) {
            seen.push(cursor.current()?.format('j') as string);
        }
        expect(seen).toEqual(['1', '2', '3']);
        expect(() => [...CarbonPeriod.create({start: '2024-01-01'})]).toThrow();
    });

    it('is created from dates and ISO strings', () => {
        const date = Carbon.parse({time: '2024-01-01', tz: 'UTC'});
        expect(date.daysUntil('2024-01-04').count()).toBe(4);
        expect(date.monthsUntil({end: '2024-04-01', step: 1}).count()).toBe(4);
        expect(date.range({end: '2024-01-10', step: 3}).count()).toBe(4);
        expect(date.hoursUntil('2024-01-01 03:00').count()).toBe(4);
        expect(CarbonPeriod.createFromIso('R3/2024-01-01T00:00:00Z/P1D').count()).toBe(3);
        expect(CarbonPeriod.createFromIso('2024-01-01/P1W/2024-01-31').count()).toBe(5);
        expect(CarbonPeriod.createFromArray(['2024-01-01', 'P1D', 3]).count()).toBe(3);
        const a = CarbonPeriod.create({start: '2024-01-01', end: '2024-01-10'});
        const b = CarbonPeriod.create({start: '2024-01-08', end: '2024-01-20'});
        const c = CarbonPeriod.create({start: '2024-01-11', end: '2024-01-20'});
        expect(a.overlaps(b)).toBe(true);
        expect(a.overlaps(c)).toBe(false);
        expect(a.isConsecutiveWith(c)).toBe(true);
        expect(a.toString()).toBe('Every 1 day from 2024-01-01 00:00:00 to 2024-01-10 00:00:00');
    });
});

describe('CarbonTimeZone', () => {
    it('describes zones', () => {
        const tz = new CarbonTimeZone('Asia/Kolkata');
        expect(tz.getName()).toBe('Asia/Kolkata');
        expect(tz.getOffset('2024-01-01T00:00:00Z')).toBe(19800);
        expect(tz.toOffsetName('2024-01-01T00:00:00Z')).toBe('+05:30');
        expect(tz.getType()).toBe(3);
        expect(CarbonTimeZone.createFromHourOffset(5.5).getName()).toBe('+05:30');
        expect(CarbonTimeZone.createFromHourOffset(5.5).getType()).toBe(1);
        expect(CarbonTimeZone.createFromHourOffset(5.5).toRegionName('2024-01-01T00:00:00Z')).toMatch(/Asia\/(Kolkata|Calcutta)/);
        const transitions = new CarbonTimeZone('America/New_York').getTransitions({from: '2024-01-01T00:00:00Z', to: '2024-12-31T00:00:00Z'});
        expect(transitions.map(t => t.offset)).toEqual([-14400, -18000]);
        expect(CarbonTimeZone.listIdentifiers()).toContain('Europe/London');
    });
});

describe('DateUtils entry points', () => {
    it('keeps the old helpers and exposes the Carbon API', () => {
        expect(DateUtils.formatDate('2024-03-05T00:00:00', 'YYYY-MM-DD')).toBe('2024-03-05');
        expect(DateUtils.parse({time: '2024-03-05 10:00', tz: 'UTC'}).addDay().toDateString()).toBe('2024-03-06');
        expect(DateUtils.interval('2 hours').hours()).toBe(2);
        expect(DateUtils.period({start: '2024-01-01', end: '2024-01-02'}).count()).toBe(2);
        expect(DateUtils.create({year: 2024, month: 1, day: 1, tz: 'UTC'}).toDateString()).toBe('2024-01-01');
        expect(DateUtils.timezone('UTC').getName()).toBe('UTC');
    });
});
