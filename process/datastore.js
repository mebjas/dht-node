// file stores data store class
const Kernel = require('./kernel.js')

// abstraction over store object
var Datastore = function() {
    // private store object
    var store = {}

    // add / update an entry
    this.set = function(key, value, timestamp = null) {
        if (!timestamp) timestamp = Kernel.getTimestamp()
        
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
        if (key in store) return store[key];
        return null;
    }

    // check if the store has the key
    this.has = function(key) {
        return key in store;
    }

    // delete a key
    this.delete = function(key) {
        if (key in store) {
            delete store[key];
        } else {
            throw Error('key not found in store')
        }
    }
}

module.exports = Datastore;



