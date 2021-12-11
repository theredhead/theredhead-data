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
  {
    name: "Alec",
    surname: "Guinness",
    role: "Obi-wan Kenobi",
  },
  {
    name: "Hayden",
    surname: "Christensen",
    role: "Anakin Skywalker",
  },
  {
    name: "Ewan",
    surname: "McGregor",
    role: "Obi-wan Kenobi",
  },
  {
    name: "Daisy",
    surname: "Ridley",
    role: "Rey",
  },
  {
    name: "John",
    surname: "Boyega",
    role: "Finn",
  },
  {
    name: "Adam",
    surname: "Driver",
    role: "Kylo Ren",
  },
  {
    name: "Andy",
    surname: "Serkis",
    role: "Snoke",
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
              rowid int not null primary key auto_increment,
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

    it("can do paging", async () => {
      const pageSize = 5;
      const numberOfPages = Math.ceil(initialListOfActors.length / pageSize);
      for (let pageIx = 0; pageIx < numberOfPages; pageIx++) {
        const page2 = await cn.from(tableName).page(1, 5).fetch();
        expect(page2.length).toBeLessThanOrEqual(pageSize);
      }
    });

    it("includes rowid", async () => {
      const obiwans = await cn
        .from(tableName)
        .where("role = ?", "Obi-wan Kenobi")
        .fetch();
      expect(obiwans.length).toBe(2);
      obiwans.forEach((o) => {
        expect(Object.keys(o)).toContain("rowid");
      });
    });
  });
});
