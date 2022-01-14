const axios = require('axios')
const es = require("event-stream")
const { SensibleFT, API_NET, API_TARGET, SensibleApi, Wallet } = require("sensible-sdk");

class ARAPI{
    static async getTxHistory({ address, num, start, end }) {
        let block = {}
        if(start)block.min = start
        if(end) block.max = end
        const query = `
            query {transactions(recipients: ["${address}"]) {
              pageInfo {
                hasNextPage
              }
              edges {
                node {
                  id
                  owner { 
                    address
                  }
                  recipient
                  tags {
                    name
                    value
                  }
                  block {
                    timestamp
                  }
                  fee { winston }
                  quantity { winston }
                }
                cursor
              }
          }}`;
          
        let url = "https://arweave.net/graphql",res = null
        //const variables = {address:address,block:block}
        try{
        res = await axios.post(url,{query},{
            headers: {
              'Content-Type': 'application/json',
              'Accept-Encoding': 'gzip, deflate, br',
              'Origin': 'https://arweave.net'
            }
          })
        }catch(e){
            console.log(e.response)
        }
        let txs ={c:[],u:[]};
        for(let i=res.data.length-1;i>=0;i--){
            const item = res.data[i]
            const tx = {txid:item.tx_hash,block:item.height}
            item.height!=0 ? txs.c.push(tx):tx.u.push(tx)
        }
        return txs
    }
}
class WOCAPI{
    static async getTxHistory({ address, num, start, end }) {
        let url = "https://api.whatsonchain.com/v1/bsv/main/address/"+address+"/history"
        const res = await axios.get(url)
        let txs ={c:[],u:[]};
        for(let i=res.data.length-1;i>=0;i--){
            const item = res.data[i]
            const tx = {txid:item.tx_hash,block:item.height}
            item.height!=0 ? txs.c.push(tx):tx.u.push(tx)
        }
        return txs
    }
    static async getUtxoValue(utxos){
        let txids = [],i=0
        const length = Object.keys(utxos).length
        for(let txid in utxos){
            i++
            const item = this.db && this.db.getTransaction(txid)
            if(item){
                utxos[txid].value = item.to[utxos[txid].pos].value
                continue
            }
            txids.push(txid)
            if(txids.length==20||i>=length){
                const res = await axios.post("https://api.whatsonchain.com/v1/bsv/main/txs",{txids:txids})
                if(res.data){
                    console.log(res.data)
                    for(const item of res.data){
                        const t = utxos[item.txid]
                        if(t)t.value = Math.floor(item.vout[t.pos].value*1e8)
                    }
                }
                txids = []
            }
        }
        return null
        /*const item = this.db && this.db.getTransaction(txid)
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
        return null*/
    }
}
class SensibleAPI{
    static async getTxHistory({ address, num, start, end }) {
        let url = `https://api.sensiblequery.com/address/${address}/history/tx?start=${start}&end=${end}&cursor=0&size=${num*2}`
        const res = await axios.get(url)
        if(res&&res.data.code==0){
            const data = res.data.data
            let txs ={c:[],u:[]};
            for(let i=0;i<data.length;i++){
                const item = data[i]
                const tx = {txid:item.txid,block:item.height,ts:item.timestamp}
                item.height!=4294967295 ? txs.c.push(tx):(tx.block=-1,txs.u.push(tx))
            }
            return txs
        }
        return []
    }
}
class PlanAPI{
    static async getTxHistory({ address, num, start, end }) {
        
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

module.exports = {WOCAPI,PlanAPI,SensibleAPI,ARAPI}