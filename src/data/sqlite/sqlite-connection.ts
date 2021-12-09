/** @format */

import {
  PartialRecord,
  AbstractDbConnection,
  DbParams,
  FetchRequest,
  Record,
  FetchRequestSQLWriter,
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

  async execure(
    text: string,
    params: DbParams = []
  ): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.cn.run(
        text,
        params,
        (result: sqlite3.RunResult, err: Error | null) => {
          if (err) {
            console.error(err);
            reject(err);
          }
          resolve(result);
        }
      );
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
    return new Promise(async (resolve, reject) => {
      const result = await this.execure(text, params);
      result.get((err, row) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
  async executeArray<T extends Record>(
    text: string,
    params: DbParams
  ): Promise<T[]> {
    return new Promise(async (resolve, reject) => {
      const result = await this.execure(text, params);
      result.all((err, rows) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
  async executeNonQuery(text: string, params: DbParams): Promise<number> {
    const result = await this.execure(text, params);
    return result.changes;
  }
  async tableExists(table: string): Promise<boolean> {
    return this.executeScalar(
      "SELECT COUNT(1) FROM sqlite_master WHERE type=? AND name=?",
      ["table", table]
    );
  }
  async columnExists(table: string, column: string): Promise<boolean> {
    const columns = await this.executeArray("PRAGMA table-info(?)", [table]);
    return columns.find((c) => c["name"] == column) != null;
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

    const statement = `INSERT INTO ${quotedTableName} (${columns}) VALUES (${tokens}); SELECT LAST_INSERT_ID()`;
    const insertId = await this.executeScalar<number>(statement, values);

    const inserted = await this.executeSingle<T>(
      `SELECT * FROM ${quotedTableName} WHERE id=?`,
      [insertId]
    );

    return { id: insertId, ...inserted };
  }
  async update<T extends Record>(table: string, record: Record): Promise<T> {
    const id = record.id;
    const data: PartialRecord = { ...record };
    delete data.id;
    const quotedTableName = this.quoteObjectName(table);
    const snippets = Object.keys(data)
      .map((col) => [this.quoteObjectName(col), "=?"].join(""))
      .join(", ");
    const statement = `UPDATE ${quotedTableName} SET ${snippets} WHERE id=?`;
    await this.executeNonQuery(statement, [...Object.values(data), id]);
    return await this.executeSingle<T>(
      `SELECT * FROM ${quotedTableName} WHERE id=?`,
      [id]
    );
  }
  async delete<T extends Record>(table: string, id: number): Promise<T> {
    const quotedTableName = this.quoteObjectName(table);
    const record = await this.executeSingle<T>(
      `SELECT * FROM ${quotedTableName} WHERE id=?`,
      [id]
    );
    await this.executeNonQuery(`DELETE FROM ${quotedTableName} WHERE id=?`, [
      id,
    ]);
    return record;
  }

  async fetch<T extends Record>(request: FetchRequest): Promise<T[]> {
    const writer = new FetchRequestSQLWriter();
    const command = writer.write(request);
    return await this.executeArray<T>(command.text, command.params);
  }
}
