# @theredhead/data

## Purpose

This package provides interfaces for use with @theredhead/data-access-mysql and @theredhead/data-access-sqlite

### basic usage

```typescript

const db = new MySqlDatabase(config);

const data = await db.from('people')
  .where('surname = ?', 'Hamill')
  .where('name = ?', 'Mark')
  .orderBy('surname', 'DESC')
  .fetch();

```

The more interesting bits:

```typescript

export interface IDbConnection {
  executeScalar<T>(text: string, params: DbParams): Promise<T>;
  executeSingle<T extends PartialRecord>(
    text: string,
    params: DbParams
  ): Promise<T>;
  executeArray<T extends Record>(text: string, params: DbParams): Promise<T[]>;
  executeNonQuery(text: string, params: DbParams): Promise<number>;

  tableExists(table: string): Promise<boolean>;
  columnExists(table: string, column: string): Promise<boolean>;

  insert<T extends PartialRecord>(table: string, obj: T): Promise<T>;
  update<T extends Record>(table: string, obj: T): Promise<T>;
  delete<T extends Record>(table: string, id: number): Promise<T>;

  fetch<T extends Record>(request: FetchRequest): Promise<T[]>;
  from(table: string): FetchRequestBuilder;
}

```

Connecting to mysql:

```typescript
const connection = new MySqlConnection({
  host: "127.0.0.1",
  user: "user",
  password: "password",
  database: "database",
})
```

Connecting to sqlite:

```typescript
const connection = new SqliteConnection('/path/to/file');
```
