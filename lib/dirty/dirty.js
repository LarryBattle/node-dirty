/**
* node-dirty 2 <https://github.com/LarryBattle/node-dirty> 
* The goals of project
* - Fix the issues at <https://github.com/felixge/node-dirty/issues>
* - Refactor
* - Submit pull request.
*
* @author Larry Battle <https://github.com/LarryBattle>
* @version 0.1
*/

if (global.GENTLY)
    require = GENTLY.hijack(require);

var fs = require('fs'),
util = require('util'),
EventEmitter = require('events').EventEmitter;

var Dirty = exports.Dirty = module.exports = function (path) {
    if (!(this instanceof Dirty))
        return new Dirty(path);
    
    EventEmitter.call(this);
    
    this.path = path;
    this.writeBundle = 1000;
    this._docs = {};
    this._keys = [];
    this._queue = [];
    this._readStream = null;
    this._writeStream = null;
    this._buffer = '';
    this._load();
};
util.inherits(Dirty, EventEmitter);
Dirty.Dirty = Dirty;

Dirty.handleCallbacks = function (err, cbs) {
    while (cbs.length) {
        cbs.shift()(err);
    }
};
// pluggable serializers: Fixed for <https://github.com/felixge/node-dirty/issues/24>
Dirty.prototype.convertRowToString = JSON.stringify;
Dirty.prototype.rowDelimiter = '\n';
Dirty.prototype.parseRowString = function(rowStr){
	var row;
	try {
		row = JSON.parse(rowStr);
		if (!('key' in row)) {
			throw new Error();
		}
	} catch (e) {
		this.emit('error', new Error('Could not load corrupted row: ' + rowStr));
		return '';
	}
	return row;
};

Dirty.prototype.set = function (key, val, cb) {
	if(key === undefined){
		return;
	}
    if (val === undefined) {
        this._keys.splice(this._keys.indexOf(key), 1);
        delete this._docs[key];
    } else {
        if (this._keys.indexOf(key) === -1) {
            this._keys.push(key);
        }
        this._docs[key] = val;
    }
    this._queue.push(cb ? [key, cb] : key);
    this._maybeFlush();
};
Dirty.prototype.get = function (key) {
    return this._docs[key];
};
Dirty.prototype.size = function () {
    return this._keys.length;
};
Dirty.prototype.rm = function (key, cb) {
    this.set(key, undefined, cb);
};
Dirty.prototype.forEach = function (fn) {
    var key;
    for (var i = 0, len = this._keys.length; i < len; i++) {
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
    this.setupReadStream();
    this.setupWriteStream();
};
Dirty.prototype.setupReadStream = function () {
    var self = this,
        length = 0;
        
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
    this._readStream.on('data', this.createReadStreamDataFunc() );
    this._readStream.on('end', function () {
        if (this.buffer.length) {
            self.emit('error', new Error('Corrupted row at the end of the db: ' + this.buffer));
        }
        self.emit('load', length);
    });
};

Dirty.prototype.createReadStreamDataFunc = function(){
    var self = this;
    return function (chunk) {
        self.buffer += chunk;
        if (chunk.lastIndexOf(self.rowDelimiter) == -1)
            return;
        var arr = self.buffer.split(self.rowDelimiter);
        self.buffer = arr.pop();
        arr.forEach(function (rowStr) {
            var row;
            if (!rowStr) {
                self.emit('error', new Error('Empty lines never appear in a healthy database'));
                return;
            }
            row = self.parseRowString();
            if (row.val === undefined) {
                if (row.key in self._docs) {
                    length--;
                }
                delete self._docs[row.key];
            } else {
                if (!(row.key in self._docs)) {
                    self._keys.push(row.key);
                    length++;
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
Dirty.prototype.saveBundleStr = function (bundleStr, cbs) {
    if (!bundleStr) {
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
    this._writeStream.write(bundleStr, function (err) {
        if (!cbs.length && err) {
            self.emit('error', err);
            return;
        }
        Dirty.handleCallbacks(err, cbs);
    });
};
Dirty.prototype.getKeyValueAsString = function (key) {
	return this.convertRowToString({
        key : key,
        val : this._docs[key]
    });
};
Dirty.prototype._flush = function () {
    var bundleLength,
    bundleStr,
    key,
    cbs;
    for (var i = 0, length = this._queue.length; i < length; i++) {
        if (this.writeBundle <= bundleLength || length <= i + 1) {
            this.saveBundleStr(bundleStr, cbs);
            bundleStr = '';
            bundleLength = 0;
            cbs = [];
        }
        key = this._queue[i];
        if (Array.isArray(key)) {
            cbs.push(key[1]);
            key = key[0];
        }
        bundleStr += this.getKeyValueAsString(key) + '\n';
        bundleLength++;
    }
    this.flushing = true;
    this._queue = [];
};
