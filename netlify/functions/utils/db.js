/**
 * pg DATE type parser fix.
 * 
 * By default, node-pg parses DATE columns into JavaScript Date objects
 * using the process timezone. When JSON.stringify serializes these Date
 * objects, they become UTC ISO strings — which can shift dates by one day
 * if the process timezone isn't UTC.
 * 
 * This override returns DATE values as plain "YYYY-MM-DD" strings,
 * eliminating all timezone conversion issues.
 */
const { types } = require('pg');

// OID 1082 = DATE type in PostgreSQL
types.setTypeParser(1082, (val) => val);
