"use strict";

var a = require( "async" );
var atob = require( "atob" );
var request = require( "request" );
var githubApi = require( "github" );
var github = new githubApi( {
    version: "3.0.0"
} );

var api = {};
module.exports = api;

var authenticate = function ( accessToken )
{
    github.authenticate( {
        type: "oauth",
        token: accessToken
    } );
};

api.getFile = function ( accessToken, owner, repoName, commitHash, filePath, done )
{
    authenticate( accessToken );

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

api.getRepos = function ( accessToken, done )
{
    authenticate( accessToken );

    api.getOrgs( accessToken, function ( err, orgs )
    {
        var fetch = [];

        fetch.push( function ( done )
        {
            api.getOwnerRepos( accessToken, done );
        } );

        orgs.forEach( function ( org )
        {
            fetch.push( function ( done )
            {
               api.getOrgRepos( accessToken, org.login, done );
            } );
        } );

        a.parallelLimit( fetch, 5, function ( err, results )
        {
            var flat = [];
            var flatIds = [];

            results.forEach( function ( repos )
            {
                repos.forEach( function ( repo )
                {
                    if( flatIds.indexOf( repo.id ) === -1 )
                    {
                        flat.push( repo );
                        flatIds.push( repo.id );
                    }
                } );
            } );
            done( null, flat );
        } );
    } );
};

api.getOrgs = function ( accessToken, done )
{
    authenticate( accessToken );

    github.user.getOrgs( { per_page: 100 }, done );
};

var repoPager = function ( url, accessToken, done )
{
    var reqOptions = {
        headers: {
            "User-Agent": "request"
        }
    };

    var totalPages = null;

    var getPage = function ( pageIndex, done )
    {
        reqOptions.url = url + "access_token=" + accessToken +  "&per_page=100&page=" + pageIndex;

        request( reqOptions, function ( err, res, body )
        {
            if( err || res.statusCode !== 200 )
            {
                return done( err );
            }

            var pageResults = JSON.parse( body );

            if( totalPages )
            {
                return done( null, pageResults );
            }

            totalPages = res.headers.link
                ? Number( res.headers.link.match( /page=\d*/g ).reverse()[ 0 ].replace( "page=", "" ) )
                : 1;

            var pageTasks = [];
            for( var p = 2; p <= totalPages; p++ )
            {
                ( function ()
                {
                    var pp = p;
                    pageTasks.push( function ( done )
                    {
                        getPage( pp, done );
                    } );
                } )();
            }

            a.parallelLimit( pageTasks, 5, function ( err, results )
            {
                var collector = pageResults;
                results.forEach( function ( r )
                {
                    collector = collector.concat( r );
                } );

                results = results.sort( function ( a, b )
                {
                    return a.full_name < b.full_name ? -1 : a.full_name > b.full_name ? 1 : 0;
                } );

                done( err, collector );
            } );
        } );
    };

    getPage( 1, done );
};

api.getOwnerRepos = function ( accessToken, done )
{
    repoPager( "https://api.github.com/user/repos?", accessToken,  done );
};

api.getOrgRepos = function ( accessToken, org, done )
{
    repoPager( "https://api.github.com/orgs/" + org + "/repos?", accessToken,  done );
};

api.getHookByUrl = function ( accessToken, owner, repoName, hookUrl, done )
{
    authenticate( accessToken );

    var onHooks = function ( err, res )
    {
        if( err )
        {
            return done( err );
        }

        var existingHook = res.filter( function ( r )
        {
            return r.config.url === hookUrl;
        } )[ 0 ];

        return done( null, existingHook || null );
    };

    github.repos.getHooks( {
        user: owner,
        repo: repoName,
        page: 1,
        per_page: 100
    }, onHooks );
};

api.createHook = function ( accessToken, owner, repoName, hookUrl, done )
{
    authenticate( accessToken );

    var onHook = function ( err, hook )
    {
        if( err )
        {
            return done( err );
        }

        if( hook )
        {
            return done( null, hook );
        }

        github.repos.createHook( {
            user: owner,
            repo: repoName,
            name: "web",
            events: [
              "push",
              "pull_request"
            ],
            config: {
              url: hookUrl,
              content_type: "json"
            }
        }, done );
    };

    api.getHookByUrl( accessToken, owner, repoName, hookUrl, onHook );
};

api.deleteHook = function ( accessToken, owner, repoName, hookUrl, done )
{
    authenticate( accessToken );

    var onHook = function ( err, existingHook )
    {
        if( err )
        {
            return done( err );
        }

        if( !existingHook )
        {
            return done( new Error( "hook does not exist" ) );
        }

        github.repos.deleteHook( {
            user: owner,
            repo: repoName,
            id: existingHook.id
        }, done );
    };

    api.getHookByUrl( accessToken, owner, repoName, hookUrl, onHook );
};

api.createStatus = function ( accessToken, message, done )
{
    authenticate( accessToken );

    github.statuses.create( message, done );
};
