// Script to test e2e capabilities of the system
//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const {spawn} = require('child_process');
const assert = require('assert');
const express = require('express');
const chai = require('chai');
const chaiHttp = require('chai-http');
const request = require('request');
const sprintf = require('sprintf').sprintf;
const kernel = require('../process/kernel.js');
chai.use(chaiHttp);

function spawnANode(port, introducer) {
    console.log("Spawning", port)
    var proc = spawn('node', ['../index.js', port, (introducer) ? introducer : ""]);

    proc.stdout.on('data', function(data) {
        console.log(">>", port, data.toString());
    });
    return proc
}

ports = [8080, 8081, 8082, 8083, 8084]
portProcesses = []

// Spawn all nodes
ports.forEach(function(port, index) {
    if (!index) portProcesses[index] = spawnANode(port);
    else {
    setTimeout(function() { portProcesses[index] = spawnANode(port, ports[0]); }, 1000);
    }
}, this);

// -------------------- test ---------------------------
describe('End to End', function() {
    describe('Should fail for keys that don\'t exist', function() {
        it ('Fail to get a key', function() {
            ports.forEach(function(port) {
                kernel.send(
                    port,
                    's/key',
                    'GET',
                    'key=key1',
                    function(resp, body) {
                        // ping accepted
                        assert.ok(true);

                        assert.equal(resp.statusCode, 400);
                    }, function( err) {
                        assert.ok(false);
                    }
                )
            })
        });

        it ('SET /s/key', function() {
            ports.forEach(function(port, index) {
                kernel.send(
                    port,
                    's/key',
                    'POST',
                    {key: 'key' +index, value: 'value' +index},
                    function(resp, body) {
                        // ping accepted
                        assert.ok(true);
                        assert.equal(resp.statusCode, 200);
                    }, function( err) {
                        assert.ok(false);
                    }
                )
            })
        });

        describe ('GET /s/key', function() {
            ports.forEach(function(port, index) {
                it ('In same order, port:' +port, function() {
                    kernel.send(
                        port,
                        's/key',
                        'GET',
                        'key=key' +index,
                        function(resp, body) {
                            // ping accepted
                            assert.ok(true);
                            assert.equal(resp.statusCode, 200);
                            try {
                                body = JSON.parse(body)
                                assert.equal(body.value, 'value' +index)
                            } catch (ex) {
                                assert.ok(false);
                            }
                        }, function( err) {
                            assert.ok(false);
                        }
                    )
                });
            });

            ports.reverse().forEach(function(port, index) {
                it ('In reverse order, port: ' +port, function() {
                    kernel.send(
                        port,
                        's/key',
                        'GET',
                        'key=key' +index,
                        function(resp, body) {
                            // ping accepted
                            assert.ok(true);
                            assert.equal(resp.statusCode, 200);
                            assert.equal(body.value, 'value' +index);
                        }, function( err) {
                            assert.ok(false);
                        }
                    )
                });
            });
        });
    });
});













