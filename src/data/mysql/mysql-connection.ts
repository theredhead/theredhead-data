/** @format */

import {
  PartialRecord,
  AbstractDbConnection,
  DbParams,
  Record,
} from "../idbconnection";
import * as mysql2 from "mysql2";

export class MySqlConnection extends AbstractDbConnection {
  private readonly pool: mysql2.Pool;
  constructor(private config: any) {
    super();
    this.pool = mysql2.createPool({
      ...this.config,
      multipleStatements: true,
    });
  }

  private isResultSetHeader(obj: any): boolean {
    if (obj == null) return false;

    const fields = [
      "fieldCount",
      "affectedRows",
      "insertId",
      "info",
      "serverStatus",
      "warningStatus",
    ];
    let matches = 0;
    fields.map((field) => {
      if ((<any>obj).hasOwnProperty(field)) {
        matches++;
      }
    });
    return matches > 2;
  }

  readonly quoteObjectName = (name: string): string =>
    ["`", name, "`"].join("");

  protected async execute<T>(
    text: string,
    params: DbParams = []
  ): Promise<MySqlResult<T>> {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((cnErr, cn) => {
        if (cnErr) {
          reject(cnErr);
        }

        cn.query(text, params, (err, rows, fields) => {
          try {
            if (err) {
              reject(err);
              return;
            }

            const result = <MySqlResult<T>>(<unknown>{
              info: {},
              fields,
              rows: [],
            });

            if (this.isResultSetHeader(rows)) {
              result.info = <any>{ ...rows };
              rows = [];
            } else if (this.isResultSetHeader((<any[]>rows)[0])) {
              result.info = (<any[]>rows).shift();
            }
            if ((<any[]>rows)?.length) {
              result.rows = <any>rows;
            }
            resolve(result);
          } catch (throwable) {
            reject(throwable);
          } finally {
            cn.release();
          }
        });
        // this.pool.releaseConnection(cn);
      });
    });
  }
  release(): void {
    (<any>this.pool) = null;
  }

  async executeScalar<T>(statement: string, args: DbParams = []): Promise<T> {
    const single = await this.executeSingle(statement, args);
    const key = Object.keys(single)[0];
    const scalar = (<any>single)[key];
    return <T>(<unknown>scalar);
  }
  async executeSingle<T extends PartialRecord>(
    text: string,
    params: DbParams = []
  ): Promise<T> {
    const result = await (await this.execute(text, params)).rows;
    if (result.length != 1) {
      throw new Error(`ExecuteSingle got ${result.length} records.`);
    }

    return <T>(<unknown>result[0]);
  }
  async executeArray<T extends Record>(
    text: string,
    params: DbParams = []
  ): Promise<T[]> {
    return (await this.execute<T>(text, params)).rows;
  }
  async executeNonQuery(text: string, params: DbParams): Promise<number> {
    return (await this.execute<any>(text, params)).info?.affectedRows ?? -1;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const count = await this.executeScalar<number>(
      [
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE",
        " TABLE_SCHEMA=DATABASE()",
        " AND TABLE_NAME=?",
      ].join(""),
      [tableName]
    );
    return count === 1;
  }
  async columnExists(table: string, column: string): Promise<boolean> {
    const sql = [
      "SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS WHERE",
      " TABLE_SCHEMA=DATABASE() AND ",
      " TABLE_NAME=? AND ",
      " COLUMN_NAME=?",
    ].join("");
    const count = await this.executeScalar<number>(sql, [table, column]);
    return count === 1;
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

    const insertId = (await this.execute<any>(statement, values)).info
      .insertId!;

    // const insertId = await this.executeScalar<number>(statement, values);
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
}

export interface MySqlResult<T extends PartialRecord> {
  info: {
    fieldCount?: number;
    affectedRows?: number;
    insertId?: number;
    info: any;
    serverStatus: string;
    warningStatus: any;
  };
  fields: mysql2.FieldPacket[];
  rows: T[];
}
