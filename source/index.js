var git = require( "nodegit" );
var path = require( "path" );
var rimraf = require( "rimraf" );
var fs = require( "fs" );
var async = require( "async" );
var lcov = require( "lcov-parse" );
var githubApi = require( "github" );
var github = new githubApi( {
    version: "3.0.0"
} );

var handlebars = require( "handlebars" );

var cvr = {};

module.exports = cvr;

cvr.commitCache = {};

cvr.getCommit = function ( accessToken, owner, repo, commit, done )
{
    var commit = commit || "HEAD"; //TODO: using HEAD like this is too general
    var commitCacheKey = owner + "/" + repo + "/" + commit;
    var cachedCommit = cvr.commitCache[ commitCacheKey ];

    if( cachedCommit )
    {
        return done( null, cachedCommit );
    }

    var gitUrl = "https://github.com/" + owner + "/" + repo;
    var options = {
        remoteCallbacks: {
            credentials: function ()
            {
                return git.Cred.userpassPlaintextNew( accessToken, "x-oauth-basic" );
            },
            certificateCheck: function ()
            {
                return 1;
            }
        }
    };

    if( !fs.existsSync( path.join( "tmp" ) ) )
    {
        fs.mkdirSync( path.join( "tmp" ) );
    }
    if( !fs.existsSync( path.join( "tmp", owner ) ) )
    {
        fs.mkdirSync( path.join( "tmp", owner ) );
    }
    if( !fs.existsSync( path.join( "tmp", owner, repo ) ) )
    {
        fs.mkdirSync( path.join( "tmp", owner, repo ) );
    }

    var tmp = path.join( "tmp", owner, repo, commit );
    rimraf.sync( tmp );


    var result = git.Clone.clone( gitUrl, tmp, options )
        .then( function( repo )
        {
            return git.Reference.nameToId( repo, commit )
                .then( function ( commitOid )
                {
                    return git.Commit.lookup( repo, commitOid );
                } );
        } )
        .then( function ( commit )
        {
            cvr.commitCache[ commitCacheKey ] = commit;
            done( null, commit );
        } )
        .catch( done );
};

cvr.getBlob = function ( owner, repo, commit, fileName, done )
{
    cvr.getCommit( null, owner, repo, commit, function ( err, commit )
    {
        if( err )
        {
            return done( err );
        }

        commit.getEntry( fileName )
            .then( function( entry )
            {
                return entry.getBlob().then( function( blob )
                {
                    done( null, blob );
                } )
                .catch( done );
            } )
            .catch( done );
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
        } )
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

cvr.parseLCOV = function ( path, done )
{
    lcov( path, done );
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

cvr.formatCoverage = function ( coverage, source, filePath, done )
{
    var linesCovered = coverage.lines.details
        .filter( function ( line )
        {
            return line.hit;
        } )
        .map( function ( line )
        {
            return line.line;
        } );

    var linesMissing = coverage.lines.details
        .filter( function ( line )
        {
            return line.hit === 0;
        } )
        .map( function ( line )
        {
            return line.line;
        } );

    fs.readFile( path.join( "source", "templates", "basic.html" ),
        { encoding: "utf8" },
        function ( err, content )
    {
        var template = handlebars.compile( content );

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

        done( null, template( {
            source: source,
            title: filePath,
            extension: types[ path.extname( filePath ).replace( ".", "" ) ] || "clike",
            linesCovered: linesCovered.join( "," ),
            linesMissing: linesMissing.join( "," )
        } ) );
    } );
};