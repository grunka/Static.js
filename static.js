#!/usr/bin/env node

"use strict";

var http = require("http");
var url = require("url");
var path = require("path");
var fs = require("fs");
var sys = require("sys");
var crypto = require("crypto");

var cache = {};

//TODO gzip
//TODO configure paths
//TODO limit memory usage
//TODO use file modification headers
//TODO replace string content with buffer

function outputCachedFile(response, filename) {
    sys.log("Responding for " + filename);
    var file = cache[filename];
    response.writeHead(file.exists ? 200 : 404, {
        "Content-Length": file.content.length,
        "Last-Modified": file.modified.toUTCString(),
        "Etag": file.etag
    });
    response.end(file.content);
}


function hash(data) {
    var sha1 = crypto.createHash("sha1");
    sha1.update(data);
    return sha1.digest("hex");
}

function cacheFile(response, mtime, filename) {
    fs.readFile(filename, "utf8", function(err, data) {
        if (err) {
            //Could not read file that existed in stat call
            throw err;
        } else {
            var hash = hash(data);
            sys.log("Caching " + filename + " with mtime " + mtime);
            cache[filename] = {
                exists: true,
                content: data,
                modified: mtime,
                etag: hash
            };
        }
        outputCachedFile(response, filename);
    });
}

http.createServer(function(request, response){
    if (request.method == "OPTIONS") {
        //TODO allow GET, OPTIONS, ranges
    } else {
        var parsed = url.parse(request.url);
        var filename = path.join("./", parsed.pathname);
        fs.stat(filename, function(err, stat) {
            if (err) {
                if (!cache[filename]) {
                    cache[filename] = {
                        exists: false,
                        content: "File not found",
                        modified: new Date()
                    };
                }
                sys.log("Caching " + filename + " as not found with mtime " + cache[filename].modified);
                outputCachedFile(response, filename);
            } else {
                if (!cache[filename] || !cache[filename].exists || cache[filename].modified.getTime() != stat.mtime.getTime()) {
                    cacheFile(response, new Date(Date.parse(stat.mtime)), filename);
                } else {
                    outputCachedFile(response, filename);
                }
            }
        });
    }
}).listen(8000);

sys.log("Listening on port 8000");
