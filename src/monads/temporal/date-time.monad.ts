import Num from '../primitive/num/num.monad';
import Monad from '../monad';
import {localDateTimeToString, timeZoneOffsetInSeconds, timeZoneOffsetToIsoString, totalNanoseconds} from '../../utils/temporal.utils';
import Str from '../primitive/str.monad';
import None from '../primitive/none.monad';

export interface RawDateTime {
    year: Num;
    month: Num;
    day: Num;
    hour: Num;
    minute: Num;
    second: Num;
    nanosecond: Num;
    timeZoneOffsetSeconds: Num | None<number>;
    timeZoneId: Str | None<string>;
}

export default class DateTime extends Monad<RawDateTime> {
    static isDateTime(val: any): val is DateTime {
        return val instanceof DateTime;
    }

    static of(val: any) {
        // @todo: improve typechecks
        const sane: RawDateTime = {
            year: Num.fromValue(val.year),
            month: Num.fromValue(val.month),
            day: Num.fromValue(val.day),
            hour: Num.fromValue(val.hour),
            minute: Num.fromValue(val.minute),
            second: Num.fromValue(val.second),
            nanosecond: Num.fromValue(val.nanosecond),
            timeZoneOffsetSeconds: val.timeZoneOffsetSeconds == null
                ? None.of()
                : Num.fromValue(val.timeZoneOffsetSeconds),
            timeZoneId: val.timeZoneId
                ? Str.from(val.timeZoneId)
                : None.of(),
        };

        return new DateTime(sane);
    }

    static from(val: any) {
        return val instanceof DateTime
            ? val
            : DateTime.of(val);
    }

    isEmpty(): boolean {
        return false; // @todo
    }

    getYear() {
        return this.original.year;
    }

    getMonth() {
        return this.original.month;
    }

    getDay() {
        return this.original.day;
    }

    getHour() {
        return this.original.hour;
    }

    getMinute() {
        return this.original.minute;
    }

    getSecond() {
        return this.original.second;
    }

    getNanosecond() {
        return this.original.nanosecond;
    }

    getTimeZoneOffsetSeconds() {
        return this.original.timeZoneOffsetSeconds;
    }

    getTimeZoneId() {
        return this.original.timeZoneId;
    }

    static fromStandardDate(standardDate: Date, nanosecond: number) {
        return DateTime.of({
            year: standardDate.getFullYear(),
            month: standardDate.getMonth() + 1,
            day: standardDate.getDate(),
            hour: standardDate.getHours(),
            minute: standardDate.getMinutes(),
            second: standardDate.getSeconds(),
            nanosecond: totalNanoseconds(standardDate, nanosecond),
            timeZoneOffsetSeconds: timeZoneOffsetInSeconds(standardDate),
            timeZoneId: null
        });
    }

    toString() {
        const localDateTimeStr = localDateTimeToString(
            this.getYear(),
            this.getMonth(),
            this.getDay(),
            this.getHour(),
            this.getMinute(),
            this.getSecond(),
            this.getNanosecond()
        );
        const zoneId = this.getTimeZoneId();
        const timeZoneOffsetSeconds = this.getTimeZoneOffsetSeconds();
        const timeZoneStr = Str.isStr(zoneId)
            ? zoneId.map((zone) => `[${zone}]`).get()
            : timeZoneOffsetToIsoString(timeZoneOffsetSeconds.getOrElse(0));

        return localDateTimeStr + timeZoneStr;
    }
}
