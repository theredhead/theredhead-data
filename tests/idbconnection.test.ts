/** @format */

import {
  AbstractDbConnection,
  PartialRecord,
} from "./../src/data/idbconnection";
import { IDbConnection } from "./../src/data/idbconnection";
import { SqliteConnection } from "./../src/data/sqlite/sqlite-connection";
import { MySqlConnection } from "./../src/data/mysql/mysql-connection";

const implementations: PartialRecord = {
  mysql: new MySqlConnection({
    host: "127.0.0.1",
    user: "user",
    password: "password",
    database: "database",
  }),
  sqlite: new SqliteConnection(":memory:"),
};

Object.keys(implementations).forEach((implementation) => {
  const cn: IDbConnection = implementations[implementation];

  describe(`The ${implementation} implementation IDbConnection`, () => {
    it("can select the current date", async () => {
      const date = await cn.executeScalar<Date>("SELECT CURRENT_TIMESTAMP", []);
      // mysql actually selects a Date, sqlite doesn't...
      const dateObj = new Date(String(date));

      expect(dateObj.getUTCDate()).toBeCloseTo(new Date().getUTCDate());
    });

    it("can perform 100 queries without crashing", async () => {
      for (let i = 0; i < 100; i++) {
        const pages = await cn.executeArray("SELECT 1", []);
        expect(pages.length).toBeGreaterThan(0);
      }
    });

    it("can create and drop a table", async () => {
      const createTableSql = "CREATE TABLE test (id int not null)";
      const dropTableSql = "DROP TABLE test";

      const beforeCreateTable = await cn.tableExists("test");
      await cn.executeNonQuery(createTableSql, []);
      const afterCreateTable = await cn.tableExists("test");
      await cn.executeNonQuery(dropTableSql, []);
      const afterDropTable = await cn.tableExists("test");

      expect(beforeCreateTable).toBeFalse();
      expect(afterCreateTable).toBeTrue();
      expect(afterDropTable).toBeFalse();
    });

    it("can create a table, insert into it, select from it, and perform fetch requests on it.", async () => {
      const createTableSql =
        implementation == "mysql"
          ? `
          CREATE TABLE actor (
            id int not null primary key auto_increment,
            name varchar(255),
            surname varchar(255)
          )`
          : `
          CREATE TABLE actor (
            name varchar(255),
            surname varchar(255)
          )`;
      const countPeopleSql = "SELECT COUNT(*) FROM actor";

      await cn.executeNonQuery(createTableSql, []);

      const actorsInANewHope = [
        {
          name: "Mark",
          surname: "Hamill",
        },
        {
          name: "Carrie",
          surname: "Fischer",
        },
        {
          name: "Kenny",
          surname: "Baker",
        },
        {
          name: "Anthony",
          surname: "Daniels",
        },
        {
          name: "Peter",
          surname: "Mayhew",
        },
        {
          name: "Harrison",
          surname: "Ford",
        },
      ];

      for (let actor of actorsInANewHope) {
        await cn.insert("actor", actor);
      }

      const count = await cn.executeScalar<number>(countPeopleSql, []);
      expect(count).toBe(actorsInANewHope.length);

      const selected = await cn.executeArray<any>("SELECT * FROM actor", []);
      expect(selected.length).toBe(actorsInANewHope.length);

      // bonus...
      const notMarkHamill = await (<AbstractDbConnection>cn)
        .from("actor")
        .where("name <> ?", ["Mark"])
        .where("surname <> ?", ["Hamill"])
        .orderBy("surname", "ASC")
        .fetch();

      expect(notMarkHamill.length).toBe(actorsInANewHope.length - 1);
      await cn.executeNonQuery("DROP TABLE actor", []);
    });
  });
});
