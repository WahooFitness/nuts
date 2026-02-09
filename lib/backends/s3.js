var _ = require('lodash');
var Q = require('q');
var util = require('util');
var { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
var fetch = require('node-fetch');

var Backend = require('./backend');


function S3Backend() {
    var that = this;
    Backend.apply(this, arguments);

    if (!this.opts.key || !this.opts.secret || !this.opts.bucket) {
        throw new Error('S3 backend requires "key", "secret", and "bucket" options');
    }

    this.client = new S3Client({
        region: this.opts.region || 'us-east-1',
        credentials: {
            accessKeyId: this.opts.key,
            secretAccessKey: this.opts.secret
        }
    });

    this.bucket = this.opts.bucket;
    this.prefix = this.opts.prefix || '';

    this.releases = this.memoize(this._releases);
}
util.inherits(S3Backend, Backend);


// List all releases in the S3 bucket
S3Backend.prototype._releases = function() {
    var that = this;
    var deferred = Q.defer();
    var objects = {};

    async function listAllObjects() {
        var continuationToken = undefined;

        do {
            var command = new ListObjectsV2Command({
                Bucket: that.bucket,
                Prefix: that.prefix,
                ContinuationToken: continuationToken
            });

            var response = await that.client.send(command);

            if (response.Contents) {
                _.each(response.Contents, function(object) {
                    // /<channel>/<tag>/<name>
                    var components = object.Key.split('/');
                    if (object.Size === 0 || components.length < 3) return null;

                    var tag = components[components.length - 2];
                    var channel = components[components.length - 3];

                    if (!objects[tag]) {
                        objects[tag] = {
                            tag_name: tag,
                            channel: channel,
                            published_at: object.LastModified,
                            assets: []
                        };
                    }

                    objects[tag].assets.push({
                        id: object.ETag,
                        name: components[components.length - 1],
                        size: object.Size,
                        content_type: 'application/octet-stream',
                        path: object.Key,
                        url: `https://${that.bucket}.s3-accelerate.amazonaws.com/${object.Key}`
                    });
                });
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken);

        return objects;
    }

    listAllObjects()
        .then(function(result) {
            deferred.resolve(result);
        })
        .catch(function(err) {
            deferred.reject(err);
        });

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

    return Q(fetch(asset.raw.url, {
        method: 'GET',
        headers: headers
    }).then(function(response) {
        if (!response.ok) {
            throw new Error('Failed to fetch asset: ' + response.status);
        }
        return response.body;
    }));
};


module.exports = S3Backend;
