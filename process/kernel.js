//// library to maintain core methods
//// Most of the network calls shall be made from here.
//// Mutliple instances of this class are not needed;
//// this can pretty well be a singleton class;

const request = require('request');
const sha1 = require('sha1');
const sprintf = require('sprintf').sprintf;

var Kernel = {
    // disemminator of any request
    // @param: port (int)
    send: function(port, path, type, object, callback, errcallback) {
        if (!port || !path || !type) {
            throw Error("ArgumentException");
        }
        
        var url = sprintf("http://localhost:%d/%s", port, path);
        switch (type) {
            case "GET":
            // assumption - object is of form a=b&c=d
            url += '?' +object;
            request.get(url, function(err, response, body) {
                if (err && errcallback) errcallback(err);
                if (!err && callback) callback(response, body);
            });
            break;

            case "POST":
            request.post(url, {form: object}, function(err, response, body) {
                if (err && errcallback) errcallback(err);
                if (!err && callback) callback(response, body);
            });
            break;

            case "DELETE":
            url += '?' +object;
            request.delete(url, function(err, response, body) {
                if (err && errcallback) errcallback(err);
                if (!err && callback) callback(response, body);
            });
            break;
            default:
            throw Error(sprintf("Unknown request type: %s", type))
        }
    },
    // static method to get current timestamp
    getTimestamp: function() {
        return (new Date()).getTime();
    },

    // random generator
    random: function(min, max) {
        if (min > max) {
            throw Error("Invalid args; min need to be <= max");
        }

        return Math.floor((Math.random() * (max - min) % (max-min))) + min;
    },

    // Method to shuffle an array
    shuffle: function(array) {
        if (!array) {
            throw Error("ArgumentException");
        }

        var currentIndex = array.length, temporaryValue, randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
            if (Math.random() > 0.5) continue;

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        // shallow copy?
        tmp = []
        array.forEach(function(a) {tmp.push(a)})
        return tmp;
    },

    // method to calculate hash count of any key
    hash: function(key) {
        if (!key) {
            throw Error("ArgumentException");
        }

        var hash = 0
        for (i = 0; i < key.length; i++) {
            if (key[i].charCodeAt(0) < 97) {
                hash += (key[i].charCodeAt(0) - 48);
            } else {
                hash += ((key[i].charCodeAt(0) - 97) + 10);
            }
        }
        return hash;
    },

    // hash function for port. Note: this is very naive method
    // But will give unique values for ports between [8080, 8336)
    hashPort: function(port) {
        if (!port) {
            throw Error("ArgumentException");
        }

        if (port < 8080 || port >= 8336) {
            throw Error("port has to be in range of [8080, 8336)")
        }

        // return this.hash(sha1(port).substr(0, 40))
        return port - 8080;
    },

    // find the index position of given key in DHT
    hashKey: function(key, max, maxReplicas) {
        if (max < 1 || maxReplicas < 1 || !key) {
            throw Error("ArgumentException");
        }

        var indexes = [];
        if (max < maxReplicas) {
            for(i = 0; i < max; i++) indexes.push(i);
        } else {
            var _hash = this.hash(sha1(key));
            for (i = 0; i < maxReplicas; i++) {
                indexes.push((_hash + i)% max);
            }
        }
        return indexes;
    },

    // Method to check if 
    isAReplica: function(index1, index2, ringSize) {

    }
}

module.exports = Kernel;
