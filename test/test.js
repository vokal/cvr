
var assert = require( "assert" );
var cvr = require( "../source" );
var fs = require( "fs" );
var path = require( "path" );

var accessToken = process.env.GITHUB_TOKEN || require( "./local.json" ).GITHUB_TOKEN;
var gitHubUser = process.env.GITHUB_USER || require( "./local.json" ).GITHUB_USER;
var gitHubRepo = process.env.GITHUB_REPO || require( "./local.json" ).GITHUB_REPO;
var coveredFile = process.env.COVERED_FILE || require( "./local.json" ).COVERED_FILE;


describe( "git", function ()
{
    this.timeout( 5000 );

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

    it( "should get a commit from git", function ( done )
    {
        cvr.getCommit( accessToken, gitHubUser, gitHubRepo, null, function ( err, commit )
        {
            assert( !err );
            assert( commit != null );
            done();
        } );
    } );

    it( "should get a blob from git", function ( done )
    {
        cvr.getBlob( gitHubUser, gitHubRepo, null, "README.md", function ( err, blob )
        {
            assert( !err );
            assert( !!String( blob ) );
            done();
        } );
    } );

    it( "should create a coverage report for a file", function ( done )
    {
        cvr.getBlob( gitHubUser, gitHubRepo, null, coveredFile, function ( err, blob )
        {
            assert.equal( !!err, false );
            assert.equal( !!String( blob ), true );

            var text = String( blob );

            cvr.parseLCOV( "./test/assets/lcov.info", function ( err, cov )
            {
                var coverage = cvr.getFileCoverage( cov, coveredFile );
                cvr.formatCoverage( coverage, text, coveredFile, function ( err, result )
                {
                    fs.writeFile( path.join( "tmp", "coverage.html" ), result, done );
                } );
            } )
        } );
    } );

} );