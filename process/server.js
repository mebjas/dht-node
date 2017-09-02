// File deals with server
const express = require('express')
const bodyParser = require('body-parser')
const sprintf = require("sprintf").sprintf;
const Membership = require("./membership.js")

var Server = function(port, introducer) {
    this.port = port;
    this.introducer = introducer;
    this.app = express();
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({
        extended: true
    }));
    this.membership = null;

    // Initialize
    this.init();
}

// Initialize the server
Server.prototype.init = function() {
    var $this = this;
    // bind to the port
    this.bind(function() {
        $this.membership = new Membership(
            $this.app, $this.port);
        // send join req to introducer
        if ($this.introducer) $this.membership.sendJoinReq(
            $this.introducer);
    });
}

// bind the app to the port
Server.prototype.bind = function(callback) {
    this.app.listen(this.port, function () {
        console.log(sprintf("Listening to port: %d", this.port))
        if (callback) callback();
    }.bind(this))
}

// Gets the app object
Server.prototype.getApp = function() {
    return this.app;
}

module.exports = Server;