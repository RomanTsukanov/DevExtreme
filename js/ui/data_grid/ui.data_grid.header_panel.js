"use strict";

var $ = require("jquery"),
    gridCore = require("./ui.data_grid.core"),
    Toolbar = require("../toolbar"),
    columnsView = require("./ui.data_grid.columns_view"),
    commonUtils = require("../../core/utils/common"),
    domUtils = require("../../core/utils/dom");

require("../drop_down_menu");
var DATAGRID_HEADER_PANEL_CLASS = "dx-datagrid-header-panel",
    DATAGRID_TOOLBAR_BUTTON_CLASS = "dx-datagrid-toolbar-button";

exports.HeaderPanel = columnsView.ColumnsView.inherit({
    _getToolbarItems: function() {
        return [];
    },

    _getButtonContainer: function() {
        return $("<div />").addClass(DATAGRID_TOOLBAR_BUTTON_CLASS);
    },

    _getToolbarButtonClass: function(specificClass) {
        var secondClass = specificClass ? " " + specificClass : "";

        return DATAGRID_TOOLBAR_BUTTON_CLASS + secondClass;
    },

    _getToolbarOptions: function() {
        var toolbarItems,
            options = {
                toolbarOptions: {
                    items: this._getToolbarItems(),
                    onItemRendered: function(e) {
                        var itemRenderedCallback = e.itemData.onItemRendered;

                        if(itemRenderedCallback) {
                            itemRenderedCallback(e);
                        }
                    }
                }
            };

        this.executeAction("onToolbarPreparing", options);

        if(options.toolbarOptions && !commonUtils.isDefined(options.toolbarOptions.visible)) {
            toolbarItems = options.toolbarOptions.items;
            options.toolbarOptions.visible = !!(toolbarItems && toolbarItems.length);
        }

        return options.toolbarOptions;
    },

    _renderCore: function() {
        if(!this._toolbar) {
            this.element().addClass(DATAGRID_HEADER_PANEL_CLASS);
            this._toolbar = this._createComponent($("<div />").appendTo(this.element()), Toolbar, this._toolbarOptions);
        } else {
            this._toolbar.option(this._toolbarOptions);
        }
    },

    _columnOptionChanged: $.noop,

    init: function() {
        this.callBase();
        this.createAction("onToolbarPreparing", { excludeValidators: ["designMode", "disabled", "readOnly"] });
    },

    render: function() {
        this._toolbarOptions = this._getToolbarOptions();
        this.callBase.apply(this, arguments);
    },

    updateToolbarItemOption: function(name, optionName, optionValue) {
        var toolbarInstance = this._toolbar;

        if(toolbarInstance) {
            var items = toolbarInstance.option("items");

            if(items && items.length) {
                var itemIndex;

                $.each(items, function(index, item) {
                    if(item.name === name) {
                        itemIndex = index;
                        return false;
                    }
                });

                if(itemIndex !== undefined) {
                    if(commonUtils.isObject(optionName)) {
                        toolbarInstance.option("items[" + itemIndex + "]", optionName);
                    } else {
                        toolbarInstance.option("items[" + itemIndex + "]." + optionName, optionValue);

                        if(optionName === "disabled") {
                            var widgetOptions = toolbarInstance.option("items[" + itemIndex + "].options") || {};

                            widgetOptions.disabled = optionValue;
                            toolbarInstance.option("items[" + itemIndex + "].options", widgetOptions);
                        }
                    }
                }
            }
        }
    },

    getToolbarItemOption: function(name, optionName) {
        var toolbarInstance = this._toolbar;

        if(toolbarInstance) {
            var items = toolbarInstance.option("items");

            if(items && items.length) {
                var optionValue;

                $.each(items, function(index, item) {
                    if(item.name === name) {
                        optionValue = item[optionName];
                        return false;
                    }
                });

                return optionValue;
            }
        }
    },

    getHeaderPanel: function() {
        return this.element();
    },

    getHeight: function() {
        return this.getElementHeight();
    },

    optionChanged: function(args) {
        if(args.name === "onToolbarPreparing") {
            this._invalidate();
            args.handled = true;
        }
        this.callBase(args);
    },

    isVisible: function() {
        return this._toolbarOptions && this._toolbarOptions.visible;
    }
});

gridCore.registerModule("headerPanel", {
    defaultOptions: function() {
        return {
            /**
             * @name dxDataGridOptions_onToolbarPreparing
             * @publicName onToolbarPreparing
             * @type function(e)
             * @type_function_param1 e:object
             * @type_function_param1_field4 toolbarOptions:Object
             * @extends Action
             * @action
             */
        };
    },
    views: {
        headerPanel: exports.HeaderPanel
    },
    extenders: {
        controllers: {
            resizing: {
                _updateDimensionsCore: function() {
                    this.callBase.apply(this, arguments);

                    var $headerPanelElement = this.getView("headerPanel").element();

                    if($headerPanelElement) {
                        domUtils.triggerResizeEvent($headerPanelElement);
                    }
                }
            }
        }
    }
});
