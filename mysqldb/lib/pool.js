const mysql = require("mysql2/promise");
const dbsecret = require("../config/db.json");

const pool = mysql.createPool(dbsecret);

module.exports = pool;