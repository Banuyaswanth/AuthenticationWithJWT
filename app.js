const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

//Connecting the DB and starting the server
const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at http://localhost:3000/");
    });
  } catch (err) {
    console.log(`DB Error: ${err.message}`);
    process.exit(1);
  }
};

initializeDBandServer();

//API 1
app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  let payload = { username: username };
  const getUserDetailsQuery = `SELECT * FROM USER
    WHERE username = '${username}';`;
  let dbUser = await db.get(getUserDetailsQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      let jwtToken = jwt.sign(payload, "My_secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authentication with Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  let authHeaders = request.headers["authorization"];
  console.log(authHeaders);
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_secret_key", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT 
  state_id as stateId,
  state_name as stateName,
  population as population
  FROM
  state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray);
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  let { stateId } = request.params;
  const getStateQuery = `SELECT 
  state_id as stateId,
  state_name as stateName,
  population as population
  FROM state
  WHERE state_id = ${stateId};`;
  let stateDetails = await db.get(getStateQuery);
  response.send(stateDetails);
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;
  const insertDistrictQuery = `INSERT INTO district
    (district_name,state_id,cases,cured,active,deaths)
    VALUES
    ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`;
  await db.run(insertDistrictQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT 
    district_id as districtId,
    district_name as districtName,
    state_id as stateId,
    cases as cases,
    cured as cured,
    active as active,
    deaths as deaths 
    FROM district
    WHERE district_id = ${districtId};`;
    let districtDetails = await db.get(getDistrictQuery);
    response.send(districtDetails);
  }
);

//API 6
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district
    WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    let { districtName, stateId, cases, cured, active, deaths } = request.body;
    const updateDistrictQuery = `UPDATE district 
    SET district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    let { stateId } = request.params;
    const getStateStatsQuery = `SELECT 
    sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths 
    FROM state natural join district
    WHERE state.state_id = ${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send(stats);
  }
);

module.exports = app;
