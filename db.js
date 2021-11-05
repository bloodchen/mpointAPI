const DB = require('better-sqlite3')
class Database{
    start(path){
        this.db = new DB(path)
        // 100MB cache
        this.db.pragma('cache_size = 6400')
        this.db.pragma('page_size = 16384')
    }
    setTX(item){
        const sql = "INSERT INTO txs (txid,height,main,extra,time,addresses) VALUES(?,?,?,?,?,?)"
        this.db.prepare(sql).run(item.txid,item.height,item.main,item.extra,item.time,item.addresses)
    }
    queryTX({address,from, to}){

    }
}