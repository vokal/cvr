"use strict";

var assert = require( "assert" );
var cvr = require( "../source" );
var fs = require( "fs" );
var path = require( "path" );
var util = require( "util" );
var nock = require( "nock" );
var gitNock = nock( "https://api.github.com" );

nock.emitter.on( "no match", function ( req )
{
    console.log( req ); //makes debug a lot easier
} );

var accessToken = "12345";
var webhookUrl = "https://cvr.vokal.io/webhook";
var gitHubUser = "jrit";
var gitHubRepoOwner = "vokal";
var gitHubRepo = "cvr";
var commitHash = "ef54eb807093e8a1f45f26a624267503ea01932d";
var coveredFile = "source/index.js";


var getTestReporter = function ( sourceFile, format, coveredFile, linePercent )
{
    return function ( done )
    {
        gitNock
            .get( util.format( "/repos/%s/%s/contents/%s",
                gitHubUser, gitHubRepo, encodeURIComponent( coveredFile ) ) )
            .query( { ref: "master", access_token: accessToken } )
            .reply( 200, {
                type: "file",
                encoding: "base64",
                name: coveredFile,
                path: coveredFile,
                content: fs.readFileSync( path.resolve( process.cwd(), coveredFile ) ).toString()
            } );

        cvr.gitHub.getFile( accessToken, gitHubUser, gitHubRepo, null, coveredFile, function ( err, blob )
        {
            assert.equal( !!err, false, "err should be null: " + err );
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
        gitNock
            .get( "/user/orgs" )
            .query( { per_page: "100", access_token: accessToken } )
            .reply( 200, [ {
                "login": "github"
            } ] );

        gitNock
            .get( "/orgs/github/repos" )
            .query( { access_token: accessToken, per_page: 100, page: 1 } )
            .reply( 200, [ {
                "owner": {
                    "login": "octocat"
                },
                "name": "Hello-World",
                "full_name": "octocat/Hello-World"
            } ] );

        gitNock
            .get( "/user/repos" )
            .query( { access_token: accessToken, per_page: 100, page: 1 } )
            .reply( 200, [ {
                "owner": {
                  "login": "octocat"
                },
                "name": "Hello-World",
                "full_name": "octocat/Hello-World"
            } ] );

        cvr.gitHub.getRepos( accessToken, function ( err, repos )
        {
            assert.equal( err, null );
            assert( repos.length > 0 );
            done();
        } );
    } );

    it( "should get a file from github", function ( done )
    {
        var fileName = "README.md";

        gitNock
            .get( util.format( "/repos/%s/%s/contents/%s", gitHubRepoOwner, gitHubRepo, fileName ) )
            .query( { ref: commitHash, access_token: accessToken } )
            .reply( 200, {
                type: "file",
                encoding: "base64",
                name: fileName,
                path: fileName,
                content: fs.readFileSync( path.resolve( process.cwd(), fileName ) ).toString()
            } );

        cvr.gitHub.getFile( accessToken, gitHubRepoOwner, gitHubRepo, commitHash, fileName, function ( err, res )
        {
            assert.equal( err, null );
            assert( !!res );
            done();
        } );
    } );

    it( "should create a coverage report for a LCOV file",
        getTestReporter( "./test/assets/lcov.info", "lcov", coveredFile, 42 ) );

    it( "should create a coverage report for a Cobertura file",
        getTestReporter( "./test/assets/cobertura.xml", "cobertura", coveredFile, 94 ) );

    it( "should create a coverage report for a jacoco file",
        getTestReporter( "./test/assets/jacoco.xml", "jacoco", coveredFile, 23 ) );

    it( "should create a coverage report for a Go Cover file",
        getTestReporter( "./test/assets/gocover.out", "gocover", coveredFile, 46 ) );

    it( "should prepend paths", function ()
    {
        assert.equal(
            cvr.prependPath(
                '<class name="index.js" filename="source/index.js" line-rate="0.9459000000000001">',
                "project/", "cobertura" ),
                '<class name="index.js" filename="project/source/index.js" line-rate="0.9459000000000001">' );

        assert.equal(
            cvr.prependPath(
                '<package name="source/scripts/project"><class name="source/scripts/project/app">',
                "project/", "jacoco" ),
                '<package name="project/source/scripts/project"><class name="project/source/scripts/project/app">' );

        assert.equal(
            cvr.prependPath(
                "mode: count\nsource/index.js:44.31,47.2 2 0\nsource/index.js:49.71,54.16 4 7",
                "project/", "gocover" ),
                "mode: count\nproject/source/index.js:44.31,47.2 2 0\nproject/source/index.js:49.71,54.16 4 7" );

        assert.equal(
            cvr.prependPath(
                "TN:\nSF:source/index.js\nFN:5,(anonymous_1)",
                "project/", "lcov" ),
                "TN:\nSF:project/source/index.js\nFN:5,(anonymous_1)" );
    } );

    it( "should remove paths", function ()
    {
        assert.equal(
            cvr.removePath(
                "TN:\nSF:source/index.js\nFN:5,(anonymous_1)",
                "source/scripts/", "lcov" ),
                "TN:\nSF:source/index.js\nFN:5,(anonymous_1)" );
    } );

    it( "should create a webhook", function ( done )
    {
        gitNock
            .get( util.format( "/repos/%s/%s/hooks", gitHubUser, gitHubRepo ) )
            .query( { page: 1, per_page: 100, access_token: accessToken } )
            .reply( 200, [ {
                config: {
                    url: webhookUrl
                }
            } ] );

        cvr.gitHub.createHook( accessToken, gitHubUser, gitHubRepo, webhookUrl, function ( err, res )
        {
            assert.equal( err, null );
            assert.equal( res.config.url, webhookUrl );
            done();
        } );
    } );

    it( "should delete a webhook", function ( done )
    {
        gitNock
            .get( util.format( "/repos/%s/%s/hooks", gitHubUser, gitHubRepo ) )
            .query( { page: 1, per_page: 100, access_token: accessToken } )
            .reply( 200, [ {
                id: 1,
                config: {
                    url: webhookUrl
                }
            } ] )
            .delete( util.format( "/repos/%s/%s/hooks/1", gitHubUser, gitHubRepo ) )
            .query( { access_token: accessToken } )
            .reply( 200 );

        cvr.gitHub.deleteHook( accessToken, gitHubUser, gitHubRepo, webhookUrl, function ( err, res )
        {
            assert.equal( err, null );
            assert.equal( !!res, true );
            done();
        } );
    } );

    it( "should create a status", function ( done )
    {
        gitNock
            .post( util.format( "/repos/%s/%s/statuses/%s", gitHubUser, gitHubRepo, commitHash ) )
            .query( { access_token: accessToken } )
            .reply( 201, {
                state: "pending"
            } )
            .post( util.format( "/repos/%s/%s/statuses/%s", gitHubUser, gitHubRepo, commitHash ) )
            .query( { access_token: accessToken } )
            .reply( 201, {
                state: "success"
            } );

        var statusMessage = {
            user: gitHubUser,
            repo: gitHubRepo,
            sha: commitHash,
            state: "pending",
            context: "cvr",
            description: "code coverage pending",
            target_url: "http://vokal.io"
        };

        cvr.gitHub.createStatus( accessToken, statusMessage, function ( err, res )
        {
            assert.equal( err, null );
            assert.equal( res.state, "pending" );

            statusMessage.state = "success";
            statusMessage.description = "code coverage meets minimum";

            cvr.gitHub.createStatus( accessToken, statusMessage, function ( err, res )
            {
                assert.equal( err, null );
                assert.equal( res.state, "success" );
                done();
            } );
        } );
    } );
} );

describe( "Shields", function ()
{
    it( "should get a shield", function ( done )
    {
        cvr.getShield( 80, 80, function ( err, res )
        {
            assert.equal( err, null );
            done();
        } );
    } );
} );

describe( "Utility", function ()
{
    it( "should sort coverage by file path", function ( done )
    {
        var coverageArray = [
            { file: "app/sub/test.html" },
            { file: "app/sub/index.html" },
            { file: "app/index.html" } ];

        var result = cvr.sortCoverage( coverageArray );

        assert.equal( coverageArray[ 0 ].file, "app/index.html" );
        assert.equal( coverageArray[ 1 ].file, "app/sub/index.html" );
        assert.equal( coverageArray[ 2 ].file, "app/sub/test.html" );
        done();
    } );

    it( "should calculate correct coverage percent", function ( done )
    {
        var coverageArray = [];

        assert.equal( cvr.getLineCoveragePercent( coverageArray ), 100 );

        coverageArray = [ { lines: { found: 0, hit: 0 } } ];
        assert.equal( cvr.getLineCoveragePercent( coverageArray ), 100 );

        coverageArray = [ { lines: { found: 4, hit: 1 } } ];
        assert.equal( cvr.getLineCoveragePercent( coverageArray ), 25 );

        done();
    } );

    it( "should get a line", function ( done )
    {
        var coverageArray = [];

        assert.deepEqual( cvr.getLine( coverageArray, 1 ), { active: false, hit: null } );

        coverageArray = coverageArray = [ { line: 1, found: 4, hit: 5 } ];
        assert.deepEqual( cvr.getLine( coverageArray, 1 ), { active: true, hit: 5 } );

        done();
    } );
} );

describe( "File type checking", function ()
{
    it( "should return correct file type", function ( done )
    {
        var fileTypes = {
            "my-style.less": "less",
            "my-styles.css": "css",
            "main.go": "go",
            "Some_other_file.xcode": "clike",
            "urls.py": "python",
            "V34__Create_sp_insert_data.sql": "sql",
            "script.sh": "bash",
            "other-script.bash": "bash",
            "README.md": "markdown",
            "index.js": "javascript"
        };

        for ( var name in fileTypes )
        {
            assert.equal( fileTypes[ name ], cvr.getFileType( name ) );
        };
        done();
    } );
} );
