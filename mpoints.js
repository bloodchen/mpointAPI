"use strict";

const process = require("process");
const nbpay = require("nbpay");
const bsv = nbpay.bsv;
const axios = require("axios");
const fs = require("fs");
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const url = require("url");
const es = require("event-stream");
const db = require("./db");
const crypt = require("./txtCrypt.js");

const SQDB = require("better-sqlite3-helper");
const { SensibleFT, API_NET, API_TARGET, SensibleApi, Wallet } = require("sensible-sdk");

const Hot_privateKey = process.env.hotkey1
  ? crypt.decode(process.env.hotkey1, ": P=4m+c$MZmWQxYjr")
  : null;
const PATH_ADDRESS = "/v1/address"; //?%address=%addr
const PATH_TOPUP = "/v1/topup";
const PATH_TX_LOOKUP = "/v1/tx/lookup";
const PATH_TX_ALL = "/v1/tx/all";
const PATH_TX_MAIN = "/v1/tx/main";
const PATH_TX_DEL = "/v1/tx/del";
const PATH_TX_SET = "/v1/tx/set_detail";

//util API, used as utilities, not part of mpoints system
const PATH_UTIL_PAY = "/v1/util/pay"; // pay to address using hot wallet
const PATH_UTIL_DATAPAY = "/v1/util/datapay"; // pay using hot wallet, using nbpay format
const PATH_UTIL_DECODE = "/v1/util/decode"; // decode rawtx

const PROTOCOL_ID = "173ZfY97y7NjbZ2kA3syjStCcDNAxbvVD8";

const ERROR_NO = 0;
const ERROR_TOOSMALL = 1;
const ERROR_PAY = 2;

nbpay.auto_config();

//获取访问id
function getClientIp(req) {
  const IP =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
  return IP.split(",")[0];
}
if (!fs.existsSync("logg")) {
  fs.mkdirSync("logg");
}
var logStream = fs.createWriteStream("logg/loggs.txt", { flags: "a" });
// use {flags: 'a'} to append and {flags: 'w'} to erase and write a new file

function log(...args) {
  let today = new Date();
  let time = today.getDay() + ":" + today.getHours() + ":" + today.getMinutes();
  let str = `[${time}] `;
  for (let key of args) {
    if (typeof key === "object" && key !== null) {
      str += JSON.stringify(key) + " ";
    } else str += key + " ";
  }
  logStream.write(str + "\n");
  console.log(...args);
}
let ignoreDetail = false;
class mPoints {
  constructor(appID = "mpoints") {
    this.appID = appID;
    this.dbPath = __dirname + "/data/txdb.db";
  }

  start(port) {
    const app = express()
    const self = this;
    app.use(cors());
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: false, parameterLimit: 50000 }));

    app.get(PATH_ADDRESS, async (req, res) => {
      console.log("calling:",PATH_ADDRESS,"query:",req.query)
      var data = await mPoints.getAddressInfo(req.query.address);
      res.json(data);
    })
    app.get(PATH_TOPUP, async (req, res) => {
      console.log("calling:",PATH_TOPUP,"query:",req.query)
      const query = req.query;
      var data = await this.topUpAddress(
        query.address,
        Number(query.amount)
      );
      res.json(data);
    })
    app.get(PATH_TX_LOOKUP, (req, res) => {
      console.log("calling:",PATH_TX_LOOKUP,"query:",req.query)
      var data = this.getTransaction(query.txid);
      res.json(data);
    })
    app.get(PATH_TX_ALL, async (req, res) => {
      console.log("calling:",PATH_TX_ALL,"query:",req.query)
      var data = await this.getAllTX({
        address: req.query.address,
        num: Number(req.query.num),
        sort: Number(req.query.sort),
        start: Number(req.query.start),
        end: Number(req.query.end),
        skip: Number(req.query.skip)
      });
      res.json(data);
    })
    app.get(PATH_TX_MAIN, async (req, res) => {
      console.log("calling:",PATH_TX_MAIN,"query:",req.query)
      ignoreDetail = true;
      var data = await this.getAllTX({
        address: req.query.address,
        num: Number(req.query.num),
        sort: Number(req.query.sort),
        start: Number(req.query.start),
        end: Number(req.query.end),
        skip: Number(req.query.skip)
      });
      ignoreDetail = false;
      res.json(data)
    })
    app.get(PATH_UTIL_PAY, async (req, res) => {
      console.log("calling:",PATH_UTIL_PAY,"query:",req.query)
      const IP = getClientIp(req);
      const query = req.query;
      console.log("IP:", IP);
      var data = await this.util_payAddress(
        query.address,
        query.amount,
        query.appdata,
        query.comments,
        query.appid
      );
      res.json(data);
    })
    app.get(PATH_TX_DEL, (req, res) => {
      console.log("calling:",PATH_TX_DEL,"query:",req.query)
      var data = this.delTransaction(req.query.txid);
      res.json(data);
    })
    app.post(PATH_TX_SET, (req, res) => {
      console.log("calling:",PATH_TX_DEL,"body:",req.body)
      let ret = this.setTxData(req.body, true);
      if (ret) res.end("success");
      else res.end("error, no txid");
    })
    app.post(PATH_UTIL_DATAPAY, async (req, res) => {
      console.log("calling:",PATH_TX_DEL,"body:",req.body)
      var data = await this.util_dataPay(req.body);
      res.json(data);
    })
    app.post(PATH_UTIL_DECODE, (req, res) => {
      console.log("calling:",PATH_UTIL_DECODE,"body:",req.body)
      const obj = req.body
      const rawtx = obj.rawtx;
      if(!rawtx){
        res.end("No rawtx")
        return;
      }
      const tx = bsv.Transaction(rawtx);
      let txData = tx.toJSON();
      txData.inputs.forEach(inp => {
        const sc = new bsv.Script.fromString(inp.script);
        inp.address = sc.toAddress().toString();
      });

      txData.outputs.forEach(out => {
        const sc = new bsv.Script.fromString(out.script);
        out.address = sc.toAddress().toString();
      });
      res.json(txData);
    })


    process.on("SIGINT", function () {
      console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
      // some other closing procedures go here

      process.exit();
    });
    app.listen(port, async function () {
      console.log(`mpointAPI server started on port:`, port);

    })

  }
  static async getAddressInfo_from_mtc_(address) {
      if(!address) return null;
      try {
        const url =
          "https://api.mattercloud.net/api/v3/main/address/" +
          address +
          "/balance";
        const response = await axios.get(url);
        //console.log(response);
        const obj = {
          balance: response.confirmed + response.unconfirmed
        };
        return obj;
      } catch(err) {
        console.log(err);
        return null;
      }
    }
  static async getAddressInfo_from_woc_(address) {
      if(!address) return null;
      try {
        const url =
          "https://api.whatsonchain.com/v1/bsv/main/address/" +
          address +
          "/balance";
        const response = await axios.get(url);
        //console.log(response);
        const obj = {
          balance: response.data.confirmed + response.data.unconfirmed
        };
        return obj;
      } catch(err) {
        console.log(err);
        return null;
      }
    }

  static async getAddressInfo(address) {
      var obj = await this.getAddressInfo_from_woc_(address);
      if(obj != null) return obj;
    obj = await this.getAddressInfo_from_mtc_(address);
    if (obj != null) return obj;
    return null;
  }
  setTxData(obj, isDetail) {
    console.log("setTxData");
    //console.log(obj);
    //console.log(obj);
    if (obj.txid == undefined) return false;
    const db = new SQDB({ path: this.dbPath, migrate: false });
    try {
      const txid = obj.txid;
      if (isDetail) delete obj.txid;
      let row = db.queryFirstRow("SELECT * FROM tx WHERE txid=?", txid);
      let updateObj = isDetail
        ? { detail: JSON.stringify(obj) }
        : { main: JSON.stringify(obj) };
      //console.log(updateObj);

      if (row) {
        if (row.main && isDetail) updateObj.main = row.main;
        if (row.detail && !isDetail) updateObj.detail = row.detail;
        //console.log("update-----------");
        //console.log(updateObj);
        db.update("tx", updateObj, { txid: txid });
      } else {
        updateObj.txid = txid;
        //console.log("insert----------");
        //console.log(updateObj);
        db.insert("tx", updateObj);
      }
    } catch (e) {
    } finally {
      db.close();
    }

    return true;
  }
  delTransaction(txid) {
    const db = new SQDB({ path: this.dbPath, migrate: false });
    db.delete("tx", { txid: txid });
    db.close();
    return "OK";
  }
  getTransaction(tx) {
    const db = new SQDB({ path: this.dbPath, migrate: false });
    let row = db.queryFirstRow("SELECT * FROM tx WHERE txid=?", tx);
    db.close();
    if (row) {
      let ret = {};
      //console.log(row);
      const main = JSON.parse(row.main);
      if (main) ret.tx = main;
      if (row.detail) {
        const detail = JSON.parse(row.detail);
        ret.detail = detail;
      }
      console.log(ret);
      return ret;
    }
  }
  getTxData(txid) {
    const db = new SQDB({ path: this.dbPath, migrate: false });
    let row = db.queryFirstRow("SELECT * FROM tx WHERE txid=?", txid);
    db.close();
    if (row) {
      let ret = {};
      //console.log(row);
      const main = JSON.parse(row.main);
      if (main) {
        ret.tx = main;
        if (!ret.tx.txid) ret.tx.txid = txid;
      }
      if (row.detail && !ignoreDetail) {
        const detail = JSON.parse(row.detail);
        ret.detail = detail;
      }
      //console.log(ret);
      return ret;
    }
    return null;
  }
  
  async getOutputFromInput(input) {
    const txid = input.h;
    const pos = input.i;
    const query = {
      q: {
        find: { "tx.h": txid },
        project: { "out.e": 1 }
      }
    };
    let items = await this.getAllRawRecords(query, true);
    if (items.length == 0) {
      items = await this.getAllRawRecords(query, false);
    }
    if (items.length == 0 || !items[0].out) {
      console.log("getOutputFromInput:failed to get utxo of txid:", txid);
      return null;
    }
    return items[0].out[pos];
  }
  async buildOutputItem(tx) {
    //console.log(tx);
    let item = { amount: 0 };
    item.c = tx.c;
    item.type = tx.type;
    item.txid = tx.tx.h;
    item.fee = tx.fee;
    item._out = [];
    item._in = [];
    //item.from = tx.in[0].e.a;
    tx.in.some(inp => {
      if (inp.e.a != "false") {
        item.from = inp.e.a;
        return true;
      }
      return false;
    });
    if (tx.blk != undefined) {
      item.ts = tx.blk.t;
      item.block = tx.blk.i;
    }
    if (tx.timestamp != undefined) {
      item.ts = Math.trunc(tx.timestamp / 1000);
    }

    //console.log(item.amount);
    let totalOutFee = 0,
      totalInFee = 0;
    for (let i = 0; i < tx.in.length; i++) {
      let inn = tx.in[i];
      const out = await this.getOutputFromInput(inn.e);
      if (out&&out.e) {
        item._in.push({ a: out.e.a, v: out.e.v });
        //console.log(out);
        totalInFee += out.e.v;
      }
    }
    for (let i = 0; i < tx.out.length; i++) {
      let o = tx.out[i];
      if(o.e){
        item._out.push({ a: o.e.a, v: o.e.v });
        totalOutFee += o.e.v;
      }
    }
    item.fee = totalInFee - totalOutFee;
    return item;
  }
  calcItem(item, address) {
    let tx = item.tx;
    if (!tx._in || !tx._out) return;
    tx.to = [];
    tx.amount = 0;
    let spend = false;
    tx._in.forEach(ins => {
      if (ins.a == address) {
        spend = true;
      }
    });
    if (spend) {
      tx.type = "spend";
      tx._in.forEach(ins => {
        if (ins.a == address) {
          tx.amount += ins.v;
        }
      });
      tx._out.forEach(out => {
        if (out.a == address) {
          tx.amount -= out.v;
        }
        tx.to.push(out);
      });
    } else {
      tx.type = "income";

      tx._out.forEach(out => {
        if (out.a == address) {
          tx.amount += out.v;
        }
        tx.to.push(out);
      });
      //tx.to.push({a:address,v:tx.amount});
    }
    //console.log(tx);
    delete tx._in;
    delete tx._out;
  }
  async _handleItems(all, address, forceWrite = false) {
    let allItems = [];
    for (let i = 0; i < all.length; i++) {
      let tx = all[i];
      //console.log(tx);
      let data = this.getTxData(tx.tx.h);
      if (data && data.tx && !forceWrite) {
        //console.log("found record");
        //console.log(data);
        this.calcItem(data, address);
        allItems.push(data);
        continue;
      }

      let item = await this.buildOutputItem(tx);
      if (item) {
        item.txid = tx.tx.h;
        this.setTxData(item, false);
        let i = { tx: item };
        if (data && data.detail) i.detail = data.detail;
        this.calcItem(i, address);
        allItems.push(i);
      }
    }
    return allItems;
  }
  async getAllTX({ address, num, sort, start, end, skip }) {
    if(!address)return null;

    address = address.trim();
    if (!address) return null;
    if (isNaN(num)) num = 100;
    if (isNaN(sort)) sort = -1;
    if (isNaN(start)) start = 0;
    if (isNaN(end)) end = 0;
    if (isNaN(skip)) skip = 0;
    let forceWrite = false;
    if (sort == 2) {
      sort = -1;
      forceWrite = true;
    }
    const query = {
      q: {
        find: {
          $or: [{ "in.e.a": address }, { "out.e.a": address }]
        },
        sort: { "blk.i": sort },
        project: {
          "tx.h": 1,
          "in.e": 1,
          "out.e": 1,
          timestamp: 1,
          blk: 1
        },
        limit: num,
        skip: skip
      }
    };
    if (start || end) {
      query.q.find["blk.i"] = {};
    }
    if (start != 0) {
      query.q.find["blk.i"]["$gt"] = start;
    }
    if (end != 0) {
      query.q.find["blk.i"]["$lt"] = end;
    }
    //console.log(query);
    const allc = await this.getAllRawRecords(query, true);
    //console.log("raw length=" + allc);
    let allc_ = await this._handleItems(allc, address, forceWrite);
    //console.log(allc_);

    const allu = await this.getAllRawRecords(query, false);
    //console.log("unconfirmed raw=" + allu);
    let allu_ = await this._handleItems(allu, address, forceWrite);

    let all = {
      c: allc_,
      u: allu_
    };
    return all;
  }
  async getAllRawRecords(query, isConfirm = true, skiptx = "") {
    let url = "https://txo.bitbus.network/block";
    if (!isConfirm) {
      url = "https://txo.bitsocket.network/crawl";
      query.q.limit = 1;
      query.q.sort = { "blk.i": -1 };
      query.q.find["blk.i"] = { $gt: 609000 };
      let items = await this.getAllRawRecords(query, true);
      //console.log("length----" + items.length);
      if (items.length != 0) skiptx = items[0].tx.h;
      query.q.sort = { timestamp: -1 };
      query.q.limit = 1000;
      delete query.q.find["blk.i"];
      query.q.find["timestamp"] = {
        $gt: Date.now() - 100000 * 36 //got unconfirmed tx in one hour
      };
      //console.log(query);
    }
    let skip = false;
    let res = await axios.post(url, JSON.stringify(query), {
      headers: {
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json; charset=utf-8",
        token:
          "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJzdWIiOiIxQzc5M0RkVjI0Q3NORTJFUDZNbVZmckhqVlNGVmc2dU4iLCJpc3N1ZXIiOiJnZW5lcmljLWJpdGF1dGgifQ.SUJlYUc2TGNGdFlZaGk3amxwa3ZoRGZJUEpFcGhObWhpdVNqNXVBbkxORTdLMWRkaGNESC81SWJmM2J1N0V5SzFuakpKTWFPNXBTcVJlb0ZHRm5uSi9VPQ"
      },
      responseType: "stream" // important
    });
    let items = [];
    return new Promise(function (resolve, reject) {
      res.data.on("end", function () {
        //console.log("end of stream");
        resolve(items);
        return;
      });
      res.data.pipe(es.split()).pipe(
        es.map((data, callback) => {
          if (data) {
            let d = JSON.parse(data);

            if (skiptx == d.tx.h) {
              console.log("found:" + skiptx);
              skip = true;
            }
            if (skip == false) items.push(d);
            //if(isConfirm==false)
            //console.log(d);
          }
        })
      );
    });
  }

  /**
   * @param  {} obj.data : data passed to OP_RETURN
   *            obj.address: send to address
   *            obj.amount: amount of sat
   */
  generateConfig(obj) {
    var config = {
      safe: true,
      data: obj.data, //[PROTOCOL_ID,this.appID,{rtx:"this"},{comments:comments}],
      pay: {
        key: Hot_privateKey,
        feeb: 0.5,
        to: [
          {
            address: obj.address,
            value: obj.amount
          }
        ]
      }
    };
    if (typeof obj.privateKey !== "undefined") config.pay.key = obj.privateKey;
    return config;
  }
  async util_dataPay(data) {
        const jsData = data; //JSON.parse(data);
        let payKey = "";
        if (jsData.key) {
          const buf = Buffer.from(jsData.key, "base64");
          payKey = buf.toString();
          console.log(payKey);
        } else {
          payKey = Hot_privateKey;
        }
        if (jsData.appid && jsData.appid == "mmgrid") {
          payKey = crypt.decode(process.env.mmkey, ": P=4==m+c$MZmWQxYjr");
        }
        const config = {
          pay: {
            key: bsv.PrivateKey.fromWIF(payKey),
            to: jsData.to,
            feeb: 0.5
          }
        };
        //console.log(config);
        const res = await nbpay.send(config);
        return {code:res.err?-1:0,message:res.err}
    
  }
  async util_payAddress(address, amount, appdata, comments, appid) {
    if (address == "" || address == null || amount == null) return null;
    let payKey = Hot_privateKey;
    if (appid == "mmgrid") {
      payKey = crypt.decode(process.env.mmkey, ": P=4==m+c$MZmWQxYjr");
    }
    console.log(payKey)
    var payObj = {
      privateKey: payKey,
      address: address,
      amount: amount,
      appdata: appdata,
      comments: comments
    };
    console.log("payObj:", payObj);
    return await this.payUsingKey_(payObj);
  }
  /**
   * @param  {} address: address to topup
   * @param  {} amount: number of sat
   * @param  {} comments=""
   */
  async topUpAddress(address, amount, appdata = "", comments = "") {
    var payObj = {
      privateKey: Hot_privateKey,
      address: address,
      amount: amount,
      appdata: appdata,
      comments: comments
    };
    return await this.payUsingKey_(payObj);
  }

  async payUsingKey_(payObj) {
    
      var privateKey = payObj.privateKey,
        address = payObj.address,
        amount = parseInt(payObj.amount, 10),
        appdata = payObj.appdata,
        comments = payObj.comments,
        appid = payObj.appid;
      var pKey = bsv.PrivateKey.fromWIF(privateKey);
      var aid = appid;
      if (typeof aid == "undefined") aid = this.appID;
      if (typeof appdata == "undefined") appdata = "";
      if (typeof comments == "undefined") comments = "";
      var sAppdata = JSON.stringify({ rtx: "this", aData: appdata });
      var sUserdata = JSON.stringify({ comments: comments });
      var obj = {
        data: [PROTOCOL_ID, aid, sAppdata, sUserdata],
        address: address,
        amount: amount,
        privateKey: pKey
      };
      var config = this.generateConfig(obj);
      console.log(obj);
      if (amount < 200) {
        resolve({ code: ERROR_TOOSMALL, msg: "cannot topup small amount" });
        return;
      }
      const res = await nbpay.send(config);
      delete payObj.privateKey;
      const ret = {code:res.err?-1:0,txid:res.txid,message:res.err}
      log(res.err?"Failed:":"Success Payment Obj:",JSON.stringify(payObj),JSON.stringify(ret));
      return ret
  }
}

module.exports = mPoints;
