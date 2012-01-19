var mongodb = process.env['TEST_NATIVE'] != null ? require('../lib/mongodb').native() : require('../lib/mongodb').pure();
var useSSL = process.env['USE_SSL'] != null ? true : false;

var testCase = require('../deps/nodeunit').testCase,
  debug = require('util').debug,
  inspect = require('util').inspect,
  nodeunit = require('../deps/nodeunit'),
  gleak = require('../dev/tools/gleak'),
  Db = mongodb.Db,
  Cursor = mongodb.Cursor,
  Collection = mongodb.Collection,
  Server = mongodb.Server;

var MONGODB = 'integration_tests';
var client = new Db(MONGODB, new Server("127.0.0.1", 27017, {auto_reconnect: true, poolSize: 4, ssl:useSSL}), {native_parser: (process.env['TEST_NATIVE'] != null)});

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
exports.setUp = function(callback) {
  var self = exports;  
  client.open(function(err, db_p) {
    if(numberOfTestsRun == (Object.keys(self).length)) {
      // If first test drop the db
      client.dropDatabase(function(err, done) {
        callback();
      });
    } else {
      return callback();
    }
  });
}

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
exports.tearDown = function(callback) {
  var self = this;
  numberOfTestsRun = numberOfTestsRun - 1;
  // Close connection
  client.close();
  callback();
}

exports.shouldCorrectlySaveUnicodeContainingDocument = function(test) {
  var reaperClient = new Db(MONGODB, new Server("127.0.0.1", 27017, {auto_reconnect: false}), {reaper:true, native_parser: (process.env['TEST_NATIVE'] != null)});
  reaperClient.open(function(err, reaperClient) {
    reaperClient._lastReaperTimestamp = (new Date().getTime() - 1000000);
    var con = reaperClient.serverConfig.checkoutReader();
    // Prime the reaper with a bogus call
    reaperClient._callBackStore._notReplied["3"] = {start: (new Date().getTime() - 50000), 'raw': false, chained:null, connection:con};
    reaperClient._callBackStore.once("3", function(err, result) {
      reaperClient.close();
      test.done();
    })
    
    reaperClient.collection("test", {safe:true}, function(err, col) {
      // Does not matter
    });
  })
}

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
exports.noGlobalsLeaked = function(test) {
  var leaks = gleak.detectNew();
  test.equal(0, leaks.length, "global var leak detected: " + leaks.join(', '));
  test.done();
}

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
var numberOfTestsRun = Object.keys(this).length - 2;