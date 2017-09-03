// File deals with server
const express = require('express')
const bodyParser = require('body-parser')
const sprintf = require('sprintf').sprintf;
const Topology = require('./topology.js')

var Server = function(port, introducer) {
    // Private variables
    var $this = this;
    var topology = null;
    
    app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));

    function initializeListeners() {
        // rest method to get key
        app.get('/s/key', function(req, res) {
            if (!req.query.key) {
                res.status(400).send('Key missing in query');
            } else {
                topology.get(req.query.key, function(value) {
                    if (!value) {
                        res.status(400).send('Key Not Found');
                    } else {
                        res.json(value);
                    }
                });
            }
        });

        // rest method to set key
        app.post('/s/key', function(req, res) {
            // validate input
            if (!req.body.key || !req.body.value) {
                res.status(400).send('Key or Value missing in body');
            } else {
                topology.set(req.body.key, req.body.value, function(err) {
                    if (err) {
                        res.status(400).send(err.message);
                    } else {
                        res.status(200).send('OK');
                    }
                })
            }
        });

        // rest method to delete key
        app.delete('/s/key', function(req, res) {
            // validate input
            if (!req.query.key) {
                res.status(400).send('Key missing in query');
            } else {
                topology.delete(req.query.key, function(err) {
                    if (err) {
                        res.status(400).send(err.message);
                    } else {
                        res.status(200).send('OK');
                    }
                })
            }
        });
    }

    // member function: bind the app to the port
    this.bind = function(callback) {
        app.listen(port, function () {
            console.log(sprintf("Listening to port: %d", port))
            if (callback) callback();
        });
    };

    // Gets the app object
    this.getApp = function() {
        return app;
    }

    // Initialize the process - bind to the port
    this.bind(function() {
        topology = new Topology(app, port, introducer);
    
        // initialize the rest methods
        initializeListeners();
    });
}

module.exports = Server;