var Request = (function () {

  var Constants = {
    "TIMEOUT": 5000,
    "RETRIES": 3,
    "RETRY_WAIT_TIME": 1000
  };

  function RequestManager () {

  }

  RequestManager.prototype.verifyStatus = function (request) {
    return !(request.xhr.status < 200 || request.xhr.status >= 300 && request.xhr.status !== 304);
  };
  RequestManager.prototype.loaded = function (request) {
    if (this.verifyStatus(request)) {
      request.response = this.parseData(request);
      request.completer.complete(request.response);
    }
    else {
      request.completer.completeError(request.xhr.statusText);
    }
  };

  RequestManager.prototype.parseData = function (request) {
    if (request.xhr.getResponseHeader('content-type') == 'application/json') {
      return JSON.parse(request.xhr.responseText);
    } else {
      return request.xhr.responseText;
    }
  };

  RequestManager.prototype.process = function (request) {
    request.xhr.open(request.type, request.url, request.async);
    this.send(request);
  };

  RequestManager.prototype.send = function (request) {
    this.prepareData(request);
    var that = this;
    if (request.async === true) {
      request.xhr.onload = function () {
        that.loaded.call(that, request);
      };
      request.xhr.onerror = function () {
        request.completer.completeError(request.xhr.statusText);
      }
      request.xhr.send(this.prepareData(request));
    }
    else {
      request.xhr.send(this.prepareData(request));
      this.loaded.call(this, request);
    }
  };
  RequestManager.prototype.prepareData = function (request) {
    if (typeof (request.data) === 'object') {
      request.xhr.setRequestHeader("Content-Type", "application/json");
      return JSON.stringify(request.data);
    }
    if (typeof (request.data) === 'string') {
      return request.data;
    }
    return null;
  };

  function Promise () {

  }

  Promise.prototype.then = function (callback) {
    this.resolve = callback;
    return this;
  };
  Promise.prototype.fail = function (callback) {
    this.reject = callback;
    return this;
  };

  function Completer () {
    this.promise = new Promise();
  }

  Completer.prototype.complete = function () {
    if (this.promise.resolve !== undefined) {
      this.promise.resolve.apply(this, arguments);
    }
  };
  Completer.prototype.completeError = function (error) {
    if (this.promise.reject !== undefined) {
      this.promise.reject(error);
    }
  };
  function Request () {
    if (document.all && !window.atob) { // Test for IE9 and below
      this.xhr = new XDomainRequest();
    } else {
      this.xhr = new XMLHttpRequest();
    }
    this.completer = new Completer();
    this.requestManager = new RequestManager();
  }

  Request.prototype.start = function () {
    this.requestManager.process(this);
    return this.completer.promise;
  };
  Request.prototype.restart = function () {
    this.requestManager.process();
    return this.completer.promise;
  };
  function Get (url, async) {
    this.type = 'GET';
    if (url === undefined) {
      throw new Error('Parameters mismatched');
    }
    this.url = url;
    this.async = (async === undefined) ? true : async;
  }

  Get.prototype = new Request();
  Get.prototype.constructor = Get;

  function Post (url, data, async) {

    this.type = 'POST';
    if (url === undefined || data === undefined) {
      throw new Error('Parameters mismatched');
    }
    this.async = async === undefined ? true : false;
    this.url = url;
    this.data = data;
    return this;
  }

  Post.prototype = new Request();

  Post.constructor = Post;

  return {
    get: function (url, callback, options) {
      var retries = (typeof options.retries !== "undefined") ? options.retries : Constants.RETRIES;
      var request = new Get(url);

      function send () {
        request.start().then(callback).fail(function (error, errorCode) {
          console.log("error %s with errorcode %s", error, errorCode);
          if (--retries) {
            request.restart();
          }
        });
      }

      send();
    }, Post: Post
  };

}());


