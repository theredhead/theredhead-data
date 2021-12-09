/** @format */

import { MySqlConnection } from "../src/data/mysql/mysql-connection";

const cn = new MySqlConnection({
  host: "127.0.0.1",
  user: "user",
  password: "password",
  database: "database",
});

describe("MySqlConnection", () => {
  it("can select some pages a thousand times over", async () => {
    for (let i = 0; i < 1000; i++) {
      const pages = await cn.executeArray("SELECT * FROM page");
      expect(pages.length).toBeGreaterThan(0);
    }
  });

  describe("selecting current_timestamp", () => {
    it("is a Date object", async () => {
      const now = await cn.executeScalar<Date>("SELECT CURRENT_TIMESTAMP()");
      console.log(now);
      expect(now).toBeInstanceOf(Date);
    });
  });
});
