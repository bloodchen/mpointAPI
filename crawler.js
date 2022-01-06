const axios = require('axios')
const Parser = require('./parser')
const { PlanAPI, WOCAPI } = require('./APIs')
const Database = require('./db')
class Crawler {
    constructor(api, db) {
        this.api = new WOCAPI
        this.db = new Database(__dirname + "/data/newdb.db")
        this.parser = new Parser(this, db)
    }
    start() {
        this.allAddress = this.db.getAllAddr()

    }
    async getTxHistory({ address, num, start, end }) {
        let txs = []
        if(!end||!this.db.isLocal(end))
            txs = await this.api.getTxHistory({ address, num, start, end })
        else
            txs = this.db.getTxHistory({ address, num, start, end })
        const res = this.db.getTxs(txs)
        await this.downloadAndParseTx(txs)
        if(num){
            txs.splice(num,txs.length-num)
        }
        this.relateToAddress(address,txs)
        console.log(txs)
        return txs
    }
    relateToAddress(address, txs) {
        for (let tx of txs) {
            tx.amount = 0
            tx.type = tx.main.from.find(ad=>ad.address===address)===undefined ? "income" : "spend"
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
                tx.amount -= tx.main.fee
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
        await this._download(txs)
        await this._parseTx(txs)
        this.db.saveTxs(txs)
    }

    async _download(txs) {
        let response;
        for (let tx of txs) {
            if (tx.raw || tx.main) continue

            let hex;
            try {
                console.log('woc--getting rawtx of:', tx.txid)
                response = await axios.get(`https://api.whatsonchain.com/v1/bsv/main/tx/${tx.txid}/hex`)
                hex = response.data
            } catch (e) {
                console.log('run--getting rawtx of:', tx.txid)
                response = await axios.get(`https://api.run.network/v1/main/tx/${txid.txid}`)
                hex = response.data.hex
            }
            if (!hex) {
                console.error("Download rawtx failed");
            } else {
                console.log('success')
                tx.raw = hex
            }

        }

    }
    async _parseTx(txs) {
        for (let i = 0; i < txs.length; i++) {
            const tx = txs[i]
            if (tx.main) continue
            txs[i] = await this.parser.parseRaw(tx)
        }
    }
}

//const crawler = new Crawler;
//const txs = [{txid:"7b5bcd5a16a3907d057694ec49b10ebc58da10ce96b51c7aeaea42bcc9154b0a"},{txid:"ad4ee6be98ac2bee4a90978a8ded3f57d283a19b8571463583a9b1a7b1494084"}]
//crawler.getTxHistory({ address: "12Cjv4zyumSEjpEpZCyLXpcsbyxqQFzR1g", num: 10, start: 712566 })
module.exports = Crawler