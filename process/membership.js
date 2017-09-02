// file has class and methods to deal with membership protocol
// attempted to implement SWIM protocol

const express = require('express')
const sprintf = require("sprintf").sprintf;
const Kernel = require("./kernel.js");

// The membership class - constuctor
var Membership = function(app, port) {
    // initialize with these variables
    this.app = app;
    this.port = port;

    // Membership list - initialised with self
    this.list = {};
    this.list[this.port] = {
        heartbeat: Kernel.getTimestamp(),
        timestamp: Kernel.getTimestamp(),
        status: "active"
    }
    this.pinglist = [];

    // local counts
    this.incarnationNumber = 0;                 // id of incarnation
    this.joinReqRetryCount = 0;                 // count of attempts of joinreq
    this.joinReqRetryCountThreshold = 3;        // threshold for above count
    this.joinReqRetryCountTimeout = 1000;       // timeout for join req
    this.protocolPeriod = 0.5 * 1000;           // protocol period
    this.KMax = 1;                              // no of K for ping_req
    this.suspisionLimit = 2;                    // No of times of protocol period
                                                // a node under suspision will be
                                                // kept in quarentine

    this.init();
    console.log(sprintf("Membership list initialized for #%d", this.port));
}

// Helper class to update self heartbeat
Membership.prototype.updateMyHeartbeat = function() {
    this.list[this.port].heartbeat = Kernel.getTimestamp();
}

// Get a random node to ping, round robin on all nodes
Membership.prototype.getNextNodeToPing = function() {
    var $this = this;
    if (Object.keys(this.list).length <= 1) return 0;

    // randomly choose an entry other than self
    var receiverPort = 0;
    while (!receiverPort) {
        if (this.pinglist.length == 0) {
            // TODO: pump again to round robin list
            tmp = []
            Object.keys(this.list).forEach(function(key) {
                if (key != $this.port) tmp.push(key);
            });
            this.pinglist = Kernel.shuffle(tmp);
        }
        var key = this.pinglist.shift();
        if (key in this.list && this.list[key].status == "active")
            receiverPort = key;
    }
    return parseInt(receiverPort);
}

// Helper method to add a new node entry to list
Membership.prototype.addToList = function(port, heartbeat) {
    this.list[port] = {
        heartbeat: heartbeat,
        timestamp: Kernel.getTimestamp(),
        status: "active"
    };
    console.log("JOINED: " +port);
}

// Helper method to update the membership list
Membership.prototype.updateList = function(port, status, heartbeat = null) {
    if (heartbeat == null) {
        if (!(port in this.list)) return;
        this.list[port].status = status;
        this.list[port].timestamp = Kernel.getTimestamp();
        this.list[port].heartbeat = Kernel.getTimestamp();
    }
    else if (this.list[port].heartbeat < heartbeat) {
        this.list[port].heartbeat = heartbeat;
        this.list[port].timestamp = Kernel.getTimestamp();
        this.list[port].status = status;

        // if the state comes out to be suspicious
        // remove the entry after some timeout
        if (status == "suspicious") {
            setTimeout(function() {
                if (!(port in this.list)) return;
                if (this.list[port].status != "active") {
                    console.log("failed: %s", port)
                    delete this.list[port];
                } else {
                    console.log("suspicion over: %s", port)
                }
            }.bind(this), this.protocolPeriod * this.suspisionLimit);
            // }.bind(this), this.protocolPeriod * Object.keys(this.list).length);
        }
    }
}

// Helper method to merge an incoming membership list with
// self membership list
Membership.prototype.mergeList = function(newlist) {
    var $this = this;
    Object.keys(newlist).forEach(function(port) {
        port = parseInt(port)
        if (port < 1) throw Error(sprintf("Invalid port number: %d", port))

        if (!(port in $this.list)) {
            // add only active entries
            if (newlist[port].status == "active") {
                $this.addToList(port, newlist[port].heartbeat);
            }
        } else {
            $this.updateList(port, newlist[port].status, newlist[port].heartbeat);
        }
    });
}

// Method to  initialize listeners
Membership.prototype.init = function() {
    var $this = this;

    // listener to join request
    this.app.get('/m/JOINREQ', function(req, res) {
        // TODO: null checks
        var reqPort = parseInt(req.query.port);
        // console.log("m/JOINREQ FROM: ", req.query);

        var heartbeat = parseInt(req.query.heartbeat);
        $this.addToList(reqPort, heartbeat)

        // send JOINREP
        $this.updateMyHeartbeat();
        res.json({list: $this.list});
    });

    // listener to ping request
    this.app.post('/m/PING', function(req, res) {
        // console.log("m/PING from ", req.query.port);
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
        // console.log(sprintf("m/PINGREQ from %s, target = %d",
            // req.query.port, target));
        
        // TODO: ping this targer
        // if response - send ack to this request, else nack
        $this.updateMyHeartbeat();
        $this.sendPing(res, target);
    });

    // start pinging
    this.sendPing();
}

// Method to send join request to a known introducer
Membership.prototype.sendJoinReq = function(receiverPort) {
    console.log(sprintf("#%s joinreq to #%s", this.port, receiverPort))
    var $this = this;

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
        "GET",
        sprintf("port=%d&heartbeat=%s", this.port, Kernel.getTimestamp()),
        function(resp, body) {
            try {
                $this.mergeList(JSON.parse(body)["list"]);
            } catch (ex) {
                debugger;
                errorCallback(ex);
            }
        }, errorCallback);
}

// Method to send a ping req, and ping_req req if failed
Membership.prototype.sendPing = function(_res = null, receiverPort = 0) {
    var $this = this;
    this.updateMyHeartbeat();

    // start of protocol period
    // randomly choose an entry other than self
    if (receiverPort == 0) {
        receiverPort = this.getNextNodeToPing();
        receiverPort = parseInt(receiverPort);
    }

    var errorCallback = function(err) {
        // console.log("PING to #%s failed", receiverPort);
        // TODO: send ping req to k random
        $this.updateMyHeartbeat();
        // case when ping is sent because of ping_req
        if (_res != null) {
            return _res.json({list: $this.list, ack: false});
        }

        // Since ping has failed with in protocol period; send ping_req
        // to K random nodes to look for this target
        for (i = 0; i < $this.KMax; i++) {
            var _receiverPort = $this.getNextNodeToPing();
            if (_receiverPort == 0) return;
            var target = receiverPort;
            // ask _reciever port to ping target for you
            Kernel.send(
                _receiverPort,
                sprintf("m/PINGREQ?port=%s&target=%s", $this.port, target),
                "POST",
                {list: $this.list},
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
            "POST",
            {list: this.list},
            function(resp, body) {
                // case when ping is sent because of ping_req
                if (_res != null) {
                    return _res.json({list: $this.list, ack: true});
                }

                try {
                    $this.mergeList(JSON.parse(body)["list"]);
                    receiverPort = 0;
                } catch (ex) {
                    debugger;
                    errorCallback(ex);
                }
            }, errorCallback);
    }

    setTimeout(function() {
        $this.sendPingEnd(receiverPort);
    }, this.protocolPeriod);
}

// Method to mark end of one protocol period - garbage collection
Membership.prototype.sendPingEnd = function(receiverPort) {
    var $this = this;
    // TODO: check if things went well, else remove the receiver port
    if (receiverPort != 0) {
        // mark receiverPort as suspicious now / or removed
        console.log("suspicious: %s", receiverPort)
        this.updateList(receiverPort, "suspicious", null)
        setTimeout(function() {
            delete $this.list[receiverPort];
            console.log("failed: %s", receiverPort)
        // }, this.protocolPeriod * Object.keys(this.list).length);
        }, this.protocolPeriod * this.suspisionLimit);
    }
    this.sendPing();
};

module.exports = Membership;