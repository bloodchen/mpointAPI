const axios = require('axios')
const Parser = require('./parser')
const bsv = require('bsv')
const { PlanAPI, WOCAPI, SensibleAPI, ARAPI } = require('./APIs')
const Database = require('./db')
const BLOCK_MIN = 637173
class Crawler {
    constructor(api, db) {
        this.bsv = SensibleAPI
        this.ar = ARAPI
        this.db = new Database(__dirname + "/data/db2.db")
        this.parser = new Parser(this, db)
    }
    start() {
        this.allAddress = this.db.getAllAddr()

    }
    async preFetch({ address, blockchain }) {
        this.getTxHistory({ address, num: 1000, blockchain })
    }
    async getTxHistory({ address, num = 10, start = BLOCK_MIN, end = 0, raw = false, blockchain = 'bsv' }) {
        let txs = {}
        if (blockchain == 'bsv') {
            if (!end || !this.db.isLocal(end,blockchain)){
                txs = await this.bsv.getTxHistory({ address, num, start, end })
                txs.blockchain = blockchain
            }
            else
                txs = this.db.getTxHistory({ address, num, start, end, blockchain })            
            const res = this.db.getTxs(txs.c, blockchain)
            await this.downloadAndParseTx(txs.c)
            await this.downloadAndParseTx(txs.u)
            if (num) {
                txs.c.splice(num, txs.c.length - num)
            }
            this.relateToAddress(address, txs.c, raw)
            this.relateToAddress(address, txs.u, raw)
        }
        if (blockchain == 'ar') {
            if (!end || !this.db.isLocal(end,blockchain)){
                txs = await this.bsv.getTxHistory({ address, num, start, end })
            }
            else
                txs = this.db.getTxHistory({ address, num, start, end, blockchain })
        }
        txs.blockchain = blockchain
        return txs
    }
    relateToAddress(address, txs, raw) {
        if(!txs) return
        for (let tx of txs) {
            tx.amount = 0
            tx.type = tx.main.from.find(ad => ad.address === address) === undefined ? "income" : "spend"
            if (!raw) delete tx.raw
            if (tx.type === "spend") {
                tx.main.from.forEach(ins => {
                    if (ins.address == address) {
                        tx.amount += ins.value;
                    }
                });
                tx.main.to.forEach(out => {
                    if (out.address == address) {
                        tx.amount -= out.value;
                    }
                });
                //tx.amount -= tx.main.fee
            } else {
                tx.main.to.forEach(out => {
                    if (out.address == address) {
                        tx.amount += out.value;
                    }
                });
            }
        }
    }
    async downloadAndParseTx(txs) {
        if(!txs)return
        await this._download(txs)
        await this._parseTx(txs)
        this.db.saveTxs(txs)
    }

    async _download(txs) {
        if(!txs)return
        let txids = [], i = 0
        for (let tx of txs) {
            i++
            if (tx.raw || tx.main) continue
            txids.push(tx.txid)
            if (txids.length == 20 || i >= txs.length) {
                const res = await axios.post("https://api.whatsonchain.com/v1/bsv/main/txs/hex", { txids: txids })
                if (res.data) {
                    console.log(res.data)
                    for (const item of res.data) {
                        const t = txs.find(tx => tx.txid == item.txid)
                        if (t) t.raw = item.hex
                    }
                    txids = []
                }
            }
        }

    }
    async _parseTx(txs) {
        if(!txs)return
        let utxos = {}
        for (let i = 0; i < txs.length; i++) {
            const tx = txs[i]
            if (tx.main) continue
            const tx1 = bsv.Transaction(tx.raw)
            for (const inp of tx1.inputs) {
                const txid = inp.prevTxId.toString('hex')
                utxos[txid] = { pos: inp.outputIndex }
            }
        }
        await WOCAPI.getUtxoValue(utxos)
        for (let i = 0; i < txs.length; i++) {
            const tx = txs[i]
            if (tx.main) continue
            txs[i] = await this.parser.parseRaw(tx, utxos)
        }
    }
}

//const crawler = new Crawler;
//const txs = [{txid:"7b5bcd5a16a3907d057694ec49b10ebc58da10ce96b51c7aeaea42bcc9154b0a"},{txid:"ad4ee6be98ac2bee4a90978a8ded3f57d283a19b8571463583a9b1a7b1494084"}]
//crawler.getTxHistory({ address: "12Cjv4zyumSEjpEpZCyLXpcsbyxqQFzR1g", num: 10, start: 712566 })
module.exports = Crawler