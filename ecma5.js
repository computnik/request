"use strict";
var ajax = (function () {

  noop = Function.prototype;

  var ajaxLogger = {
    "log": function (type, msg) {
      console.log("%s: - %s", type, msg);
    },
    "error": function error (msg) {
      this.log("ERROR", msg);
    },
    "warn": function warn (msg) {
      this.log("WARN", msg);
    },
    "info": function info (msg) {
      this.log("INFO", msg);
    },
    "debug": function debug (msg) {
      this.log("DEBUG", msg);
    }
  };

  var isEmpty = function isEmpty (obj) {
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        return false;
      }
    }
    return JSON.stringify(obj) === JSON.stringify({});
  };

  /**
   * Function to serialize JSON to be sent as query param
   * @method serialize
   * @param {Object} obj Object to be serialized
   * @param {Object} [options] Encode OptionsSymbol
   * @param {String} [options.sep="&"] Separator Symbol
   * @param {String} [options.eq="="] Equals Symbol
   * @param {Function} [options.encodeFunction=encodeURIComponent] Encode Function
   * @param {Boolean} [options.separateArray=true] to separate array and send key=[val1,val2] as key=val1&key=val2
   * @returns {String} serialized encoded string
   */
  var encodeQuery = function encodeQuery (obj, options) {
    var sep = options.sep || "&";
    var eq = options.eq || "=";
    var separateArray = options.separateArray;
    var arrayIdentifier = "";
    if (separateArray) {
      arrayIdentifier = options.arrayIdentifier || "[]";
    }
    var encode = (options.encodeFunction && typeof options.encodeFunction === "function") ? options.encodeFunction
      : encodeURIComponent;

    /**
     * Function to serialize Array to be sent as query param
     * @method encodeArray
     * @param {Array} arr Object to be serialized
     * @param {String} [key] Key to be sent as name for the object
     * @returns {String} serialized encoded string
     */
    var encodeArray = function encodeArray (arr, key) {
      var str = [];
      if (!(key == null || !Array.isArray(arr) || arr.length === 0)) {
        for (var i = 0; i < arr.length; i++) {
          if (typeof arr[i] === "object") {
            str.push(key + arrayIdentifier + eq + encode(JSON.stringify(arr[i])));
          } else {
            str.push(key + arrayIdentifier + eq + encode(arr[i]));
          }
        }
      }
      if (str.length > 0) {
        return str.join(sep);
      }
      return key;
    };
    if (obj != null && (typeof obj === "object" )) {
      var str = [];
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (obj[key] == null) {
            continue;
          }
          if (typeof obj[key] === "string") {
            str.push(key + eq + encode(obj[key]));
          } else if (Array.isArray(obj[key]) && separateArray) {
            str.push(encodeArray(obj[key], key));
          } else {
            str.push(key + eq + encode(JSON.stringify(obj[key])));
          }
        }
      }
      return str.join(sep);
    }
  };

  var Timers = {
    timeOut: function timeOut (delay, fn) {
      return function () {
        setTimeout(fn, delay);
      };
    }
  };

  var requests = [];
  var ajax = function ajax (options) {
    var url = options.url || "";
    var success = options.success || noop;
    var error = options.error || noop;
    var complete = options.complete || noop;
    var beforeSend = options.beforeSend || noop;
    var contentType = options.contentType;
    var headers = options.headers || {};
    var data = options.data || {};
    var method = options.method || "GET";
    var retries = options.retries || 0;
    var queryString = options.queryString || "";
    var debugInfo = options.debugInfo || {startTime: 0, stopTime: 0};
    var useXDR = options.useXDR || false;
    var processData = options.processData || true;
    var async = options.async || true;
    var serializeArr = options.encodeArray || true;
    var username = options.username;
    var password = options.password;
    var xhr;

    if (url === "") {
      ajaxLogger.error("Blank URL Specified");
      complete(false, "URL NULL!!!");
      return;
    }
    if (!options.xhr) {
      if (!useXDR) {
        xhr = new XMLHttpRequest();
      } else {
        url = url.replace(/(http(s?):)\/\//, "//");
        xhr = new XDomainRequest();
      }
    } else {
      xhr = options.xhr();
    }

    /* CONSTANTS */
    var RETRYTIME = 1000;
    var OK = 200;
    var DONE = 4;

    var response = void 0;
    if (url.indexOf("?") > -1) {
      var urlSplit = url.split("?");
      url = urlSplit.shift();
      queryString = "?" + urlSplit.join("?") + queryString;
    }
    if (processData && !isEmpty(data)) {
      if (queryString.indexOf("?") !== 0) {
        queryString = "?" + queryString;
      } else {
        queryString += "&";
      }
      queryString += encodeQuery(data);
    } else if (typeof data === "string") {
      queryString += data;
    }

    var createRequest = function createRequest () {

      var rId = method + "-" + Math.random();
      requests[rId] = xhr;

      debugInfo.startTime = new Date().getTime();
      var resendRequest = function resendRequest () {
        ajaxLogger.warn("Request Failed - Resending...");
        Timers.timeOut(RETRYTIME, createRequest);
      };

      var onComplete = function onComplete (success, data) {
        if (typeof complete === "function") {
          complete(success, data, debugInfo);
        }
        requests[rId] = null;
        delete requests[rId];
      };
      var onError = function onError () {
        var xhr = requests[rId];
        if (!xhr) {
          return;
        }
        if (retries > 0) {
          retries--;
          resendRequest();
        } else {
          if (typeof error === "function") {
            error();
          }
          ajaxLogger.error("Request Failed");
          var errMsg = {
            "errorCode": "HTTP:" + xhr.status,
            "message": "Request Failed"
          };
          onComplete(false, errMsg);
        }
      };
      var onLoad = function onLoad () {
        var xhr = requests[rId];
        if (!xhr) {
          return;
        }
        if (xhr.status !== OK) {
          onError();
          return;
        }
        debugInfo.stopTime = new Date().getTime();
        response = xhr.responseText;
        var responseHeaders = {};
        var responseType = xhr.reponseType;
        if (!xhr.reponseType) {
          responseType = "text"; // TODO: Support Additional Types
          if (!xhr.contentType) {
            xhr.contentType = xhr.getResponseHeader
            if (xhr.contentType.indexOf("json")) {
              responseType = "json";
            }
          }
        }
        if (responseType === "json") {
          try {
            response = JSON.parse(xhr.responseText);
          } catch (ex) {
            responseType = "text";
            ajaxLogger.error("JSON.parse Error");
          }
        }
        onComplete(true, response);
      };

      var sendRequest = function sendRequest () {
        try {
          if (processData) {
            xhr.send();
          } else {
            xhr.send(data);
          }
        } catch (ex) {
          ajaxLogger.error(ex);
        }
      };

      var setRequestHeaders = function setRequestHeaders () {
        if (xhr.setRequestHeader) {
          for (var header in headers) {
            if (headers.hasOwnProperty(header)) {
              xhr.setRequestHeader(header, headers[header]);
            }
          }
          if (contentType) {
            xhr.setRequestHeader("Content-Type", contentType);
          }
        }
      };
      if (!("onload" in xhr) && false) {
        xhr.onreadystatechange = function () {
          if (xhr.readyState === DONE) {
            if (xhr.status === OK) {
              onLoad();
            } else {
              onError();
            }
          }
        };
      } else {
        xhr.onerror = xhr.ontimeout = onError;
        xhr.onload = onLoad;
        xhr.onprogress = noop;
      }
      if (timeout) {
        xhr.timeout = timeout;
      }
      try {
        xhr.open(method, url + queryString, async, username, password);
        if (beforeSend && typeof beforeSend === "function") {
          beforeSend(xhr, data);
        }
        setRequestHeaders();
        Timers.timeOut(0, sendRequest);
      } catch (ex) {
        ajaxLogger.error(ex);
      }
    };
    createRequest();
  };
  return ajax;
}());