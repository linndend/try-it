var redis   = require("redis")
var pkg     = require("../package.json")
var helpers = require("./helpers")
var moment  = require("moment")

exports.createClient = function(cfg){
  if (!cfg) cfg = {}

  var client = cfg.hasOwnProperty("port")
    ? redis.createClient(cfg.port)
    : redis.createClient()

  var listKey = "autuv::machines"

  var timestamp = function(){
    return Math.round(new Date().getTime()/1000)
  }

  // var _registerClient = function(interface, callback){
  //   var ts   = timestamp()
  //   callback = callback || new Function
  //   debug("host._registerClient()", listKey, ts, interface)
  //   config.redis.zadd(listKey, ts, interface, function(err, reply){
  //     callback()
  //   })
  // }

  // list all clients
  var _listClients = function(callback){
    var ts = timestamp()
    var lowerbound = ts - 60 * 15 // five min ago
    var upperbound = ts + 60 * 15 // five min into future
    client.zrangebyscore(listKey, lowerbound, upperbound, callback)
  }
  

  return {


    /**
     * Write - logs usage data.
     *
     * Arg: @data
     *
     */

    write: function(data, callback){


      if (!callback) callback = new Function

      /**
       * converte timestampe to JS date
       * if date not present we assume now
       */

      var ts   = timestamp()
      var date = helpers.date(data.timestamp)
      var transaction = client.multi()

      delete data.timestamp

      /**
       * summary
       *
       *   sfo-03::2015-03-17::summary {
       *     200: 5
       *     304: 21
       *     404: 1
       *   }
       *
       * history
       *
       *   sfo-03::2015-03-17::history [
       *     200, 304, 404
       *   ]
       */
      

      for (var machine in data) {
        if (data.hasOwnProperty(machine)) {
          
          var twodays = 60 * 24 * 8

          var summarykey = [machine, date, "summary"].join("::")
          var historykey = [machine, date, "history"].join("::")

          transaction.zincrby(summarykey, 1, data[machine])
          transaction.lpush(historykey, data[machine])

          transaction.expire(summarykey, twodays)
          transaction.expire(historykey, twodays)

          transaction.zadd(listKey, ts, machine)

        }
      }

      /**
       * One call
       */

      transaction.exec(callback)

    },


    /**
     * Read - returns historical data for date range.
     *
     * Args:
     *    @domain    String (eg. 2015-03-17)
     *    @timestamp String (eg. 2015-03-17)
     *
     * Options:
     *    @offset Integer (eg. 14)
     *
     *   (daily)
     *   summary: {
     *     "sfo-03" : { 200: 37, 404: 3}
     *   }
     *
     *   (72)
     *   history: {
     *     "sfo-03": [200, 404, 500, 200, 200],
     *     "yyz-05": [200, 200, 200, 200, 200]
     *   }
     *
     */

    read: function(date, callback){
      if(!callback){
        callback = date
        date = helpers.date(date)
      }
      date = helpers.date()
      stats = {}

      var transaction = client.multi()
      _listClients(function(err, machines){
        machines.forEach(function(machine){
          var summarykey = [machine, date, "summary"].join("::")
          var historykey = [machine, date, "history"].join("::")
          transaction.zrevrange(summarykey, 0, -1, "WITHSCORES")
          transaction.lrange(historykey, 0, 71)
        })
        transaction.exec(function(errors, replies){
          var payload = {}
          var total = machines.length * 2
          var count = 0
          
          // all replies: [summary, history, summary, history, summary, history]
          replies.forEach(function(reply, ind){
            
            var marchineIndex = Math.abs(Math.round(((ind + 1) / 2) - 1))
            var marchineName = machines[marchineIndex]

            //console.log("ind:", ind, marchineIndex, marchineName)

            // IF INDEX IS EVEN WE HAVE A NEW MACHINE
            if (ind % 2 == 0){
              payload[marchineName] = { summary: {} }

              // even means summary
              reply.forEach(function(statusOrValue, i){
                if (i % 2 == 0){
                  payload[marchineName]["summary"][reply[i]] = reply[i + 1]
                }
              })
            } else {
              // odd means history
              payload[marchineName]["history"] = reply
            }

            count ++
            if (count >= total){
              callback(payload)  
            }

          })


        })
      })

    }

  }

}