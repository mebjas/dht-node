//// library to maintain core methods
//// Most of the network calls shall be made from here.
//// Mutliple instances of this class are not needed;
//// this can pretty well be a singleton class;

const sprintf = require("sprintf").sprintf;
const request = require('request');

var _kernel;

var Kernel = {
    // disemminator of any request
    // @param: port (int)
    send: function(port, path, type, object, callback, errcallback) {
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
            throw Error("NotImplementedException");
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
        return Math.floor((Math.random() * (max - min) % (max-min))) + min;
    },

    shuffle: function(array) {
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
    }
}

module.exports = Kernel;
