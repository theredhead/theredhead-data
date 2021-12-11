/** @format */

import {
  PartialRecord,
  Record,
  IDbConnection,
} from "./../src/data/idbconnection";
import {} from "./../src/data/idbconnection";
import { SqliteConnection } from "../src/data/sqlite";
import { MySqlConnection } from "../src/data/mysql";

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
      // these should be basically the same date
      const date = await cn.executeScalar<Date>("SELECT CURRENT_TIMESTAMP", []);
      const dateObj = new Date(String(date));
      // this may still fail depending on timezone differences settings.
      // assuming the database is following UTC best-practice though.
      expect(dateObj.getDate()).toBeCloseTo(new Date().getUTCDate());
    });

    it("can perform 100 queries without crashing", async () => {
      for (let i = 0; i < 100; i++) {
        const pages = await cn.executeArray("SELECT 1", []);
        expect(pages.length).toBeGreaterThan(0);
      }
    });

    it("executeNonQuery will throw on invalid sql", async () => {
      let caught = false;
      try {
        await cn.executeNonQuery("this is not valid sql", []);
      } catch (e) {
        console.error(e);
        caught = true;
      }
      expect(caught).toBeTrue();
    });
    it("executeScalar will return null on division by zero", async () => {
      expect(async () => {
        const wrong = await cn.executeScalar("SELECT 1 / ?", [0]);
        expect(wrong).toBeNull();
      }).not.toThrow();
    });

    it("executeScalar will throw on invalid sql", async () => {
      let caught = false;
      try {
        await cn.executeScalar("this is not valid sql", []);
      } catch (e) {
        caught = e != null;
      }
      expect(caught).toBeTrue();
    });
    it("executeSingle will throw on invalid sql", async () => {
      let caught = false;
      try {
        await cn.executeSingle("this is not valid sql", []);
      } catch (e) {
        caught = e != null;
      }
      expect(caught).toBeTrue();
    });
    it("executeArray will throw on invalid sql", async () => {
      let caught = false;
      try {
        await cn.executeArray("this is not valid sql", []);
      } catch (e) {
        caught = e != null;
      }
      expect(caught).toBeTrue();
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

    it("can create a table, perform various CRUD operations on it and drop it.", async () => {
      const createTableSql =
        implementation == "mysql"
          ? `
          CREATE TABLE actor (
            rowid int not null primary key auto_increment,
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

      expect(await cn.columnExists("actor", "name")).toBeTrue();
      expect(await cn.columnExists("actor", "surname")).toBeTrue();

      const actorsInANewHope = [
        {
          name: "John",
          surname: "Doe",
        },
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
      expect(await cn.executeScalar<number>(countPeopleSql, [])).toBe(
        actorsInANewHope.length
      );

      const selectByNameAndSurname =
        implementation == "sqlite"
          ? "SELECT rowid, * FROM actor WHERE name=? AND surname=?"
          : "SELECT * FROM actor WHERE name=? AND surname=?";
      const johnDoeInTable = await cn.executeSingle<Record>(
        selectByNameAndSurname,
        ["John", "Doe"]
      );

      expect(johnDoeInTable.rowid).toBe(1);
      expect(johnDoeInTable.name).toBe("John");
      expect(johnDoeInTable.surname).toBe("Doe");

      // after the gender transition
      johnDoeInTable.name = "Jane";
      await cn.update("actor", johnDoeInTable);
      const janeDoeInTable = await cn.executeSingle<Record>(
        selectByNameAndSurname,
        ["Jane", "Doe"]
      );
      expect(janeDoeInTable.rowid).toBe(1);
      expect(janeDoeInTable.name).toBe("Jane");
      expect(janeDoeInTable.surname).toBe("Doe");

      await cn.delete("actor", janeDoeInTable.rowid);

      expect(await cn.executeScalar<number>(countPeopleSql, [])).toBe(
        actorsInANewHope.length - 1
      );

      const selected = await cn.executeArray<any>("SELECT * FROM actor", []);
      expect(selected.length).toBe(actorsInANewHope.length - 1);

      // bonus...
      const notMarkHamill = await cn
        .from("actor")
        .where("name <> ?", "Mark")
        .where("surname <> ?", "Hamill")
        .orderBy("surname", "ASC")
        .fetch();

      expect(notMarkHamill.length).toBe(actorsInANewHope.length - 2);
      await cn.executeNonQuery("DROP TABLE actor", []);
    });

    it("can tell me that a column doesn't exist", async () => {
      const nope = await cn.columnExists("no_such_table", "no_such_column");
      expect(nope).toBeFalse();
    });
  });
});
