/** @format */

import { MySqlConnection } from "./../src/data/mysql/mysql-connection";

describe("MySqlConnection", () => {
  it("can select some pages)", async () => {
    const cn = new MySqlConnection({
      host: "127.0.0.1",
      user: "user",
      password: "password",
      database: "database",
    });

    const pages = await cn.executeArray("SELECT * FROM page");

    expect(pages.length).toBeGreaterThan(0);
  });
});
