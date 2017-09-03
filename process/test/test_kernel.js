//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const assert = require('assert');
const Kernel = require('../kernel.js')

describe('Kernel', function() {
    describe('#getTimestamp()', function() {
        var t1 = (new Date()).getTime();
        it('should return current timestamp', function() {
            var t2 = Kernel.getTimestamp();
            var t3 = (new Date()).getTime();

            assert.ok(t2 >= t1);
            assert.ok(t3 >= t2);
        });
    });

    describe('#random()', function() {
        it('Should be with in range', function() {
            assert.ok(Kernel.random(0, 10) >= 0)
            assert.ok(Kernel.random(0, 10) <= 10)
        })

        // TODO: check for randomness?
    });

    describe('#shuffle()', function() {
        it('should shuffle the array', function() {
            arr = [1,2,3,4,5]
            arr1 = Kernel.shuffle(arr)
            // TODO: looks like a stupid test, does it even
            // compare the strucure of array?
            assert.ok(arr != arr1)
        });
    });

    describe('#hashPort()', function() {
        it('should have different hash for 8080 - 8100 port range', function() {
            var collisionDict = {};
            for (j = 8080; j <= 8100; j++) {
                var hash = Kernel.hashPort(j);
                assert.ok(!(hash in collisionDict))

                if (!(hash in collisionDict)) collisionDict[hash] = 0
                collisionDict[hash] += 1
            }
        });
    });
});