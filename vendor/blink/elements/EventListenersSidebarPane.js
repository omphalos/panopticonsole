/*
 * Copyright (C) 2007 Apple Inc.  All rights reserved.
 * Copyright (C) 2009 Joseph Pecoraro
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @extends {WebInspector.SidebarPane}
 */
WebInspector.EventListenersSidebarPane = function()
{
    WebInspector.SidebarPane.call(this, WebInspector.UIString("Event Listeners"));
    this.bodyElement.classList.add("events-pane");

    this.sections = [];

    var refreshButton = this.titleElement.createChild("button", "pane-title-button refresh");
    refreshButton.addEventListener("click", this._refreshButtonClicked.bind(this), false);
    refreshButton.title = WebInspector.UIString("Refresh");

    this.settingsSelectElement = this.titleElement.createChild("select", "select-filter");

    var option = this.settingsSelectElement.createChild("option");
    option.value = "all";
    option.label = WebInspector.UIString("All Nodes");

    option = this.settingsSelectElement.createChild("option");
    option.value = "selected";
    option.label = WebInspector.UIString("Selected Node Only");

    var filter = WebInspector.settings.eventListenersFilter.get();
    if (filter === "all")
        this.settingsSelectElement[0].selected = true;
    else if (filter === "selected")
        this.settingsSelectElement[1].selected = true;
    this.settingsSelectElement.addEventListener("click", consumeEvent, false);
    this.settingsSelectElement.addEventListener("change", this._changeSetting.bind(this), false);

    this._linkifier = new WebInspector.Linkifier();
    this._refreshThrottler = new WebInspector.Throttler(0);
}

WebInspector.EventListenersSidebarPane._objectGroupName = "event-listeners-sidebar-pane";

WebInspector.EventListenersSidebarPane.prototype = {
    /**
     * @param {?WebInspector.DOMNode} node
     */
    update: function(node)
    {
        this._selectedNode = node;
        this._refreshThrottler.schedule(this._refreshView.bind(this));
    },

    /**
     * @param {!WebInspector.Throttler.FinishCallback} finishCallback
     */
    _refreshView: function(finishCallback)
    {
        if (this._lastRequestedNode) {
            this._lastRequestedNode.target().runtimeAgent().releaseObjectGroup(WebInspector.EventListenersSidebarPane._objectGroupName);
            delete this._lastRequestedNode;
        }

        this._linkifier.reset();

        var body = this.bodyElement;
        body.removeChildren();
        this.sections = [];

        var node = this._selectedNode;
        if (!node) {
            finishCallback();
            return;
        }

        this._lastRequestedNode = node;
        node.eventListeners(WebInspector.EventListenersSidebarPane._objectGroupName, this._onEventListeners.bind(this, finishCallback));
    },

    /**
     * @param {!WebInspector.Throttler.FinishCallback} finishCallback
     * @param {?Array.<!WebInspector.DOMModel.EventListener>} eventListeners
     */
    _onEventListeners: function(finishCallback, eventListeners)
    {
        if (!eventListeners) {
            finishCallback();
            return;
        }

        var body = this.bodyElement;
        var node = this._selectedNode;
        var selectedNodeOnly = "selected" === WebInspector.settings.eventListenersFilter.get();
        var sectionNames = [];
        var sectionMap = {};
        for (var i = 0; i < eventListeners.length; ++i) {
            var eventListener = eventListeners[i];
            if (selectedNodeOnly && (node.id !== eventListener.payload().nodeId))
                continue;
            if (/^function _inspectorCommandLineAPI_logEvent\(/.test(eventListener.payload().handlerBody.toString()))
                continue; // ignore event listeners generated by monitorEvent
            var type = eventListener.payload().type;
            var section = sectionMap[type];
            if (!section) {
                section = new WebInspector.EventListenersSection(type, node.id, this._linkifier);
                sectionMap[type] = section;
                sectionNames.push(type);
                this.sections.push(section);
            }
            section.addListener(eventListener);
        }

        if (sectionNames.length === 0) {
            body.createChild("div", "info").textContent = WebInspector.UIString("No Event Listeners");
        } else {
            sectionNames.sort();
            for (var i = 0; i < sectionNames.length; ++i) {
                var section = sectionMap[sectionNames[i]];
                body.appendChild(section.element);
            }
        }

        finishCallback();
    },

    _refreshButtonClicked: function()
    {
        if (!this._selectedNode)
            return;
        this.update(this._selectedNode);
    },

    _changeSetting: function()
    {
        var selectedOption = this.settingsSelectElement[this.settingsSelectElement.selectedIndex];
        WebInspector.settings.eventListenersFilter.set(selectedOption.value);
        this.update(this._selectedNode);
    },

    __proto__: WebInspector.SidebarPane.prototype
}

/**
 * @constructor
 * @extends {WebInspector.PropertiesSection}
 */
WebInspector.EventListenersSection = function(title, nodeId, linkifier)
{
    this._nodeId = nodeId;
    this._linkifier = linkifier;
    WebInspector.PropertiesSection.call(this, title);

    // Changed from a Properties List
    this.propertiesElement.remove();
    delete this.propertiesElement;
    delete this.propertiesTreeOutline;

    this._eventBars = this.element.createChild("div", "event-bars");
}

WebInspector.EventListenersSection.prototype = {
    /**
     * @param {!WebInspector.DOMModel.EventListener} eventListener
     */
    addListener: function(eventListener)
    {
        var eventListenerBar = new WebInspector.EventListenerBar(eventListener, this._nodeId, this._linkifier);
        this._eventBars.appendChild(eventListenerBar.element);
    },

    __proto__: WebInspector.PropertiesSection.prototype
}

/**
 * @constructor
 * @extends {WebInspector.ObjectPropertiesSection}
 * @param {!WebInspector.DOMModel.EventListener} eventListener
 * @param {!DOMAgent.NodeId} nodeId
 * @param {!WebInspector.Linkifier} linkifier
 */
WebInspector.EventListenerBar = function(eventListener, nodeId, linkifier)
{
    var target = eventListener.target();
    WebInspector.ObjectPropertiesSection.call(this, target.runtimeModel.createRemoteObjectFromPrimitiveValue(""));

    this._runtimeModel = target.runtimeModel;
    this._eventListener = eventListener;
    this._nodeId = nodeId;
    this._setNodeTitle();
    this._setFunctionSubtitle(linkifier);
    this.editable = false;
    this.element.className = "event-bar"; /* Changed from "section" */
    this.headerElement.classList.add("source-code");
    this.propertiesElement.className = "event-properties properties-tree source-code"; /* Changed from "properties" */
}

WebInspector.EventListenerBar.prototype = {
    update: function()
    {
        /**
         * @param {?WebInspector.RemoteObject} nodeObject
         * @this {WebInspector.EventListenerBar}
         */
        function updateWithNodeObject(nodeObject)
        {
            var properties = [];
            var payload = this._eventListener.payload();

            properties.push(this._runtimeModel.createRemotePropertyFromPrimitiveValue("type", payload.type));
            properties.push(this._runtimeModel.createRemotePropertyFromPrimitiveValue("useCapture", payload.useCapture));
            properties.push(this._runtimeModel.createRemotePropertyFromPrimitiveValue("isAttribute", payload.isAttribute));
            if (nodeObject)
                properties.push(new WebInspector.RemoteObjectProperty("node", nodeObject));
            if (typeof payload.handler !== "undefined") {
                var remoteObject = this._runtimeModel.createRemoteObject(payload.handler);
                properties.push(new WebInspector.RemoteObjectProperty("handler", remoteObject));
            }
            properties.push(this._runtimeModel.createRemotePropertyFromPrimitiveValue("listenerBody", payload.handlerBody));
            if (payload.sourceName)
                properties.push(this._runtimeModel.createRemotePropertyFromPrimitiveValue("sourceName", payload.sourceName));
            properties.push(this._runtimeModel.createRemotePropertyFromPrimitiveValue("lineNumber", payload.location.lineNumber + 1));

            this.updateProperties(properties);
        }
        this._eventListener.node().resolveToObject(WebInspector.EventListenersSidebarPane._objectGroupName, updateWithNodeObject.bind(this));
    },

    _setNodeTitle: function()
    {
        var node = this._eventListener.node();
        if (!node)
            return;

        if (node.nodeType() === Node.DOCUMENT_NODE) {
            this.titleElement.textContent = "document";
            return;
        }

        if (node.id === this._nodeId) {
            this.titleElement.textContent = WebInspector.DOMPresentationUtils.simpleSelector(node);
            return;
        }

        this.titleElement.removeChildren();
        this.titleElement.appendChild(WebInspector.DOMPresentationUtils.linkifyNodeReference(node));
    },

    /**
     * @param {!WebInspector.Linkifier} linkifier
     */
    _setFunctionSubtitle: function(linkifier)
    {
        this.subtitleElement.removeChildren();
        var link = linkifier.linkifyRawLocation(this._eventListener.location(), this._eventListener.sourceName());
        this.subtitleElement.appendChild(link);
    },

    __proto__: WebInspector.ObjectPropertiesSection.prototype
}
