// file has class and methods to deal with membership protocol
// attempted to implement SWIM protocol

const express = require('express')
const sprintf = require('sprintf').sprintf;
const Kernel = require('./kernel.js');

// An enum representing node state
var NodeStateEnum = {
    Active: "active",
    Suspicious: "suspicious"
}

// The membership class - constuctor
var Membership = function(app, port, joincb, churncb) {
    // ----------- PRIVATE VARS --------------------------------
    const ENVIRONMENT = process.env.NODE_ENV;
    var $this = this;

    // ----------- PUBLIC VARS --------------------------------
    // initialize with these variables
    // TODO: make all these private variables
    // bring in the public methods
    this.app = app;
    this.port = port;
    this.joincb = joincb;
    this.churncb = churncb;

    // Membership list - initialised with self
    // TODO: make this member private, provide public methods
    // to expose;
    this.list = {};
    this.pinglist = [];

    // local counts
    this.joinReqRetryCount = 0;                 // count of attempts of joinreq
    this.joinReqRetryCountThreshold = 3;        // threshold for above count
    this.joinReqRetryCountTimeout = 1000;       // timeout for join req
    this.protocolPeriod = 2 * 1000;             // protocol period
    this.KMax = 1;                              // no of K for ping_req
    this.suspisionLimit = 2;                    // No of times of protocol period
                                                // a node under suspision will be
                                                // kept in quarentine

    // ------------ private methods ----------------------------------------
    // Method to generate a list entry
    var createListEntry = (heartbeat, timestamp, status) => {
        if (!status) status = NodeStateEnum.Active;

        return {
            heartbeat: heartbeat,
            timestamp: timestamp,
            status: status
        };
    }

    // Get a random node to ping, round robin on all nodes
    // Algorithm: Every time the ping list is empty, it's filled
    // with shuffled array of all other nodes active in membership list
    // The keep shifting array untill an active node is found;
    var getNextNodeToPing = () => {
        // randomly choose an entry other than self
        var receiverPort = 0;
        while (!receiverPort) {
            if (Object.keys($this.list).length <= 1) return 0;
            if ($this.pinglist.length == 0) {

                tmp = []
                Object.keys($this.list).forEach(function(key) {
                    if (key != $this.port && $this.list[key].status == NodeStateEnum.Active)
                        tmp.push(key);
                });
                if (tmp.length == 0) return 0;
                $this.pinglist = Kernel.shuffle(tmp);
            }
            var key = $this.pinglist.shift();
            if (key in $this.list && $this.list[key].status == NodeStateEnum.Active)
                receiverPort = key;
        }
        return parseInt(receiverPort);
    }

    // ----------- PUBLIC METHODS --------------------------------------------
    // Helper method to add a new node entry to list
    this.addToList = (port, heartbeat) => {
        this.list[port] = createListEntry(heartbeat, Kernel.getTimestamp());

        if (ENVIRONMENT != Kernel.Constants.TestEnv) {
            console.log("JOINED: " +port);
        }

        if (this.joincb) this.joincb(port);
    }

    // Helper class to update self heartbeat
    this.updateMyHeartbeat = () => {
        this.list[this.port].heartbeat = Kernel.getTimestamp();
    }

    // Helper method to update the membership list
   this.updateList = (port, status, heartbeat = null) => {
        // todo: if during a gossip, the node recieves itself
        // as suspicious or failed to other node, it should send
        // a gossip with updated incarnation number

        if (port === this.port) return this.updateMyHeartbeat();

        if (heartbeat == null) {
            if (!(port in this.list)) return;

            this.list[port] = 
                createListEntry(Kernel.getTimestamp(), Kernel.getTimestamp(), status);
        } else if (this.list[port].heartbeat < heartbeat) {
            this.list[port] = 
                createListEntry(heartbeat, Kernel.getTimestamp(), status);

            // if the state comes out to be suspicious
            // remove the entry after some timeout
            if (status === NodeStateEnum.Suspicious) {
                setTimeout(function() {
                    if (!(port in this.list)) return;
                    if (this.list[port].status !== NodeStateEnum.Active) {
                        if (ENVIRONMENT !== Kernel.Constants.TestEnv) {
                            console.log("failed: %s", port);
                        }

                        delete this.list[port];
                        if ($this.churncb) $this.churncb(port)
                    } else {
                        if (ENVIRONMENT !== Kernel.Constants.TestEnv) {
                            console.log("suspicion over: %s", port)
                        }
                    }
                }.bind(this), this.protocolPeriod * this.suspisionLimit);
            }
        }
    }

    // Method to  initialize listeners
    this.init = () => {
        // listener to join request
        this.app.get('/m/JOINREQ', function (req, res) {
            // TODO: null checks

            var reqPort = parseInt(req.query.port);
            if (ENVIRONMENT === Kernel.Constants.VerboseEnv) {
                console.log("m/JOINREQ FROM: ", req.query);
            }

            var heartbeat = parseInt(req.query.heartbeat);
            $this.addToList(reqPort, heartbeat)

            // send JOINREP
            $this.updateMyHeartbeat();
            res.json({ list: $this.list });
        });

        // listener to ping request
        this.app.post('/m/PING', function( req, res) {
            if (ENVIRONMENT === Kernel.Constants.VerboseEnv) {
                console.log("m/PING from ", req.query.port);
            }

            var list = req.body.list;
            $this.mergeList(list);

            $this.updateMyHeartbeat();
            res.json({list: $this.list})
        });

        // listener to ping_req
        this.app.post('/m/PINGREQ', function(req, res) {
            var list = req.body.list;
            $this.mergeList(list);

            var target = parseInt(req.query.target);
            if (ENVIRONMENT === Kernel.Constants.VerboseEnv) {
                console.log(sprintf("m/PINGREQ from %s, target = %d",
                    req.query.port, target));
            }
            
            // ping this targer if response - send ack to this request, else nack
            $this.updateMyHeartbeat();
            $this.sendPing(res, target);
        });

        // start pinging
        this.sendPing();
    }

    // Helper method to merge an incoming membership list with
    // self membership list
    this.mergeList = (newlist) => {
        Object.keys(newlist).forEach(function(port) {
            port = parseInt(port)
            if (port < 1) throw Error(sprintf("Invalid port number: %d", port))

            if (!(port in $this.list)) {
                // add only active entries
                if (newlist[port].status == NodeStateEnum.Active) {
                    $this.addToList(port, newlist[port].heartbeat);
                }
            } else {
                $this.updateList(port, newlist[port].status, newlist[port].heartbeat);
            }
        });
    }

    // Method to send a ping req, and ping_req req if failed
    this.sendPing = (_res = null, receiverPort = 0) => {
        this.updateMyHeartbeat();

        // start of protocol period
        // randomly choose an entry other than self
        if (receiverPort === 0) receiverPort = getNextNodeToPing();

        var errorCallback = (err) => {
            // console.log("PING to #%s failed", receiverPort);
            // TODO: send ping req to k random
            $this.updateMyHeartbeat();
            // case when ping is sent because of ping_req
            if (_res !== null) {
                return _res.json({list: $this.list, ack: false});
            }

            // Since ping has failed with in protocol period; send ping_req
            // to K random nodes to look for this target
            for (i = 0; i < $this.KMax; i++) {
                var _receiverPort = getNextNodeToPing();
                if (_receiverPort === 0) return;
                var target = receiverPort;
                // ask _reciever port to ping target for you
                Kernel.send(
                    _receiverPort,
                    sprintf("m/PINGREQ?port=%s&target=%s", $this.port, target),
                    Kernel.RequestTypes.POST,
                    { list: $this.list },
                    function(resp, body) {
                        try {
                            $this.mergeList(JSON.parse(body)["list"]);
                            receiverPort = 0;
                        } catch (ex) {
                            console.log(body);
                        }
                    }
                );
            }
        }

        // console.log(sprintf("ping to #%s", receiverPort))
        if (receiverPort > 0) {
            Kernel.send(
                receiverPort,
                "m/PING?port=" +this.port,
                Kernel.RequestTypes.POST,
                { list: $this.list },
                function (resp, body) {
                    // case when ping is sent because of ping_req
                    if (_res != null) {
                        return _res.json({list: $this.list, ack: true});
                    }

                    try {
                        $this.mergeList(JSON.parse(body)["list"]);
                        receiverPort = 0;
                    } catch (ex) {
                        errorCallback(ex);
                    }
                }, errorCallback);
        }

        setTimeout(function() {
            $this.sendPingEnd(receiverPort);
        }, this.protocolPeriod);
    }

    // Method to send join request to a known introducer
    this.sendJoinReq = (receiverPort) => {
        console.log(sprintf("#%s joinreq to #%s", this.port, receiverPort))

        var errorCallback = function (err) {
            if ($this.joinReqRetryCount < $this.joinReqRetryCountThreshold) {
                $this.joinReqRetryCount++;
                console.log("JOINREQ FAIL, Retry Count: ", $this.joinReqRetryCount);
                setTimeout(function() {
                    $this.sendJoinReq(receiverPort);
                }, $this.joinReqRetryCountTimeout * $this.joinReqRetryCount);
            } else {
                console.log("JOINREQ FAIL, Retry count exceeded limit, abort")
                process.exit()
            }
        }

        Kernel.send(
            receiverPort,
            "m/JOINREQ",
            Kernel.RequestTypes.GET,
            sprintf("port=%d&heartbeat=%s", this.port, Kernel.getTimestamp()),
            function(resp, body) {
                try {
                    $this.mergeList(JSON.parse(body)["list"]);
                } catch (ex) {
                    errorCallback(ex);
                }
            }, errorCallback);
    }

    // Method to mark end of one protocol period - garbage collection
    this.sendPingEnd = (receiverPort) => {
        // TODO: check if things went well, else remove the receiver port
        if (receiverPort != 0) {
            // mark receiverPort as suspicious now / or removed
            console.log("suspicious: %s", receiverPort)
            this.updateList(receiverPort, NodeStateEnum.Suspicious, null)
            setTimeout(function() {
                if (!(receiverPort in $this.list)) return;

                delete $this.list[receiverPort];
                console.log("failed: %s", receiverPort)
                if ($this.churncb) $this.churncb(receiverPort);
            }, this.protocolPeriod * this.suspisionLimit);
        }
        this.sendPing();
    };

    // ----------- Constructor Code ---------------------------------------
    // Add self to membership list
    this.list[this.port] = createListEntry(
        Kernel.getTimestamp(), Kernel.getTimestamp());

    this.init();
    console.log(sprintf("Membership list initialized for #%d", this.port));
};

module.exports = Membership;