// file has class and methods to deal with ring topology in cassandra
// like architecture

const express = require('express')
const sprintf = require('sprintf').sprintf;
const Membership = require('./membership.js')
const Datastore = require('./datastore.js')
const Kernel = require('./kernel.js')

// topology class
var Topology = function(app, port, introducer = null) {
    // REGION: Public variables
    this.app = app;
    this.port = port;
    this.datastore = new Datastore()
    this.maxReplicas = 3;                       // Max no of replica of a data
    this.quorumCount = 2;                       // Votes needed in Quorum

    // REGION: private variables ---------------------------------------------
    var $this = this;
    var id = Kernel.hashPort(this.port);        // self id
    var list = [id];                            // list of virtual IDS
    var listPortMapping = {};                   // mapping of id to port
    listPortMapping[id] = this.port;
    
    // REGION: Private methods ---------------------------------------------

    // stabalisation to perform when a new member joins - TODO: complete this
    var joinStabalisation = function(joinPort) {
        // for each K in datastore check what should belong here
        // and as to where they should belong. if they should belong
        // to new node / a node which doesn't already have it
        // club the data, and send it to them.
        // A given node should only be conserned about it's adjoining
        // maxReplicas - 1 nodes in the ring.

        // once sent to all, delete from here;
        // assume list is sorted; look for the position of this port
        var joinPortId = Kernel.hashPort(joinPort);
        listPortMapping[joinPortId] = joinPort;
        var stabalisationNeeded = false;
        if (list.indexOf(joinPortId) != -1) {
            console.log("STABALISATION_HALT, already in: ", joinPort, joinPortId);
            return;
        }

        list.push(joinPortId);
        list.sort(function(a, b) {
            return (a > b) ? 1 : -1;
        });
        // var newIndex = this.list.indexOf(this.id);
        // var joinPortIndex = this.list.indexOf(joinPortId);

        // check if joinPortIndex is in newIndex + maxReplicast % ring size

        // console.log("JOINSTABALISATION")
        // console.log(list)

        // TODO: implement this;
    }

    // statbalisation to perform when an old member leaves
    var churnStabalisation = function(chrunPort) {
        // TODO;
    }
    
    // REGION: Constuctor code ---------------------------------------------
    this.membership = new Membership(app, port, joinStabalisation, churnStabalisation);
    if (introducer) {
        this.membership.sendJoinReq(introducer);
    }

    // Initialize the internal apis  --------
    // READ API
    this.app.get('/d/read', function(req, res) {
        var key = req.query.key;
        console.log(sprintf("dREAD: %s", key));
        if (!key) {
            res.status(400).send('Key missing in query');
        } else {
            res.json({value: $this.datastore.get(key)});
        }
    })

    // READ REPAIR API
    this.app.post('/d/readrepair', function(req, res) {
        var data = req.body.data;
        console.log(sprintf("dREADREPAIR: %s", data.key));
        if (!data || !data.key || !data.value) {
            return res.status(400).send('Key missing; bad request');
        }

        data.value.timestamp = parseInt(data.value.timestamp);

        if (!$this.datastore.has(data.key)) {
            return res.status(400).send('key not found');
        } else if ($this.datastore.get(data.key).timestamp < data.value.timestamp) {
            $this.datastore.set(data.key, data.value.value, data.value.timestamp);
        }
        res.json({ack: true});
    })

    // WRITE API
    this.app.post('/d/write', function(req, res) {
        var key = req.body.key;
        var value = req.body.value;

        if (!key || !value) {
            return res.status(400).send("Key or Value missing");
        }
        console.log(sprintf("dWRITE: %s, val: %s", key, value));

        $this.datastore.set(key, value);
        res.json({ack: true});
    });

    // DELETE API
    this.app.delete('/d/delete', function(req, res) {
        var key = req.query.key;
        console.log(sprintf("dDELETE: %s", key));
        
        if (!key) {
            res.status(400).send('Key missing in query');
        } else {
             try {
                $this.datastore.delete(key);
            }
            catch (ex) {
                console.log("Key delete error; " +ex.message);
            }
            res.json({ack: true})
        }
    });
    
    // REGION: public methods that shall use private variables
    // TODO: below three methods seems to have some code overlap
    // check what can be taken out of it;
    
    // Method to get the key
    this.get = function(key, callback) {
        if (!key || !callback) {
            throw Error("ArgumentException")
        }

        // TODO: if stabalisation going on wait for it to finish;
        // set a timeout and maybe fail with 5xx error if it 
        // doesn't finish before that;
        var indexes = Kernel.hashKey(key, list.length, this.maxReplicas);
        var responses = [];

        var responseCallback = function() {
            if (responses.length != indexes.length) return;

            // look at +ve responses, count and get val;
            var val = null, positiveCount = 0;
            responses.forEach(function(response) {
                if (response != null && response.value != null) {
                    ++positiveCount;
                    if (val) {
                        if (response.value.timestamp > val.value.timestamp) {
                            if (response.value.value != val.value.value) {
                                // send a read-repair to by
                                Kernel.send(
                                    val.by,
                                    "d/readrepair",
                                    "POST",
                                    {data: {key: key, value: val.value}},
                                    function(response, body) {
                                        // console.log(body);
                                    }, function(err) {
                                        console.log(err);
                                    }
                                );
                            }
                            val = response;
                        }
                    } else {
                        val = response;
                    }
                }
            });

            if (indexes.length < $this.quorumCount) {
                if (positiveCount != indexes.length) callback(null);
                else callback(val.value);
            } else if (positiveCount < $this.quorumCount) {
                callback(null);
            } else {
                callback(val.value);
            }
        }

        indexes.forEach(function(index) {
            var port = listPortMapping[list[index]];
            if (port == $this.port) {
                responses.push({
                    value: $this.datastore.get(key),
                    by: port
                });
                responseCallback();
            } else {
                // send request to port
                Kernel.send(
                    port,
                    "d/read",
                    "GET",
                    sprintf("key=%s", key),
                    function(resp, body) {
                        try {
                            responses.push({
                                value: JSON.parse(body).value,
                                by: port
                            });
                        } catch (ex) {
                            responses.push(null);
                        }
                        responseCallback();
                    }, function(err) {
                        responses.push(null);
                        responseCallback();
                    }
                );
            }
        });
    }

    // Method to set the key
    this.set = function(key, value, callback) {
        if (!key || !value || !callback) {
            throw Error("ArgumentException");
        }

        // TODO: if stabalisation going on wait for it to finish;
        // set a timeout and maybe fail with 5xx error if it 
        // doesn't finish before that;

        var indexes = Kernel.hashKey(key, list.length, this.maxReplicas);
        var responses = [];

        var responseCallback = function() {
            if (responses.length != indexes.length) return;
            var positiveCount = 0;
            responses.forEach(function(response) {
                if (response) positiveCount++;
            });

            if (indexes.length < $this.quorumCount) {
                if (positiveCount != indexes.length) {
                    callback(Error('Unable to write to quorum'));
                } else callback(null);
            } else if (positiveCount < $this.quorumCount) {
                callback(Error('Unable to write to quorum'));
            } else callback(null);
        }

        indexes.forEach(function(index) {
            var port = listPortMapping[list[index]];
            if (port == $this.port) {
                $this.datastore.set(key, value);
                responses.push(true);
                responseCallback();
            } else {
                // send request to port
                Kernel.send(
                    port,
                    "d/write",
                    "POST",
                    {key: key, value: value},
                    function(resp, body) {
                        responses.push(true);
                        responseCallback();
                    }, function(err) {
                        responses.push(false);
                        responseCallback();
                    }
                );
            }
        });
    }

    // Method to delete a key
    this.delete = function(key, callback) {
        if (!key || !callback) {
            throw Error("ArgumentException")
        }

        // TODO: if stabalisation going on wait for it to finish;
        // set a timeout and maybe fail with 5xx error if it 
        // doesn't finish before that;

        var indexes = Kernel.hashKey(key, list.length, this.maxReplicas);
        var responses = [];

        var responseCallback = function() {
            if (responses.length != indexes.length) return;
            var positiveCount = 0;
            responses.forEach(function(response) {
                if (response) positiveCount++;
            });

            if (indexes.length < $this.quorumCount) {
                if (positiveCount != indexes.length) {
                    callback(Error('Unable to delete from quorum'));
                } else callback(null);
            } else if (positiveCount < $this.quorumCount) {
                callback(Error('Unable to delete from quorum'));
            } else callback(null);
        }

        indexes.forEach(function(index) {
            var port = listPortMapping[list[index]];
            if (port == $this.port) {
                try {
                    $this.datastore.delete(key);
                } catch (ex) {
                    console.log("EX while self delete; ", ex.message)
                }
                responses.push(true);
                responseCallback();
            } else {
                // send request to port
                Kernel.send(
                    port,
                    "d/delete",
                    "DELETE",
                    "key=" +key,
                    function(resp, body) {
                        responses.push(true);
                        responseCallback();
                    }, function(err) {
                        responses.push(false);
                        responseCallback();
                    }
                );
            }
        });
    }
}

module.exports = Topology;