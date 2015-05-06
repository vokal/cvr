/* http://prismjs.com/download.html?themes=prism-twilight&languages=markup+css+clike+javascript+bash+go+handlebars+java+less+python+sql&plugins=line-highlight+line-numbers+show-language */
self = (typeof window !== 'undefined')
    ? window   // if in browser
    : (
        (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
        ? self // if in worker
        : {}   // if in node js
    );

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;

var _ = self.Prism = {
    util: {
        encode: function (tokens) {
            if (tokens instanceof Token) {
                return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
            } else if (_.util.type(tokens) === 'Array') {
                return tokens.map(_.util.encode);
            } else {
                return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
            }
        },

        type: function (o) {
            return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
        },

        // Deep clone a language definition (e.g. to extend it)
        clone: function (o) {
            var type = _.util.type(o);

            switch (type) {
                case 'Object':
                    var clone = {};

                    for (var key in o) {
                        if (o.hasOwnProperty(key)) {
                            clone[key] = _.util.clone(o[key]);
                        }
                    }

                    return clone;

                case 'Array':
                    return o.map(function(v) { return _.util.clone(v); });
            }

            return o;
        }
    },

    languages: {
        extend: function (id, redef) {
            var lang = _.util.clone(_.languages[id]);

            for (var key in redef) {
                lang[key] = redef[key];
            }

            return lang;
        },

        /**
         * Insert a token before another token in a language literal
         * As this needs to recreate the object (we cannot actually insert before keys in object literals),
         * we cannot just provide an object, we need anobject and a key.
         * @param inside The key (or language id) of the parent
         * @param before The key to insert before. If not provided, the function appends instead.
         * @param insert Object with the key/value pairs to insert
         * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
         */
        insertBefore: function (inside, before, insert, root) {
            root = root || _.languages;
            var grammar = root[inside];
            
            if (arguments.length == 2) {
                insert = arguments[1];
                
                for (var newToken in insert) {
                    if (insert.hasOwnProperty(newToken)) {
                        grammar[newToken] = insert[newToken];
                    }
                }
                
                return grammar;
            }
            
            var ret = {};

            for (var token in grammar) {

                if (grammar.hasOwnProperty(token)) {

                    if (token == before) {

                        for (var newToken in insert) {

                            if (insert.hasOwnProperty(newToken)) {
                                ret[newToken] = insert[newToken];
                            }
                        }
                    }

                    ret[token] = grammar[token];
                }
            }
            
            // Update references in other language definitions
            _.languages.DFS(_.languages, function(key, value) {
                if (value === root[inside] && key != inside) {
                    this[key] = ret;
                }
            });

            return root[inside] = ret;
        },

        // Traverse a language definition with Depth First Search
        DFS: function(o, callback, type) {
            for (var i in o) {
                if (o.hasOwnProperty(i)) {
                    callback.call(o, i, o[i], type || i);

                    if (_.util.type(o[i]) === 'Object') {
                        _.languages.DFS(o[i], callback);
                    }
                    else if (_.util.type(o[i]) === 'Array') {
                        _.languages.DFS(o[i], callback, i);
                    }
                }
            }
        }
    },

    highlightAll: function(async, callback) {
        var elements = document.querySelectorAll('code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code');

        for (var i=0, element; element = elements[i++];) {
            _.highlightElement(element, async === true, callback);
        }
    },

    highlightElement: function(element, async, callback) {
        // Find language
        var language, grammar, parent = element;

        while (parent && !lang.test(parent.className)) {
            parent = parent.parentNode;
        }

        if (parent) {
            language = (parent.className.match(lang) || [,''])[1];
            grammar = _.languages[language];
        }

        if (!grammar) {
            return;
        }

        // Set language on the element, if not present
        element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

        // Set language on the parent, for styling
        parent = element.parentNode;

        if (/pre/i.test(parent.nodeName)) {
            parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
        }

        var code = element.textContent;

        if(!code) {
            return;
        }

        code = code.replace(/^(?:\r?\n|\r)/,'');

        var env = {
            element: element,
            language: language,
            grammar: grammar,
            code: code
        };

        _.hooks.run('before-highlight', env);

        if (async && self.Worker) {
            var worker = new Worker(_.filename);

            worker.onmessage = function(evt) {
                env.highlightedCode = Token.stringify(JSON.parse(evt.data), language);

                _.hooks.run('before-insert', env);

                env.element.innerHTML = env.highlightedCode;

                callback && callback.call(env.element);
                _.hooks.run('after-highlight', env);
            };

            worker.postMessage(JSON.stringify({
                language: env.language,
                code: env.code
            }));
        }
        else {
            env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

            _.hooks.run('before-insert', env);

            env.element.innerHTML = env.highlightedCode;

            callback && callback.call(element);

            _.hooks.run('after-highlight', env);
        }
    },

    highlight: function (text, grammar, language) {
        var tokens = _.tokenize(text, grammar);
        return Token.stringify(_.util.encode(tokens), language);
    },

    tokenize: function(text, grammar, language) {
        var Token = _.Token;

        var strarr = [text];

        var rest = grammar.rest;

        if (rest) {
            for (var token in rest) {
                grammar[token] = rest[token];
            }

            delete grammar.rest;
        }

        tokenloop: for (var token in grammar) {
            if(!grammar.hasOwnProperty(token) || !grammar[token]) {
                continue;
            }

            var patterns = grammar[token];
            patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

            for (var j = 0; j < patterns.length; ++j) {
                var pattern = patterns[j],
                    inside = pattern.inside,
                    lookbehind = !!pattern.lookbehind,
                    lookbehindLength = 0,
                    alias = pattern.alias;

                pattern = pattern.pattern || pattern;

                for (var i=0; i<strarr.length; i++) { // Don’t cache length as it changes during the loop

                    var str = strarr[i];

                    if (strarr.length > text.length) {
                        // Something went terribly wrong, ABORT, ABORT!
                        break tokenloop;
                    }

                    if (str instanceof Token) {
                        continue;
                    }

                    pattern.lastIndex = 0;

                    var match = pattern.exec(str);

                    if (match) {
                        if(lookbehind) {
                            lookbehindLength = match[1].length;
                        }

                        var from = match.index - 1 + lookbehindLength,
                            match = match[0].slice(lookbehindLength),
                            len = match.length,
                            to = from + len,
                            before = str.slice(0, from + 1),
                            after = str.slice(to + 1);

                        var args = [i, 1];

                        if (before) {
                            args.push(before);
                        }

                        var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias);

                        args.push(wrapped);

                        if (after) {
                            args.push(after);
                        }

                        Array.prototype.splice.apply(strarr, args);
                    }
                }
            }
        }

        return strarr;
    },

    hooks: {
        all: {},

        add: function (name, callback) {
            var hooks = _.hooks.all;

            hooks[name] = hooks[name] || [];

            hooks[name].push(callback);
        },

        run: function (name, env) {
            var callbacks = _.hooks.all[name];

            if (!callbacks || !callbacks.length) {
                return;
            }

            for (var i=0, callback; callback = callbacks[i++];) {
                callback(env);
            }
        }
    }
};

var Token = _.Token = function(type, content, alias) {
    this.type = type;
    this.content = content;
    this.alias = alias;
};

Token.stringify = function(o, language, parent) {
    if (typeof o == 'string') {
        return o;
    }

    if (_.util.type(o) === 'Array') {
        return o.map(function(element) {
            return Token.stringify(element, language, o);
        }).join('');
    }

    var env = {
        type: o.type,
        content: Token.stringify(o.content, language, parent),
        tag: 'span',
        classes: ['token', o.type],
        attributes: {},
        language: language,
        parent: parent
    };

    if (env.type == 'comment') {
        env.attributes['spellcheck'] = 'true';
    }

    if (o.alias) {
        var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
        Array.prototype.push.apply(env.classes, aliases);
    }

    _.hooks.run('wrap', env);

    var attributes = '';

    for (var name in env.attributes) {
        attributes += name + '="' + (env.attributes[name] || '') + '"';
    }

    return '<' + env.tag + ' class="' + env.classes.join(' ') + '" ' + attributes + '>' + env.content + '</' + env.tag + '>';

};

if (!self.document) {
    if (!self.addEventListener) {
        // in Node.js
        return self.Prism;
    }
    // In worker
    self.addEventListener('message', function(evt) {
        var message = JSON.parse(evt.data),
            lang = message.language,
            code = message.code;

        self.postMessage(JSON.stringify(_.util.encode(_.tokenize(code, _.languages[lang]))));
        self.close();
    }, false);

    return self.Prism;
}

// Get current script and highlight
var script = document.getElementsByTagName('script');

script = script[script.length - 1];

if (script) {
    _.filename = script.src;

    if (document.addEventListener && !script.hasAttribute('data-manual')) {
        document.addEventListener('DOMContentLoaded', _.highlightAll);
    }
}

return self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Prism;
}
;
Prism.languages.markup = {
    'comment': /<!--[\w\W]*?-->/,
    'prolog': /<\?.+?\?>/,
    'doctype': /<!DOCTYPE.+?>/,
    'cdata': /<!\[CDATA\[[\w\W]*?]]>/i,
    'tag': {
        pattern: /<\/?[\w:-]+\s*(?:\s+[\w:-]+(?:=(?:("|')(\\?[\w\W])*?\1|[^\s'">=]+))?\s*)*\/?>/i,
        inside: {
            'tag': {
                pattern: /^<\/?[\w:-]+/i,
                inside: {
                    'punctuation': /^<\/?/,
                    'namespace': /^[\w-]+?:/
                }
            },
            'attr-value': {
                pattern: /=(?:('|")[\w\W]*?(\1)|[^\s>]+)/i,
                inside: {
                    'punctuation': /=|>|"/
                }
            },
            'punctuation': /\/?>/,
            'attr-name': {
                pattern: /[\w:-]+/,
                inside: {
                    'namespace': /^[\w-]+?:/
                }
            }

        }
    },
    'entity': /&#?[\da-z]{1,8};/i
};

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function(env) {

    if (env.type === 'entity') {
        env.attributes['title'] = env.content.replace(/&amp;/, '&');
    }
});
;
Prism.languages.css = {
    'comment': /\/\*[\w\W]*?\*\//,
    'atrule': {
        pattern: /@[\w-]+?.*?(;|(?=\s*\{))/i,
        inside: {
            'punctuation': /[;:]/
        }
    },
    'url': /url\((?:(["'])(\\\n|\\?.)*?\1|.*?)\)/i,
    'selector': /[^\{\}\s][^\{\};]*(?=\s*\{)/,
    'string': /("|')(\\\n|\\?.)*?\1/,
    'property': /(\b|\B)[\w-]+(?=\s*:)/i,
    'important': /\B!important\b/i,
    'punctuation': /[\{\};:]/,
    'function': /[-a-z0-9]+(?=\()/i
};

if (Prism.languages.markup) {
    Prism.languages.insertBefore('markup', 'tag', {
        'style': {
            pattern: /<style[\w\W]*?>[\w\W]*?<\/style>/i,
            inside: {
                'tag': {
                    pattern: /<style[\w\W]*?>|<\/style>/i,
                    inside: Prism.languages.markup.tag.inside
                },
                rest: Prism.languages.css
            },
            alias: 'language-css'
        }
    });
    
    Prism.languages.insertBefore('inside', 'attr-value', {
        'style-attr': {
            pattern: /\s*style=("|').*?\1/i,
            inside: {
                'attr-name': {
                    pattern: /^\s*style/i,
                    inside: Prism.languages.markup.tag.inside
                },
                'punctuation': /^\s*=\s*['"]|['"]\s*$/,
                'attr-value': {
                    pattern: /.+/i,
                    inside: Prism.languages.css
                }
            },
            alias: 'language-css'
        }
    }, Prism.languages.markup.tag);
};
Prism.languages.clike = {
    'comment': [
        {
            pattern: /(^|[^\\])\/\*[\w\W]*?\*\//,
            lookbehind: true
        },
        {
            pattern: /(^|[^\\:])\/\/.*/,
            lookbehind: true
        }
    ],
    'string': /("|')(\\\n|\\?.)*?\1/,
    'class-name': {
        pattern: /((?:(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[a-z0-9_\.\\]+/i,
        lookbehind: true,
        inside: {
            punctuation: /(\.|\\)/
        }
    },
    'keyword': /\b(if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
    'boolean': /\b(true|false)\b/,
    'function': {
        pattern: /[a-z0-9_]+\(/i,
        inside: {
            punctuation: /\(/
        }
    },
    'number': /\b-?(0x[\dA-Fa-f]+|\d*\.?\d+([Ee]-?\d+)?)\b/,
    'operator': /[-+]{1,2}|!|<=?|>=?|={1,3}|&{1,2}|\|?\||\?|\*|\/|~|\^|%/,
    'ignore': /&(lt|gt|amp);/i,
    'punctuation': /[{}[\];(),.:]/
};
;
Prism.languages.javascript = Prism.languages.extend('clike', {
    'keyword': /\b(break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|get|if|implements|import|in|instanceof|interface|let|new|null|package|private|protected|public|return|set|static|super|switch|this|throw|true|try|typeof|var|void|while|with|yield)\b/,
    'number': /\b-?(0x[\dA-Fa-f]+|\d*\.?\d+([Ee][+-]?\d+)?|NaN|-?Infinity)\b/,
    'function': /(?!\d)[a-z0-9_$]+(?=\()/i
});

Prism.languages.insertBefore('javascript', 'keyword', {
    'regex': {
        pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\r\n])+\/[gim]{0,3}(?=\s*($|[\r\n,.;})]))/,
        lookbehind: true
    }
});

if (Prism.languages.markup) {
    Prism.languages.insertBefore('markup', 'tag', {
        'script': {
            pattern: /<script[\w\W]*?>[\w\W]*?<\/script>/i,
            inside: {
                'tag': {
                    pattern: /<script[\w\W]*?>|<\/script>/i,
                    inside: Prism.languages.markup.tag.inside
                },
                rest: Prism.languages.javascript
            },
            alias: 'language-javascript'
        }
    });
}
;
Prism.languages.bash = Prism.languages.extend('clike', {
    'comment': {
        pattern: /(^|[^"{\\])(#.*?(\r?\n|$))/,
        lookbehind: true
    },
    'string': {
        //allow multiline string
        pattern: /("|')(\\?[\s\S])*?\1/,
        inside: {
            //'property' class reused for bash variables
            'property': /\$([a-zA-Z0-9_#\?\-\*!@]+|\{[^\}]+\})/
        }
    },
    // Redefined to prevent highlighting of numbers in filenames
    'number': {
        pattern: /([^\w\.])-?(0x[\dA-Fa-f]+|\d*\.?\d+([Ee]-?\d+)?)\b/,
        lookbehind: true
    },
    // Originally based on http://ss64.com/bash/
    'function': /\b(?:alias|apropos|apt-get|aptitude|aspell|awk|basename|bash|bc|bg|builtin|bzip2|cal|cat|cd|cfdisk|chgrp|chmod|chown|chroot|chkconfig|cksum|clear|cmp|comm|command|cp|cron|crontab|csplit|cut|date|dc|dd|ddrescue|declare|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|du|echo|egrep|eject|enable|env|ethtool|eval|exec|exit|expand|expect|export|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|getopts|git|grep|groupadd|groupdel|groupmod|groups|gzip|hash|head|help|hg|history|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|jobs|join|kill|killall|less|link|ln|locate|logname|logout|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|make|man|mkdir|mkfifo|mkisofs|mknod|more|most|mount|mtools|mtr|mv|mmv|nano|netstat|nice|nl|nohup|notify-send|nslookup|open|op|passwd|paste|pathchk|ping|pkill|popd|pr|printcap|printenv|printf|ps|pushd|pv|pwd|quota|quotacheck|quotactl|ram|rar|rcp|read|readarray|readonly|reboot|rename|renice|remsync|rev|rm|rmdir|rsync|screen|scp|sdiff|sed|select|seq|service|sftp|shift|shopt|shutdown|sleep|slocate|sort|source|split|ssh|stat|strace|su|sudo|sum|suspend|sync|tail|tar|tee|test|time|timeout|times|touch|top|traceroute|trap|tr|tsort|tty|type|ulimit|umask|umount|unalias|uname|unexpand|uniq|units|unrar|unshar|until|uptime|useradd|userdel|usermod|users|uuencode|uudecode|v|vdir|vi|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yes|zip)\b/,
    'keyword': /\b(if|then|else|elif|fi|for|break|continue|while|in|case|function|select|do|done|until|echo|exit|return|set|declare)\b/
});

Prism.languages.insertBefore('bash', 'keyword', {
    //'property' class reused for bash variables
    'property': /\$([a-zA-Z0-9_#\?\-\*!@]+|\{[^}]+\})/
});
Prism.languages.insertBefore('bash', 'comment', {
    //shebang must be before comment, 'important' class from css reused
    'important': /(^#!\s*\/bin\/bash)|(^#!\s*\/bin\/sh)/
});
;
Prism.languages.go = Prism.languages.extend('clike', {
    'keyword': /\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go(to)?|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/,
    'builtin': /\b(bool|byte|complex(64|128)|error|float(32|64)|rune|string|u?int(8|16|32|64|)|uintptr|append|cap|close|complex|copy|delete|imag|len|make|new|panic|print(ln)?|real|recover)\b/,
    'boolean': /\b(_|iota|nil|true|false)\b/,
    'operator': /([(){}\[\]]|[*\/%^!]=?|\+[=+]?|-[>=-]?|\|[=|]?|>[=>]?|<(<|[=-])?|==?|&(&|=|^=?)?|\.(\.\.)?|[,;]|:=?)/,
    'number': /\b(-?(0x[a-f\d]+|(\d+\.?\d*|\.\d+)(e[-+]?\d+)?)i?)\b/i,
    'string': /("|'|`)(\\?.|\r|\n)*?\1/
});
delete Prism.languages.go['class-name'];
;
(function(Prism) {

    var handlebars_pattern = /\{\{\{[\w\W]+?\}\}\}|\{\{[\w\W]+?\}\}/g;
    
    Prism.languages.handlebars = Prism.languages.extend('markup', {
        'handlebars': {
            pattern: handlebars_pattern,
            inside: {
                'delimiter': {
                    pattern: /^\{\{\{?|\}\}\}?$/i,
                    alias: 'punctuation'
                },
                'string': /(["'])(\\?.)+?\1/,
                'number': /\b-?(0x[\dA-Fa-f]+|\d*\.?\d+([Ee]-?\d+)?)\b/,
                'boolean': /\b(true|false)\b/,
                'block': {
                    pattern: /^(\s*~?\s*)[#\/]\w+/i,
                    lookbehind: true,
                    alias: 'keyword'
                },
                'brackets': {
                    pattern: /\[[^\]]+\]/,
                    inside: {
                        punctuation: /\[|\]/,
                        variable: /[\w\W]+/
                    }
                },
                'punctuation': /[!"#%&'()*+,.\/;<=>@\[\\\]^`{|}~]/,
                'variable': /[^!"#%&'()*+,.\/;<=>@\[\\\]^`{|}~]+/
            }
        }
    });

    // Comments are inserted at top so that they can
    // surround markup
    Prism.languages.insertBefore('handlebars', 'tag', {
        'handlebars-comment': {
            pattern: /\{\{![\w\W]*?\}\}/,
            alias: ['handlebars','comment']
        }
    });

    // Tokenize all inline Handlebars expressions that are wrapped in {{ }} or {{{ }}}
    // This allows for easy Handlebars + markup highlighting
    Prism.hooks.add('before-highlight', function(env) {
        if (env.language !== 'handlebars') {
            return;
        }

        env.tokenStack = [];

        env.backupCode = env.code;
        env.code = env.code.replace(handlebars_pattern, function(match) {
            env.tokenStack.push(match);

            return '___HANDLEBARS' + env.tokenStack.length + '___';
        });
    });

    // Restore env.code for other plugins (e.g. line-numbers)
    Prism.hooks.add('before-insert', function(env) {
        if (env.language === 'handlebars') {
            env.code = env.backupCode;
            delete env.backupCode;
        }
    });

    // Re-insert the tokens after highlighting
    // and highlight them with defined grammar
    Prism.hooks.add('after-highlight', function(env) {
        if (env.language !== 'handlebars') {
            return;
        }

        for (var i = 0, t; t = env.tokenStack[i]; i++) {
            env.highlightedCode = env.highlightedCode.replace('___HANDLEBARS' + (i + 1) + '___', Prism.highlight(t, env.grammar, 'handlebars'));
        }

        env.element.innerHTML = env.highlightedCode;
    });

}(Prism));
;
Prism.languages.java = Prism.languages.extend('clike', {
    'keyword': /\b(abstract|continue|for|new|switch|assert|default|goto|package|synchronized|boolean|do|if|private|this|break|double|implements|protected|throw|byte|else|import|public|throws|case|enum|instanceof|return|transient|catch|extends|int|short|try|char|final|interface|static|void|class|finally|long|strictfp|volatile|const|float|native|super|while)\b/,
    'number': /\b0b[01]+\b|\b0x[\da-f]*\.?[\da-fp\-]+\b|\b\d*\.?\d+[e]?[\d]*[df]\b|\b\d*\.?\d+\b/i,
    'operator': {
        pattern: /(^|[^\.])(?:\+=|\+\+?|-=|--?|!=?|<{1,2}=?|>{1,3}=?|==?|&=|&&?|\|=|\|\|?|\?|\*=?|\/=?|%=?|\^=?|:|~)/m,
        lookbehind: true
    }
});;
/* FIXME :
 :extend() is not handled specifically : its highlighting is buggy.
 Mixin usage must be inside a ruleset to be highlighted.
 At-rules (e.g. import) containing interpolations are buggy.
 Detached rulesets are highlighted as at-rules.
 A comment before a mixin usage prevents the latter to be properly highlighted.
 */

Prism.languages.less = Prism.languages.extend('css', {
    'comment': [
        /\/\*[\w\W]*?\*\//,
        {
            pattern: /(^|[^\\])\/\/.*/,
            lookbehind: true
        }
    ],
    'atrule': {
        pattern: /@[\w-]+?(?:\([^{}]+\)|[^(){};])*?(?=\s*\{)/i,
        inside: {
            'punctuation': /[:()]/
        }
    },
    // selectors and mixins are considered the same
    'selector': {
        pattern: /(?:@\{[\w-]+\}|[^{};\s@])(?:@\{[\w-]+\}|\([^{}]*\)|[^{};@])*?(?=\s*\{)/,
        inside: {
            // mixin parameters
            'variable': /@+[\w-]+/
        }
    },

    'property': /(\b|\B)(?:@\{[\w-]+\}|[\w-])+(?:\+_?)?(?=\s*:)/i,
    'punctuation': /[{}();:,]/,
    'operator': /[+\-*\/]/
});

// Invert function and punctuation positions
Prism.languages.insertBefore('less', 'punctuation', {
    'function': Prism.languages.less.function
});

Prism.languages.insertBefore('less', 'property', {
    'variable': [
        // Variable declaration (the colon must be consumed!)
        {
            pattern: /@[\w-]+\s*:/,
            inside: {
                "punctuation": /:/
            }
        },

        // Variable usage
        /@@?[\w-]+/
    ],
    'mixin-usage': {
        pattern: /([{;]\s*)[.#](?!\d)[\w-]+.*?(?=[(;])/,
        lookbehind: true,
        alias: 'function'
    }
});
;
Prism.languages.python= { 
    'comment': {
        pattern: /(^|[^\\])#.*?(\r?\n|$)/,
        lookbehind: true
    },
    'string': /"""[\s\S]+?"""|'''[\s\S]+?'''|("|')(\\?.)*?\1/,
    'keyword' : /\b(as|assert|break|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|pass|print|raise|return|try|while|with|yield)\b/,
    'boolean' : /\b(True|False)\b/,
    'number' : /\b-?(0[box])?(?:[\da-f]+\.?\d*|\.\d+)(?:e[+-]?\d+)?j?\b/i,
    'operator' : /[-+]|<=?|>=?|!|={1,2}|&{1,2}|\|?\||\?|\*|\/|~|\^|%|\b(or|and|not)\b/,
    'punctuation' : /[{}[\];(),.:]/
};

;
Prism.languages.sql= { 
    'comment': {
        pattern: /(^|[^\\])(\/\*[\w\W]*?\*\/|((--)|(\/\/)|#).*?(\r?\n|$))/,
        lookbehind: true
    },
    'string' : {
        pattern: /(^|[^@])("|')(\\?[\s\S])*?\2/,
        lookbehind: true
    },
    'variable': /@[\w.$]+|@("|'|`)(\\?[\s\S])+?\1/,
    'function': /\b(?:COUNT|SUM|AVG|MIN|MAX|FIRST|LAST|UCASE|LCASE|MID|LEN|ROUND|NOW|FORMAT)(?=\s*\()/i, // Should we highlight user defined functions too?
    'keyword': /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALTER|ANALYZE|APPLY|AS|ASC|AUTHORIZATION|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADE|CASCADED|CASE|CHAIN|CHAR VARYING|CHARACTER VARYING|CHECK|CHECKPOINT|CLOSE|CLUSTERED|COALESCE|COLUMN|COLUMNS|COMMENT|COMMIT|COMMITTED|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS|CONTAINSTABLE|CONTINUE|CONVERT|CREATE|CROSS|CURRENT|CURRENT_DATE|CURRENT_TIME|CURRENT_TIMESTAMP|CURRENT_USER|CURSOR|DATA|DATABASE|DATABASES|DATETIME|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DOUBLE PRECISION|DROP|DUMMY|DUMP|DUMPFILE|DUPLICATE KEY|ELSE|ENABLE|ENCLOSED BY|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPE|ESCAPED BY|EXCEPT|EXEC|EXECUTE|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR|FOR EACH ROW|FORCE|FOREIGN|FREETEXT|FREETEXTTABLE|FROM|FULL|FUNCTION|GEOMETRY|GEOMETRYCOLLECTION|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|IDENTITY|IDENTITY_INSERT|IDENTITYCOL|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT|INTEGER|INTERSECT|INTO|INVOKER|ISOLATION LEVEL|JOIN|KEY|KEYS|KILL|LANGUAGE SQL|LAST|LEFT|LIMIT|LINENO|LINES|LINESTRING|LOAD|LOCAL|LOCK|LONGBLOB|LONGTEXT|MATCH|MATCHED|MEDIUMBLOB|MEDIUMINT|MEDIUMTEXT|MERGE|MIDDLEINT|MODIFIES SQL DATA|MODIFY|MULTILINESTRING|MULTIPOINT|MULTIPOLYGON|NATIONAL|NATIONAL CHAR VARYING|NATIONAL CHARACTER|NATIONAL CHARACTER VARYING|NATIONAL VARCHAR|NATURAL|NCHAR|NCHAR VARCHAR|NEXT|NO|NO SQL|NOCHECK|NOCYCLE|NONCLUSTERED|NULLIF|NUMERIC|OF|OFF|OFFSETS|ON|OPEN|OPENDATASOURCE|OPENQUERY|OPENROWSET|OPTIMIZE|OPTION|OPTIONALLY|ORDER|OUT|OUTER|OUTFILE|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRECISION|PREV|PRIMARY|PRINT|PRIVILEGES|PROC|PROCEDURE|PUBLIC|PURGE|QUICK|RAISERROR|READ|READS SQL DATA|READTEXT|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEATABLE|REPLICATION|REQUIRE|RESTORE|RESTRICT|RETURN|RETURNS|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROWCOUNT|ROWGUIDCOL|ROWS?|RTREE|RULE|SAVE|SAVEPOINT|SCHEMA|SELECT|SERIAL|SERIALIZABLE|SESSION|SESSION_USER|SET|SETUSER|SHARE MODE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|START|STARTING BY|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLE|TABLES|TABLESPACE|TEMP(?:ORARY)?|TEMPTABLE|TERMINATED BY|TEXT|TEXTSIZE|THEN|TIMESTAMP|TINYBLOB|TINYINT|TINYTEXT|TO|TOP|TRAN|TRANSACTION|TRANSACTIONS|TRIGGER|TRUNCATE|TSEQUAL|TYPE|TYPES|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNPIVOT|UPDATE|UPDATETEXT|USAGE|USE|USER|USING|VALUE|VALUES|VARBINARY|VARCHAR|VARCHARACTER|VARYING|VIEW|WAITFOR|WARNINGS|WHEN|WHERE|WHILE|WITH|WITH ROLLUP|WITHIN|WORK|WRITE|WRITETEXT)\b/i,
    'boolean': /\b(?:TRUE|FALSE|NULL)\b/i,
    'number': /\b-?(0x)?\d*\.?[\da-f]+\b/,
    'operator': /\b(?:ALL|AND|ANY|BETWEEN|EXISTS|IN|LIKE|NOT|OR|IS|UNIQUE|CHARACTER SET|COLLATE|DIV|OFFSET|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b|[-+]|!|[=<>]{1,2}|(&){1,2}|\|?\||\?|\*|\//i,
    'punctuation': /[;[\]()`,.]/
};;
(function(){

if(!window.Prism) {
    return;
}

function $$(expr, con) {
    return Array.prototype.slice.call((con || document).querySelectorAll(expr));
}

function hasClass(element, className) {
  className = " " + className + " ";
  return (" " + element.className + " ").replace(/[\n\t]/g, " ").indexOf(className) > -1
}

var CRLF = crlf = /\r?\n|\r/g;
    
function highlightLines(pre, lines, classes) {
    var ranges = lines.replace(/\s+/g, '').split(','),
        offset = +pre.getAttribute('data-line-offset') || 0;
    
    var lineHeight = parseFloat(getComputedStyle(pre).lineHeight);

    for (var i=0, range; range = ranges[i++];) {
        range = range.split('-');
                    
        var start = +range[0],
            end = +range[1] || start;
        
        var line = document.createElement('div');
        
        line.textContent = Array(end - start + 2).join(' \r\n');
        line.className = (classes || '') + ' line-highlight';

    //if the line-numbers plugin is enabled, then there is no reason for this plugin to display the line numbers
    if(!hasClass(pre, 'line-numbers')) {
      line.setAttribute('data-start', start);

      if(end > start) {
        line.setAttribute('data-end', end);
      }
    }

        line.style.top = (start - offset - 1) * lineHeight + 'px';

    //allow this to play nicely with the line-numbers plugin
    if(hasClass(pre, 'line-numbers')) {
      //need to attack to pre as when line-numbers is enabled, the code tag is relatively which screws up the positioning
      pre.appendChild(line);
    } else {
      (pre.querySelector('code') || pre).appendChild(line);
    }
    }
}

window.Prism.highlightLines = highlightLines;
window.Prism.applyHash = applyHash;

function applyHash() {
    var hash = location.hash.slice(1);
    
    // Remove pre-existing temporary lines
    $$('.temporary.line-highlight').forEach(function (line) {
        line.parentNode.removeChild(line);
    });
    
    var range = (hash.match(/\.([\d,-]+)$/) || [,''])[1];
    
    if (!range || document.getElementById(hash)) {
        return;
    }
    
    var id = hash.slice(0, hash.lastIndexOf('.')),
        pre = document.getElementById(id);
        
    if (!pre) {
        return;
    }
    
    if (!pre.hasAttribute('data-line')) {
        pre.setAttribute('data-line', '');
    }

    highlightLines(pre, range, 'temporary ');

    document.querySelector('.temporary.line-highlight').scrollIntoView();
}

var fakeTimer = 0; // Hack to limit the number of times applyHash() runs

Prism.hooks.add('after-highlight', function(env) {
    var pre = env.element.parentNode;
    var lines = pre && pre.getAttribute('data-line');
    
    if (!pre || !lines || !/pre/i.test(pre.nodeName)) {
        return;
    }
    
    clearTimeout(fakeTimer);
    
    $$('.line-highlight', pre).forEach(function (line) {
        line.parentNode.removeChild(line);
    });
    
    highlightLines(pre, lines);
    
    fakeTimer = setTimeout(applyHash, 1);
});

addEventListener('hashchange', applyHash);

})();
;
Prism.hooks.add('after-highlight', function (env) {
    // works only for <code> wrapped inside <pre> (not inline)
    var pre = env.element.parentNode;
    var clsReg = /\s*\bline-numbers\b\s*/;
    if (
        !pre || !/pre/i.test(pre.nodeName) ||
        // Abort only if nor the <pre> nor the <code> have the class
        (!clsReg.test(pre.className) && !clsReg.test(env.element.className))
    ) {
        return;
    }

    if (clsReg.test(env.element.className)) {
        // Remove the class "line-numbers" from the <code>
        env.element.className = env.element.className.replace(clsReg, '');
    }
    if (!clsReg.test(pre.className)) {
        // Add the class "line-numbers" to the <pre>
        pre.className += ' line-numbers';
    }

    var linesNum = (1 + env.code.split('\n').length);
    var lineNumbersWrapper;

    var lines = new Array(linesNum);
    lines = lines.join('<span></span>');

    lineNumbersWrapper = document.createElement('span');
    lineNumbersWrapper.className = 'line-numbers-rows';
    lineNumbersWrapper.innerHTML = lines;

    if (pre.hasAttribute('data-start')) {
        pre.style.counterReset = 'linenumber ' + (parseInt(pre.getAttribute('data-start'), 10) - 1);
    }

    env.element.appendChild(lineNumbersWrapper);

});;
(function(){

if (!self.Prism) {
    return;
}

var Languages = {
    'csharp': 'C#',
    'cpp': 'C++'
};
Prism.hooks.add('before-highlight', function(env) {
    var pre = env.element.parentNode;
    if (!pre || !/pre/i.test(pre.nodeName)) {
        return;
    }
    var language = Languages[env.language] || env.language;
    pre.setAttribute('data-language', language);
});

})();
;
