/** @format */

export type PartialRecord = { [name: string]: any };
export type Record = { id: number | string; [name: string]: any };
export type DbParams = PartialRecord | any[];

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
}

export abstract class AbstractDbConnection implements IDbConnection {
  abstract executeScalar<T>(text: string, params: DbParams): Promise<T>;
  abstract executeSingle<T extends PartialRecord>(
    text: string,
    params: DbParams
  ): Promise<T>;
  abstract executeArray<T extends Record>(
    text: string,
    params: DbParams
  ): Promise<T[]>;
  abstract executeNonQuery(text: string, params: DbParams): Promise<number>;

  abstract tableExists(table: string): Promise<boolean>;
  abstract columnExists(table: string, column: string): Promise<boolean>;

  abstract insert<T extends PartialRecord>(table: string, obj: T): Promise<T>;
  abstract update<T extends Record>(table: string, obj: T): Promise<T>;
  abstract delete<T extends Record>(table: string, id: number): Promise<T>;

  abstract fetch<T extends Record>(request: FetchRequest): Promise<T[]>;

  from(table: string): FetchRequestBuilder {
    return new FetchRequestBuilder(this, table);
  }
}

export interface FetchRequest {
  table: string;
  predicates: FetchPredicte;
  sort: Sort;
}

export interface FetchSimplePredicteClause {
  text: string;
  params: any[];
}

export interface FetchCompoundPredicteClause {
  type: "AND" | "OR";
  predicates: FetchPredicte;
}

export type FetchPredicteClause =
  | FetchSimplePredicteClause
  | FetchCompoundPredicteClause;

export type FetchPredicte = FetchPredicteClause[];

export type Sort = SortClause[];

export interface SortClause {
  column: string;
  direction: "ASC" | "DESC";
}

export class FetchRequestBuilder implements FetchRequest {
  table: string;
  predicates: FetchPredicte = [];
  sort: Sort = [];

  constructor(private connection: IDbConnection, table: string) {
    this.table = table;
  }

  where(text: string, params: any[] = []) {
    this.predicates.push({
      text,
      params,
    });
    return this;
  }
  orderBy(column: string, direction: "ASC" | "DESC") {
    this.sort.push({
      column,
      direction,
    });
    return this;
  }
  fetch(): Promise<Record[]> {
    return this.connection.fetch(this);
  }
}

// const db: AbstractDbConnection = <AbstractDbConnection>{};
// db.from("users").where("name = ?", ["Harry"]).orderBy("age", "DESC").fetch();

export type FetchCommand = { text: string; params: any[] };

export class FetchRequestSQLWriter {
  write(request: FetchRequest): FetchCommand {
    const params: any[] = [];
    const text = [
      "SELECT * ",
      "FROM " + request.table,
      request.predicates.length > 0 ? "WHERE" : null,
      request.predicates
        .map((p) => this.expandPredicate(p, params))
        .join(" AND "),
      request.sort.length > 0 ? this.expandSort(request.sort) : null,
    ]
      .filter((o) => o != null)
      .join("\n");

    return { text, params };
  }
  expandPredicate(clause: FetchPredicteClause, params: any[]): string {
    if (clause.hasOwnProperty("type")) {
      return this.expandCompoundPredicateClause(
        <FetchCompoundPredicteClause>clause,
        params
      );
    } else {
      return this.expandSimplePredicateClause(
        <FetchSimplePredicteClause>clause,
        params
      );
    }
  }
  expandSimplePredicateClause(
    clause: FetchSimplePredicteClause,
    params: any[]
  ): string {
    params.push(clause.params);
    return `(${clause.text})`;
  }
  expandCompoundPredicateClause(
    clause: FetchCompoundPredicteClause,
    params: any[]
  ): string {
    return [
      "(",
      clause.predicates
        .map((p) => this.expandPredicate(p, params))
        .join(` ${clause.type} `),
      ")",
    ].join("");
  }
  expandSort(sort: Sort): string {
    return [
      "ORDER BY ",
      sort.map((clause) => `${clause.column} ${clause.direction}`).join(", "),
    ].join("");
  }
}
