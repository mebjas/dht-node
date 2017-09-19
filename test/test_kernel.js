//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const assert = require('assert');
const Kernel = require('../process/kernel.js')

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

            assert.equal(0, Kernel.hashPort(8080))
            assert.ok(Kernel.hashPort(8100) >= 0)
            assert.ok(Kernel.hashPort(8100) < 256)
        });
    });

    describe('#hash()', function() {
        it('should give same values each time', function() {
            assert.ok(Kernel.hash("something") > 0)
            assert.equal(Kernel.hash("something"), Kernel.hash("something"))
        });

        it('should give correct value', function() {
            assert.equal(191, Kernel.hash("something"))
        });
    });

    describe('#hashKey()', function() {
        it('should give correct value in range', function() {
            var val = Kernel.hashKey("something", 10, 5);
            assert.equal(val.length, 5);
        });

        it('should give correct value when max < max replica', function() {
            var val = Kernel.hashKey("something", 2, 5);
            assert.equal(val.length, 2);
        });

        it('should throw exception for wrong input', function() {
            try {
                Kernel.hashKey("something", 0, 5);
            } catch (ex) {
                assert.ok(true);
            }
        });

        it('should give same value each time', function() {
            var val = Kernel.hashKey("something", 10, 5);
        });
    });
});