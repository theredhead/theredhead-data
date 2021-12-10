/** @format */

import { PartialRecord } from "./../src/data/idbconnection";
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

      const selectByNameAndSurname =
        implementation == "sqlite"
          ? "SELECT rowid as id, * FROM actor WHERE name=? AND surname=?"
          : "SELECT * FROM actor WHERE name=? AND surname=?";
      const johnDoeInTable = await cn.executeSingle(selectByNameAndSurname, [
        "John",
        "Doe",
      ]);

      expect(await cn.executeScalar<number>(countPeopleSql, [])).toBe(
        actorsInANewHope.length
      );

      expect(johnDoeInTable.id).toBe(1);
      expect(johnDoeInTable.name).toBe("John");
      expect(johnDoeInTable.surname).toBe("Doe");
      await cn.delete("actor", johnDoeInTable.id);

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
  });
});
