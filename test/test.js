"use strict";

var assert = require( "assert" );
var cvr = require( "../source" );
var fs = require( "fs" );
var path = require( "path" );

var accessToken = process.env.GITHUB_TOKEN || require( "./local.json" ).GITHUB_TOKEN;
var gitHubUser = process.env.GITHUB_USER || require( "./local.json" ).GITHUB_USER;
var gitHubRepoOwner = process.env.GITHUB_REPO_OWNER || require( "./local.json" ).GITHUB_REPO_OWNER;
var gitHubRepo = process.env.GITHUB_REPO || require( "./local.json" ).GITHUB_REPO;
var commitHash = process.env.COMMIT_HASH || require( "./local.json" ).COMMIT_HASH;
var webhookUrl = process.env.WEBHOOK_URL || require( "./local.json" ).WEBHOOK_URL;


var getTestReporter = function ( sourceFile, format, coveredFile, linePercent )
{
    return function ( done )
    {
        cvr.getGitHubFile( accessToken, gitHubUser, gitHubRepo, null, coveredFile, function ( err, blob )
        {
            assert.equal( !!err, false );
            assert.equal( !!String( blob ), true );

            var text = String( blob );

            fs.readFile( sourceFile, { encoding: "utf8" }, function ( err, content )
            {
                cvr.getCoverage( content, format, function ( err, cov )
                {
                    assert.equal( Math.floor( cvr.getLineCoveragePercent( cov ) ), linePercent );

                    var coverage = cvr.getFileCoverage( cov, coveredFile );
                    cvr.formatCoverage( coverage, text, coveredFile, function ( err, result )
                    {
                        fs.mkdir( path.join( "tmp" ), function ()
                        {
                            fs.writeFile( path.join( "tmp", "coverage-" + format + ".html" ), result, done );
                        } );
                    } );
                } );
            } );
        } );
    };
};


describe( "git", function ()
{
    it( "should get a list of repos from GitHub", function ( done )
    {
        this.timeout( 20000 );
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

    it( "should create a coverage report for a LCOV file",
        getTestReporter( "./test/assets/lcov.info", "lcov", "source/scripts/project/app.js", 42 ) );

    it( "should create a coverage report for a Cobertura file",
        getTestReporter( "./test/assets/cobertura.xml", "cobertura", "source/scripts/project/app.js", 94 ) );

    it( "should create a coverage report for a jacoco file",
        getTestReporter( "./test/assets/jacoco.xml", "jacoco", "source/scripts/project/app.js", 23 ) );

    it( "should create a coverage report for a Go Cover file",
        getTestReporter( "./test/assets/gocover.out", "gocover", "source/scripts/project/app.js", 46 ) );

    it( "should prepend paths", function ()
    {
        assert.equal(
            cvr.prependPath(
                '<class name="app.js" filename="source/scripts/project/app.js" line-rate="0.9459000000000001">',
                "project/", "cobertura" ),
                '<class name="app.js" filename="project/source/scripts/project/app.js" line-rate="0.9459000000000001">' );

        assert.equal(
            cvr.prependPath(
                '<package name="source/scripts/project"><class name="source/scripts/project/app">',
                "project/", "jacoco" ),
                '<package name="project/source/scripts/project"><class name="project/source/scripts/project/app">' );

        assert.equal(
            cvr.prependPath(
                "mode: count\nsource/scripts/project/app.js:44.31,47.2 2 0\nsource/scripts/project/app.js:49.71,54.16 4 7",
                "project/", "gocover" ),
                "mode: count\nproject/source/scripts/project/app.js:44.31,47.2 2 0\nproject/source/scripts/project/app.js:49.71,54.16 4 7" );

        assert.equal(
            cvr.prependPath(
                "TN:\nSF:source/scripts/project/app.js\nFN:5,(anonymous_1)",
                "project/", "lcov" ),
                "TN:\nSF:project/source/scripts/project/app.js\nFN:5,(anonymous_1)" );
    } );

    it( "should remove paths", function ()
    {
        assert.equal(
            cvr.removePath(
                "TN:\nSF:source/scripts/project/app.js\nFN:5,(anonymous_1)",
                "source/scripts/", "lcov" ),
                "TN:\nSF:project/app.js\nFN:5,(anonymous_1)" );
    } );

    it( "should register a webhook", function ( done )
    {
        cvr.createGitHubHook( accessToken, gitHubUser, gitHubRepo, webhookUrl, function ( err, res )
        {
            assert.equal( err, null );
            assert.equal( res.config.url, webhookUrl );
            done();
        } );
    } );

    it( "should create a status", function ( done )
    {
        var statusMessage = {
            user: gitHubUser,
            repo: gitHubRepo,
            sha: commitHash,
            state: "pending",
            context: "cvr",
            description: "code coverage pending",
            target_url: "http://vokal.io"
        };

        cvr.createGitHubStatus( accessToken, statusMessage, function ( err, res )
        {
            assert.equal( err, null );
            assert.equal( res.state, "pending" );

            statusMessage.state = "success";
            statusMessage.description = "code coverage meets minimum";

            cvr.createGitHubStatus( accessToken, statusMessage, function ( err, res )
            {
                assert.equal( err, null );
                assert.equal( res.state, "success" );
                done();
            } );
        } );
    } );

    it( "should get a shield", function ( done )
    {
        cvr.getShield( 80, 80, function ( err, res )
        {
            assert.equal( err, null );
            done();
        } );
    } );
} );
