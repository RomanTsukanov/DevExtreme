"use strict";

var $ = require("jquery"),
    _Number = Number,
    _getAppropriateFormat = require("../core/utils").getAppropriateFormat,
    translator1DModule = require("../translators/translator1d"),
    _extend = $.extend,
    BaseWidget = require("../core/base_widget"),
    _normalizeEnum = require("../core/utils").normalizeEnum,
    commonUtils = require("../../core/utils/common"),
    Tracker = require("./tracker"),
    _isString = commonUtils.isString;

var dxBaseGauge = BaseWidget.inherit({
    _rootClassPrefix: "dxg",

    _createThemeManager: function() {
        return new this._factory.ThemeManager();
    },

    _setDeprecatedOptions: function() {
        this.callBase();

        _extend(this._deprecatedOptions, {
            subtitle: {
                since: '15.2',
                message: "Use the 'title.subtitle' option instead"
            },
            "title.position": {
                since: "15.2",
                message: "Use the 'verticalAlignment' and 'horizontalAlignment' options instead"
            },
            "scale.hideFirstTick": {
                since: "15.2",
                message: "The functionality is not more available"
            },
            "scale.hideLastTick": {
                since: "15.2",
                message: "The functionality is not more available"
            },
            "scale.hideFirstLabel": {
                since: "15.2",
                message: "The functionality is not more available"
            },
            "scale.hideLastLabel": {
                since: "15.2",
                message: "The functionality is not more available"
            },
            "scale.majorTick": {
                since: "15.2",
                message: "Use the 'tick' option instead"
            },
            "scale.minorTick.showCalculatedTicks": {
                since: "15.2",
                message: "The functionality is not more available"
            },
            "scale.minorTick.customTickValues": {
                since: "15.2",
                message: "Use the 'customMinorTicks' option instead"
            },
            "scale.minorTick.tickInterval": {
                since: "15.2",
                message: "Use the 'minorTickInterval' option instead"
            }
        });
    },

    _initCore: function() {
        var that = this,
            root = that._renderer.root;

        that._valueChangingLocker = 0;
        that._translator = that._factory.createTranslator();

        that._initDeltaIndicator();
        that._tracker = that._factory.createTracker({ renderer: that._renderer, container: root });

        that._setTrackerCallbacks();
    },

    _beginValueChanging: function() {
        this._resetIsReady();
        ++this._valueChangingLocker;
    },

    _endValueChanging: function() {
        if(--this._valueChangingLocker === 0) {
            this._drawn();
        }
    },

    // For Dashboards
    _initDeltaIndicator: function() {
        var that = this,
            DeltaIndicator = that._DeltaIndicator;
        if(DeltaIndicator) {
            that._deltaIndicator = new DeltaIndicator({ renderer: that._renderer, container: that._renderer.root });
            that._deltaIndicator.layoutOptions = function() {
                this.clean();
                this.draw(that._getOption("indicator"));
                var options = this.getLayoutOptions();
                this._size = options ? [options.width, options.height] : null;
                return options && { horizontalAlignment: options.horizontalAlignment || "center", verticalAlignment: options.verticalAlignment || "bottom" };
            };
            that._deltaIndicator.measure = function() {
                return this._size;
            };
            that._deltaIndicator.move = function(rect) {
                return this.shift(Math.round(rect[0]), Math.round(rect[1]));
            };
            that._layout.add(that._deltaIndicator);
        }
    },

    // For Dashboards
    _disposeDeltaIndicator: function() {
        if(this._deltaIndicator) {
            this._deltaIndicator.clean();
            this._deltaIndicator.dispose();
        }
    },

    _setTrackerCallbacks: function() {
        var that = this,
            renderer = that._renderer,
            tooltip = that._tooltip;

        that._tracker.setCallbacks({
            'tooltip-show': function(target, info) {
                var tooltipParameters = target.getTooltipParameters(),
                    offset = renderer.getRootOffset(),
                    formatObject = _extend({
                        value: tooltipParameters.value,
                        valueText: tooltip.formatValue(tooltipParameters.value),
                        color: tooltipParameters.color
                    }, info);

                return tooltip.show(formatObject, {
                    x: tooltipParameters.x + offset.left,
                    y: tooltipParameters.y + offset.top,
                    offset: tooltipParameters.offset
                }, { target: info });
            },
            'tooltip-hide': function() {
                return tooltip.hide();
            }
        });
    },

    _dispose: function() {
        this._cleanCore();
        this.callBase.apply(this, arguments);
    },

    _disposeCore: function() {
        var that = this;
        that._themeManager.dispose();
        that._tracker.dispose();

        that._disposeDeltaIndicator();
        that._translator = that._tracker = null;
    },

    _cleanCore: function() {
        var that = this;
        that._tracker.deactivate();
        that._cleanContent();
    },

    _renderCore: function() {
        var that = this;
        if(!that._isValidDomain) return;

        that._renderContent();
        that._tracker.setTooltipState(that._tooltip.isEnabled());
        that._tracker.activate();
        that._noAnimation = false;
        ///#DEBUG
        that._debug_rendered && that._debug_rendered();
        ///#ENDDEBUG
    },

    _applyChanges: function() {
        this.callBase.apply(this, arguments);
        this._resizing = this._noAnimation = false;
    },

    _setContentSize: function() {
        var that = this;
        that._resizing = that._noAnimation = that._changes.count() === 2;
        that.callBase.apply(that, arguments);
    },

    _applySize: function(rect) {
        var that = this;
        ///#DEBUG
        that._DEBUG_rootRect = rect;
        ///#ENDDEBUG
        that._innerRect = { left: rect[0], top: rect[1], right: rect[2], bottom: rect[3] };
        // If loading indicator is shown it is got hidden at the end of "_renderCore" - during "_drawn". Then "loadingIndicator" option is changed.
        // It causes another "_setContentSize" execution (inside of the first one). Layout backwards during inner "_setContentSize" and clears its cache and
        // then backwards again during outer "_setContentSize" when "_cache" is null - so it fails.
        // The following code dirtily preserves layout cache for the outer backward.
        // The appropriate solution is to remove heavy rendering from "_applySize" - it should be done later during some other change processing.
        // It would be even better to somehow defer any inside option changes - so they all are applied after all changes are processed.
        var layoutCache = that._layout._cache;
        that._cleanCore();
        that._renderCore();
        that._layout._cache = that._layout._cache || layoutCache;
        return [rect[0], that._innerRect.top, rect[2], that._innerRect.bottom];
    },

    _initialChanges: ["DOMAIN"],

    _themeDependentChanges: ["DOMAIN"],

    _optionChangesMap: {
        subtitle: "MOSTLY_TOTAL",
        indicator: "MOSTLY_TOTAL",
        geometry: "MOSTLY_TOTAL",
        animation: "MOSTLY_TOTAL",
        startValue: "DOMAIN",
        endValue: "DOMAIN"
    },

    _optionChangesOrder: ["DOMAIN", "MOSTLY_TOTAL"],

    _change_DOMAIN: function() {
        this._setupDomain();
    },

    _change_MOSTLY_TOTAL: function() {
        this._applyMostlyTotalChange();
    },

    _setupDomain: function() {
        var that = this;
        that._setupDomainCore();
        // T130599
        that._isValidDomain = isFinite(1 / (that._translator.getDomain()[1] - that._translator.getDomain()[0]));
        if(!that._isValidDomain) {
            that._incidentOccurred("W2301");
        }
        that._change(["MOSTLY_TOTAL"]);
    },

    _applyMostlyTotalChange: function() {
        var that = this;
        that._setupCodomain();
        that._setupAnimationSettings();
        that._setupDefaultFormat();
        that._change(["LAYOUT"]);
    },

    _setupAnimationSettings: function() {
        var that = this,
            option = that.option("animation");
        that._animationSettings = null;
        if(option === undefined || option) {
            option = _extend({
                enabled: true,
                duration: 1000,
                easing: "easeOutCubic"
            }, option);
            if(option.enabled && option.duration > 0) {
                that._animationSettings = { duration: _Number(option.duration), easing: option.easing };
            }
        }
        //  It is better to place it here than to create separate function for one line of code
        that._containerBackgroundColor = that.option("containerBackgroundColor") || that._themeManager.theme().containerBackgroundColor;
    },

    _setupDefaultFormat: function() {
        var domain = this._translator.getDomain();
        this._defaultFormatOptions = _getAppropriateFormat(domain[0], domain[1], this._getApproximateScreenRange());
    },

    _setupDomainCore: null,

    _calculateSize: null,

    _cleanContent: null,

    _renderContent: null,

    _setupCodomain: null,

    _getApproximateScreenRange: null,

    _factory: {
        createTranslator: function() {
            return new translator1DModule.Translator1D();
        },

        createTracker: function(parameters) {
            return new Tracker(parameters);
        }
    }
});

exports.dxBaseGauge = dxBaseGauge;

var _format = require("../core/format");

//  TODO: find a better place for it
var formatValue = function(value, options, extra) {
    options = options || {};
    var text = _format(value, options),
        formatObject;
    if(typeof options.customizeText === "function") {
        formatObject = _extend({ value: value, valueText: text }, extra);
        return String(options.customizeText.call(formatObject, formatObject));
    }
    return text;
};

//  TODO: find a better place for it
var getSampleText = function(translator, options) {
    var text1 = formatValue(translator.getDomainStart(), options),
        text2 = formatValue(translator.getDomainEnd(), options);
    return text1.length >= text2.length ? text1 : text2;
};

exports.formatValue = formatValue;
exports.getSampleText = getSampleText;

exports.compareArrays = function(array1, array2) {
    return array1 && array2 && array1.length === array2.length && compareArraysElements(array1, array2);
};

function compareArraysElements(array1, array2) {
    var i,
        ii = array1.length;

    for(i = 0; i < ii; ++i) {
        if(array1[i] !== array2[i]) return false;
    }
    return true;
}

// PLUGINS_SECTION
dxBaseGauge.addPlugin(require("../core/export").plugin);
dxBaseGauge.addPlugin(require("../core/title").plugin);
dxBaseGauge.addPlugin(require("../core/tooltip").plugin);
dxBaseGauge.addPlugin(require("../core/loading_indicator").plugin);

// These are gauges specifics on using tooltip - they require refactoring.
var _setTooltipOptions = dxBaseGauge.prototype._setTooltipOptions;
dxBaseGauge.prototype._setTooltipOptions = function() {
    _setTooltipOptions.apply(this, arguments);
    this._tracker && this._tracker.setTooltipState(this._tooltip.isEnabled());
};

// DEPRECATED_15_2
function processTitleOptions(options) {
    return _isString(options) ? { text: options } : (options || {});
}
dxBaseGauge.prototype._getTitleOptions = function() {
    var that = this,
        titleOptions = processTitleOptions(that.option("title")),
        options,
        position;

    that._suppressDeprecatedWarnings();
    titleOptions.subtitle = $.extend(processTitleOptions(titleOptions.subtitle), processTitleOptions(that.option("subtitle")));
    that._resumeDeprecatedWarnings();
    options = _extend(true, {}, that._themeManager.theme("title"), titleOptions);
    if(options.position) {
        position = _normalizeEnum(options.position).split('-');
        options.verticalAlignment = position[0];
        options.horizontalAlignment = position[1];
    }

    return options;
};
