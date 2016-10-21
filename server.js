var express = require('express');
var app = express();
var url = process.env.MONGOLAB_URI; // old "mongodb://localhost:27017/local" ;
var mongo = require('mongodb').MongoClient;
var lastEntryNr;


mongo.connect(url, function(err, db) {
    
    if (err) throw err;
    var shorturls = db.collection('shorturls');

    shorturls.findOne({}, {sort:{$natural:-1}}, function(err, doc){

            if (err) throw err;
            
            if (doc == undefined){
                lastEntryNr = 0;
                console.log("INIT - DB clean; last entry_nr: 0");
            }else{
                lastEntryNr = parseInt(doc.entry_nr, 10);
                console.log("INIT - DB loaded; last entry_nr: " + (lastEntryNr));
            }
            db.close();
    });
});

app.use('/new', function(req, res, next){
    
    //console.log("ENTRY REQUEST on " + JSON.stringify(req.url));
    var entry = {
        entry_nr: ++lastEntryNr,
        original_url: decodeURI(req.url).substring(1),
        short_url: "https://" + req.hostname + "/" + lastEntryNr
    };
    
    mongo.connect(url, function(err, db) {

        if (err) throw err;
        var shorturls = db.collection('shorturls');
    
        shorturls.insertOne(entry, function(err, data) {
            
            if (err) throw err;
            
            res.writeHead(200, { 'Content-Type': 'application/json' }); 
            console.log("NEW ENTRY  - "+ JSON.stringify({
                    entry_nr: entry.entry_nr,
                    original_url: entry.original_url, 
                    client_ip: req.headers['x-forwarded-for']}));
            delete entry._id;
            delete entry.entry_nr;
            res.end(JSON.stringify(entry));
            db.close();
        });
    });
});

app.use('/', function(req, res, next){
    
    //console.log("REDIRECT REQUEST on " + JSON.stringify(req.url));
    if (req.url == "/favicon.ico"){
        res.end();
        //console.log("FAVICON REQUEST DROPPED");
    }else{
        
        mongo.connect(url, function(err, db) {
            
          if (err) throw err;
          var shorturls = db.collection('shorturls');
          
          shorturls.find({ //didnt use findOne() for debugging purposes
            entry_nr: parseInt(req.url.substring(1), 10)
          }).toArray(function(err, documents) {
              
            if (err) throw err;
                
            /*if (documents.length > 1){                //DEBUG
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end("Error! More than 1 result: \n" + JSON.stringify(documents));
                db.close();
                console.log("Error! More than 1 result: \n" + JSON.stringify(documents));
            }*/
            
            if (documents.length == 0){
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end("Entry Nr \"" + req.url.substring(1) + "\" not found!\n\nshorturl usage: https://" + req.hostname + "/new/<url you want shortened>");
                db.close();
                console.log("USER ERROR - Entry Nr \"" + req.url.substring(1) + "\" not found!");
            }else{
                if(documents[0].original_url.substring(0, 4) == "http")
                    res.redirect(301, documents[0].original_url);
                else
                    res.redirect(301, "http://" + documents[0].original_url);
                db.close();
                console.log("REDIRECTED - "+ JSON.stringify({
                    entry_nr: documents[0].entry_nr,
                    original_url: documents[0].original_url, 
                    client_ip: req.headers['x-forwarded-for']}));
                res.end();
            }
          });
        });
    }
});
 
app.listen(process.env.PORT || 8080);