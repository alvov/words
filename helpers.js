(function() {
    'use strict';

    var perfTest = {
        entries: {},
        /**
         * Start capturing time
         * @param {string} name
         */
        start: function(name) {
            if (!this.entries[name]) {
                this.entries[name] = {
                    timings: [],
                    min: Infinity,
                    max: -Infinity,
                    sum: 0,
                    tmp: null
                };
            }
            this.entries[name].tmp = performance.now();
        },

        /**
         * Stop capturing time
         * @param {string} name
         */
        end: function(name) {
            if (this.entries[name]) {
                var value = performance.now() - this.entries[name].tmp;
                this.entries[name].timings.push(value);
                if (this.entries[name].min > value) {
                    this.entries[name].min = value;
                }
                if (this.entries[name].max < value) {
                    this.entries[name].max = value;
                }
                this.entries[name].sum += value;
            }
        },

        /**
         * Print the results
         */
        results: function() {
            Object.keys(this.entries).forEach(function(name) {
                if (!this.entries[name].timings.length) {
                    return;
                }
                var mean = this.entries[name].timings.reduce(function(result, timing) {
                    return result + timing;
                }) / this.entries[name].timings.length;
                var median = this.entries[name].timings.sort(function(a, b) {
                    return a - b;
                })[Math.floor(this.entries[name].timings.length / 2)];
                console.log(`--${name}--`);
                console.log(
`mean: ${mean},
median: ${median},
sum: ${this.entries[name].sum},
max: ${this.entries[name].max},
min: ${this.entries[name].min},
count: ${this.entries[name].timings.length}`);
            }, this);
        }
    };

    var normalization = {
        /**
         * Create value instance
         * @param {string} key
         */
        reset: function(key) {
            this.items = this.items || {};
            this.items[key] = {
                min: Infinity,
                max: -Infinity,
                divider: null
            }
        },

        /**
         * Add new value for comparison
         * @param {string} key
         * @param {number} value
         */
        push: function(key, value) {
            var item = this.items[key];
            if (item.min > value) {
                item.min = value;
            }
            if (item.max < value) {
                item.max = value;
            }
        },

        /**
         * When done collecting data, calculate the divider
         * @param {string} key
         */
        done: function(key) {
            this.items[key].divider = this.items[key].max - this.items[key].min;
        },

        /**
         * Returns the normalized value
         * @param {string} key
         * @param {number} value
         * @returns {number}
         */
        normalize: function(key, value) {
            var item = this.items[key];
            if (item.divider) {
                return (value - item.min) / item.divider;
            }
            return value;
        }
    };

    window.helpers = {
        perfTest: perfTest,
        normalization: normalization
    }
})();
