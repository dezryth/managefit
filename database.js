const Database = require("better-sqlite3");

function getDatabase() {
  try {
    var db = new Database("./fab.db", {
      fileMustExist: true,
      verbose: console.log,
    });
  } catch (error) {
    // File didn't exist. Create Database and tables.
    db = createDatabase();
  }

  return db;
}

function createDatabase() {
  let db = new Database("./fab.db", { verbose: console.log });
  createTables(db);
  return db;
}

function createTables(newdb) {
  try {
    newdb.exec(
      `create table requests (
        id integer primary key autoincrement,
        end_point text not null,
        request_body text not null,
        date_received datetime default current_timestamp);`
    );

    newdb.exec(
      `create table health_data (
        id integer primary key autoincrement,
        date_for datetime unique not null,
        user text not null,
        step_count integer null,
        body_mass_index real null,
        dietary_energy integer default 2000 null,
        physical_effort real null,
        vo2_max real null,
        weight_body_mass real null);`
    );

    newdb.exec(
      `create table goals (
        id integer primary key autoincrement,
        created_date datetime not null,
        start_date datetime null,
        user text not null,
        start_weight real null,
        goal_weight real null,
        completed_date datetime null);`
    );
  } catch (error) {
    console.error("Better SQLite3 Error:", error.message);
  }
}

function execSql(db, command) {
  try {
    const exec = db.exec(command);
  } catch (error) {
    console.error("Better SQLite3 Error:", error.message);
  }
}

async function getHealthDataRow(db, date) {
  let sql = "SELECT * FROM health_data WHERE date_for = ?";

  try {
    const row = await db.prepare(sql).get(date);
    return row ? row.id : null;
  } catch (error) {
    reject(error);
    console.error("Better SQLite3 Error:", error.message);
  }
}

async function insertOrUpdateHealthData(db, healthMetrics) {
  // Insert metrics data into health_data table if data for day doesn't exist, otherwise update.
  const rowId = await getHealthDataRow(db, healthMetrics.date_for);
  if (!rowId) {
    var insertHealthDataCmd = `
    insert into health_data
    (date_for,
    user,
    step_count,
    body_mass_index,
    dietary_energy,
    physical_effort,
    vo2_max,
    weight_body_mass)
    values
    (?, ?, ?, ?, ?, ?, ?, ?)`;

    try {
      const exec = db.prepare(insertHealthDataCmd).run(healthMetrics.date_for, healthMetrics.user, healthMetrics.step_count,
        healthMetrics.body_mass_index, healthMetrics.dietary_energy, healthMetrics.physical_effort,
        healthMetrics.vo2_max, healthMetrics.weight_body_mass);
    } catch (error) {
      console.error("Better SQLite3 Error:", error.message);
    }
    return true;
  }
  else
  {
    updateHealthData(db, rowId, healthMetrics);
    return false;
  }
}

function updateHealthData(db, rowId, healthMetrics)
{
  var updateHealthDataCmd = `
    UPDATE health_data
    SET
      user = ?,
      step_count = ?,
      body_mass_index = ?,
      dietary_energy = ?,
      physical_effort = ?,
      vo2_max = ?,
      weight_body_mass = ?
    WHERE
      id = ?;`;

  try {
    const exec = db.prepare(updateHealthDataCmd).run(healthMetrics.user, healthMetrics.step_count,
      healthMetrics.body_mass_index, healthMetrics.dietary_energy, healthMetrics.physical_effort,
      healthMetrics.vo2_max, healthMetrics.weight_body_mass, rowId);
  } catch (error) {
    console.error("Better SQLite3 Error:", error.message);
  }
}

async function getAveragesThisWeek(db)
{
  let sql = `SELECT AVG(COALESCE(weight_body_mass,` + process.env.AVERAGE_WEIGHT + `)) AS AvgWeight, AVG(step_count) AS AvgStepCount, AVG(COALESCE(dietary_energy, 2200)) AvgCalories,
    AVG(physical_effort) AvgPhysicalEffort FROM health_data WHERE date_for >= ?`;
  let today = new Date();
  let sevenDaysAgoTimeStamp = new Date(today.getTime()- 7 * 24 * 60 * 60 * 1000);
  let sevenDaysAgo = new Date(sevenDaysAgoTimeStamp);
  sevenDaysAgo = sevenDaysAgo.toISOString().split("T")[0];

  let averages = {
    AvgWeight: null,
    AvgStepCount: null,
    AvgCalories: null,
    AvgPhysicalEffort: null,
  }

  try {
    const row = await db.prepare(sql).get(sevenDaysAgo);
    averages.AvgWeight = row.AvgWeight;
    averages.AvgStepCount = row.AvgStepCount;
    averages.AvgCalories = row.AvgCalories;
    averages.AvgPhysicalEffort = row.AvgPhysicalEffort;
    return averages;
  } catch (error) {
    console.error("Better SQLite3 Error:", error.message);
    reject(error);
  }
}

async function getAveragesLastMonth(db) {
  let sql = `SELECT AVG(COALESCE(weight_body_mass,` + process.env.AVERAGE_WEIGHT + `)) AS AvgWeight, AVG(step_count) AS AvgStepCount, AVG(COALESCE(dietary_energy, 2200)) AvgCalories,
  AVG(physical_effort) AvgPhysicalEffort FROM health_data WHERE date_for >= ?`;
  let today = new Date();
  let monthAgoTimeStamp = new Date(today.setMonth(today.getMonth() - 1));
  let monthAgo = new Date(monthAgoTimeStamp);
  monthAgo = monthAgo.toISOString().split("T")[0];

  let averages = {
    AvgWeight: null,
    AvgStepCount: null,
    AvgCalories: null,
    AvgPhysicalEffort: null,
  }

  try {
    const row = await db.prepare(sql).get(monthAgo);
    averages.AvgWeight = row.AvgWeight;
    averages.AvgStepCount = row.AvgStepCount;
    averages.AvgCalories = row.AvgCalories;
    averages.AvgPhysicalEffort = row.AvgPhysicalEffort;
    return averages;
  } catch (error) {
    console.error("Better SQLite3 Error:", error.message);
    reject(error);
  }
}

async function getCurrentGoal(db)
{
  let sql = `SELECT start_date, start_weight, goal_weight FROM goals WHERE completed_date IS NULL ORDER BY id ASC LIMIT 1`;
  let goal = {
    StartDate: null,
    StartWeight: null,
    GoalWeight: null,
  }

  try {
    const row = await db.prepare(sql).get();
    goal.StartDate = row.start_date;
    goal.StartWeight = row.start_weight;
    goal.GoalWeight = row.goal_weight;
    return goal;
  } catch (error) {
    console.error("Better SQLite3 Error:", error.message);
    reject(error);
  }
}

function completeGoal(db, completeDate)
{
  var completeGoalCmd = `
    UPDATE goals
    SET
      completed_date = ?
    WHERE
    completed_date IS NULL ORDER BY id ASC LIMIT 1;`;

  try {
    const exec = db.prepare(completeGoalCmd).run(completeDate);
  } catch (error) {
    console.error("Better SQLite3 Error:", error.message);
  }
}

async function validateNewData(db, date_for, end_point)
{
  let sql = `SELECT COUNT(*) NumRows FROM requests WHERE date_received >= ? AND end_point = ?`;
  try {
    const row = await db.prepare(sql).get(new Date(date_for).toISOString(), end_point);
    var numRows = row.NumRows;
    console.log(end_point, numRows, date_for);

    if (numRows > 0)
    {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Better SQLite3 Error:", error.message);
    reject(error);
  }
}

module.exports = {
  getDatabase,
  createDatabase,
  createTables,
  execSql,
  getHealthDataRow,
  insertOrUpdateHealthData,
  getAveragesThisWeek,
  getAveragesLastMonth,
  getCurrentGoal,
  completeGoal,
  validateNewData
};
