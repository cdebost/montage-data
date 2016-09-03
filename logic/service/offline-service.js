var RawDataService = require("logic/service/raw-data-service").RawDataService,
    DataStream = require("logic/service/data-stream").DataStream,
    Dexie = require("dexie"),
    Promise = require("bluebird"),
    uuid = require("montage/core/uuid"),
    DataOrdering = require("logic/model/data-ordering").DataOrdering,
    DESCENDING = DataOrdering.DESCENDING,
    evaluate = require("frb/evaluate"),
    Map = require("collections/map"),
    Set = require("collections/set"),
    OfflineService;
/**
 * TODO: Document
 *
 * @class
 * @extends RawDataService
 */
exports.OfflineService = OfflineService = RawDataService.specialize(/** @lends OfflineService.prototype */ {

    /***************************************************************************
     * Initializing
     */

    constructor: {
        value: function OfflineService() {
            RawDataService.call(this);
        }
    },

   _db : {
        value: void 0
    },
   schema : {
        value: void 0
    },

   
     /**
     * Main initialiation method
     *
     * @method
     * @argument {String} name          - Defines the name of the database offline service will create/use.
     * @argument {Number} version       - Storage version
     * @argument {Object} scheme        - A schema with the following structure:
     * 
     *           {
     *      "Person": {
     *           primaryKey: "id",
     *           indexes: ["firstName","lastName],
     *           versionUpgradeLogic: function() {}
     *       },
     *       "Product": {
     * 
     *       }
     *   }
     * 
     */

    initWithName: {
        value: function(name, version, schema) {
            var localVersion = version || 1;
            if (!this._db) {
                var db = this._db = new Dexie(name), 
                    table, tableSchema, dbTable, dbSchema, dbIndexes, 
                    shouldUpgradeToNewVersion = false, newDbSchema, 
                    schemaDefinition, tableIndexes, tablePrimaryKey;

                this.schema = schema;

                //db.open().then(function (db) {
                newDbSchema = {};

                //We automatically create an extra table that will track offline operations the record was last updated
                schemaDefinition = "++id";
                schemaDefinition += ",";
                schemaDefinition += "dataID";
                schemaDefinition += ",";
                schemaDefinition += this.typePropertyName;
                schemaDefinition += ",";
                schemaDefinition += this.lastFetchedPropertyName;
                schemaDefinition += ",";
                schemaDefinition += this.lastModifiedPropertyName;
                schemaDefinition += ",";
                schemaDefinition += this.operationPropertyName;
                schemaDefinition += ",";
                schemaDefinition += this.changesPropertyName;
                schemaDefinition += ",";
                schemaDefinition += this.contextPropertyName;
                newDbSchema[this.operationTableName] = schemaDefinition;

                if (schema) {

                    for (table in schema) {
                        tableSchema = schema[table];
                        tableIndexes = tableSchema.indexes;
                        tablePrimaryKey = tableSchema.primaryKey;
                        dbTable = db[table];
                        if (dbTable) {
                            //That table is defined, now let's compare primaryKey and indexes
                            dbSchema = dbTable.schema;
                            if (dbSchema.primKey !== tablePrimaryKey) {
                                //Existing table has different primaryKey, needs new version
                                shouldUpgradeToNewVersion = true;
                            }
                            //test if indexes aren't the same.
                            dbIndexes = dbSchema.indexes;
                            if (dbIndexes !== tableSchema.indexes) {
                                //Existing table has different indexes, needs new version
                                shouldUpgradeToNewVersion = true;
                            }


                        } else {
                            //That table doesn't exists, which means we need to update.
                            shouldUpgradeToNewVersion = true;
                        }
                        if (shouldUpgradeToNewVersion) {
                            //We automatically add an index for lastUpdatedPropertyName ("montage-online-last-updated")
                            schemaDefinition = tablePrimaryKey;
                            for(var i=0, iIndexName;(iIndexName = tableIndexes[i]);i++) {
                                if(iIndexName !== tablePrimaryKey) {
                                    schemaDefinition += ",";
                                    schemaDefinition +=  iIndexName;
                                }
                            }
                            newDbSchema[table] = schemaDefinition;
                        }
                    }

                    if (shouldUpgradeToNewVersion) {
                        //db.close();
                        //Add upgrade here
                        //console.log("newDbSchema:",newDbSchema);
                        db.version(db.verno+1).stores(newDbSchema);
                        //db.open();
                    }
                }
                //});

            }
            return this;
        }
    },

    // createObjectStoreFromSample: {
    //     value: function (objectStoreName, primaryKey, sampleData) {
    //         if(!sampleData) return;

    //         var sampleDataKeys = Object.keys(sampleData),
    //             db = this._db,
    //             currentSchema = {};

    //         db.tables.forEach(function (table) {
    //             currentSchema[table.name] = JSON.stringify(table.schema);
    //         });

    //         var schemaDefinition = primaryKey;
    //         for(var i=0, iKey;(iKey = sampleDataKeys[i]);i++) {
    //             if(iKey !== primaryKey) {
    //                 schemaDefinition += ",";
    //                 schemaDefinition +=  iKey;
    //             }
    //         }
    //         currentSchema[objectStoreName] = schemaDefinition;
    //         db.version(db.verno+1).stores(currentSchema);

    //     }
    // },

    /**
     * table/property/index name that tracks the date the record was last updated
     *
     * @returns {String}
     */
    operationTableName: {
        value: "Operation"
    },
    /**
     * name of the schema property that stores the name of the type/object store 
     * of the object the operation impacts
     *
     * @returns {String}
     */
    typePropertyName: {
        value: "type"
    },

    /**
     * name of the schema property that stores the last time the operation's object 
     * (dataID) was last fetched.
     *
     * @returns {String}
     */
    lastFetchedPropertyName: {
        value: "lastFetched"
    },

   /**
     * name of the schema property that stores the last time the operation's  
     * object was last modified.
     *
     * @returns {String}
     */
    lastModifiedPropertyName: {
        value: "lastModified"
    },

     /**
     * name of the schema property that stores the type of operation:  
     * This will be create or update or delete
     *
     * @returns {String}
     */
    operationPropertyName: {
        value: "operation" 
    },
    operationCreateName: {
        value: "create"
    },
   operationUpdateName: {
        value: "update"
    },
    operationDeleteName: {
        value: "delete"
    },

   /**
     * name of the schema property that stores the  changes made to the object in this operation
     *
     * @returns {String}
     */
    changesPropertyName: {
        value: "changes" //This contains 
    },

    /**
     * name of the schema property that stores the primary key of the object the operation impacts
     *
     * @returns {String}
     */
    dataIDPropertyName: {
        value: "dataID"
    },

   /**
     * name of the schema property that stores unstructured/custom data for a service 
     * to stash what it may need for further use.
     *
     * @returns {String}
     */
    contextPropertyName: {
        value: "context" 
    },


    /* 
        returns all records, ordered by time, that reflect what hapened when offline.
        We shoud
        [{
            // NO primaryKey: uuid-uuid-uuid, 
            lastFetched: Date("08-02-2016"),
            lastModified: Date("08-02-2016"),
            operation: "create",
            data: {
                hazard_id:  uuid-uuid-uuid,
                "foo":"abc",
                "bla":23
            }
        },
        {
            lastFetched: Date("08-02-2016"),
            lastModified: Date("08-02-2016"),
            operation: "update"
        },
        {
            lastFetched: Date("08-02-2016"),
            lastModified: Date("08-02-2016"),
            operation: "update"
        },
        ]
    */

    offlineOperations: {
        get: function() {
            //Fetch 
        }

    },

    clearOfflineOperations: {
        value: function(operations) {
            //Fetch 

        }
    },
    /* Feels like that should return the data, in case it's called with null and created inside?*/
    mapToRawSelector: {
        value: function (object, data) {
            // TO DO: Provide a default mapping based on object.TYPE.
            // For now, subclasses must override this.
        }
    },

    _tableByName: {
        value: void 0
    },
    tableNamed: {
        value: function(tableName) {
            var table;
            if(!this._tableByName) {
                this._tableByName = new Map();
            }
            table = this._tableByName.get(tableName);
            if(!table) {
                table = this._db[tableName];
                if(!table) {
                    var tables = this._db.tables;
                    for(var i=0, iTable; (iTable = tables[i]); i++) {
                        if(iTable.name === tableName) {
                            this._tableByName.set(tableName,(table = iTable));
                            break;
                        }
                    }
                }
            }
            return table;
        }
    },

    _operationTable: {
        value: void 0
    },
    operationTable: {
        get:function() {
            if(!this._operationTable) {
                this._operationTable = this.tableNamed(this.operationTableName);
            }
            return this._operationTable;
        }
    },

    fetchData: {
        value: function (selector, stream) {
            var db = this._db,
                criteria = selector.criteria,
                whereProperties = Object.keys(criteria),
                orderings = selector.orderings,
                self = this;
            
              /*
                    The idea here (to finish) is to use the first criteria in the where, assuming it's the most
                    important, and then filter the rest in memory by looping on remaining 
                    whereProperties amd whereEqualValues, index matches. Not sure how Dexie's Collection fits there
                    results in the then is an Array... This first pass fetches offline Hazards with status === "A", 
                    which seems to be the only fetch for Hazards on load when offline.
                */
                db.open().then(function (db) {
                    var table = self.tableNamed(selector.type);

                    if(whereProperties.length) {
                        var wherePromise,
                            resultPromise,
                            whereProperty = whereProperties.shift(),
                            whereValue = criteria[whereProperty];

                        if(whereProperties.length > 0) {
                                //db.table1.where("key1").between(8,12).and(function (x) { return x.key2 >= 3 && x.key2 < 18; }).toArray();


                            if(Array.isArray(whereValue)) {
                                wherePromise = table
                                                .where(whereProperty)
                                                .anyOf(whereValue);
                            }
                            else {
                                wherePromise = table
                                                .where(whereProperty)
                                                .equals(whereValue);
                            }

                            resultPromise = wherePromise
                                            .and(function (aRecord) {
                                                var result = true;
                                                for(var i=0, iKey, iValue, iKeyMatchValue;(iKey = whereProperties[i]);i++) {
                                                    iValue = criteria[iKey];
                                                    iKeyMatchValue = false;
                                                    if(Array.isArray(iValue)) {
                                                        iOrValue = false;
                                                        for(var j=0, jValue;(jValue = iValue[j]);j++) {
                                                            if(aRecord[iKey] === jValue) {
                                                                if(!iKeyMatchValue) iKeyMatchValue = true;
                                                            }
                                                        }
                                                    }
                                                    else {
                                                        if(aRecord[iKey] !== iValue) {
                                                            iKeyMatchValue = false;
                                                        }
                                                        else {
                                                            iKeyMatchValue = true;
                                                        }
                                                    }

                                                    if(!(result = result && iKeyMatchValue)) {
                                                        break;
                                                    }
                                                }
                                                return result;
                                            });
                        }
                        else {
                            if(Array.isArray(whereValue)) {
                                resultPromise = table
                                                .where(whereProperty)
                                                .anyOf(whereValue);
                            }
                            else {
                                resultPromise = table
                                                .where(whereProperty)
                                                .equals(whereValue);
                            }
                        }
                        resultPromise.toArray(function(results) {
                            //Creates an infinite loop, we don't need what's there
                            //self.addRawData(stream, results);
                            //self.rawDataDone(stream);
                            if(orderings) {
                                var expression = "";
                                //Build combined expression
                                for(var i=0,iDataOrdering,iExpression;(iDataOrdering = orderings[i]);i++) {
                                    iExpression = iDataOrdering.expression;

                                    if(expression.length) 
                                        expression += ".";

                                    expression += "sorted{";
                                    expression += iExpression;
                                    expression += "}";
                                    if(iDataOrdering.order === DESCENDING) {
                                        expression += ".reversed()";
                                    }
                                }
                                results = evaluate(expression, results);
                            }

                            stream.addData(results);
                            stream.dataDone();

                        });

                    }
                    else {
                        table.toArray()
                        .then(function(results) {
                            stream.addData(results);
                            stream.dataDone();
                        });
                    }

                }).catch('NoSuchDatabaseError', function(e) {
                    // Database with that name did not exist
                    stream.dataError(e);
                }).catch(function (e) {
                    stream.dataError(e);
                });

            // Return the passed in or created stream.
            return stream;
        }
    },

     /**
     * Called every time [addRawData()]{@link RawDataService#addRawData} is
     * called while online to optionally cache that data for offline use.
     *
     * The default implementation does nothing. This is appropriate for
     * subclasses that do not support offline operation or which operate the
     * same way when offline as when online.
     *
     * Other subclasses may override this method to cache data fetched when
     * online so [fetchOfflineData]{@link RawDataSource#fetchOfflineData} can
     * use that data when offline.
     *
     * @method
     * @argument {DataStream} stream   - The stream to which the fetched data is
     *                                   being added.
     * @argument {Array} rawDataArray  - An array of objects whose properties'
     *                                   values hold the raw data.
     * @argument {?} context           - The context value passed to the
     *                                   [addRawData()]{@link DataMapping#addRawData}
     *                                   call that is invoking this method.
     */

    //writeOfflineData/readOfflineOperatio

    writeOfflineData: {
        value: function (selector, rawDataArray) {

            var self = this,
                db = this._db,
                tableName = selector.type,
                table = this.tableNamed(tableName),
                lastUpdatedTable = this.operationTable,
                clonedArray = [],
                i,countI,iRawData, iLastUpdated,
                lastUpdated = Date.now(),
                updateOperationArray = [],
                dataID = this.dataIDPropertyName,
                primaryKey = table.schema.primKey.name,
                lastUpdatedPropertyName = this.lastFetchedPropertyName,
                j, countJ, jRawData,
                rawDataMapByPrimaryKey,
                offlineObjectsToClear = [],
                rawDataStream = new DataStream();

                rawDataStream.selector = selector;


            primaryKey = table.schema.primKey.name;


            //Make a clone of the array and create the record to track the online Last Updated date 
            for(i=0, countI = rawDataArray.length;i<countI;i++) {
                if((iRawData = rawDataArray[i])) {
                    clonedArray.push(iRawData);
                    
                    //Create the record to track the online Last Updated date
                    iLastUpdated = {};
                    iLastUpdated[dataID] = iRawData[primaryKey];
                    iLastUpdated[lastUpdatedPropertyName] = lastUpdated;
                    iLastUpdated[this.typePropertyName] = tableName;
                    updateOperationArray.push(iLastUpdated);
                }
            }

            // 1) First we need to execute the equivalent of stream's selector to find what we have matching locally
            return this.fetchData(selector,rawDataStream).then(function (offlineSelectedRecords) {
                // 2) Loop on offline results and if we can't find it in the recent rawDataArray:
                //    2.0) Remove the non-matching record so it doesn't show up in results 
                //         if that query were immediatrely done next as offline.
                // Not ideal as we're going to do at worse a full lookup of rawDataArray, every iteration
                for(var i=0, countI = offlineSelectedRecords.length, iRecord, iRecordPrimaryKey;(iRecord = offlineSelectedRecords[i]);i++) {
                    iRecordPrimaryKey = iRecord[self.dataIDPropertyName];
                    if(!rawDataMapByPrimaryKey) {
                        rawDataMapByPrimaryKey = new Map();
                        for(j=0;(jRawData = rawDataArray[j]);j++) {
                            rawDataMapByPrimaryKey.set(jRawData[primaryKey],jRawData);
                        }
                    }
                    if(!rawDataMapByPrimaryKey.has(iRecord[primaryKey])) {
                        offlineObjectsToClear.push(primaryKey);
                    }
                }

                //Now we now what to delete: offlineObjectsToClear, what to put: rawDataArray.
                //We need to be able to build a transaction and pass 

                // 3) Put new objects
                return self.performOfflineSelectorChanges(selector, clonedArray, updateOperationArray, offlineObjectsToClear);

            })
            .catch(function(e) {
                console.log(selector.type + ": performOfflineSelectorChanges failed",e);
                console.error(e);
            });

        }
    },

    readOfflineOperations: {
        value: function (operationMapToService) {
            var operationTable,
                self = this;

            return new Promise(function (resolve, reject) {
                var myDB = self._db;

                myDB
                .open()
                .then(function (db) {
                    self.operationTable.where("operation").anyOf("create","update","delete")
                    .toArray(function (offlineOperations) {
                            resolve(offlineOperations);
                    }).catch(function(e) {
                            console.log(selector.type + ": performOfflineSelectorChanges failed",e);
                            console.error(e);
                            reject(e);
                    });
                });
            });
        }
    },

    performOfflineSelectorChanges: {
        value: function (selector, rawDataArray, updateOperationArray, offlineObjectsToClear) {
            var myDB = this._db,
                self = this,
                clonedRawDataArray = rawDataArray.slice(0),
                clonedUpdateOperationArray = updateOperationArray.slice(0),
                clonedOfflineObjectsToClear = offlineObjectsToClear.slice(0);

            return myDB
            .open()
            .then(function (db) {

                var table = db[selector.type],
                    operationTable = self.operationTable;
            //Transaction:
                //Objects to put: 
                //      rawDataArray
                //      updateOperationArray
                //Objects to delete: 
                //      offlineObjectsToClear in table and operationTable

                db.transaction('rw', table, operationTable, function () {

                        return Dexie.Promise.all(
                            [table.bulkPut(clonedRawDataArray),
                            operationTable.bulkPut(clonedUpdateOperationArray),
                            table.bulkDelete(clonedOfflineObjectsToClear),
                            operationTable.bulkDelete(clonedOfflineObjectsToClear)]);

                }).then(function(value) {
                    //console.log(selector.type + ": performOfflineSelectorChanges succesful: "+rawDataArray.length+" rawDataArray, "+clonedUpdateOperationArray.length+" updateOperationArray");
                }).catch(function(e) {
                        console.log(selector.type + ": performOfflineSelectorChanges failed",e);
                        console.error(e);
                });
            });

        }
    },

    registerOfflinePrimaryKeyDependenciesForData: {
        value: function(data, tableName, primaryKeyPropertyName) {

            if(data.length === 0) return;

            OfflineService.registerOfflinePrimaryKeyDependenciesForData(data, tableName, primaryKeyPropertyName, this);
        }
    },

    //TODO
    deleteOfflinePrimaryKeyDependenciesForData: {
        value: function(data, tableName, primaryKeyPropertyName) {
                        if(data.length === 0) return;

            var tableSchema = this.schema[tableName],
                //if we don't have a known list of foreign keys, we'll consider all potential candidate
                foreignKeys = tableSchema.foreignKeys;


            OfflineService.deleteOfflinePrimaryKeyDependenciesForData(data, tableName, primaryKeyPropertyName, foreignKeys);
        }
    },

    /**
     * Save new data passed in objects of type
     *
     * @method
     * @argument {Object} objects   - objects whose data should be created.
     * @argument {String} type   - type of objects, likely to mean a "table" in storage 
     * @returns {external:Promise} - A promise fulfilled when all of the data in
     * the changed object has been saved.
     */
    createData: {
        value: function (objects, type, context) {
            var self = this;

            return new Promise(function (resolve, reject) {
                var myDB = self._db,
                table = self.tableNamed(type),
                operationTable = self.operationTable,
                clonedObjects = [],
                operations = [],
                primaryKey = table.schema.primKey.name,
                dataID = self.dataIDPropertyName,
                lastModifiedPropertyName = self.lastModifiedPropertyName,
                lastModified = Date.now(),
                typePropertyName = self.typePropertyName,
                changesPropertyName = self.changesPropertyName,
                operationPropertyName = self.operationPropertyName,
                operationCreateName = self.operationCreateName,
                primaryKeys = [];


                myDB.open().then(function (db) {
                    db.transaction('rw', table, operationTable, 
                        function () {

                            //Assign primary keys and build operations
                            for(var i=0, countI = objects.length, iRawData, iPrimaryKey;i<countI;i++) {
                                if((iRawData = objects[i])) {

                                    //Set offline uuid based primary key
                                    iRawData[primaryKey] = iPrimaryKey = uuid.generate();

                                    //keep track of primaryKeys:
                                    primaryKeys.push(iPrimaryKey);

                                    clonedObjects.push(iRawData);

                                    //Create the record to track of last modified date
                                    iOperation = {};
                                    iOperation[dataID] = iPrimaryKey;
                                    iOperation[lastModifiedPropertyName] = lastModified;
                                    iOperation[typePropertyName] = type;
                                    iOperation[changesPropertyName] = iRawData;
                                    iOperation[operationPropertyName] = operationCreateName;
                                    iOperation.context = context;

                                    operations.push(iOperation);
                                }
                            }

                            return Dexie.Promise.all([table.bulkAdd(clonedObjects),operationTable.bulkAdd(operations)]);

                        }).then(function(value) {
                            //Now write new offline primaryKeys
                            OfflineService.writeOfflinePrimaryKeys(primaryKeys).then(function() {
                                OfflineService.fetchOfflinePrimaryKeys().then(function(offlinePrimaryKeys) {
                                    console.log(offlinePrimaryKeys);
                                });

                                //Once this succedded, we need to add our temporary primary keys bookeeping:
                                //Register potential temporary primaryKeys
                                self.registerOfflinePrimaryKeyDependenciesForData(objects, table.name, primaryKey);

                                resolve(objects.length);
                            })
                            .catch(function(e) {
                                reject(e);
                                console.error(e);
                            });
                            //console.log("tableName: added Offline Data, ",objects.length," objects");
                        }).catch(function(e) {
                            reject(e);
                            // console.log("tableName:failed to addO ffline Data",e)
                            console.error(e);
                        });
                    }
                );
            });
        }
    },

    /**
     * Save updates made to an array of existing data objects.
     *
     * @method
     * @argument {Object} objects   - objects whose data should be updated.
     * @argument {String} type   - type of objects, likely to mean a "table" in storage 
     * @returns {external:Promise} - A promise fulfilled when all of the data in
     * objects has been saved.
     */
    updateData: {
        value: function (objects, type, context) {
            var self = this;
            if(!objects || objects.length === 0) return Dexie.Promise.resolve();
            
            return new Promise(function (resolve, reject) {
                var myDB = self._db,
                table = self.tableNamed(type),
                operationTable = self.operationTable,
                clonedObjects = objects.slice(0),
                operations = [],
                primaryKey = table.schema.primKey.name,
                dataID = self.dataIDPropertyName,
                lastModifiedPropertyName = self.lastModifiedPropertyName,
                lastModified = Date.now(),
                updateDataPromises = [],
                typePropertyName = self.typePropertyName,
                changesPropertyName = self.changesPropertyName,
                operationPropertyName = self.operationPropertyName,
                operationUpdateName = self.operationUpdateName;




                myDB.open().then(function (db) {
                    db.transaction('rw', table, operationTable, 
                        function () {
                            //Make a clone of the array and create the record to track the online Last Updated date 
                            for(var i=0, countI = objects.length, iRawData,iPrimaryKey;i<countI;i++) {
                                if((iRawData = objects[i])) {
                                    iPrimaryKey = iRawData[primaryKey];
                                    console.log("updateData ",iPrimaryKey,iRawData);
                                    updateDataPromises.push(table.update(iPrimaryKey, iRawData));

                                    //Create the record to track of last modified date
                                    iOperation = {};
                                    iOperation[dataID] = iPrimaryKey;
                                    iOperation[lastModifiedPropertyName] = lastModified;
                                    iOperation[typePropertyName] = type;
                                    iOperation[changesPropertyName] = iRawData;
                                    iOperation[operationPropertyName] = operationUpdateName;
                                    iOperation.context = context;

                                    updateDataPromises.push(operationTable.put(iOperation));
                                }
                            }
                            return Dexie.Promise.all(updateDataPromises);

                        }).then(function(value) {
                            //Once this succedded, we need to add our temporary primary keys bookeeping:
                            //Register potential temporary primaryKeys
                            self.registerOfflinePrimaryKeyDependenciesForData(objects, table.name, primaryKey);


                            resolve(clonedObjects);
                            //console.log(table.name,": updateData for ",objects.length," objects succesfully",value);
                        }).catch(function(e) {
                            reject(e);
                            // console.log("tableName:failed to addO ffline Data",e)
                            console.error(table.name,": failed to updateData for ",objects.length," objects with error",e);
                        });
                    }
                );

            });
        }
    },

    /**
     * Delete data passed in array.
     *
     * @method
     * @argument {Object} objects   - objects whose data should be saved.
     * @argument {String} type   - type of objects, likely to mean a "table" in storage 
     * @returns {external:Promise} - A promise fulfilled when all of the data in
     * the changed object has been saved.
     */
    deleteData: {
        value: function (objects, type, context) {
            var self = this;
            if(!objects || objects.length === 0) return Dexie.Promise.resolve();
            
            return new Promise(function (resolve, reject) {
                var myDB = self._db,
                table = self.tableNamed(type),
                operationTable = self.operationTable,
                clonedObjects = objects.slice(0),
                operations = [],
                primaryKey = table.schema.primKey.name,
                dataID = self.dataIDPropertyName,
                lastModifiedPropertyName = self.lastModifiedPropertyName,
                lastModified = Date.now(),
                updateDataPromises = [],
                typePropertyName = this.typePropertyName,
                changesPropertyName = this.changesPropertyName,
                operationPropertyName = this.operationPropertyName,
                operationDeleteName = this.operationDeleteName;

                myDB.open().then(function (db) {
                    db.transaction('rw', table, operationTable, 
                        function () {
                            //Make a clone of the array and create the record to track the online Last Updated date 
                            for(var i=0, countI = objects.length, iRawData,iPrimaryKey;i<countI;i++) {
                                if((iRawData = objects[i])) {
                                    iPrimaryKey = iRawData[primaryKey];
                                    updateDataPromises.push(table.delete(iPrimaryKey, iRawData));

                                    //Create the record to track of last modified date
                                    iOperation = {};
                                    iOperation[dataID] = iPrimaryKey;
                                    iOperation[lastModifiedPropertyName] = lastModified;
                                    iOperation[typePropertyName] = type;
                                    // iOperation[changesPropertyName] = iRawData;
                                    iOperation[operationPropertyName] = operationDeleteName;
                                    iOperation.context = context;

                                    updateDataPromises.push(operationTable.put(iPrimaryKey, iOperation));
                                }
                            }
                            return Dexie.Promise.all(updateDataPromises);

                        }).then(function(value) {

                                //Once this succedded, we need to add our temporary primary keys bookeeping:
                                //Register potential temporary primaryKeys
                                self.deleteOfflinePrimaryKeyDependenciesForData(objects);


                            resolve(clonedObjects);
                            //console.log(table.name,": updateData for ",objects.length," objects succesfully",value);
                        }).catch(function(e) {
                            reject(e);
                            // console.log("tableName:failed to addO ffline Data",e)
                            console.error(table.name,": failed to updateData for ",objects.length," objects with error",e);
                        });
                    }
                );

            });
        }
    },

    deleteOfflineOperations: {
        value: function (operations) {
            var self = this;

            if(!operations || operations.length === 0) return Promise.resolve();
            
            return new Promise(function (resolve, reject) {
                var myDB = self._db,
                operationTable = self.operationTable,
                primaryKey = operationTable.schema.primKey.name,
                deleteOperationPromises = [];

                myDB.open().then(function (db) {
                    db.transaction('rw', operationTable, 
                        function () {
                            //Make a clone of the array and create the record to track the online Last Updated date 
                            for(var i=0, countI = operations.length, iOperation;i<countI;i++) {
                                if((iOperation = operations[i])) {
                                    deleteOperationPromises.push(operationTable.delete(iOperation[primaryKey], iOperation));
                                }
                            }
                            return Dexie.Promise.all(deleteOperationPromises);

                    }).then(function(value) {
                        resolve();
                        //console.log(table.name,": updateData for ",objects.length," objects succesfully",value);
                    }).catch(function(e) {
                        reject(e);
                        // console.log("tableName:failed to addO ffline Data",e)
                        console.error(table.name,": failed to updateData for ",objects.length," objects with error",e);
                    });
                });

            });
        }
    }
},
    {
        __offlinePrimaryKeyDB: {
            value:null
        },
        _offlinePrimaryKeyDB: {
            get: function() {
                if(!this.__offlinePrimaryKeyDB) {
                    var db = this.__offlinePrimaryKeyDB = new Dexie("OfflinePrimaryKeys"),
                        primaryKeysTable = db["PrimaryKeys"];

                    if(!primaryKeysTable) {
                        /*   PrimaryKeys has offlinePrimaryKey and a property "dependencies" that contains an array of 
                            {
                                offlinePrimaryKey:"uuid-1111-4444-5555",
                                dependencies:[
                                    {
                                        tableName:"BlahTable", 
                                        primaryKey:"uuid-1233-3455", 
                                        foreignKeyName:"foo_ID"
                                    }
                                ]
                            }
                                This tells us that the primaryKey "uuid-1111-4444-5555" appears as a foreignKey named "foo_ID" of the record in "BlahTable" that has the primaryKey value of "uuid-1233-3455" 
                        */

                        var newDbSchema = {
                            PrimaryKeys: "offlinePrimaryKey,dependencies.tableName, dependencies.primaryKey, dependencies.foreignKeyName"
                        };
                        db.version(db.verno+1).stores(newDbSchema);
                    }

                }
                return this.__offlinePrimaryKeyDB;
            }
        },
        _primaryKeysTable: {
            value:null
        },

        primaryKeysTable: {
            get: function() {
                return this._primaryKeysTable || (this._primaryKeysTable = this._offlinePrimaryKeyDB.PrimaryKeys);
            }
        },

        writeOfflinePrimaryKey: {
            value: function(aPrimaryKey) {
                return this.writeOfflinePrimaryKeys([aPrimaryKey]);
            }
        },

        writeOfflinePrimaryKeys: {
            value: function(primaryKeys) {
                var db = this._offlinePrimaryKeyDB,
                    table = this.primaryKeysTable,
                    primaryKeysRecords = [],
                    self = this;

                for(var i=0, countI = primaryKeys.length, iRawData, iPrimaryKey;i<countI;i++) {
                    primaryKeysRecords.push({
                        offlinePrimaryKey: primaryKeys[i]
                    })
                }
                return new Promise(function (resolve, reject) {
                    var i, iPrimaryKey,
                        _offlinePrimaryKeys = self._offlinePrimaryKeys;

                    table.bulkAdd(primaryKeysRecords)
                    .then(function(lastKey) {
                        self.fetchOfflinePrimaryKeys()
                        .then(function(offlinePrimaryKeys) {

                            //Update local cache:
                            for(i=0;(iPrimaryKey = primaryKeys[i]);i++) {
                                offlinePrimaryKeys.add(iPrimaryKey.offlinePrimaryKey,primaryKeysRecords[i]);
                            }
                            resolve(lastKey);
                        });
                    })
                    .catch(function(e){
                        console.error("deleteOfflinePrimaryKeys failed",e);
                        reject(e);
                    });

                });
            }
        },

        registerOfflinePrimaryKeyDependenciesForData: {
            value: function(data, tableName, primaryKeyPropertyName, service) {

                if(data.length === 0) return;

                var keys = Object.keys(data[0]),
                    i, iData, countI,
                    j, jProperty, jPropertyValue, jPrimaryKey,
                    offlineService = OfflineService,
                    tableSchema = service.schema[tableName],
                    //if we don't have a known list of foreign keys, we'll consider all potential candidate
                    foreignKeys = tableSchema.foreignKeys,
                    updatedRecord, updatedRecords
                    self = this;

                if(!foreignKeys) {
                    foreignKeys = tableSchema._computedForeignKeys 
                                    || (tableSchema._computedForeignKeys = new Set(keys));
                }

                //We need the cache populated from storage before we can do this:
                this.fetchOfflinePrimaryKeys()
                    .then(function(offlinePrimaryKeys) {

                        for(i=0, countI = data.length;(i<countI);i++) {
                            iData = data[i];
                            for(j=0;(jProperty = keys[j]);j++) {
                                if(foreignKeys.has(jProperty)) {
                                    jPrimaryKey = iData[primaryKeyPropertyName];
                                    jPropertyValue = iData[jProperty];
                                    if(updatedRecord = self.addPrimaryKeyDependency(jPropertyValue, tableName,jPrimaryKey,jProperty)) {
                                        updatedRecords = updatedRecords || [];
                                        updatedRecords.push(updatedRecord);
                                    }
                                }
                            }
                        }


                        if(updatedRecords && updatedRecords.length) {
                            //We need to save:
                            this.primaryKeysTable.bulkPut(updatedRecords)
                            .then(function(lastKey) {
                                console.log("Updated  offline primaryKeys dependencies" + lastKey); // Will be 100000.
                            }).catch(Dexie.BulkError, function (e) {
                                console.error (e);
                            });

                        }
                });
            }
        },

        deleteOfflinePrimaryKeyDependenciesForData: {
            value: function(data, tableName, primaryKeyPropertyName, tableForeignKeys) {
                
            }
        },

       /**
        * this assumes this._offlinePrimaryKeys has already been fetched    
        * @returns {Object} - if we found a record to uypdate, returns it
        * otherwise returns null
        */

        addPrimaryKeyDependency: {
            value: function(aPrimaryKey, tableName, tablePrimaryKey, tableForeignKey) {

                if(this._offlinePrimaryKeys.has(aPrimaryKey)) {
                    var aPrimaryKeyRecord = this._offlinePrimaryKeys.get(aPrimaryKey),
                        dependencies = aPrimaryKeyRecord.dependencies,
                        i, iDependency, found = false,
                        primaryKeysRecord;

                    //Now we search for a match... whish we could use an in-memory
                    //compound-index...
                    for(i=0;(iDependency = dependencies[i]);i++) {
                        if( iDependency.tableName === tableName
                            && iDependency.primaryKey === tablePrimaryKey
                            && iDependency.foreignKeyName === tableForeignKey) {
                                found = true;
                                break;
                            }
                    }
                    if(!found) {
                        primaryKeysRecord = {
                            tableName:tableName, 
                            primaryKey:tablePrimaryKey, 
                            foreignKeyName:tableForeignKey
                        };
                        dependencies.push(primaryKeysRecord);
                        return aPrimaryKeyRecord;
                    }
                    return null;
                }
            }
        },

        /**
         * caches the primary keys only
         */

        _offlinePrimaryKeys: {
            value: null
        },        
        _offlinePrimaryKeysPromise: {
            value: null
        },
        fetchOfflinePrimaryKeys: {
            value: function() {
                if(!this._offlinePrimaryKeys) {
                    var _offlinePrimaryKeys = this._offlinePrimaryKeys = new Map(),
                        self = this;
                    return new Promise(function (resolve, reject) {
                        self._offlinePrimaryKeyDB.PrimaryKeys.each(function (item, cursor) {
                            _offlinePrimaryKeys.set(item.offlinePrimaryKey,item);
                         })
                         .then(function() {
                             resolve(_offlinePrimaryKeys);
                         })
                         .catch(function(e){
                             console.error("fetchOfflinePrimaryKeys failed",e);
                             reject(e);
                         });
                    });
                }
                else {
                    if(!this._offlinePrimaryKeysPromise) {
                        this._offlinePrimaryKeysPromise = Promise.resolve(this._offlinePrimaryKeys);
                    }
                    return this._offlinePrimaryKeysPromise;
                }
            }
        },
        deleteOfflinePrimaryKeys: {
            value: function (primaryKeys) {
                var self = this,
                    _offlinePrimaryKeys = this._offlinePrimaryKeys;

                if(!primaryKeys || primaryKeys.length === 0) return Promise.resolve();
            
                return new Promise(function (resolve, reject) {
                    self._offlinePrimaryKeyDB.PrimaryKeys.bulkDelete(primaryKeys)
                    .then(function() {
                        //Update local cache:
                        for(var i=0, iPrimaryKey;(iPrimaryKey = primaryKeys[i]);i++) {
                            _offlinePrimaryKeys.delete(iPrimaryKey.offlinePrimaryKey);
                        }
                        resolve();
                    })
                    .catch(function(e){
                        console.error("deleteOfflinePrimaryKeys failed",e);
                        reject(e);
                    });
                })
            }
        }
    });
