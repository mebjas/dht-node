//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const assert = require('assert');
const chai = require('chai');
const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const sprintf = require("sprintf").sprintf;
const Kernel = require("../process/kernel.js")
const Topology = require('../process/topology.js')

var app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var testPort = 8100;
app.listen(testPort);

var topology = new Topology(app, testPort)

describe('Topology', function() {
    describe('Placeholder', function() {
        it ('Placeholder', function() {
            assert.equal(1,1);
        });
    });
});