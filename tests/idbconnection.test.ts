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
  sqlite: new SqliteConnection(),
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
  });
});
