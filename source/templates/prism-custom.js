
(function () {
    var fakeTimer = 0; // Hack to limit the number of times applyHash() runs

    Prism.hooks.add('after-highlight', function(env) {
        var pre = env.element.parentNode;
        var lines = pre && pre.getAttribute('data-line-missing');
        
        if (!pre || !lines || !/pre/i.test(pre.nodeName)) {
            return;
        }
        
        clearTimeout(fakeTimer);
        
        window.Prism.highlightLines(pre, lines, "missing");
        
        fakeTimer = setTimeout(window.Prism.applyHash, 1);
    });
})();