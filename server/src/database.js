const sqlite = require('better-sqlite3');
const path = require('path');
const db = new sqlite(path.resolve('db.sqlite3'), {fileMustExist: true});

function query(sql) {
  return db.prepare(sql).all();
}

function queryGet(sql, arrValues) {
  return db.prepare(sql).get(...arrValues);
}

function queryRun(sql, arrValues) {
  return db.prepare(sql).run(...arrValues);
}

module.exports = {
  query,
  queryRun,
  queryGet,
  db
}
