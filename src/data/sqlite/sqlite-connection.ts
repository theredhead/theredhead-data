/** @format */

import {
  FetchRequest,
  FetchRequestSQLWriter,
  PartialRecord,
  AbstractDbConnection,
  DbParams,
  Record,
} from "../idbconnection";
import * as sqlite3 from "sqlite3";

export class SqliteConnection extends AbstractDbConnection {
  private cn: sqlite3.Database;
  constructor(options: any = ":memory:") {
    super();
    this.cn = new sqlite3.Database(options);
  }

  readonly quoteObjectName = (name: string): string =>
    ["`", name, "`"].join("");

  async query(text: string, params: DbParams = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.cn.serialize(() => {
        const stmt = this.cn.prepare(text, params, function (err) {
          if (err) reject(err);
        });
        stmt.all((err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
    });
  }

  async run(text: string, params: DbParams = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.cn.serialize(() => {
        const stmt = this.cn.prepare(text, params, function (err) {
          // syntax errors
          if (err) reject(err);
        });
        stmt.run(params, function (err) {
          // execution errors
          if (err) reject(err);
          resolve(<sqlite3.RunResult>(<unknown>this));
        });
      });
    });
  }

  async executeScalar<T>(text: string, params: DbParams = []): Promise<T> {
    const row = await this.executeSingle(text, params);
    const key = Object.keys(row)[0];
    return row[key];
  }

  async executeSingle<T extends PartialRecord>(
    text: string,
    params: DbParams
  ): Promise<T> {
    const result = await this.query(text, params);
    return (<T[]>(<unknown>result))[0];
  }
  async executeArray<T extends Record>(
    text: string,
    params: DbParams
  ): Promise<T[]> {
    const result = await this.query(text, params);
    return result;
  }
  async executeNonQuery(text: string, params: DbParams): Promise<number> {
    const result = await this.run(text, params);
    return result?.changes ?? 0;
  }
  async tableExists(table: string): Promise<boolean> {
    const num = await this.executeScalar(
      "SELECT COUNT(1) FROM sqlite_master WHERE type=? AND name=?",
      ["table", table]
    );
    return num == 1;
  }
  async columnExists(table: string, column: string): Promise<boolean> {
    // parameter binding doesn't work wth PRAGMA so to be safe
    // i check to see if the table asked for actually exists, which
    // does use parameter binding
    if (await this.tableExists(table)) {
      const columns = await this.executeArray(
        `PRAGMA table_info(${table})`,
        []
      );
      return columns.find((c) => c["name"] == column) != null;
    }
    return false;
  }
  async insert<T extends PartialRecord>(table: string, record: T): Promise<T> {
    const quotedTableName = this.quoteObjectName(table);
    const data: any = { ...record };
    delete data.id;
    const columns = Object.keys(data).map(this.quoteObjectName).join(", ");
    const tokens = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.keys(data).map((key) => data[key]);

    const statement = `INSERT INTO ${quotedTableName} (${columns}) VALUES (${tokens})`;
    const result = await this.run(statement, values);

    const inserted = await this.executeSingle<T>(
      `SELECT * FROM ${quotedTableName} WHERE rowid=?`,
      [result.lastID]
    );

    return inserted;
  }
  async update<T extends Record>(table: string, record: Record): Promise<T> {
    const id = record.rowid;
    const data: PartialRecord = { ...record };
    delete data.id;
    const quotedTableName = this.quoteObjectName(table);
    const snippets = Object.keys(data)
      .map((col) => [this.quoteObjectName(col), "=?"].join(""))
      .join(", ");
    const statement = `UPDATE ${quotedTableName} SET ${snippets} WHERE rowid=?`;
    await this.executeNonQuery(statement, [...Object.values(data), id]);
    return await this.executeSingle<T>(
      `SELECT * FROM ${quotedTableName} WHERE rowid=?`,
      [id]
    );
  }
  async delete<T extends Record>(table: string, id: number): Promise<T> {
    const quotedTableName = this.quoteObjectName(table);
    const record = await this.executeSingle<T>(
      `SELECT * FROM ${quotedTableName} WHERE rowid=?`,
      [id]
    );
    await this.executeNonQuery(`DELETE FROM ${quotedTableName} WHERE rowid=?`, [
      id,
    ]);
    return record;
  }

  async fetch<T extends Record>(request: FetchRequest): Promise<T[]> {
    const writer = new FetchRequestSQLWriter();
    writer.columns = "rowid, *";
    const command = writer.write(request);
    return await this.executeArray<T>(command.text, command.params);
  }
}
