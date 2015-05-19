
var assert = require( "assert" );
var cvr = require( "../source" );
var fs = require( "fs" );
var path = require( "path" );

var localSettings = require( "./local.json" );
var accessToken = process.env.GITHUB_TOKEN || localSettings.GITHUB_TOKEN;
var gitHubUser = process.env.GITHUB_USER || localSettings.GITHUB_USER;
var gitHubRepoOwner = process.env.GITHUB_REPO_OWNER || localSettings.GITHUB_REPO_OWNER;
var gitHubRepo = process.env.GITHUB_REPO || localSettings.GITHUB_REPO;
var coveredFile = process.env.COVERED_FILE || localSettings.COVERED_FILE;
var commitHash = process.env.COMMIT_HASH || localSettings.COMMIT_HASH;


describe( "git", function ()
{
    it( "should get a list of repos from GitHub", function ( done )
    {
        this.timeout( 10000 );
        cvr.getGitHubRepos( accessToken, function ( err, repos )
        {
            assert( !err );
            assert( repos.length > 0 );
            done();
        } );
    } );

    it( "should get a file from github", function ( done )
    {
        cvr.getGitHubFile( accessToken, gitHubRepoOwner, gitHubRepo, commitHash, "README.md", function ( err, res )
        {
            assert( !err );
            assert( !!res );
            done();
        } );
    } );

    it( "should create a coverage report for a file", function ( done )
    {
        cvr.getGitHubFile( accessToken, gitHubUser, gitHubRepo, null, coveredFile, function ( err, blob )
        {
            assert.equal( !!err, false );
            assert.equal( !!String( blob ), true );

            var text = String( blob );

            fs.readFile( "./test/assets/lcov.info", { encoding: "utf8" }, function ( err, content )
            {
                cvr.getCoverage( content, "lcov", function ( err, cov )
                {
                    var coverage = cvr.getFileCoverage( cov, coveredFile );
                    cvr.formatCoverage( coverage, text, coveredFile, function ( err, result )
                    {
                        fs.writeFile( path.join( "tmp", "coverage.html" ), result, done );
                    } );
                } );
            } )
        } );
    } );

} );