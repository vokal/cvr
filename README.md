# cvr

Code coverage tools.

## Usage

**Full docs needed**


### cvr.getGitHubFile

function ( accessToken, owner, repoName, commitHash, filePath, done )

### cvr.getGitHubRepos

function ( accessToken, done )

### cvr.getGitHubOwnerRepos

function ( accessToken, done )

### cvr.getGitHubOrgRepos

function ( accessToken, org, done )

### cvr.getCoverage

function ( content, type, done )

### cvr.getLineCoveragePercent

function ( coverageArray )

### cvr.getFileCoverage

function ( coverage, filePath )

### cvr.getLine

function ( lineCoverage, line )

### cvr.renderCoverage

function ( coverage, source )

### cvr.linesCovered

function ( coverage )

### cvr.linesMissing

function ( coverage )

### cvr.getFileType

function ( filePath )

### cvr.formatCoverage

function ( coverage, source, filePath, done )

### cvr.createGitHubStatus

function ( accessToken, userName, repoName, hash, state, description, done )
