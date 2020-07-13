import {Monad, Str, Dict} from '@relate/types';

import CypherNum from '../cypher-num/cypher-num.monad';

export interface RawRelationship {
    identity: CypherNum;
    start: CypherNum;
    end: CypherNum;
    type: Str;
    properties: Dict;
}

// @ts-ignore
export default class Relationship extends Monad<RawRelationship> {
    static EMPTY = Relationship.of({});

    get isEmpty() {
        return false;
    }

    get hasProperties() {
        return !this.original.properties.isEmpty;
    }

    get identity() {
        return this.original.identity;
    }

    get type() {
        return this.original.type;
    }

    get start() {
        return this.original.start;
    }

    get end() {
        return this.original.end;
    }

    get properties() {
        return this.original.properties;
    }

    static isRelationship(val: any): val is Relationship {
        return val instanceof Relationship;
    }

    static of(val: any): Relationship {
        // @todo: improve typechecks
        const sane: RawRelationship = {
            identity: CypherNum.fromValue(val.identity),
            start: CypherNum.fromValue(val.start),
            end: CypherNum.fromValue(val.end),
            type: Str.from(val.type),
            properties: Dict.from(val.properties)
        };

        return new Relationship(sane);
    }

    static from(val: any): Relationship {
        return Relationship.isRelationship(val)
            ? val
            : Relationship.of(val);
    }

    toString() {
        let s = '(' + this.start + ')-[:' + this.type;

        if (this.hasProperties) {
            s += ' {';

            let first = true;

            for (const [key, val] of this.properties) {
                if (!first) {
                    s += ',';
                }

                s += key + ':' + JSON.stringify(val);
                first = false;
            }

            s += '}';
        }

        s += ']->(' + this.end + ')';

        return `${this.constructor.name} {${s}}`;
    }
}
