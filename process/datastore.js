// file stores data store class
const Kernel = require('./kernel.js')

// abstraction over store object
var Datastore = function() {
    // private store object
    var store = {}

    // add / update an entry
    this.set = function(key, value, timestamp = null) {
        if (!key || !value) {
            throw Error("ArgumentException")
        }
        
        if (!timestamp) {
            timestamp = Kernel.getTimestamp()
        } else {
            timestamp = parseInt(timestamp);
        }
        
        if (key in store) {
            if (store[key].timestamp > timestamp) {
                throw Error ("store fresher than requested")
            }
        }

        store[key] = {
            value: value,
            timestamp: timestamp
        }
    }

    // get the value for the input key
    this.get = function(key) {
        if (!key) {
            throw Error("ArgumentException")
        }

        if (key in store) return store[key];
        return null;
    }

    // check if the store has the key
    this.has = function(key) {
        if (!key) {
            throw Error("ArgumentException")
        }

        return key in store;
    }

    // delete a key
    this.delete = function(key) {
        if (!key) {
            throw Error("ArgumentException")
        }

        if (key in store) {
            delete store[key];
        } else {
            throw Error('key not found in store')
        }
    }

    // Remove the keys that do not belong to self
    this.removeStabalsiedKeys = function (index, max, maxReplicas) {
        if (index === null || index === undefined || !max || !maxReplicas) {
            throw Error("ArgumentException")
        }
        
        var $this = this;
        Object.keys(store).forEach(function(key) {
            var indexes = Kernel.hashKey(key, max, maxReplicas);
            if (indexes.indexOf(index) == -1) {
                $this.delete(key);
            }
        });
    }

    // iterate through all keys and look for remapping
    this.getRemappedData = function(index, max, maxReplicas) {
        if (index === null || index === undefined || !max || !maxReplicas) {
            throw Error("ArgumentException")
        }

        var $this = this;
        var stabalisationMetadata = {};
        Object.keys(store).forEach(function(key) {
            var indexes = Kernel.hashKey(key, max, maxReplicas);
            // if (indexes.indexOf(index) == -1) {
            indexes.forEach(function(_index) {
                if (_index === index) return;

                if (!(_index in stabalisationMetadata)) {
                    stabalisationMetadata[_index] = [];
                }

                stabalisationMetadata[_index].push({key: key, value: $this.get(key)});
            });
            // }
        });

        return stabalisationMetadata;
    }
}

module.exports = Datastore;



