//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const assert = require('assert');
const chai = require('chai');
const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const sprintf = require("sprintf").sprintf;
const Kernel = require("../kernel.js")
const Server = require('../server.js')

var server = new Server(8080, null)

describe('Server', function() {
    describe('Placeholder', function() {
        it ('Placeholder', function() {
            assert.equal(1,1);
        });
    });
});