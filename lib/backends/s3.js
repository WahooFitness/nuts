var _ = require('lodash');
var Q = require('q');
var util = require('util');
var s3 = require('s3');
var semver = require('semver');
var request = require('request');

var Backend = require('./backend');


function S3Backend() {
    var that = this;
    Backend.apply(this, arguments);

    if (!this.opts.key || !this.opts.secret || !this.opts.bucket) {
        throw new Error('S3 backend requires "key", "secret", and "bucket" options');
    }

    this.client = s3.createClient({
        s3Options: {
            accessKeyId: this.opts.key,
            secretAccessKey: this.opts.secret
        }
    });

    this.releases = this.memoize(this._releases);
}
util.inherits(S3Backend, Backend);


// List all releases in the S3 bucket
S3Backend.prototype._releases = function() {
    var deferred = Q.defer();
    var objects = [];

    var s3Params = { Bucket: this.opts.bucket, Prefix: this.opts.prefix };
    var list = this.client.listObjects({ s3Params: s3Params });

    var region = this.opts.region;
    var bucket = this.opts.bucket;

    list.on('data', function(data) {
        var releases = {}

        _.each(data.Contents, function(object) {
            // /<channel>/<tag>/<name>
            var components = object.Key.split('/');
            if (object.Size === 0 || components.length < 3) return null;

            var tag = components[components.length - 2];
            var channel = components[components.length - 3];

            if (!releases[tag]) {
                releases[tag] = {
                    tag_name: tag,
                    channel: channel,
                    published_at: object.LastModified,
                    assets: []
                };
            }

            releases[tag].assets.push({
                id: object.ETag,
                name: components[components.length - 1],
                size: object.Size,
                content_type: 'application/octet-stream',
                path: object.Key,
                url: `https://${bucket}.s3-accelerate.amazonaws.com/${object.Key}`
            });
        });

        objects = _.union(objects, _.values(releases));
    });

    list.on('end', function() { deferred.resolve(objects); });
    list.on('error', function(err) { deferred.reject(err); });

    return deferred.promise;
};


// Return stream for an asset
S3Backend.prototype.serveAsset = function(asset, req, res) {
    res.redirect(asset.raw.url);
};


// Return stream for an asset
S3Backend.prototype.getAssetStream = function(asset) {
    var headers = {
        'User-Agent': 'nuts',
        'Accept': 'application/octet-stream'
    };

    return Q(request({
        uri: asset.raw.url,
        method: 'get',
        headers: headers
    }));
};


module.exports = S3Backend;
