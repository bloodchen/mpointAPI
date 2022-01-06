const axios = require('axios')
const es = require("event-stream")
const { SensibleFT, API_NET, API_TARGET, SensibleApi, Wallet } = require("sensible-sdk");

class WOCAPI{
    async getTxHistory({ address, num, start, end }) {
        let url = "https://api.whatsonchain.com/v1/bsv/main/address/"+address+"/history"
        const res = await axios.get(url)
        let txs = [];
        for(let i=res.data.length-1;i>=0;i--){
            const item = res.data[i]
            const tx = {txid:item.tx_hash,block:item.height}
            txs.push(tx)
        }
        return txs
    }
    static async getUtxoValue(txid,outPos){
        const item = this.db && this.db.getTransaction(txid)
        if(item){
            return item.to[outPos].value
        }else{
            console.log("getting UTXO value of:",outPos,"@",txid)
            const url = "https://api.whatsonchain.com/v1/bsv/main/tx/hash/"+txid
            let response = await axios.get(url)
            if(response.data){
                console.log("success")
                return response.data.vout[outPos].value*1e8
            }else{
                console.error("fail")
            }
        }
        return null
    }
}
class PlanAPI{
    async getTxHistory({ address, num, start, end }) {
        
        let url = "https://txo.bitbus.network/block";
        const query = {
            q: {find: {$or: [{ "in.e.a": address }, { "out.e.a": address }]},sort: { "blk.i": -1 },
                project: {"tx.h": 1,timestamp: 1,blk: 1},
                limit: num,
            }
        };
        if ( start>0 || end>0) query.q.find["blk.i"] = {};
        if (start > 0) query.q.find["blk.i"]["$gt"] = start;
        if (end > 0) query.q.find["blk.i"]["$lt"] = end;
        let res = await axios.post(url, JSON.stringify(query), {
            headers: {
                "Content-type": "application/json; charset=utf-8",
                Accept: "application/json; charset=utf-8",
                token:"eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJzdWIiOiIxQzc5M0RkVjI0Q3NORTJFUDZNbVZmckhqVlNGVmc2dU4iLCJpc3N1ZXIiOiJnZW5lcmljLWJpdGF1dGgifQ.SUJlYUc2TGNGdFlZaGk3amxwa3ZoRGZJUEpFcGhObWhpdVNqNXVBbkxORTdLMWRkaGNESC81SWJmM2J1N0V5SzFuakpKTWFPNXBTcVJlb0ZHRm5uSi9VPQ"
            },
            responseType: "stream" // important
        });
        let txs = [];
        console.log("getting transactions...")
        return new Promise(function (resolve, reject) {
            res.data.on("end", function () {
                resolve(txs);
                return;
            });
            res.data.pipe(es.split()).pipe(
                es.map((data, callback) => {
                    if (data) {
                        let d = JSON.parse(data);
                        const tx = {txid:d.tx.h,block:d.blk.i,ts:d.blk.t}
                        console.log("adding:",tx.txid)
                        txs.push(tx);
                    }
                })
            );
        });
    }
}

module.exports = {WOCAPI,PlanAPI}