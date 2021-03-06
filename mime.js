"use strict";

var fs = require("fs");
var sys = require("sys");

exports.init = function() {
    var lookup = {};
    var data = fs.readFileSync("mime.types", "ascii");
    var lines = data.split("\n");
    lines.forEach(function(line) {
        if (!line.match(/^#/)) {
            var item = line.match(/^(.*?)[\s]+(.*?)$/);
            if (item) {
                var type = item[1];
                item[2].split(" ").forEach(function(extension) {
                    lookup[extension] = type;
                });
            }
        }
    });
    sys.log("Mime types loaded");
    return {
        type: function(extension) {
            if (lookup[extension]) {
                return lookup[extension];
            } else {
                return "application/octet-stream";
            }
        }
    }
};
