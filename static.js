#!/usr/bin/env node

"use strict";

var http = require("http");
var url = require("url");
var path = require("path");
var fs = require("fs");
var sys = require("sys");
var crypto = require("crypto");

var cache = {};

//TODO configure paths
//TODO limit memory usage / evict from cache
//TODO mime-types
//TODO sane logging
//TODO range header
//TODO check if fs.watchFile could be useful
//TODO gzip

function outputFile(response, file, notModified) {
    if (notModified(file)) {
        response.writeHead(304, {"Content-Length": 0});
        response.end();
    } else {
        response.writeHead(file.exists ? 200 : 404, {
            "Content-Length": file.content.length,
            "Last-Modified": file.modified.toUTCString(),
            "Etag": file.etag
        });
        response.end(file.content);
    }
}


function hash(data) {
    var sha1 = crypto.createHash("sha1");
    if (typeof(data) == "object") {
        sha1.update(data.toString("utf8"));
    } else {
        sha1.update(data);
    }
    return sha1.digest("hex");
}

function cacheFile(response, mtime, filename, notModified) {
    fs.readFile(filename, function(err, data) {
        if (err) {
            //Could not read file that existed in stat call
            throw err;
        } else {
            var hashed = hash(data);
            sys.log("Caching " + filename + " with mtime " + mtime);
            cache[filename] = {
                exists: true,
                content: data,
                modified: mtime,
                etag: hashed
            };
            outputFile(response, cache[filename], notModified);
        }
    });
}

var notFoundFile = {
    exists: false,
    content: "",
    modified: new Date(0),
    etag: hash("")
};

function createNotModified(headers) {
    var modifiedSinceIsLess = function(modified) {
        try {
            var modifiedSince = new Date(Date.parse(headers["if-modified-since"]));
            return modifiedSince.getTime() < modified.getTime();
        } catch(e) {
            return false;
        }
    };
    return function (file) {
        return headers["if-none-match"] == file.etag || modifiedSinceIsLess(file.modified);
    };
}

function handleGet(request, response) {
    var pathname = url.parse(request.url).pathname;
    var filename = path.join("./", pathname);
    sys.log("[ip] GET " + pathname);
    fs.stat(filename, function(err, stat) {
        if (err) {
            sys.log("[ip] 404 " + pathname + "(" + filename + ")");
            outputFile(response, notFoundFile);
        } else {
            var file = cache[filename];
            var notModified = createNotModified(request.headers);
            if (!file || !file.exists || file.modified.getTime() != stat.mtime.getTime()) {
                cacheFile(response, new Date(Date.parse(stat.mtime)), filename, notModified);
            } else {
                outputFile(response, file, notModified);
            }
        }
    });
}

http.createServer(function(request, response){
    sys.log(JSON.stringify(request.headers));
    if (request.method == "OPTIONS") {
        sys.log("[ip] OPTIONS");
        response.writeHead(200, {
            "Accept-Ranges": "bytes",
            "Allow": "GET,OPTIONS",
            "Content-Length": 0,
            "Date": new Date().toUTCString()
        });
        response.end();
    } else if (request.method == "GET") {
        handleGet(request, response);
    } else {
        response.writeHead(405, {"Content-Length": 0});
        response.end();
    }
}).listen(8000);

sys.log("Listening on port 8000");
