/** @format */

import { MySqlConnection } from "./../src/data/mysql";

describe("MySqlConnection", () => {
  it("Throws when trying to connect to a non-existing server", async () => {
    const cn = new MySqlConnection({
      host: "no-such-host.local",
      user: "user",
      password: "password",
      database: "database",
      connectTimeout: 500,
    });

    let caught = false;
    try {
      const timestampFromNonExistingServer = await cn.executeScalar(
        "SELECT CURRENT_TIMESTAMP"
      );
      console.log({ timestampFromNonExistingServer });
    } catch (e) {
      caught = e != null;
    }
    expect(caught).toBe(true);
  });
});
