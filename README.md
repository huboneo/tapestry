# Tapestry
A neo4j driver spike illustrating an RxJS based monadic driver with full typescript support and a pluggable packstream.

Help keep the dream alive!

## ToC
1. [Basic usage](#basic-usage)
    - [Initialisation](#initialisation)
    - [Queries](#queries)
    - [Transactions](#transactions)
    - [Routing](#routing)
    - [Routing + Transactions](#routing--transactions)
2. [Custom unpackers](#custom-unpackers)
3. [Configuration](#configuration)


## Basic Usage
### Initialisation
```Typescript
import {Driver} from '.';

const driver = new Driver({
    connectionConfig: {
        authToken: {
            scheme: 'basic',
            principal: 'neo4j',
            credentials: 'neo4j'
        }
    }
});
```

### Queries
```Typescript
import {Driver} from '.';

const driver = new Driver({});

// Reactive
driver.query('RETURN $foo', {foo: true}).subscribe({
    next: console.log,
    complete: () => driver.shutDown().toPromise(),
    error: (err) => {
        console.error(err);
        
        driver.shutDown().toPromise();
    }
})

// Promise
driver.query('RETURN $foo', {foo: true})
    .toPromise()
    .then(console.log)
    .catch(console.error)
    .finally(() => driver.shutDown().toPromise());
```

### Transactions
Only for 4.X
```Typescript
import {flatMap, reduce, tap} from 'rxjs/operators';

import {Driver, List, Num, Result} from '.';

const driver = new Driver<Result>({});

// Reactive
driver.transaction().pipe(
    flatMap((tx) => tx.query('CREATE (n {foo: $foo}) RETURN n', {foo: true}).pipe(
        reduce((agg, next) => agg.concat(next), List.of<Result>([])),
        tap(() => tx.rollback().toPromise())
    ))
).subscribe({
    next: console.log,
    complete: () => driver.shutDown().toPromise(),
    error: (err) => {
        console.error(err);

        driver.shutDown().toPromise();
    }
});

// Promise
getResults()
    .then(console.log)
    .catch(console.error)
    .finally(() => driver.shutDown().toPromise())

async function getResults()  {
    const tx = await driver.transaction().toPromise();
    const q1 = await tx.query('CREATE (n {foo: $foo}) RETURN n', {foo: true}).toPromise();

    if (q1.data.length.equals(Num.ZERO)) {
        await tx.rollback().toPromise();

        return;
    }

    await tx.commit().toPromise();

    return q1;
}
```

## Routing
Only for 4.X
```TypeScript
import {forkJoin} from 'rxjs';
import {filter, reduce} from 'rxjs/operators';
import _ from 'lodash'

import {Driver, DRIVER_RESULT_TYPE, List, Result} from '.';

const driver = new Driver<Result>({
    useRouting: true,
    maxPoolSize: 10
});

const query = driver.query('RETURN 1', {}).pipe(
    filter(({type}) => type === DRIVER_RESULT_TYPE.RECORD),
    reduce((agg, next) => agg.concat(next), List.of<Result>([]))
);

// Reactive
const result = forkJoin(_.map(Array(10), () => query));

result.subscribe({
    next: console.log,
    complete: () => driver.shutDown().toPromise(),
    error: (err) => {
        console.error(err);

        driver.shutDown().toPromise();
    }
})

// Promise
const result = Promise.all(_.map(Array(10), () => query.toPromise()));

result
    .then(console.log)
    .catch(console.error)
    .finally(() => driver.shutDown().toPromise())
```

## Routing + Transactions
Only for 4.X
```TypeScript
import {filter, reduce} from 'rxjs/operators';

import {DBMS_DB_ROLE, Driver, DRIVER_RESULT_TYPE, List, Result} from '.';

const driver = new Driver<Result>({
    useRouting: true,
    maxPoolSize: 10
});

getResults()
    .then(console.log)
    .catch(console.error)
    .finally(() => driver.shutDown().toPromise())

async function getResults()  {
    // request WRITE transaction for db 'neo4j'
    const tx = await driver.transaction({role: DBMS_DB_ROLE.LEADER, db: 'neo4j'}).toPromise();
    const q1 = await tx.query('CREATE (n {foo: $foo}) RETURN n', {foo: true}).pipe(
       filter(({type}) => type === DRIVER_RESULT_TYPE.RECORD),
       reduce((agg, next) => agg.concat(next), List.of<Result>([]))
   ).toPromise();

    await tx.commit().toPromise();

    return q1;
}
```

## Custom unpackers
Example using a [custom JSON unpacker](./src/packstream/unpacker/json-unpacker.ts), removing all monads from results.
```Typescript
import {reduce} from 'rxjs/operators';

import {Driver, DRIVER_HEADERS, JsonUnpacker} from '.';

const driver = new Driver<any>({
    connectionConfig: {
        unpacker: JsonUnpacker,
        getResponseHeader: (data): DRIVER_HEADERS => data[0] || DRIVER_HEADERS.FAILURE,
        getResponseData: (data): any => data[1] || []
    },
    mapToResult: (headerRecord, type, data) => ({header: headerRecord, type, data})
});

driver.query('MATCH (n) RETURN n')
    .pipe(
        reduce((agg, next) => agg.concat(next), [])
    ).subscribe({
        next: console.log,
        complete: () => driver.shutDown().toPromise(),
        error: (err) => {
            console.error(err);
            
            driver.shutDown().toPromise();
        }
    })
```

## Configuration
```Typescript
import {
    Packer,
    Unpacker,
    DRIVER_HEADERS,
    DRIVER_RESULT_TYPE
} from '.';

export interface IAuthToken {
    scheme: 'basic',
    principal: string,
    credentials: string;
}

export interface IConnectionConfig<Data = any> {
    secure?: true;
    authToken: IAuthToken;
    host: string;
    port: number;
    userAgent: string;
    getResponseHeader?: (unpacked: Data) => DRIVER_HEADERS,
    getResponseData?: (unpacked: Data) => Data,
    packer?: Packer<Data>;
    unpacker?: Unpacker<Data>;
}

export interface IDriverConfig<Rec = any> {
    maxPoolSize: number;
    discoveryIntervalMs: number;
    useRouting?: boolean;
    connectionConfig: Partial<IConnectionConfig>; // @todo: Partial is not correct
    mapToResultHeader: (headerRecord: any) => any;
    mapToResult: (headerRecord: any, type: DRIVER_RESULT_TYPE, data: any) => Rec;
}
```
