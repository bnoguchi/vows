var path = require('path');

require.paths.unshift(path.join(__dirname, '..', 'lib'));

var events = require('events'),
    assert = require('assert'),
    fs     = require('fs');

var vows = require('vows');

var api = vows.prepare({
    get: function (id, callback) {
        process.nextTick(function () { callback(null, id) });
    },
    version: function () { return '1.0' }
}, ['get']);

var promiser = function (val) {
    return function () {
        var promise = new(events.EventEmitter);
        process.nextTick(function () { promise.emit('success', val) });
        return promise;
    }
};

vows.describe("Vows").addBatch({
    "A context": {
        topic: promiser("hello world"),

        "with a nested context": {
            topic: function (parent) {
                this.state = 42;
                return promiser(parent)();
            },
            "has access to the environment": function () {
                assert.equal(this.state, 42);
            },
            "and a sub nested context": {
                topic: function () {
                    return this.state;
                },
                "has access to the parent environment": function (r) {
                    assert.equal(r, 42);
                    assert.equal(this.state, 42);
                },
                "has access to the parent context object": function (r) {
                    assert.ok(Array.isArray(this.context.topics));
                    assert.include(this.context.topics, "hello world");
                }
            }
        }
    },
    "A nested context": {
        topic: promiser(1),

        ".": {
            topic: function (a) { return promiser(2)() },

            ".": {
                topic: function (b, a) { return promiser(3)() },

                ".": {
                    topic: function (c, b, a) { return promiser([4, c, b, a])() },

                    "should have access to the parent topics": function (topics) {
                        assert.equal(topics.join(), [4, 3, 2, 1].join());
                    }
                },

                "from": {
                    topic: function (c, b, a) { return promiser([4, c, b, a])() },

                    "the parent topics": function(topics) {
                        assert.equal(topics.join(), [4, 3, 2, 1].join());
                    }
                }
            }
        }
    },
    "Nested contexts with callback-style async": {
        topic: function () {
            fs.stat(__dirname + '/vows-test.js', this.callback);
        },
        'after a successful `fs.stat`': {
            topic: function (stat) {
                fs.open(__dirname + '/vows-test.js', "r", stat.mode, this.callback);
            },
            'after a successful `fs.open`': {
                topic: function (fd, stat) {
                    fs.read(fd, stat.size, 0, "utf8", this.callback);
                },
                'after a successful `fs.read`': function (data) {
                    assert.match (data, /after a successful `fs.read`/);
                }
            }
        }
    },
    "A nested context with no topics": {
        topic: 45,
        ".": {
            ".": {
                "should pass the value down": function (topic) {
                    assert.equal(topic, 45);
                }
            }
        }
    },
    "A Nested context with topic gaps": {
        topic: 45,
        ".": {
            ".": {
                topic: 101,
                ".": {
                    ".": {
                        topic: function (prev, prev2) {
                            return this.context.topics.slice(0);
                        },
                        "should pass the topics down": function (topics) {
                            assert.length(topics, 2);
                            assert.equal(topics[0], 101);
                            assert.equal(topics[1], 45);
                        }
                    }
                }
            }
        }
    },
    "A non-promise return value": {
        topic: function () { return 1 },
        "should be converted to a promise": function (val) {
            assert.equal(val, 1);
        }
    },
    "A 'prepared' interface": {
        "with a wrapped function": {
            topic: function () { return api.get(42) },
            "should work as expected": function (val) {
                assert.equal(val, 42);
            }
        },
        "with a non-wrapped function": {
            topic: function () { return api.version() },
            "should work as expected": function (val) {
                assert.equal(val, '1.0');
            }
        }
    },
    "A non-function topic": {
        topic: 45,

        "should work as expected": function (topic) {
            assert.equal(topic, 45);
        }
    },
    "A non-function topic with a falsy value": {
        topic: 0,

        "should work as expected": function (topic) {
            assert.equal(topic, 0);
        }
    },
    "A topic returning a function": {
        topic: function () {
            return function () { return 42 };
        },

        "should work as expected": function (topic) {
            assert.isFunction(topic);
            assert.equal(topic(), 42);
        },
        "in a sub-context": {
            "should work as expected": function (topic) {
                assert.isFunction(topic);
                assert.equal(topic(), 42);
            },
        }
    },
    "A topic emitting an error": {
        topic: function () {
            var promise = new(events.EventEmitter);
            process.nextTick(function () {
                promise.emit("error", 404);
            });
            return promise;
        },
        "shouldn't raise an exception if the test expects it": function (e, res) {
            assert.equal(e, 404);
            assert.ok(! res);
        }
    },
    "A topic not emitting an error": {
        topic: function () {
            var promise = new(events.EventEmitter);
            process.nextTick(function () {
                promise.emit("success", true);
            });
            return promise;
        },
        "should pass `null` as first argument, if the test is expecting an error": function (e, res) {
            assert.strictEqual(e, null);
            assert.equal(res, true);
        },
        "should pass the result as first argument if the test isn't expecting an error": function (res) {
            assert.equal(res, true);
        }
    },
    "A topic with callback-style async": {
        "when successful": {
            topic: function () {
                var that = this;
                process.nextTick(function () {
                    that.callback(null, "OK");
                });
            },
            "should work like an event-emitter": function (res) {
                assert.equal(res, "OK");
            },
            "should assign `null` to the error argument": function (e, res) {
                assert.strictEqual(e, null);
                assert.equal(res, "OK");
            }
        },
        "when unsuccessful": {
            topic: function () {
                function async(callback) {
                    process.nextTick(function () {
                        callback("ERROR");
                    });
                }
                async(this.callback);
            },
            "should have a non-null error value": function (e, res) {
                assert.equal(e, "ERROR");
            },
            "should work like an event-emitter": function (e, res) {
                assert.equal(res, undefined);
            }
        },
        "using this.callback synchronously": {
            topic: function () {
                this.callback(null, 'hello');
            },
            "should work the same as returning a value": function (res) {
                assert.equal(res, 'hello');
            }
        }
    }
}).addBatch({
    "A Sibling context": {
        "'A', with `this.foo = true`": {
            topic: function () {
                this.foo = true;
                return this;
            },
            "should have `this.foo` set to true": function (res) {
                assert.equal(res.foo, true);
            }
        },
        "'B', with nothing set": {
            topic: function () {
                return this;
            },
            "shouldn't have access to `this.foo`": function (e, res) {
                assert.isUndefined(res.foo);
            }
        }
    }
}).addBatch({
    "A 2nd batch": {
        topic: function () {
            var p = new(events.EventEmitter);
            setTimeout(function () {
                p.emit("success");
            }, 100);
            return p;
        },
        "should run after the first": function () {}
    }
}).addBatch({
    "A 3rd batch": {
        topic: true, "should run last": function () {}
    }
}).addBatch({}).export(module);

vows.describe("Vows with a single batch", {
    "This is a batch that's added as the optional parameter to describe()": {
        topic: true,
        "And a vow": function () {}
    }
}).export(module);

vows.describe("Vows with multiple batches added as optional parameters", {
    "First batch": {
        topic: true,
        "should be run first": function () {}
    }
}, {
    "Second batch": {
        topic: true,
        "should be run second": function () {}
    }
}).export(module);

vows.describe("Vows with teardowns").addBatch({
    "A context": {
        topic: function () {
            return { flag: true };
        },
        "And a vow": function (topic) {
            assert.isTrue(topic.flag);
        },
        "And another vow": function (topic) {
            assert.isTrue(topic.flag);
        },
        "And a final vow": function (topic) {
            assert.isTrue(topic.flag);
        },
        teardown: function (topic) {
            topic.flag = false;
        }
    }
}).export(module);

