/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @implements {WebInspector.Searchable}
 * @extends {WebInspector.Panel}
 * @param {!WebInspector.ExtensionServer} server
 * @param {string} id
 * @param {string} pageURL
 */
WebInspector.ExtensionPanel = function(server, id, pageURL)
{
    WebInspector.Panel.call(this, id);
    this._server = server;
    this.setHideOnDetach();
    this.element.classList.add("extension-panel");
    this._panelStatusBarElement = this.element.createChild("div", "panel-status-bar hidden");

    this._searchableView = new WebInspector.SearchableView(this);
    this._searchableView.show(this.element);

    var extensionView = new WebInspector.ExtensionView(server, id, pageURL, "extension panel");
    extensionView.show(this._searchableView.element);
    this.setDefaultFocusedElement(extensionView.defaultFocusedElement());
}

WebInspector.ExtensionPanel.prototype = {
    /**
     * @return {!Element}
     */
    defaultFocusedElement: function()
    {
        return WebInspector.View.prototype.defaultFocusedElement.call(this);
    },

    /**
     * @param {!Element} element
     */
    addStatusBarItem: function(element)
    {
        this._panelStatusBarElement.classList.remove("hidden");
        this._panelStatusBarElement.appendChild(element);
    },

    searchCanceled: function()
    {
        this._server.notifySearchAction(this.name, WebInspector.extensionAPI.panels.SearchAction.CancelSearch);
        this._searchableView.updateSearchMatchesCount(0);
    },

    /**
     * @return {!WebInspector.SearchableView}
     */
    searchableView: function()
    {
        return this._searchableView;
    },

    /**
     * @param {string} query
     * @param {boolean} shouldJump
     * @param {boolean=} jumpBackwards
     */
    performSearch: function(query, shouldJump, jumpBackwards)
    {
        this._server.notifySearchAction(this.name, WebInspector.extensionAPI.panels.SearchAction.PerformSearch, query);
    },

    jumpToNextSearchResult: function()
    {
        this._server.notifySearchAction(this.name, WebInspector.extensionAPI.panels.SearchAction.NextSearchResult);
    },

    jumpToPreviousSearchResult: function()
    {
        this._server.notifySearchAction(this.name, WebInspector.extensionAPI.panels.SearchAction.PreviousSearchResult);
    },

    __proto__: WebInspector.Panel.prototype
}

/**
 * @constructor
 * @param {!WebInspector.ExtensionServer} server
 * @param {string} id
 * @param {string} iconURL
 * @param {string=} tooltip
 * @param {boolean=} disabled
 */
WebInspector.ExtensionButton = function(server, id, iconURL, tooltip, disabled)
{
    this._id = id;
    this.element = document.createElement("button");
    this.element.className = "status-bar-item extension";
    this.element.addEventListener("click", server.notifyButtonClicked.bind(server, this._id), false);
    this.update(iconURL, tooltip, disabled);
}

WebInspector.ExtensionButton.prototype = {
    /**
     * @param {string} iconURL
     * @param {string=} tooltip
     * @param {boolean=} disabled
     */
    update: function(iconURL, tooltip, disabled)
    {
        if (typeof iconURL === "string")
            this.element.style.backgroundImage = "url(" + iconURL + ")";
        if (typeof tooltip === "string")
            this.element.title = tooltip;
        if (typeof disabled === "boolean")
            this.element.disabled = disabled;
    }
}

/**
 * @constructor
 * @extends {WebInspector.SidebarPane}
 * @param {!WebInspector.ExtensionServer} server
 * @param {string} title
 * @param {string} id
 */
WebInspector.ExtensionSidebarPane = function(server, title, id)
{
    WebInspector.SidebarPane.call(this, title);
    this.setHideOnDetach();
    this._server = server;
    this._id = id;
}

WebInspector.ExtensionSidebarPane.prototype = {
    /**
     * @param {!Object} object
     * @param {string} title
     * @param {function(?string=)} callback
     */
    setObject: function(object, title, callback)
    {
        this._createObjectPropertiesView();
        this._setObject(WebInspector.RemoteObject.fromLocalObject(object), title, callback);
    },

    /**
     * @param {string} expression
     * @param {string} title
     * @param {!Object} evaluateOptions
     * @param {string} securityOrigin
     * @param {function(?string=)} callback
     */
    setExpression: function(expression, title, evaluateOptions, securityOrigin, callback)
    {
        this._createObjectPropertiesView();
        this._server.evaluate(expression, true, false, evaluateOptions, securityOrigin, this._onEvaluate.bind(this, title, callback));
    },

    /**
     * @param {string} url
     */
    setPage: function(url)
    {
        if (this._objectPropertiesView) {
            this._objectPropertiesView.detach();
            delete this._objectPropertiesView;
        }
        if (this._extensionView)
            this._extensionView.detach(true);

        this._extensionView = new WebInspector.ExtensionView(this._server, this._id, url, "extension fill");
        this._extensionView.show(this.bodyElement);

        if (!this.bodyElement.style.height)
            this.setHeight("150px");
    },

    /**
     * @param {string} height
     */
    setHeight: function(height)
    {
        this.bodyElement.style.height = height;
    },

    /**
     * @param {string} title
     * @param {function(?string=)} callback
     * @param {?Protocol.Error} error
     * @param {!RuntimeAgent.RemoteObject} result
     * @param {boolean=} wasThrown
     */
    _onEvaluate: function(title, callback, error, result, wasThrown)
    {
        if (error)
            callback(error.toString());
        else
            this._setObject(WebInspector.runtimeModel.createRemoteObject(result), title, callback);
    },

    _createObjectPropertiesView: function()
    {
        if (this._objectPropertiesView)
            return;
        if (this._extensionView) {
            this._extensionView.detach(true);
            delete this._extensionView;
        }
        this._objectPropertiesView = new WebInspector.ExtensionNotifierView(this._server, this._id);
        this._objectPropertiesView.show(this.bodyElement);
    },

    /**
     * @param {!WebInspector.RemoteObject} object
     * @param {string} title
     * @param {function(?string=)} callback
     */
    _setObject: function(object, title, callback)
    {
        // This may only happen if setPage() was called while we were evaluating the expression.
        if (!this._objectPropertiesView) {
            callback("operation cancelled");
            return;
        }
        this._objectPropertiesView.element.removeChildren();
        var section = new WebInspector.ObjectPropertiesSection(object, title);
        if (!title)
            section.headerElement.classList.add("hidden");
        section.expanded = true;
        section.editable = false;
        this._objectPropertiesView.element.appendChild(section.element);
        callback();
    },

    __proto__: WebInspector.SidebarPane.prototype
}
