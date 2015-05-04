var git = require( "nodegit" );
var path = require( "path" );
var rimraf = require( "rimraf" );
var fs = require( "fs" );
var lcov = require( "lcov-parse" );
var githubApi = require( "github" );
var github = new githubApi( {
    version: "3.0.0"
} );

var cvr = {};

module.exports = cvr;

cvr.commitCache = {};

cvr.getCommit = function ( accessToken, owner, repo, commit, done )
{
    var commitCacheKey = owner + "_" + repo + "/" + ( commit || "HEAD" ); //TODO: using HEAD like this is wrong
    var cachedCommit = cvr.commitCache[ commitCacheKey ];

    if( cachedCommit )
    {
        return done( null, cachedCommit );
    }

    var gitUrl = "http://github.com/" + owner + "/" + repo;
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

    var tmp = path.join( "tmp", owner, repo );
    rimraf.sync( tmp );


    var result = git.Clone.clone( gitUrl, tmp, options )
        .then( function( repo )
        {
            // TODO: accept commit
            return git.Reference.nameToId( repo, "HEAD" )
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

    //TODO: more than 100
    github.repos.getAll( { per_page: 100 }, done );
};

cvr.parseLCOV = function ( path, done )
{
    lcov( path, done );
};
