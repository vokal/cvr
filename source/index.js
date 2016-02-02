"use strict";

var path = require( "path" );
var fs = require( "fs" );
var lcov = require( "lcov-parse" );
var cobertura = require( "cobertura-parse" );
var jacoco = require( "jacoco-parse" );
var gocover = require( "golang-cover-parse" );

var handlebars = require( "handlebars" );
var shield = require( "svg-shield" );


var cvr = {
    gitHub: require( "./github" )
};

module.exports = cvr;

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
    else if( type === "jacoco" )
    {
        jacoco.parseContent( content, done );
    }
    else if( type === "gocover" )
    {
        gocover.parseContent( content, done );
    }
    else
    {
        done( new Error( "Coverage Type Unavailable: " + type ) );
    }
};

cvr.sortCoverage = function ( coverageArray )
{
    return coverageArray.sort( function ( a, b )
    {
        if( a === b )
        {
            return 0;
        }

        var dirA = path.dirname( a.file );
        var dirB = path.dirname( b.file );

        if( dirA !== dirB )
        {
            return dirA > dirB ? 1 : -1;
        }

        return path.basename( a.file ) > path.basename( b.file ) ? 1 : -1;
    } );
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

    if( found === 0 )
    {
        return 100;
    }

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
        return c.line === line;
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
        sh: "bash",
        bash: "bash",
        css: "css",
        go: "go",
        js: "javascript",
        less: "less",
        md: "markdown",
        py: "python",
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
        if( err )
        {
            return done( err );
        }

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

cvr.removePath = function ( coverage, path )
{
    var exp = new RegExp( path.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&" ), "g" );
    return coverage.replace( exp, "" );
};

cvr.prependPath = function ( coverage, path, coverageType )
{
    if( coverageType === "jacoco" )
    {
        return coverage
            .replace( /class name="/g, "class name=\"" + path )
            .replace( /package name="/g, "package name=\"" + path );
    }

    if( coverageType === "cobertura" )
    {
        return coverage.replace( /filename="/g, "filename=\"" + path );
    }

    if( coverageType === "gocover" )
    {
        return coverage.split( "mode:" ).map( function ( mode )
        {
            if( mode )
            {
                return "mode:" + mode.replace( /(.*):/g, path + "$1:" );
            }
            return "";
        } ).join( "" );
    }

    // default to lcov
    return coverage.replace( /SF:/g, "SF:" + path );
};

cvr.getShield = function ( linePercent, minPassingLinePercent, callback )
{
    var valueBgColor = linePercent >= minPassingLinePercent ? "#4b1" : "#b21";
    if( linePercent && linePercent.toFixed )
    {
        linePercent = Math.floor( linePercent ).toFixed( 0 ) + "%";
    }

    shield.getShield( {
        valueBgColor: valueBgColor,
        value: linePercent || "new",
        name: "line cvr",
        nameWidth: 60
    }, callback );
};
