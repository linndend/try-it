# autuv

> Time-series data collection for bolt

    alluvium.write({ 
      "sfo-01": 200, 
      "yyz-02": 200, 
      "jfk-01": 200, 
      "svg-03": 200, 
      "fra-07": 200, 
      "ams-02": 200 
    })

#### alluvium.read(domain, [options,] callback)

    alluvium.read(function(results){
      console.log(results)

      {
        sfo-01:{
          "summary": { "200": 37 }
          "history": [200, 500, 404]
        }
      }
    })
