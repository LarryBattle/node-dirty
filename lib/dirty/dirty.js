// Shouldn't GENTLY be in the test files????
// if (global.GENTLY) {
	// require = GENTLY.hijack(require);
// }
var Dirty = exports.Dirty = module.exports = (function () {
		"use strict";
		var fs = require('fs'),
			util = require('util'),
			EventEmitter = require('events').EventEmitter;
		var Dirty = function (path) {
			if (!(this instanceof Dirty)) {
				return new Dirty(path);
			}
			EventEmitter.call(this);
			this.readLength = 0;
			this.path = path;
			this.writeBundle = 1000;
			this._docs = {};
			this._keys = [];
			this._queue = [];
			this._readStream = null;
			this._writeStream = null;
			this.rowDelimiter = '\n';
			this.writeBuffer = '';
			this.readBuffer = '';
			this._load();
		};
		util.inherits(Dirty, EventEmitter);
		Dirty.Dirty = Dirty;
		Dirty.VERSION = '0.9.9 BETA';
		Dirty.handleCallbacks = function (err, cbs) {
			while (cbs.length) {
				cbs.shift()(err);
			}
		};
		Dirty.prototype.convertRowToString = JSON.stringify;
		Dirty.prototype.parseRowString = function (rowStr) {
			var row;
			try {
				row = JSON.parse(rowStr);
				if (!row.hasOwnProperty('key')) {
					throw new Error();
				}
			} catch (e) {
				this.emit('error', new Error('Could not load corrupted row: ' + rowStr));
				return '';
			}
			return row;
		};
		Dirty.prototype.set = function (key, val, cb) {
			if (key === undefined) {
				this.emit('error', new Error('Dirty.prototype.set(), `key` must not be undefined.'));
			}
			if (val === undefined) {
				this._keys.splice(this._keys.indexOf(key), 1);
				delete this._docs[key];
			} else {
				if (this._keys.indexOf(key) === -1) {
					this._keys.push(key);
				}
				val = (typeof val === 'object') ? val : val.toString();
				this._docs[key] = val;
			}
			this._queue.push(cb ? [key, cb] : key);
			this._maybeFlush();
		};
		Dirty.prototype.get = function (key) {
			return this._docs[key];
		};
		Dirty.prototype.getKeyValueObject = function (key) {
			return {
				key : key,
				val : this._docs[key]
			};
		};
		Dirty.prototype.size = function () {
			return this._keys.length;
		};
		Dirty.prototype.rm = function (key, cb) {
			this.set(key, undefined, cb);
		};
		Dirty.prototype.forEach = function (fn) {
			var key,
				i,
				len = this._keys.length;
			for (i = 0; i < len; i += 1) {
				key = this._keys[i];
				if (fn(key, this._docs[key]) === false) {
					break;
				}
			}
		};
		Dirty.prototype._load = function () {
			var self = this;
			if (!this.path) {
				process.nextTick(function () {
					self.emit('load', 0);
				});
				return;
			}
			this.setupWriteStream();
			this.setupReadStream();
		};
		Dirty.prototype.setupReadStream = function () {
			var self = this;
			this.readLength = 0;
			this._readStream = fs.createReadStream(this.path, {
				encoding : 'utf-8',
				flags : 'r'
			});
			this._readStream.on('error', function (err) {
				if (err.code === 'ENOENT') {
					self.emit('load', 0);
					return;
				}
				self.emit('error', err);
			});
			this._readStream.on('data', this.createReadStreamDataFunc(this));
			this._readStream.on('end', function () {
				if (self.readBuffer.length) {
					self.emit('error', new Error('Corrupted row at the end of the db: ' + self.readBuffer));
				}
				self.emit('load', this.readLength);
			});
		};
		Dirty.prototype.createReadStreamDataFunc = function (self) {
			return function (chunk) {
				self.readBuffer += chunk;
				if (chunk.lastIndexOf(self.rowDelimiter) === -1) {
					return;
				}
				var arr = self.readBuffer.split(self.rowDelimiter);
				self.readBuffer = arr.pop();
				arr.forEach(function (rowStr) {
					var row;
					if (!rowStr) {
						self.emit('error', new Error('Empty lines never appear in a healthy database'));
						return;
					}
					row = self.parseRowString();
					if (row.val === undefined) {
						if (self._docs.hasOwnProperty(row.key)) {
							this.readLength -= 1;
						}
						delete self._docs[row.key];
					} else {
						if (!self._docs.hasOwnProperty(row.key)) {
							self._keys.push(row.key);
							this.readLength += 1;
						}
						self._docs[row.key] = row.val;
					}
					return '';
				});
			};
		};
		Dirty.prototype.setupWriteStream = function () {
			var self = this;
			this._writeStream = fs.createWriteStream(this.path, {
				encoding : 'utf-8',
				flags : 'a'
			});
			this._writeStream.on('drain', function () {
				self._writeDrain();
			});
		};
		Dirty.prototype._writeDrain = function () {
			this.flushing = false;
			if (!this._queue.length) {
				this.emit('drain');
			} else {
				this._maybeFlush();
			}
		};
		Dirty.prototype._maybeFlush = function () {
			if (!(this.flushing || !this._queue.length)) {
				this._flush();
			}
		};
		Dirty.prototype.saveWriteBuffer = function (cbs) {
			if (!this.writeBuffer) {
				return;
			}
			var self = this;
			if (!this.path) {
				process.nextTick(function () {
					Dirty.handleCallbacks(null, cbs);
					self._writeDrain();
				});
				return;
			}
			this._writeStream.write(this.writeBuffer, function (err) {
				if (!cbs.length && err) {
					self.emit('error', err);
					return;
				}
				self.writeBuffer = '';
				Dirty.handleCallbacks(err, cbs);
			});
		};
		Dirty.prototype.getKeyValueAsString = function (key) {
			return this.convertRowToString(this.getKeyValueObject(key));
		};
		Dirty.prototype._flush = function () {
			var bundleLength,
				key,
				cbs,
				i,
				length = this._queue.length;
			this.writeBuffer = '';
			for (i = 0; i < length; i += 1) {
				if (this.writeBundle <= bundleLength || length <= i + 1) {
					this.saveWriteBuffer(cbs);
					bundleLength = 0;
					cbs = [];
				}
				key = this._queue[i];
				if (Array.isArray(key)) {
					cbs.push(key[1]);
					key = key[0];
				}
				this.writeBuffer += this.getKeyValueAsString(key) + '\n';
				bundleLength += 1;
			}
			this.flushing = true;
			this._queue = [];
		};
		return Dirty;
	}
		());
