require('should');

// Sync tests (no backend required)
require('./platforms');
require('./win-releases');

// Tests requiring a backend (GitHub backend is currently mocked/disabled)
// To run these, either:
// 1. Configure S3 credentials and change testing.js to use 's3' backend
// 2. Re-enable the GitHub backend by replacing the octocat dependency
// require('./versions');
// require('./download');
// require('./update');
