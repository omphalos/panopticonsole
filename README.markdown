Panopticonsole
==============

This is a free, open source extension for Chrome's DevTools.

The DevTools console operates in two modes:
* It can run code in a global scope.
* If you are at a breakpoint, it runs code in function scope.

Panopticonsole gives you a third option.
* It allows you to run code in function scope without setting a breakpoint.

It does this by saving the execution context of each function as it is called.

To do so, it instruments your code using Chromium's preprocessor API.

Installation
------------

To install, clone the repo.
Then load the extension from developer mode, as described [https://developer.chrome.com/extensions/getstarted#unpacked](here).

License
-------

MIT
