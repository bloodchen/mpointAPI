var mysql = require("mysql");

const connOption = {
  host: process.env.DBHOST,
  port: process.env.DBPORT,
  user: process.env.DBUSER,
  password: process.env.DBPWD,
  database: process.env.DATABASE
};

var pool = mysql.createPool(connOption);

let getConnection_ = function() {
  return new Promise(function(resolve, reject) {
    pool.getConnection(function(err, connection) {
      if (err) {
        reject(err);
      } else {
        resolve(connection);
        connection.release();
      }
    });
  });
};

var sqlGetAddressByAppUid =
  "SELECT address from key_store where app = ? AND uid = ?";
let getAddressByAppUid = async function(app, uid) {
  connection = await getConnection_();
  return new Promise(function(resolve, reject) {
    var param = [];
    param.push(app);
    param.push(uid);
    connection.query(sqlGetAddressByAppUid, param, function(err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

var sqlInsertKey =
  "INSERT INTO key_store(app, uid, privatekey, publickey, address, ts) VALUES(?,?,?,?,?,?)";
let insertKey = async function(app, uid, privatekey, publickey, address, ts) {
  connection = await getConnection_();
  return new Promise(function(resolve, reject) {
    var param = [];
    param.push(app);
    param.push(uid);
    param.push(privatekey);
    param.push(publickey);
    param.push(address);
    param.push(ts);
    connection.query(sqlInsertKey, param, function(err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getAddressByAppUid = getAddressByAppUid;
exports.insertKey = insertKey;
