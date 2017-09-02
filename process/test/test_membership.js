//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const assert = require('assert');
const chai = require('chai');
const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const sprintf = require("sprintf").sprintf;
const Membership = require("../membership.js")
const Kernel = require('../kernel.js')

var app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var testPort = 8080;
app.listen(testPort);

var membership = new Membership(app, testPort);

describe('Membership', function() {
    describe('PortNo', function() {
        it ('Should have port no same as assigned one', function() {
            assert.equal(testPort, membership.port);
        });
    });

    describe('MembershipList', function() {
        it('Should have atleast one item as of now', function() {
            assert.ok(1 == Object.keys(membership.list).length);
        })

        it('Should have self as member', function() {
            assert.ok(testPort in membership.list)
        })

        it('Should have self as active ', function() {
            assert.equal("active", membership.list[testPort].status)
        });
    });

    describe('#updateMyHeartbeat()', function() {
        var t1 = Kernel.getTimestamp();

        it ('Should have heartbeat >= t1', function() {
            membership.updateMyHeartbeat()
            assert.ok(membership.list[testPort].heartbeat >= t1);
        });
    });

    describe('/m/JOINREQ', function() {
        it ('should add 8081 with joinreq', function() {
            request.get(
                sprintf('http://localhost:%d/m/JOINREQ?port=8081',testPort),
                function(err, response, body) {
                    assert.ok(2 == Object.keys(membership.list).length);
                    assert.ok(8081 in membership.list);
                    assert.ok(!(8082 in membership.list));
                });
        });
    });
            
    describe('/m/PING', function() {
        it ('should add 8082 & 8083 based on ping', function() {
            request.post(
                sprintf('http://localhost:%d/m/PING?port=8081',testPort),
                {form: {list: {
                    8082: {
                        heartbeat: Kernel.getTimestamp(),
                        timestamp: Kernel.getTimestamp(),
                        status: "active"
                    },
                    8083: {
                        heartbeat: Kernel.getTimestamp(),
                        timestamp: Kernel.getTimestamp(),
                        status: "active"
                    }
                }}}, function(err, response, body) {
                    assert.ok(4 == Object.keys(membership.list).length);
                    assert.ok(8082 in membership.list);
                    assert.ok(8083 in membership.list);
                });
        });
    });

    // TODO: test sendPing, sendJoinReq etc
});
