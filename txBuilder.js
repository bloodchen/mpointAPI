const Database = require('better-sqlite3')
const es = require("event-stream")

class planAPI {
    static async getTXHistory({ address, num, start, end }) {
        let url = "https://txo.bitbus.network/block";
        const query = {
            q: {
                find: {$or: [{ "in.e.a": address }, { "out.e.a": address }]},
                sort: { "blk.i": -1 },
                project: {"tx.h": 1,timestamp: 1,blk: 1},
                limit: num,
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
                resolve(items);
                return;
            });
            res.data.pipe(es.split()).pipe(
                es.map((data, callback) => {
                    if (data) {
                        let d = JSON.parse(data);
                        items.push(d);
                    }
                })
            );
        });
    }
    static getMempool(address) {

    }
}
class TXBuilder {
    constructor() {
        this.db = null
    }
    getTXHistory({ address, num, from, to }) {

    }
}