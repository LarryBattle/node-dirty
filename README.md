##Project: node-dirty 2
##Objective: 
The goals of project<br/>
- Fix the issues at <https://github.com/felixge/node-dirty/issues>
- Refactor
- Submit pull request.

##Completed tasks but need testcases
1) Fixed: https://github.com/felixge/node-dirty/issues/30
INFO:

`.set()` will throw an error if key is undefined.<br/>

2) Fixed: https://github.com/felixge/node-dirty/issues/24

INFO: 

    /*
	* @method Dirty.prototype.parseRowString
	* @param {String} - The row as a string. Result from `.convertRowToString()`
	* @return {Object} - Object must have with `key` and `val` as properties.
	*/
	/*
	* @method Dirty.prototype.convertRowToString
	* @param {Object} - ?result from `.parseRowString()`
	* @return {String}
	*/
	/*
	* @property	Dirty.prototype.rowDelimiter
	* @type {String} - default is `\n`
	*/

3) Fixed: https://github.com/felixge/node-dirty/issues/26 <br/>
INFO:<br/>
Added `this.writeBuffer` and `this.readBuffer`<br/>
`this.writeBuffer` is the buffer used to write.<br/>
`this.readBuffer` is the buffer used to read.<br/>
However, both buffers are String types and not Buffer objects.<br/>

Having an actual Buffer don't matter. Strings are ok.<br/>
More [information here](http://www.clintharris.net/2011/nodejs-101-use-buffer-to-append-strings-instead-of-concatenating-them/)
<br/>
Note: A writing event might need to be added.<br/>

4) fixed: https://github.com/felixge/node-dirty/issues/17 <br/>
INFO<br/>
Ticket is old and needs to be completed.

5) Added `Dirty.VERSION = '0.9.9 BETA'`<br/>
INFO<br/>
modules should have a version number.

6) Fixed: https://github.com/felixge/node-dirty/issues/10<br/>
INFO<br/>
- `.set()` emits an error if key is undefined.<br/>
- `.set(key, val, cb)`, if val is a function, then tries to saves the source of the function by using `val.toString()`.
<br/>

7) Fixed: https://github.com/felixge/node-dirty/issues/16
INFO<br/>
Calling `this.setupWriteStream()` before `this.setupReadStream()` will create a file if it doesn't exist.<br/>
Flag `a` [info:](http://nodejs.org/api/fs.html)<br/>
'a' - Open file for appending. The file is created if it does not exist.<br/>

8) Fixed: https://github.com/felixge/node-dirty/issues/23 <br/>
- Renamed `this.savewriteBuffer()` to `this.savewriteBuffer()`<br/>
- Added: `Dirty.prototype.this.getKeyValueObject()`. <br/>
Returns

	Dirty.prototype.getKeyValueObject = function (key) {
		return {
			key : key,
			val : this._docs[key]
		};
	};

If the user wants extra values saved to disk, then all they to have to do is add it to the object.<br/>
This add a timestamp to the entry.<br/>

	Dirty.prototype.getKeyValueObject = function (key) {
		return {
			key : key,
			val : this._docs[key],
			timeStamp: +(new Date())
		};
	};

Note: `Dirty.prototype.convertRowToString` must support other key types than `key` and `val`.

##TODO list

- factor out `this._readStream` and `this._writeStream` into Classes.
- https://github.com/felixge/node-dirty/issues/28
- https://github.com/felixge/node-dirty/issues/25
- https://github.com/felixge/node-dirty/issues/22
- https://github.com/felixge/node-dirty/issues/18
- https://github.com/felixge/node-dirty/issues/16
- Pass jslint 100% with default settings
- Reduce the code complexity with the help of jsmeter.info.
- Submit as patch
- Add test cases for each issue fixed.


## Backup


# node-dirty

## Purpose

A tiny & fast key value store with append-only disk log. Ideal for apps with < 1 million records.

## Installation

    npm install dirty

## Why dirty?

This module is called dirty because:

* The file format is newline separated JSON
* Your database lives in the same process as your application, they share memory
* There is no query language, you just `forEach` through all records

So dirty means that you will hit a very hard wall with this database after ~1 million records,
but it is a wonderful solution for anything smaller than that.

## Tutorial

    require('../test/common');
    var db = require('dirty')('user.db');

    db.on('load', function() {
      db.set('john', {eyes: 'blue'});
      console.log('Added john, he has %s eyes.', db.get('john').eyes);

      db.set('bob', {eyes: 'brown'}, function() {
        console.log('User bob is now saved on disk.')
      });

      db.forEach(function(key, val) {
        console.log('Found key: %s, val: %j', key, val);
      });
    });

    db.on('drain', function() {
      console.log('All records are saved on disk now.');
    });

Output:

    Added john, he has blue eyes.
    Found key: john, val: {"eyes":"blue"}
    Found key: bob, val: {"eyes":"brown"}
    User bob is now saved on disk.
    All records are saved on disk now.

## API

### new Dirty([path])

Creates a new dirty database. If `path` does not exist yet, it is created. You
can also omit the `path` if you don't want disk persistence (useful for testing).

The constructor can be invoked in multiple ways:

    require('dirty')('my.db');
    require('dirty').Dirty('my.db');
    new (require('dirty'))('my.db');
    new (require('dirty').Dirty)('my.db');

### dirty.path

The path of the dirty database.

### dirty.set(key, value, [cb])

Set's the given `key` / `val` pair. The state of the database is affected instantly,
the optional `cb` callback is fired when the record was written to disk.

`val` can be any JSON-serializable type, it does not have to be an object.

### dirty.get(key)

Retrieves the value for the given `key`.

### dirty.rm(key, cb)

Removes the record with the given `key`. This is identical to setting the `key`'s value
to `undefined`.

### dirty.forEach(fn)

Calls the given `fn` function for every document in the database. The passed
arguments are `key` and `val`. You can return `false` to abort a query (useful
if you are only interested in a limited number of records).

This function is blocking and runs at ~4 Mhz.

### dirty event: 'load' (length)

Emitted once the database file has finished loading. It is not safe to access
records before this event fires. Writing records however should be fine.

`length` is the amount of records the database is holding. This only counts each
key once, even if it had been overwritten.

### dirty event: 'drain' ()

Emitted whenever all records have been written to disk.

## License

node-dirty is licensed under the MIT license.
