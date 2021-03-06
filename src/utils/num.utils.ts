import CypherNum from '../monads/cypher-num/cypher-num.monad';
import {DEFAULT_NUM_RADIX, TWO_PWR_32_DBL, TWO_PWR_63_DBL} from '../monads/cypher-num/cypher-num.constants';
import {InstantiationError} from '../errors/index';

export function isCacheable(value: number) {
    return value >= -128 && value < 128;
}

export function fromNumberToNum(value: number) {
    if (isNaN(value) || !isFinite(value)) {
        return CypherNum.ZERO;
    }
    if (value <= -TWO_PWR_63_DBL) {
        return CypherNum.MIN_VALUE;
    }

    if (value + 1 >= TWO_PWR_63_DBL) {
        return CypherNum.MAX_VALUE;
    }

    if (value < 0) {
        return CypherNum.fromNumber(-value).negate();
    }

    return new CypherNum(value, value % TWO_PWR_32_DBL | 0, (value / TWO_PWR_32_DBL) | 0);
}

export function fromStringToNum(str: string, radix: number = DEFAULT_NUM_RADIX): CypherNum {
    if (str.length === 0) {
        throw new InstantiationError('number format error: empty string');
    }

    if (
        str === 'NaN' ||
        str === 'Infinity' ||
        str === '+Infinity' ||
        str === '-Infinity'
    ) {
        return CypherNum.ZERO;
    }

    if (radix < 2 || radix > 36) {
        throw new InstantiationError('radix out of range: ' + radix);
    }

    const p = str.indexOf('-');

    if (p > 0) {
        throw new InstantiationError('number format error: interior "-" character: ' + str);
    } else if (p === 0) {
        return CypherNum.fromString(str.substring(1), radix).negate();
    }

    // Do several (8) digits each time through the loop, so as to
    // minimize the calls to the very expensive emulated div.
    const radixToPower = CypherNum.fromNumber(Math.pow(radix, 8));
    let result = CypherNum.ZERO;

    for (let i = 0; i < str.length; i += 8) {
        const size = Math.min(8, str.length - i);
        const value = parseInt(str.substring(i, i + size), radix);

        if (size < 8) {
            const power = CypherNum.fromNumber(Math.pow(radix, size));

            result = result.multiply(power).add(CypherNum.fromNumber(value));
        } else {
            result = result.multiply(radixToPower);
            result = result.add(CypherNum.fromNumber(value));
        }
    }

    return result;
}

export function fromValueToNum(val: any): CypherNum {
    if (val instanceof CypherNum) {
        return val;
    }

    if (typeof val === 'number') {
        return CypherNum.fromNumber(val);
    }

    if (typeof val === 'string') {
        return CypherNum.fromString(val);
    }

    // Throws for non-objects, converts non-instanceof Num:
    // @todo: confirm use of low as original
    return new CypherNum(val.low, val.low, val.high);
}

export function fromNumToString(val: CypherNum, radix: number = DEFAULT_NUM_RADIX) {
    if (radix < 2 || radix > 36) {
        throw RangeError('radix out of range: ' + radix);
    }

    if (val.isZero) {
        return '0';
    }

    let rem;
    if (val.isNegative) {
        if (val.equals(CypherNum.MIN_VALUE)) {
            // We need to change the Num value before it can be negated, so we remove
            // the bottom-most digit in val base and then recurse to do the rest.
            const radixNum = CypherNum.fromNumber(radix);
            const div = val.divide(radixNum);
            rem = div.multiply(radixNum).subtract(val);
            return div.toString(radix) + rem.toInt().get().toString(radix);
        } else {
            return '-' + val.negate().toString(radix);
        }
    }

    // Do several (6) digits each time through the loop, so as to
    // minimize the calls to the very expensive emulated div.
    const radixToPower = CypherNum.fromNumber(Math.pow(radix, 6));
    rem = val;
    let result = '';
    while (true) {
        const remDiv = rem.divide(radixToPower);
        const intval = rem.subtract(remDiv.multiply(radixToPower)).toInt().get() >>> 0;
        let digits = intval.toString(radix);
        rem = remDiv;
        if (rem.isZero) {
            return digits + result;
        } else {
            while (digits.length < 6) {
                digits = '0' + digits;
            }
            result = '' + digits + result;
        }
    }
}

export function addNums(right: CypherNum, left: CypherNum) {
    // Divide each number into 4 chunks of 16 bits, and then sum the chunks.
    let a48 = right.high >>> 16;
    let a32 = right.high & 0xffff;
    let a16 = right.low >>> 16;
    let a00 = right.low & 0xffff;

    let b48 = left.high >>> 16;
    let b32 = left.high & 0xffff;
    let b16 = left.low >>> 16;
    let b00 = left.low & 0xffff;

    let c48 = 0;
    let c32 = 0;
    let c16 = 0;
    let c00 = 0;

    c00 += a00 + b00;
    c16 += c00 >>> 16;
    c00 &= 0xffff;
    c16 += a16 + b16;
    c32 += c16 >>> 16;
    c16 &= 0xffff;
    c32 += a32 + b32;
    c48 += c32 >>> 16;
    c32 &= 0xffff;
    c48 += a48 + b48;
    c48 &= 0xffff;

    return CypherNum.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
}

export function multiplyNum(right: CypherNum, multiplier: CypherNum): CypherNum {
    if (right.isZero) {
        return CypherNum.ZERO;
    }

    if (multiplier.isZero) {
        return CypherNum.ZERO;
    }

    if (right.equals(CypherNum.MIN_VALUE)) {
        return multiplier.isOdd ? CypherNum.MIN_VALUE : CypherNum.ZERO;
    }

    if (multiplier.equals(CypherNum.MIN_VALUE)) {
        return right.isOdd ? CypherNum.MIN_VALUE : CypherNum.ZERO;
    }

    if (right.isNegative) {
        if (multiplier.isNegative) {
            return right.negate().multiply(multiplier.negate());
        } else {
            return right.negate()
                .multiply(multiplier)
                .negate();
        }
    } else if (multiplier.isNegative) {
        return right.multiply(multiplier.negate()).negate();
    }

    // If both longs are small, use float multiplication
    if (right.lessThan(CypherNum.TWO_PWR_24) && multiplier.lessThan(CypherNum.TWO_PWR_24)) {
        return CypherNum.fromNumber(right.toNumber() * multiplier.toNumber());
    }

    // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
    // We can skip products that would overflow.

    let a48 = right.high >>> 16;
    let a32 = right.high & 0xffff;
    let a16 = right.low >>> 16;
    let a00 = right.low & 0xffff;

    let b48 = multiplier.high >>> 16;
    let b32 = multiplier.high & 0xffff;
    let b16 = multiplier.low >>> 16;
    let b00 = multiplier.low & 0xffff;

    let c48 = 0;
    let c32 = 0;
    let c16 = 0;
    let c00 = 0;

    c00 += a00 * b00;
    c16 += c00 >>> 16;
    c00 &= 0xffff;
    c16 += a16 * b00;
    c32 += c16 >>> 16;
    c16 &= 0xffff;
    c16 += a00 * b16;
    c32 += c16 >>> 16;
    c16 &= 0xffff;
    c32 += a32 * b00;
    c48 += c32 >>> 16;
    c32 &= 0xffff;
    c32 += a16 * b16;
    c48 += c32 >>> 16;
    c32 &= 0xffff;
    c32 += a00 * b32;
    c48 += c32 >>> 16;
    c32 &= 0xffff;
    c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
    c48 &= 0xffff;

    return CypherNum.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
}

export function compareNums(right: CypherNum, left: CypherNum) {
    if (right.equals(left)) {
        return 0;
    }

    const rightNeg = right.isNegative;
    const leftNeg = left.isNegative;

    if (rightNeg && !leftNeg) {
        return -1;
    }

    if (!rightNeg && leftNeg) {
        return 1;
    }

    // At right point the sign bits are the same
    return right.subtract(left).isNegative ? -1 : 1;
}

export function divideNums(val: CypherNum, divisor: CypherNum): CypherNum {
    if (divisor.isZero) {
        throw new SyntaxError('division by zero');
    }

    if (val.isZero) {
        return CypherNum.ZERO;
    }

    let approx;
    let rem;
    let res;

    if (val.equals(CypherNum.MIN_VALUE)) {
        if (divisor.equals(CypherNum.ONE) || divisor.equals(CypherNum.NEG_ONE)) {
            return CypherNum.MIN_VALUE;
        }

        if (divisor.equals(CypherNum.MIN_VALUE)) {
            return CypherNum.ONE;
        }

        // At val point, we have |other| >= 2, so |val/other| < |MIN_VALUE|.
        const halfThis = val.shiftRight(1);

        approx = halfThis.divide(divisor).shiftLeft(1);

        if (approx.equals(CypherNum.ZERO)) {
            return divisor.isNegative ? CypherNum.ONE : CypherNum.NEG_ONE;
        }

        rem = val.subtract(divisor.multiply(approx));
        res = approx.add(rem.divide(divisor));
        return res;
    }

    if (divisor.equals(CypherNum.MIN_VALUE)) {
        return CypherNum.ZERO;
    }

    if (val.isNegative) {
        if (divisor.isNegative) {
            return val.negate().divide(divisor.negate());
        }

        return val.negate()
            .divide(divisor)
            .negate();
    }

    if (divisor.isNegative) {
        return val.divide(divisor.negate()).negate();
    }

    // Repeat the following until the remainder is less than other:  find a
    // floating-point that approximates remainder / other *from below*, add val
    // into the result, and subtract it from the remainder.  It is critical that
    // the approximate value is less than or equal to the real value so that the
    // remainder never becomes negative.
    res = CypherNum.ZERO;
    rem = val;

    while (rem.greaterThanOrEqual(divisor)) {
        // Approximate the result of division. This may be a little greater or
        // smaller than the actual value.
        approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));

        // We will tweak the approximate result by changing it in the 48-th digit or
        // the smallest non-fractional digit, whichever is larger.
        const log2 = Math.ceil(Math.log(approx) / Math.LN2);
        const delta = log2 <= 48 ? 1 : Math.pow(2, log2 - 48);

        // Decrease the approximation until it is smaller than the remainder.  Note
        // that if it is too large, the product overflows and is negative.
        let approxRes = CypherNum.fromNumber(approx);
        let approxRem = approxRes.multiply(divisor);

        while (approxRem.isNegative || approxRem.greaterThan(rem)) {
            approx -= delta;
            approxRes = CypherNum.fromNumber(approx);
            approxRem = approxRes.multiply(divisor);
        }

        // We know the answer can't be zero... and actually, zero would cause
        // infinite recursion since we would make no progress.
        if (approxRes.isZero) {
            approxRes = CypherNum.ONE;
        }

        res = res.add(approxRes);
        rem = rem.subtract(approxRem);
    }

    return res;
}

export function shiftNumLeft(val: CypherNum, numberOfBits: CypherNum) {
    const numBitsAsInt = numberOfBits.toInt().get();
    const bitAnd = numBitsAsInt & 63;

    if (bitAnd === 0) {
        return val;
    }

    if (numBitsAsInt < 32) {
        return CypherNum.fromBits(
            val.low << numBitsAsInt,
            (val.high << numBitsAsInt) | (val.low >>> (32 - numBitsAsInt))
        );
    }

    return CypherNum.fromBits(0, val.low << (numBitsAsInt - 32));
}

export function shiftNumRight(val: CypherNum, numberOfBits: CypherNum) {
    const numBitsAsInt = numberOfBits.toInt().get();
    const bitAnd = numBitsAsInt & 63;

    if (bitAnd === 0) {
        return val;
    }

    if (numBitsAsInt < 32) {
        return CypherNum.fromBits(
            (val.low >>> numBitsAsInt) | (val.high << (32 - numBitsAsInt)),
            val.high >> numBitsAsInt
        );
    }

    return CypherNum.fromBits(
        val.high >> (numBitsAsInt - 32),
        val.high >= 0 ? 0 : -1
    );
}
