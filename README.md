# @theredhead/data

## Purpose

This package provides interfaces for use with @theredhead/data-access-mysql and @theredhead/data-access-sqlite

## Features

- Easy to use full featured
- Fully built with typescript
- Optional peer dependencies on [mysql2](https://www.npmjs.com/package/mysql2) and/or [sqlite3](https://www.npmjs.com/package/sqlite3). (only grab the engine you use)


### Some quick examples using FetchRequest fluently through FetchRequestBuilder

```typescript
const db = new SqliteDatabase('starwars.sqlite3');
const carrie = await db.from('actor')
  .where( 'surname = ? AND name = ?', 'Carrie','Fischer')
  .orderBy('surname', 'DESC')
  .fetch();

const mark = await db.from('actor')
  .whereAnd(
    ['surname = ?', 'Hamill'],
    ['name = ?', 'Mark']
  )
  .fetch();

const otiginalTrilogyMainCast = await db.from('actor')
  .whereOr(
    ['name = ?', 'Carrie'],
    ['name = ?', 'Mark']
    ['name = ?', 'Harrison'],
    ['name = ?', 'Peter'],
    ['name = ?', 'Kenny'],
    ['name = ?', 'Anthony'],
  )
  .fetch();
```

The interfaces making this possible:

```typescript

export interface IDbConnection {

  // straight sql execution
  executeScalar<T>(text: string, params: DbParams): Promise<T>;
  executeSingle<T extends PartialRecord>(text: string, params: DbParams): Promise<T>;
  executeArray<T extends Record>(text: string, params: DbParams): Promise<T[]>;
  executeNonQuery(text: string, params: DbParams): Promise<number>;

  // schema inspection
  tableExists(table: string): Promise<boolean>;
  columnExists(table: string, column: string): Promise<boolean>;

  // CRUD
  insert<T extends PartialRecord>(table: string, obj: T): Promise<T>;
  update<T extends Record>(table: string, obj: T): Promise<T>;
  delete<T extends Record>(table: string, id: number): Promise<T>;

  // FetchRequest support
  fetch<T extends Record>(request: FetchRequest): Promise<T[]>;
  from(table: string): FetchRequestBuilder;
}

```

### Connecting to mysql

```typescript
const connection = new MySqlConnection({
  host: "127.0.0.1",
  user: "user",
  password: "password",
  database: "database",
})
```

### Connecting to sqlite:

```typescript
const connection = new SqliteConnection('/path/to/file');
```


### Conventions that avoid problems.
#### For the `insert`, `update` and `delete` methods:

We expect every table to have a unique, numeric identity column. This means that for mysql tables, you must have a rowid column probably declared as `rowid BIGINT NOT NULL UNIQUE AUTO_INCREMENT`. Note that this is for the database, not for the data, so it does not need to be a primary key, but it must be unique. If you don't want it to be named `rowid`, you can set the `rowIdColumn` property on your `MySqlConnection` to something else.

sqlite does not need special consideration. but you will get the rowid column along with your records from `FetchRequest`s and the `insert`/`update` methods.