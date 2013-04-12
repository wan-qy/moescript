Changelog
=================
0.8.0
-----------------
- **[*]** Changed the pipeline operator from `|` into `|>`. `|` is now only used for in-block parameters.
- **[/]** Fixed: wrong evaluation order with pipeline calls: when the 1st argument is side-effective and the function is side-effectless, the function is evaluated before the 1st argument.
- **[+]** Added low-priority call operator '<|'.

0.7.3
-----------------
- **[+]** Added warning when shadowing a constant. When `!option explicit` is enabled, it is an error.

0.7.2
-----------------
- **[+]** Added minimal web runtime.

0.5.0
-----------------

- **[*]** Changed single-quote strings' grammar. Now it uses backaslashes to escape special characters.
- **[*]** Improved SMAP metadata format. Perhaps I will add source map generation feature, I hope.