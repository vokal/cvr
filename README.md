# CVR

## Tools for working with code coverage reports.

CVR has support for processing coverage in Cobertura, LCOV, Jacoco, and Go Cover. Coverage is translated first to a standard JavaScript format and then can be queried for coverage metrics including line, function, and branch coverage. There are also a set of tools for interacting with the GitHub API that makes it easier to get files matching coverage reports.


## Installation

CVR is a node module and does not have browser support.

`npm install cvr`


## Basic Use

```js
var cvr = require( "cvr" );
cvr.getCoverage( coverageFileContents, coverageFileFormat, function ( err, cov )
{
    var linePercent = cvr.getLineCoveragePercent( cov );
} );
```

For more complicated examples, taking a look at `/test/test.js` is recommended.

## Common Coverage Object

Parsers are used for each coverage format to convert the diverse formats into a common format that is used internally for processing. This is the Common Coverage Object and documented on [lcov-parse](https://github.com/davglass/lcov-parse) and reproduced below.

```json
{
    "title": "Test #1",
    "file": "anim-base/anim-base-coverage.js",
    "functions": {
      "hit": 23,
      "found": 29,
      "details": [ {
          "name": "(anonymous 1)",
          "line": 7,
          "hit": 6
        } ]
    },
    "lines": {
      "found": 181,
      "hit": 143,
      "details": [ {
          "line": 7,
          "hit": 6
        } ]
    },
    "branches": {
      "found": 123,
      "hit": 456,
      "details": [ {
          "line": 7,
          "hit": 6
        } ]
    }
}
```

## Methods

### `getCoverage( content, type, callback )`

- `content` | _String_ | the code coverage file contents
- `type` | _String_ `[ "lcov" | "cobertura" | "gocover" | "jacoco" ]` | the code coverage file type
- `callback` | _Function_ | Callback args `Error`, `Array of Common Coverage Objects`

### `getFileCoverage( coverageArray, filePath )`

- `coverageArray` | _Array of Common Coverage Objects_ | array of file coverage
- `filePath` | _String_ | the file to find in `coverageArray`
- returns | _Common Coverage Object_ | the first matching file found, or `undefined`

### `getLine( lineCoverage, line )`

- `lineCoverage` | _Line Coverage from Common Coverage Object_ | array of file coverage
- `line` | _Number_ | the line number to find
- returns | _Object_ { active: true | false, hit: true | false | null  }
 - `active` whether a line was covered
 - `hit` whether it was hit where and `hit=null` when `active=false`

### `getLineCoveragePercent( coverageArray )`

- `coverageArray` | _Array of Common Coverage Objects_ | array of file coverage
- returns | _Number_ | percent of lines that have coverage

### `linesCovered( coverage )`

- `coverage` | _Common Coverage Objects_ | file coverage
- returns | _Array of Line Coverage_ | only the hit lines from the file

### `linesMissing( coverage )`

- `coverage` | _Common Coverage Objects_ | file coverage
- returns | _Array of Line Coverage_ | only the non-hit lines from the file

### `getFileType( filePath )`

- `filePath` | _String_ | the file name or path
- returns | _String_ | a file type based on `filePath` extension
 - "bash" | "css" | "go" | "javascript" | "less" | "markdown" | "python" | "sql" | "clike" (default for non-matched)

### `renderCoverage( coverage, source )`

- `coverage` | _Common Coverage Object_ | the file coverage
- `source` | _String_ | the file contents
- returns | _String_ | HTML output wraps covered lines in `<span>`s to indicate whether the line was hit or not.

### `formatCoverage( coverage, source, filePath, callback )`

Returns a complete template with code coloring and syntax highlighting, as compared to `renderCoverage` which just returns an HTML snippet.

- `coverage` | _Common Coverage Object_ | the file coverage
- `source` | _String_ | the file contents
- `filePath` | _String_ | the file path
- `callback` | _Function_, args err: Error, String: html | `html` is created based on the `source/templates/basic.html` file

### `getGitHubFile( accessToken, owner, repoName, commitHash, filePath, callback )`

- `accessToken` | _String_ | GitHub access token
- `owner` | _String_ | GitHub file owner
- `repoName` | _String_ | GitHub repo name
- `commitHash` | _String_ | GitHub commit hash (sha)
- `filePath` | _String_ | GitHub file path (this must match the path on GitHub, not the local file path)
- `callback` | _Function_, args err: Error, String: contents | `contents` is the file contents

### `getGitHubRepos( accessToken, callback )`

This is a convenience method that collects repos from the user's org and own repos

- `accessToken` | _String_ | GitHub access token
- `callback` | _Function_, args err: Error, Array: repos | `repos` is a list of all the repos, the order is not guaranteed to be consistent

### `getGitHubOwnerRepos( accessToken, callback )`

- `accessToken` | _String_ | GitHub access token
- `callback` | _Function_, args err: Error, Array: repos | `repos` is a list of all the owner's repos

### `getGitHubOrgRepos( accessToken, org, callback )`

- `accessToken` | _String_ | GitHub access token
- `org` | _String_ | GitHub organization name
- `callback` | _Function_, args err: Error, Array: repos | `repos` is a list of all the org's repos

### `createGitHubStatus( accessToken, message, callback )`

- `accessToken` | _String_ | GitHub access token
- `message` follows http://mikedeboer.github.io/node-github/#statuses.prototype.create and is passed along directly.
- `callback` | _Function_, args err: Error | callback is invoked directly by the GitHub module


## Tests

`npm test`

Or to run with coverage statistics `npm run testcover`


## Contributing

A JSCS file is included. Please check any changes against the code standards defined in that file. All changes should have tests.
