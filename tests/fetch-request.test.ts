/** @format */

import { FetchRequest } from "./../src/data/idbconnection";
/** @format */

import { PartialRecord, IDbConnection } from "../src/data/idbconnection";
import { MySqlConnection } from "../src/data/mysql/mysql-connection";
import { SqliteConnection } from "../src/data/sqlite/sqlite-connection";

const initialListOfActors = [
  {
    name: "Mark",
    surname: "Hamill",
    role: "Luke Skywalker",
  },
  {
    name: "Carrie",
    surname: "Fischer",
    role: "Leia Organa",
  },
  {
    name: "Kenny",
    surname: "Baker",
    role: "R2-D2",
  },
  {
    name: "Anthony",
    surname: "Daniels",
    role: "C3PO",
  },
  {
    name: "Peter",
    surname: "Mayhew",
    role: "Chewbacca",
  },
  {
    name: "Harrison",
    surname: "Ford",
    role: "Han Solo",
  },
];

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
  const tableName = "fetchtests";

  describe(`FetchRequest (${implementation})`, () => {
    beforeEach(async () => {
      const createTableSql =
        implementation == "mysql"
          ? `
            CREATE TABLE ${tableName} (
              id int not null primary key auto_increment,
              name varchar(255),
              surname varchar(255),
              role varchar(255)
            )`
          : `
            CREATE TABLE ${tableName} (
              name varchar(255),
              surname varchar(255),
              role varchar(255)
            )`;
      await cn.executeNonQuery(createTableSql, []);

      for (let actor of initialListOfActors) {
        await cn.insert(tableName, actor);
      }
    });
    afterEach(async () => {
      await cn.executeNonQuery(`DROP TABLE ${tableName}`, []);
    });
    it(`can select all rows (${implementation})`, async () => {
      const actors = await cn.from(tableName).fetch();
      expect(actors.length).toBe(initialListOfActors.length);
    });

    it(`requests are basic JSON (${implementation})`, async () => {
      const request: FetchRequest = {
        table: tableName,
        sort: [],
        predicates: [
          {
            type: "OR",
            predicates: [
              {
                text: "name = ?",
                params: ["Mark"],
              },
              {
                text: "name = ?",
                params: ["Carrie"],
              },
            ],
          },
        ],
      };

      const anakinsChildren = await cn.fetch(request);

      expect(anakinsChildren.length).toBe(2);
    });

    it("works with simple builder syntax #1", async () => {
      const childrenAndDroids = await cn
        .from(tableName)
        .whereOr(
          ["role = ?", "Luke Skywalker"],
          ["name = ?", "Carrie"],
          ["role IN(?, ?)", "R2-D2", "C3PO"]
        )
        .fetch();
      expect(childrenAndDroids.length).toBe(4);
    });

    it("works with simple builder syntax #2", async () => {
      const marks = await cn
        .from(tableName)
        .whereAnd(
          ["role = ?", "Luke Skywalker"],
          ["name = ?", "Mark"],
          ["surname = ?", "Hamill"]
        )
        .fetch();
      expect(marks.length).toBe(1);
    });
  });
});
