var _ = require('lodash');
var semver = require('semver');
var stripBom = require('strip-bom');

// Ordered list of supported channel
var CHANNEL_MAGINITUDE = 100000;
var CHANNELS = [
    'alpha', 'beta', 'unstable', 'rc'
];

// RELEASES parsing
var releaseRe = /^([0-9a-fA-F]{40})\s+(\S+)\s+(\d+)[\r]*$/;


// Hash a prerelease
function hashPrerelease(s) {
    if (_.isString(s[0])) {
        return (_.indexOf(CHANNELS, s[0]) + 1) * CHANNEL_MAGINITUDE + (s[1] || 0);
    } else {
        return s[0];
    }
};

// Map a semver version to a windows version
function normVersion(tag) {
    var parts = new semver.SemVer(tag);
    var prerelease = "";

    if (parts.prerelease && parts.prerelease.length > 0) {
        prerelease = hashPrerelease(parts.prerelease);
    }

    return [
        parts.major,
        parts.minor,
        parts.patch
    ].join('.') + (prerelease? '.'+prerelease : '');
}

// Map a windows version to a semver
function toSemver(tag) {
    var parts = tag.split('.');
    var version = parts.slice(0, 3).join('.');
    var prerelease = Number(parts[3]);

    // semver == windows version
    if (!prerelease) return version;

    var channelId = Math.floor(prerelease/CHANNEL_MAGINITUDE);
    var channel = CHANNELS[channelId - 1];
    var count = prerelease - (channelId*CHANNEL_MAGINITUDE);

    return version + '-' + channel + '.' + count
}

// Parse RELEASES file
// https://github.com/Squirrel/Squirrel.Windows/blob/0d1250aa6f0c25fe22e92add78af327d1277d97d/src/Squirrel/ReleaseExtensions.cs#L19
function parseRELEASES(content) {
    return _.chain(stripBom(content))
        .replace('\r\n', '\n')
        .split('\n')
        .map(function(line) {
            var parts = releaseRe.exec(line);
            if (!parts) return null;

            var filename = parts[2];
            var isDelta = filename.indexOf('-full.nupkg') == -1;
            var isBeta = filename.indexOf('beta') !== -1;
            var isAlpha = filename.indexOf('alpha') !== -1;
            var isUnstable = filename.indexOf('unstable') !== -1;
            var isRc = filename.indexOf('rc') !== -1;
            //filename = "sufferfest-5.2.3-beta.5-full.nupkg"
            var filenameParts = filename
                .replace(".nupkg", "")
                .replace("-delta", "")
                .replace("-full", "")
                .replace("beta", "")
                .replace("alpha", "")
                .replace("unstable", "")
                .replace("rc", "")
                .split(/\.|-/)
                .reverse();

            if (filenameParts.length >= 4) {
                let offset = 0;
                if (isAlpha) {
                    offset = CHANNEL_MAGINITUDE;
                } else if (isBeta) {
                    offset = CHANNEL_MAGINITUDE * 2;
                } else if (isUnstable) {
                    offset = CHANNEL_MAGINITUDE * 3;
                } else if (isRc) {
                    offset = CHANNEL_MAGINITUDE * 4;
                }
                filenameParts[0] = parseInt(filenameParts[0], 10) + offset;
            }

            var version = _.chain(filenameParts)
                .filter(function(x) {
                    return /^\d+$/.exec(x);
                })
                .reverse()
                .value()
                .join('.');


            return {
                sha: parts[1],
                filename: filename,
                size: Number(parts[3]),
                isDelta: isDelta,
                version: version,
                semver: toSemver(version)
            };
        })
        .compact()
        .value();
}

// Generate a RELEASES file
function generateRELEASES(entries) {
    return _.map(entries, function(entry) {
        var filename = entry.filename;

        if (!filename) {
            filename = [
                entry.app,
                entry.version,
                entry.isDelta? 'delta.nupkg' : 'full.nupkg'
            ].join('-');
        }

        return [
            entry.sha,
            filename,
            entry.size
        ].join(' ');
    })
    .join('\n');
}

module.exports = {
    normVersion: normVersion,
    toSemver: toSemver,
    parse: parseRELEASES,
    generate: generateRELEASES
};
