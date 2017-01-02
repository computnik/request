noop = (data, status, xhr)=> {
};
ajaxLogger = {
  "error": (msg)=> {
    console.log("ERROR: - %s", msg);
  },
  "warn": (msg)=> {
    console.log("ERROR: - %s", msg);
  },
  "info": (msg)=> {
    console.log("ERROR: - %s", msg);
  },
  "debug": (msg)=> {
    console.log("ERROR: - %s", msg);
  }
};

let isEmpty = (obj) => {
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
let encodeQuery = (obj, options)=> {
  let {sep = "&", eq = "=", separateArray = true, encodeFunction} = options;
  let encode;

  /**
   * Function to serialize Array to be sent as query param
   * @method serializeArray
   * @param {Array} arr Object to be serialized
   * @param {String} [key] Key to be sent as name for the object
   * @returns {String} serialized encoded string
   */
  let serializeArray = (arr, key) => {
    var str = [];
    if (!(key == null || !Array.isArray(arr) || arr.length === 0)) {
      for (var i = 0; i < arr.length; i++) {
        if (typeof arr[i] === "object") {
          str.push(key + eq + encode(JSON.stringify(arr[i])));
        } else {
          str.push(key + eq + encode(arr[i]));
        }
      }
    }
    if (str.length > 0) { // FIXME: The change depends on the ServerSide
      return str.join(sep);
    }
    return key;
  };
  if (encodeFunction && typeof encodeFunction === "function") {
    encode = encodeFunction;
  } else {
    encode = encodeURIComponent;
  }
  if (obj != null && typeof obj === "object") {
    var str = [];
    for (var p in obj) {
      if (obj.hasOwnProperty(p)) {
        if ((obj[p] == null)) {
          continue;
        }
        if (typeof obj[p] === "string") {
          str.push(encode(p) + eq + encode(obj[p]));
        } else if (Array.isArray(obj[p]) && separateArray) {
          str.push(serializeArray(obj[p], p));
        } else {
          str.push(encode(p) + eq + encode(JSON.stringify(obj[p])));
        }
      }
    }
    return str.join(sep);
  }
};

Timers = {
  timeOut: ()=> function (delay = 0, fn = noop) {
    setTimeout(fn, delay)
  },
};

let ajax = (options)=> {
  let {
    url = "",
    success = noop,
    error = noop,
    complete = noop,
    beforeSend = noop,
    contentType = "application/x-www-form-urlencoded; charset=UTF-8",
    headers = {},
    data = {},
    method = "GET",
    retries = 0,
    queryString = "",
    debugInfo = {startTime: 0, stopTime: 0},
    useXDR = false,
    processData = true,
    async = true,
    username,
    serializeArray = true,
    password,
    xhr
  } = options;
  if (url === "") {
    ajaxLogger.error("Blank URL Specified");
    complete(false, "URL NULL!!!");
    return;
  }
  if (!xhr) {
    if (!useXDR) {
      xhr = new XMLHttpRequest();
    } else {
      url = url.replace(/(http(s?):)\/\//, "//");
      xhr = new XDomainRequest();
    }
  } else {
    xhr = xhr();
  }

  /* CONSTANTS */
  const RETRYTIME = 1000;
  const OK = 200;
  const DONE = 4;

  let response;
  if (url.indexOf("?") > -1) {
    let urlSplit = url.split("?");
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

  let createRequest = () => {
    debugInfo.startTime = new Date().getTime();
    let resendRequest = ()=> {
      ajaxLogger.warn("Request Failed - Resending...");
      Timers.timeOut(RETRYTIME, createRequest);
    }
    let onComplete = (success, data) => {
      if (typeof complete === "function") {
        complete(success, data, debugInfo);
      }
    };
    let onError = ()=> {
      if (retries > 0) {
        retries--;
        resendRequest();
      } else {
        if (typeof error === "function") {
          error();
        }
        ajaxLogger.error("Request Failed");
        let errMsg = {
          "errorCode": "HTTP:" + xhr.status,
          "message": "Request Failed"
        };
        onComplete(false, errMsg);
      }
    };
    let onLoad = ()=> {
      if (xhr.status !== OK) {
        onError();
        return;
      }
      debugInfo.stopTime = new Date().getTime();
      response = xhr.responseText;
      let responseHeaders = {};
      let responseType = xhr.reponseType;
      if (!xhr.reponseType) {
        responseType = "text"; // TODO: Support Additional Types
        if (!xhr.contentType) {
          xhr.contentType = xhr.getResponseHeader ? xhr.getResponseHeader("Content-type") : "text";
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

    let sendRequest = ()=> {
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

    let setRequestHeaders = () => {
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
    }
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