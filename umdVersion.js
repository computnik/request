(function (name, context, definition) {
  "use strict";
  if (typeof define === "function" && define.amd) {
    define(definition);
  }
  else if (typeof module !== "undefined" && module.exports) {
    module.exports = definition();
  }
  else if (context.exports) {
    context.exports = definition();
  }
  else {
    context[name] = definition();
  }
})("umdVersion", this, function () {
  "use strict";

  var umdVersion = function (options) {

  };

  umdVersion.VERSION = 0.0
  .1;

  return umdVersion;

});