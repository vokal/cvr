"use strict";

var path = require( "path" );
var fs = require( "fs" );
var atob = require( "atob" );
var async = require( "async" );
var lcov = require( "lcov-parse" );
var cobertura = require( "cobertura-parse" );
var githubApi = require( "github" );
var github = new githubApi( {
    version: "3.0.0"
} );

var handlebars = require( "handlebars" );

var cvr = {};

module.exports = cvr;

cvr.getGitHubFile = function ( accessToken, owner, repoName, commitHash, filePath, done )
{
    github.authenticate( {
        type: "oauth",
        token: accessToken
    } );

    github.repos.getContent({
        user: owner,
        repo: repoName,
        ref: commitHash || "master",
        path: filePath
    }, function ( err, res )
    {
        if( err )
        {
            return done( err );
        }

        if( res.encoding === "base64" )
        {
            res.content = atob( res.content );
        }

        done( null, res.content );
    } );
};

cvr.getGitHubRepos = function ( accessToken, done )
{
    github.authenticate( {
        type: "oauth",
        token: accessToken
    } );

    github.user.getOrgs( { per_page: 100 }, function ( err, orgs )
    {
        var fetch = [];

        fetch.push( function ( done )
        {
            cvr.getGitHubOwnerRepos( accessToken, done );
        } );

        orgs.forEach( function ( org )
        {
            fetch.push( function ( done )
            {
               cvr.getGitHubOrgRepos( accessToken, org.login, done );
            } );
        } );

        async.series( fetch, function ( err, results )
        {
            var flat = [];
            results.forEach( function ( r )
            {
                flat = flat.concat( r );
            } );
            done( null, flat );
        } );
    } );
};

cvr.getGitHubOwnerRepos = function ( accessToken, done )
{
    github.authenticate( {
        type: "oauth",
        token: accessToken
    } );

    //TODO: more than 100
    github.repos.getAll( { per_page: 100 }, done );
};

cvr.getGitHubOrgRepos = function ( accessToken, org, done )
{
    github.authenticate( {
        type: "oauth",
        token: accessToken
    } );

    var results = [];

    var getPage = function ( index )
    {
        github.repos.getFromOrg( { per_page: 100, page: index, org: org }, function ( err, result )
        {
            results = results.concat( result );
            if( result.length === 100 )
            {
                getPage( index + 1 );
            }
            else
            {
                done( null, results.sort( function ( a, b )
                {
                    return a.full_name < b.full_name ? -1 : a.full_name > b.full_name ? 1 : 0;
                } ) );
            }
        } );
    };

    getPage( 1 );
};

cvr.getCoverage = function ( content, type, done )
{
    if( type === "lcov" )
    {
        lcov( content, done );
    }
    else if( type === "cobertura" )
    {
        cobertura.parseContent( content, done );
    }
    else
    {
        done( new Error( "Coverage Type Unavailable: " + type ) );
    }
};

cvr.getLineCoveragePercent = function ( coverageArray )
{
    var found = 0;
    var hit = 0;

    coverageArray.forEach( function ( c )
    {
        found += c.lines.found;
        hit += c.lines.hit;
    } );

    return hit / found * 100;
};

cvr.getFileCoverage = function ( coverage, filePath )
{
    return coverage.filter( function ( c )
    {
        return c.file === filePath;
    } )[ 0 ];
};

cvr.getLine = function ( lineCoverage, line )
{
    var lineExecs = lineCoverage.filter( function ( c )
    {
        return c.line === line - 1;
    } );

    return {
        active: !!lineExecs.length,
        hit: lineExecs.length ? lineExecs[ 0 ].hit : null
    };
};

cvr.renderCoverage = function ( coverage, source )
{
    var lines = source.split( "\n" );
    var covLines = coverage.lines.details;

    for( var l = 0; l < lines.length; l++ )
    {
        var lineCover = cvr.getLine( covLines, l ).hit;
        if( lineCover )
        {
            lines[ l ] = '<span class="cvr-line-y">' + lines[ l ]  + '</span>';
        }
        else if ( lineCover !== null )
        {
            lines[ l ] = '<span class="cvr-line-n">' + lines[ l ]  + '</span>';
        }
    }

    return lines.join( "\n" );
};

cvr.linesCovered = function ( coverage )
{
    return coverage.lines.details
        .filter( function ( line )
        {
            return line.hit;
        } )
        .map( function ( line )
        {
            return line.line;
        } );
};

cvr.linesMissing = function ( coverage )
{
    return coverage.lines.details
        .filter( function ( line )
        {
            return line.hit === 0;
        } )
        .map( function ( line )
        {
            return line.line;
        } );
};

cvr.getFileType = function ( filePath )
{
    var types = {
        bash: "bash",
        css: "css",
        go: "go",
        js: "javascript",
        less: "less",
        md: "markdown",
        python: "python",
        sql: "sql"
    };

    return types[ path.extname( filePath ).replace( ".", "" ) ] || "clike";
};

cvr.formatCoverage = function ( coverage, source, filePath, done )
{
    var linesCovered = cvr.linesCovered( coverage );
    var linesMissing = cvr.linesMissing( coverage );

    fs.readFile( path.join( "source", "templates", "basic.html" ),
        { encoding: "utf8" },
        function ( err, content )
    {
        var template = handlebars.compile( content );

        done( null, template( {
            source: source,
            title: filePath,
            extension: cvr.getFileType( filePath ),
            linesCovered: linesCovered.join( "," ),
            linesMissing: linesMissing.join( "," )
        } ) );
    } );
};