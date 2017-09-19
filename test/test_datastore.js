//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const assert = require('assert');
const chai = require('chai');
const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const sprintf = require("sprintf").sprintf;
const Datastore = require("../process/datastore.js")

var datastore = new Datastore()

describe('Datastore', function() {
    describe('CRUD', function() {
        it ('Should set value', function() {
            datastore.set('key', 'value')
            assert.equal(datastore.get('key').value, 'value');
        });

        it ('Should update when set again value', function() {
            datastore.set('key', 'value')
            datastore.set('key', 'value2')
            assert.equal(datastore.get('key').value, 'value2');
        });

        it ('Should delete when deleted', function() {
            datastore.set('key', 'value')
            assert.equal(datastore.get('key').value, 'value');
            datastore.delete('key')
            assert.equal(datastore.get('key'), null);
        });

        it ('Should throw when deleting key no available', function() {
            try {
                datastore.delete('key')
                assert.ok(false);
            } catch (ex) {
                assert.ok(true);
            }
        });
    });
});