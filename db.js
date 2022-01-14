const DB = require('better-sqlite3')
const fs = require('fs')
class Database {
    constructor(path) {
        if (!fs.existsSync(path)) {
            fs.copyFileSync(__dirname + "/data/template/db2.db", path);
          }
        this.db = new DB(path)
        // 100MB cache
        this.db.pragma('cache_size = 6400')
        this.db.pragma('page_size = 16384')
    }
    setTx(item) {
        try {
            const sql = "INSERT INTO txs (txid,block,raw,main,ts,addresses,fee) VALUES(?,?,?,?,?,?,?)"
            this.db.prepare(sql).run(item.txid, item.block, item.raw, JSON.stringify(item.main), item.ts, item.addresses,item.fee)
        } catch (e) {
            console.error(e)
        }
    }
    saveTxs(txs) {
        for (let tx of txs) {
            if (tx.dirty) {
                this.setTx(tx)
                delete tx.dirty
            }
        }
    }
    getTxHistory({ address, num, start, end }) {
        const sql = "SELECT * from txs where addresses like ? LIMIT ?"
        const res = this.db.prepare(sql).all("%" + address + "%", num)
        delete res.id
        return { c: res }
    }
    isLocal(block) {
        const sql = "SELECT * from txs where block > ?"
        const res = this.db.prepare(sql).get(block)
        return res != null
    }
    getTx(tx) {
        const sql = "SELECT * from txs where txid = ?"
        const res = this.db.prepare(sql).get(tx.txid)
        if (res) {
            tx = res
            tx.main = JSON.parse(tx.main)
            delete tx.id
        }
        return tx
    }
    getTxs(txs) {
        for (let i = 0; i < txs.length; i++) {
            txs[i] = this.getTx(txs[i])
        }
    }
    getTransaction(txid) {
        return null
    }
}

module.exports = Database