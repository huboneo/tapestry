import {DBMS_MEMBER_ROLE, Driver, List, Result} from '.';
import {reduce} from 'rxjs/operators';

const driver = new Driver<Result>({
    useRouting: true,
    maxPoolSize: 10,
    connectionConfig: {
        port: 7697
    }
});

// Promise
getResults()
    .then(console.log)
    .catch(console.error)
    .finally(driver.shutDown);

async function getResults() {
    const tx = await driver.transaction({role: DBMS_MEMBER_ROLE.LEADER, db: 'neo4j'}).toPromise();
    const q1 = await tx.query('CREATE (n {foo: $foo}) RETURN n', {foo: true}).pipe(
        reduce((agg, next) => agg.concat(next), List.of<Result>([]))
    ).toPromise();

    await tx.rollback().toPromise();

    return q1;
}
