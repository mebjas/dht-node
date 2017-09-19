//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const sprintf = require("sprintf").sprintf;
const Kernel = require("../process/kernel.js")
const Server = require('../process/server.js')

chai.use(chaiHttp)
var server = new Server(8080, null)

describe('Server', function() {
    describe('Should be able to get keys that exist', function() {
        it ('Fail to get a key - TBD', function() {
            chai.request(server.getApp())
            .get('/d/read?key=key1')
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('array');
                res.body.length.should.be.eql(0);
              done();
            });
        });
    });
});