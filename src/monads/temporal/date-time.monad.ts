import moment from 'moment';
import {Monad, Str, None, Maybe} from '@relate/types';

import CypherNum from '../cypher-num/cypher-num.monad';
import {
    localDateTimeToString,
    timeZoneOffsetInSeconds,
    timeZoneOffsetToIsoString,
    totalNanoseconds
} from '../../utils/temporal.utils';

export interface RawDateTime {
    year: CypherNum;
    month: CypherNum;
    day: CypherNum;
    hour: CypherNum;
    minute: CypherNum;
    second: CypherNum;
    nanosecond: CypherNum;
    timeZoneOffsetSeconds: Maybe<CypherNum>;
    timeZoneId: Maybe<Str>;
}

export default class DateTime extends Monad<RawDateTime> {
    get isEmpty(): boolean {
        return false; // @todo
    }

    get year() {
        return this.original.year;
    }

    get month() {
        return this.original.month;
    }

    get day() {
        return this.original.day;
    }

    get hour() {
        return this.original.hour;
    }

    get minute() {
        return this.original.minute;
    }

    get second() {
        return this.original.second;
    }

    get nanosecond() {
        return this.original.nanosecond;
    }

    get timeZoneOffsetSeconds() {
        return this.original.timeZoneOffsetSeconds;
    }

    get timeZoneId() {
        return this.original.timeZoneId;
    }

    static isDateTime(val: any): val is DateTime {
        return val instanceof DateTime;
    }

    static of(val: any): DateTime {
        // @todo: improve typechecks
        const sane: RawDateTime = {
            year: CypherNum.fromValue(val.year),
            month: CypherNum.fromValue(val.month),
            day: CypherNum.fromValue(val.day),
            hour: CypherNum.fromValue(val.hour),
            minute: CypherNum.fromValue(val.minute),
            second: CypherNum.fromValue(val.second),
            nanosecond: CypherNum.fromValue(val.nanosecond),
            timeZoneOffsetSeconds: Maybe.of(
                val.timeZoneOffsetSeconds == null
                    ? None.EMPTY
                    : CypherNum.fromValue(val.timeZoneOffsetSeconds)
            ),
            timeZoneId: Maybe.of(
                val.timeZoneId
                    ? Str.from(val.timeZoneId)
                    : None.EMPTY
            ),
        };

        return new DateTime(sane);
    }

    static from(val: any): DateTime {
        return DateTime.isDateTime(val)
            ? val
            : DateTime.of(val);
    }

    static fromStandardDate(standardDate: Date, nanosecond: CypherNum, timeZoneId?: Str): DateTime {
        return DateTime.of({
            year: standardDate.getFullYear(),
            month: standardDate.getMonth() + 1,
            day: standardDate.getDate(),
            hour: standardDate.getHours(),
            minute: standardDate.getMinutes(),
            second: standardDate.getSeconds(),
            nanosecond: totalNanoseconds(standardDate, nanosecond),
            timeZoneOffsetSeconds: timeZoneOffsetInSeconds(standardDate),
            timeZoneId: Maybe.of(
                timeZoneId && !timeZoneId.isEmpty
                    ? timeZoneId
                    : None.EMPTY
            )
        });
    }

    static fromMessage(seconds: CypherNum = CypherNum.ZERO, nanoseconds: CypherNum = CypherNum.ZERO): DateTime {
        return seconds.flatMap((secs) => DateTime.fromStandardDate(
            moment(0).add(secs, 'seconds').toDate(),
            nanoseconds
            // @todo: timezone id?
        ));
    }

    toString() {
        const localDateTimeStr = localDateTimeToString(
            this.year,
            this.month,
            this.day,
            this.hour,
            this.minute,
            this.second,
            this.nanosecond
        );
        const zoneId = this.timeZoneId.getOrElse(Str.EMPTY);
        const timeZoneOffsetSeconds = this.timeZoneOffsetSeconds.getOrElse(CypherNum.ZERO);
        const timeZoneStr = !zoneId.isEmpty
            ? zoneId.map((zone) => `[${zone}]`).get()
            : timeZoneOffsetToIsoString(timeZoneOffsetSeconds.get());

        return `${localDateTimeStr}${timeZoneStr}}`;
    }
}
