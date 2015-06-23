"use strict";

var assert = require( "assert" );
var cvr = require( "../source" );
var fs = require( "fs" );
var path = require( "path" );

var accessToken = process.env.GITHUB_TOKEN || require( "./local.json" ).GITHUB_TOKEN;
var gitHubUser = process.env.GITHUB_USER || require( "./local.json" ).GITHUB_USER;
var gitHubRepoOwner = process.env.GITHUB_REPO_OWNER || require( "./local.json" ).GITHUB_REPO_OWNER;
var gitHubRepo = process.env.GITHUB_REPO || require( "./local.json" ).GITHUB_REPO;
var coveredFile = process.env.COVERED_FILE || require( "./local.json" ).COVERED_FILE;
var commitHash = process.env.COMMIT_HASH || require( "./local.json" ).COMMIT_HASH;


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

    it( "should create a coverage report for a LCOV file", function ( done )
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
                        fs.mkdir( path.join( "tmp" ), function ()
                        {
                            fs.writeFile( path.join( "tmp", "coverage-lcov.html" ), result, done );
                        } );
                    } );
                } );
            } );
        } );
    } );

    it( "should create a coverage report for a Cobertura file", function ( done )
    {
        cvr.getGitHubFile( accessToken, gitHubUser, gitHubRepo, null, coveredFile, function ( err, blob )
        {
            assert.equal( !!err, false );
            assert.equal( !!String( blob ), true );

            var text = String( blob );

            fs.readFile( "./test/assets/cobertura.xml", { encoding: "utf8" }, function ( err, content )
            {
                cvr.getCoverage( content, "cobertura", function ( err, cov )
                {
                    var coverage = cvr.getFileCoverage( cov, coveredFile );
                    cvr.formatCoverage( coverage, text, coveredFile, function ( err, result )
                    {
                        fs.mkdir( path.join( "tmp" ), function ()
                        {
                            fs.writeFile( path.join( "tmp", "coverage-cobertura.html" ), result, done );
                        } );
                    } );
                } );
            } );
        } );
    } );

    it( "should prepend paths", function ()
    {
        assert.equal(
            cvr.prependPath(
                '<class name="app.js" filename="source/scripts/project/app.js" line-rate="0.9459000000000001">',
                "project/", "cobertura" ),
                '<class name="app.js" filename="project/source/scripts/project/app.js" line-rate="0.9459000000000001">' );
    } );

    it( "should remove paths", function ()
    {
        assert.equal(
            cvr.removePath(
                "TN:\nSF:source/scripts/project/app.js\nFN:5,(anonymous_1)",
                "source/scripts/", "lcov" ),
                "TN:\nSF:project/app.js\nFN:5,(anonymous_1)" );
    } );
} );