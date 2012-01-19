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
  ObjectID = require('../lib/mongodb/bson/objectid').ObjectID,
  Long = require('../lib/mongodb/goog/math/long').Long,
  Step = require("../deps/step/lib/step"),
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

// Test the creation of a collection on the mongo db
exports.shouldCorrectExecuteBasicCollectionMethods = function(test) {
  client.createCollection('test_collection_methods', function(err, collection) {
    // Verify that all the result are correct coming back (should contain the value ok)
    test.equal('test_collection_methods', collection.collectionName);
    // Let's check that the collection was created correctly
    client.collectionNames(function(err, documents) {
      var found = false;
      documents.forEach(function(document) {
        if(document.name == "integration_tests_.test_collection_methods") found = true;
      });
      test.ok(true, found);
      // Rename the collection and check that it's gone
      client.renameCollection("test_collection_methods", "test_collection_methods2", function(err, reply) {
        test.equal(1, reply.documents[0].ok);
        // Drop the collection and check that it's gone
        client.dropCollection("test_collection_methods2", function(err, result) {
          test.equal(true, result);
          test.done();
        })
      });
    });
  })    
}

// Test the access to collections
exports.shouldAccessToCollections = function(test) {
  // Create two collections
  client.createCollection('test.spiderman', function(r) {
    client.createCollection('test.mario', function(r) {
      // Insert test documents (creates collections)
      client.collection('test.spiderman', function(err, spiderman_collection) {
        spiderman_collection.insert({foo:5}, {safe:true}, function(err, r) {
          
          client.collection('test.mario', function(err, mario_collection) {
            mario_collection.insert({bar:0}, {safe:true}, function(err, r) {
              // Assert collections
              client.collections(function(err, collections) {
                var found_spiderman = false;
                var found_mario = false;
                var found_does_not_exist = false;

                collections.forEach(function(collection) {
                  if(collection.collectionName == "test.spiderman") found_spiderman = true;
                  if(collection.collectionName == "test.mario") found_mario = true;
                  if(collection.collectionName == "does_not_exist") found_does_not_exist = true;
                });

                test.ok(found_spiderman);
                test.ok(found_mario);
                test.ok(!found_does_not_exist);
                test.done();
              });                
            });
          });
        });
      });
    });
  });    
}

// Test dropping of collections
exports.shouldCorrectlyDropCollection = function(test) {
  client.createCollection('test_drop_collection2', function(err, r) {
    client.dropCollection('test_drop_collection', function(err, r) {
      test.ok(err instanceof Error);
      test.equal("ns not found", err.message);
      var found = false;
      // Ensure we don't have the collection in the set of names
      client.collectionNames(function(err, replies) {
        replies.forEach(function(err, document) {
          if(document.name == "test_drop_collection") {
            found = true;
            return;
          }
        });
        // If we have an instance of the index throw and error
        if(found) throw new Error("should not fail");
        // Let's close the db
        test.done();
      });
    });
  });    
}

// Test dropping using the collection drop command
exports.shouldCorrectlyDropCollectionWithDropFunction = function(test) {
  client.createCollection('test_other_drop', function(err, r) {
    client.collection('test_other_drop', function(err, collection) {
      collection.drop(function(err, reply) {
        // Ensure we don't have the collection in the set of names
        client.collectionNames(function(err, replies) {
          var found = false;
          replies.forEach(function(document) {
            if(document.name == "test_other_drop") {
              found = true;
              return;
            }
          });
          // If we have an instance of the index throw and error
          if(found) throw new Error("should not fail");
          // Let's close the db
          test.done();
        });
      });
    });
  });    
}

exports.shouldCorrectlyRetriveCollectionNames = function(test) {
  client.createCollection('test_collection_names', function(err, r) {
    client.collectionNames(function(err, documents) {
      var found = false;
      var found2 = false;
      documents.forEach(function(document) {
        if(document.name == MONGODB + '.test_collection_names') found = true;
      });
      test.ok(found);
      // Insert a document in an non-existing collection should create the collection
      client.collection('test_collection_names2', function(err, collection) {
        collection.insert({a:1}, {safe:true}, function(err, r) {
          client.collectionNames(function(err, documents) {
            documents.forEach(function(document) {
              if(document.name == MONGODB + '.test_collection_names2') found = true;
              if(document.name == MONGODB + '.test_collection_names') found2 = true;
            });

            test.ok(found);
            test.ok(found2);
            // Let's close the db
            test.done();
          });            
        })
      });
    });
  });    
}

exports.shouldCorrectlyRetrieveCollectionInfo = function(test) {
  client.createCollection('test_collections_info', function(err, r) {
    client.collectionsInfo(function(err, cursor) {
      test.ok((cursor instanceof Cursor));
      // Fetch all the collection info
      cursor.toArray(function(err, documents) {
        test.ok(documents.length > 1);

        var found = false;
        documents.forEach(function(document) {
          if(document.name == MONGODB + '.test_collections_info') found = true;
        });
        test.ok(found);
        // Let's close the db
        test.done();
      });
    });
  });    
}

exports.shouldCorrectlyRetriveCollectionOptions = function(test) {
  client.createCollection('test_collection_options', {'capped':true, 'size':1024}, function(err, collection) {
    test.ok(collection instanceof Collection);
    test.equal('test_collection_options', collection.collectionName);
    // Let's fetch the collection options
    collection.options(function(err, options) {
      test.equal(true, options.capped);
      test.equal(1024, options.size);
      test.equal("test_collection_options", options.create);
      // Let's close the db
      test.done();
    });
  });    
}

exports.shouldEnsureStrictAccessCollection = function(test) {
  var error_client = new Db(MONGODB, new Server("127.0.0.1", 27017, {auto_reconnect: false, ssl:useSSL}), {strict:true, native_parser: (process.env['TEST_NATIVE'] != null)});
  test.equal(true, error_client.strict);
  
  error_client.open(function(err, error_client) {
    error_client.collection('does-not-exist', function(err, collection) {
      test.ok(err instanceof Error);
      test.equal("Collection does-not-exist does not exist. Currently in strict mode.", err.message);
    });
      
    error_client.createCollection('test_strict_access_collection', function(err, collection) {
      error_client.collection('test_strict_access_collection', function(err, collection) {
        test.ok(collection instanceof Collection);
        // Let's close the db
        error_client.close();
        test.done();
      });
    });
  });
}

exports.shouldPerformStrictCreateCollection = function(test) {
  var error_client = new Db(MONGODB, new Server("127.0.0.1", 27017, {auto_reconnect: false, ssl:useSSL}), {strict:true, native_parser: (process.env['TEST_NATIVE'] != null)});
  test.equal(true, error_client.strict);

  error_client.open(function(err, error_client) {
    error_client.createCollection('test_strict_create_collection', function(err, collection) {
      test.ok(collection instanceof Collection);

      // Creating an existing collection should fail
      error_client.createCollection('test_strict_create_collection', function(err, collection) {
        test.ok(err instanceof Error);
        test.equal("Collection test_strict_create_collection already exists. Currently in strict mode.", err.message);

        // Switch out of strict mode and try to re-create collection
        error_client.strict = false;
        error_client.createCollection('test_strict_create_collection', function(err, collection) {
          test.ok(collection instanceof Collection);

          // Let's close the db
          error_client.close();
          test.done();
        });
      });
    });
  });
} 

exports.shouldFailToInsertDueToIllegalKeys = function(test) {
  client.createCollection('test_invalid_key_names', function(err, collection) {
    // Legal inserts
    collection.insert([{'hello':'world'}, {'hello':{'hello':'world'}}], {safe:true}, function(err, r) {        
      // Illegal insert for key
      collection.insert({'$hello':'world'}, {safe:true}, function(err, doc) {
        test.ok(err instanceof Error);
        test.equal("key $hello must not start with '$'", err.message);

        collection.insert({'hello':{'$hello':'world'}}, {safe:true}, function(err, doc) {
          test.ok(err instanceof Error);
          test.equal("key $hello must not start with '$'", err.message);

          collection.insert({'he$llo':'world'}, {safe:true}, function(err, docs) {
            test.ok(docs[0].constructor == Object);

            collection.insert({'hello':{'hell$o':'world'}}, {safe:true}, function(err, docs) {
              test.ok(err == null);

              collection.insert({'.hello':'world'}, {safe:true}, function(err, doc) {
                test.ok(err instanceof Error);
                test.equal("key .hello must not contain '.'", err.message);

                collection.insert({'hello':{'.hello':'world'}}, {safe:true}, function(err, doc) {
                  test.ok(err instanceof Error);
                  test.equal("key .hello must not contain '.'", err.message);

                  collection.insert({'hello.':'world'}, {safe:true}, function(err, doc) {
                    test.ok(err instanceof Error);
                    test.equal("key hello. must not contain '.'", err.message);

                    collection.insert({'hello':{'hello.':'world'}}, {safe:true}, function(err, doc) {
                      test.ok(err instanceof Error);
                      test.equal("key hello. must not contain '.'", err.message);
                      // Let's close the db
                      test.done();
                    });
                  });
                });
              });
            })
          })
        });
      });          
    });
  });
}

exports.shouldFailDueToIllegalCollectionNames = function(test) {
  client.collection(5, function(err, collection) {
    test.equal("collection name must be a String", err.message);
  });
  
  client.collection("", function(err, collection) {
    test.equal("collection names cannot be empty", err.message);
  });
  
  client.collection("te$t", function(err, collection) {
    test.equal("collection names must not contain '$'", err.message);        
  });

  client.collection(".test", function(err, collection) {
    test.equal("collection names must not start or end with '.'", err.message);        
  });

  client.collection("test.", function(err, collection) {
    test.equal("collection names must not start or end with '.'", err.message);        
  });

  client.collection("test..t", function(err, collection) {
    test.equal("collection names cannot be empty", err.message);
    test.done();        
  });  
}

// Test the count result on a collection that does not exist
exports.shouldCorrectlyCountOnNonExistingCollection = function(test) {
  client.collection('test_multiple_insert_2', function(err, collection) {
    collection.count(function(err, count) {
      test.equal(0, count);
      // Let's close the db
      test.done();
    });
  });
}

exports.shouldCorrectlyExecuteSave = function(test) {
  client.createCollection('test_save', function(err, collection) {
    var doc = {'hello':'world'};
    collection.save(doc, {safe:true}, function(err, docs) {
      test.ok(docs._id instanceof ObjectID || Object.prototype.toString.call(docs._id) === '[object ObjectID]');

      collection.count(function(err, count) {
        test.equal(1, count);
        doc = docs;

        collection.save(doc, {safe:true}, function(err, doc2) {

          collection.count(function(err, count) {
            test.equal(1, count);
          
            collection.findOne(function(err, doc3) {
              test.equal('world', doc3.hello);
              
              doc3.hello = 'mike';
          
              collection.save(doc3, {safe:true}, function(err, doc4) {
                collection.count(function(err, count) {
                  test.equal(1, count);
          
                  collection.findOne(function(err, doc5) {
                    test.equal('mike', doc5.hello);

                    // Save another document
                    collection.save({hello:'world'}, {safe:true}, function(err, doc) {
                      collection.count(function(err, count) {
                        test.equal(2, count);
                        // Let's close the db
                        test.done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

exports.shouldCorrectlySaveDocumentWithLongValue = function(test) {
  client.createCollection('test_save_long', function(err, collection) {
    collection.insert({'x':Long.fromNumber(9223372036854775807)}, {safe:true}, function(err, r) {
      collection.findOne(function(err, doc) {
        test.ok(Long.fromNumber(9223372036854775807).equals(doc.x));
        // Let's close the db
        test.done();
      });        
    });
  });
}
  
exports.shouldSaveObjectThatHasIdButDoesNotExistInCollection = function(test) {
  client.createCollection('test_save_with_object_that_has_id_but_does_not_actually_exist_in_collection', function(err, collection) {
    var a = {'_id':'1', 'hello':'world'};
    collection.save(a, {safe:true}, function(err, docs) {
      collection.count(function(err, count) {
        test.equal(1, count);

        collection.findOne(function(err, doc) {
          test.equal('world', doc.hello);

          doc.hello = 'mike';
          collection.save(doc, {safe:true}, function(err, doc) {
            collection.count(function(err, count) {
              test.equal(1, count);
            });

            collection.findOne(function(err, doc) {
              test.equal('mike', doc.hello);
              // Let's close the db
              test.done();
            });
          });
        });
      });
    });
  });
} 

exports.shouldCorrectlyPerformUpsert = function(test) {
  client.createCollection('test_should_correctly_do_upsert', function(err, collection) {
    var id = new ObjectID(null)
    var doc = {_id:id, a:1};
  
    Step(
      function test1() {
        var self = this;        

        collection.update({"_id":id}, doc, {upsert:true, safe:true}, function(err, result) {
          test.equal(null, err);        
          test.equal(1, result);

          collection.findOne({"_id":id}, self);
        });          
      },
      
      function test2(err, doc) {
        var self = this;
        test.equal(1, doc.a);

        id = new ObjectID(null)
        doc = {_id:id, a:2};
        
        collection.update({"_id":id}, doc, {safe:true, upsert:true}, function(err, result) {
          test.equal(null, err);
          test.equal(1, result);
          
          collection.findOne({"_id":id}, self);
        });          
      },
      
      function test3(err, doc2) {
        var self = this;
        test.equal(2, doc2.a);

        collection.update({"_id":id}, doc2, {safe:true, upsert:true}, function(err, result) {
          test.equal(null, err);
          test.equal(1, result);
        
          collection.findOne({"_id":id}, function(err, doc) {
            test.equal(2, doc.a);
            test.done();                        
          });
        });
      }        
    );                  
  });
}

exports.shouldCorrectlyUpdateWithNoDocs = function(test) {
  client.createCollection('test_should_correctly_do_update_with_no_docs', function(err, collection) {
    var id = new ObjectID(null)
    var doc = {_id:id, a:1};
    collection.update({"_id":id}, doc, {safe:true}, function(err, numberofupdateddocs) {
      test.equal(null, err);
      test.equal(0, numberofupdateddocs);

      test.done();
    });
  });
}

exports.shouldCorrectlyExecuteInsertUpdateDeleteSafeMode = function(test) {
  client.createCollection('test_should_execute_insert_update_delete_safe_mode', function(err, collection) {
    test.ok(collection instanceof Collection);
    test.equal('test_should_execute_insert_update_delete_safe_mode', collection.collectionName);

    collection.insert({i:1}, {safe:true}, function(err, ids) {
      test.equal(1, ids.length);
      test.ok(ids[0]._id.toHexString().length == 24);

      // Update the record
      collection.update({i:1}, {"$set":{i:2}}, {safe:true}, function(err, result) {
        test.equal(null, err);
        test.equal(1, result);
      
        // Remove safely
        collection.remove({}, {safe:true}, function(err, result) {
          test.equal(null, err);            
          
          test.done();
        });
      });
    });
  });
}

exports.shouldPerformMultipleSaves = function(test) {
   client.createCollection("multiple_save_test", function(err, collection) {
     var doc = {
        name: 'amit',
        text: 'some text'
     };
     
     //insert new user
     collection.save(doc, {safe:true}, function(err, r) {
       collection.find({}, {name: 1}).limit(1).toArray(function(err, users){
         var user = users[0]

         if(err) {
           throw new Error(err)
         } else if(user) {
           user.pants = 'worn'

           collection.save(user, {safe:true}, function(err, result){
             test.equal(null, err);
             test.equal(1, result);

            test.done();
           })
         }
       });         
     })
  });
}
  
exports.shouldCorrectlySaveDocumentWithNestedArray = function(test) {
  var db = new Db(MONGODB, new Server('localhost', 27017, {auto_reconnect: true, ssl:useSSL}), {native_parser: (process.env['TEST_NATIVE'] != null)});
  db.open(function(err, db) {
    db.createCollection("save_error_on_save_test", function(err, collection) {      
      // Create unique index for username
      collection.createIndex([['username', 1]], true, function(err, result) {
        var doc = {
          email: 'email@email.com',
          encrypted_password: 'password',
          friends: 
            [ '4db96b973d01205364000006',
              '4db94a1948a683a176000001',
              '4dc77b24c5ba38be14000002' ],
          location: [ 72.4930088, 23.0431957 ],
          name: 'Amit Kumar',
          password_salt: 'salty',
          profile_fields: [],
          username: 'amit' };
        //insert new user
        collection.save(doc, {safe:true}, function(err, doc) {
        
            collection.find({}).limit(1).toArray(function(err, users) {
              test.equal(null, err);        
              var user = users[0]
              user.friends.splice(1,1)

              collection.save(user, function(err, doc) {
                test.equal(null, err);    

                // Update again
                collection.update({_id:new ObjectID(user._id.toString())}, {friends:user.friends}, {upsert:true, safe:true}, function(err, result) {
                  test.equal(null, err);
                  test.equal(1, result);                
                  
                  db.close();
                  test.done();
                });             
              });
            });        
        });
      })
    });
  });
}

exports.shouldPeformCollectionRemoveWithNoCallback = function(test) {
  client.collection("remove_with_no_callback_bug_test", function(err, collection) {
    collection.save({a:1}, {safe:true}, function(){
      collection.save({b:1}, {safe:true}, function(){
        collection.save({c:1}, {safe:true}, function(){
           collection.remove({a:1}, {safe:true}, function() {
             // Let's perform a count
             collection.count(function(err, count) {
               test.equal(null, err);    
               test.equal(2, count);
               test.done();
             });               
           })             
         });
       });
    });
  });
},    

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