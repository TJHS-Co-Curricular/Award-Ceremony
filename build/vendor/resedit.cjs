var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/pe-library/dist/format/FormatBase.js
var FormatBase, FormatBase_default;
var init_FormatBase = __esm({
  "node_modules/pe-library/dist/format/FormatBase.js"() {
    FormatBase = /** @class */
    function() {
      function FormatBase2(view) {
        this.view = view;
      }
      FormatBase2.prototype.copyTo = function(bin, offset) {
        new Uint8Array(bin, offset, this.view.byteLength).set(new Uint8Array(this.view.buffer, this.view.byteOffset, this.view.byteLength));
      };
      Object.defineProperty(FormatBase2.prototype, "byteLength", {
        get: function() {
          return this.view.byteLength;
        },
        enumerable: false,
        configurable: true
      });
      return FormatBase2;
    }();
    FormatBase_default = FormatBase;
  }
});

// node_modules/pe-library/dist/format/ArrayFormatBase.js
var __extends, ArrayFormatBase, ArrayFormatBase_default;
var init_ArrayFormatBase = __esm({
  "node_modules/pe-library/dist/format/ArrayFormatBase.js"() {
    init_FormatBase();
    __extends = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    ArrayFormatBase = /** @class */
    function(_super) {
      __extends(ArrayFormatBase2, _super);
      function ArrayFormatBase2(view) {
        return _super.call(this, view) || this;
      }
      ArrayFormatBase2.prototype.forEach = function(callback) {
        var len = this.length;
        var a = [];
        a.length = len;
        for (var i = 0; i < len; ++i) {
          a[i] = this.get(i);
        }
        for (var i = 0; i < len; ++i) {
          callback(a[i], i, this);
        }
      };
      ArrayFormatBase2.prototype._iterator = function() {
        return new /** @class */
        (function() {
          function class_1(base) {
            this.base = base;
            this.i = 0;
          }
          class_1.prototype.next = function() {
            if (this.i === this.base.length) {
              return {
                value: void 0,
                done: true
              };
            } else {
              return {
                value: this.base.get(this.i++),
                done: false
              };
            }
          };
          return class_1;
        }())(this);
      };
      return ArrayFormatBase2;
    }(FormatBase_default);
    if (typeof Symbol !== "undefined") {
      ArrayFormatBase.prototype[Symbol.iterator] = // eslint-disable-next-line @typescript-eslint/unbound-method
      ArrayFormatBase.prototype._iterator;
    }
    ArrayFormatBase_default = ArrayFormatBase;
  }
});

// node_modules/pe-library/dist/format/ImageDataDirectoryArray.js
var __extends2, ImageDataDirectoryArray, ImageDataDirectoryArray_default;
var init_ImageDataDirectoryArray = __esm({
  "node_modules/pe-library/dist/format/ImageDataDirectoryArray.js"() {
    init_ArrayFormatBase();
    __extends2 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    ImageDataDirectoryArray = /** @class */
    function(_super) {
      __extends2(ImageDataDirectoryArray2, _super);
      function ImageDataDirectoryArray2(view) {
        var _this = _super.call(this, view) || this;
        _this.length = 16;
        return _this;
      }
      ImageDataDirectoryArray2.from = function(bin, offset) {
        if (offset === void 0) {
          offset = 0;
        }
        return new ImageDataDirectoryArray2(new DataView(bin, offset, 128));
      };
      ImageDataDirectoryArray2.prototype.get = function(index) {
        return {
          virtualAddress: this.view.getUint32(index * 8, true),
          size: this.view.getUint32(4 + index * 8, true)
        };
      };
      ImageDataDirectoryArray2.prototype.set = function(index, data) {
        this.view.setUint32(index * 8, data.virtualAddress, true);
        this.view.setUint32(4 + index * 8, data.size, true);
      };
      ImageDataDirectoryArray2.prototype.findIndexByVirtualAddress = function(virtualAddress) {
        for (var i = 0; i < 16; ++i) {
          var va = this.view.getUint32(i * 8, true);
          var vs = this.view.getUint32(4 + i * 8, true);
          if (virtualAddress >= va && virtualAddress < va + vs) {
            return i;
          }
        }
        return null;
      };
      ImageDataDirectoryArray2.size = 128;
      ImageDataDirectoryArray2.itemSize = 8;
      return ImageDataDirectoryArray2;
    }(ArrayFormatBase_default);
    ImageDataDirectoryArray_default = ImageDataDirectoryArray;
  }
});

// node_modules/pe-library/dist/format/ImageDirectoryEntry.js
var ImageDirectoryEntry, ImageDirectoryEntry_default;
var init_ImageDirectoryEntry = __esm({
  "node_modules/pe-library/dist/format/ImageDirectoryEntry.js"() {
    ImageDirectoryEntry = {
      Export: 0,
      Import: 1,
      Resource: 2,
      Exception: 3,
      Certificate: 4,
      Security: 4,
      BaseRelocation: 5,
      Debug: 6,
      Architecture: 7,
      GlobalPointer: 8,
      Tls: 9,
      TLS: 9,
      LoadConfig: 10,
      BoundImport: 11,
      Iat: 12,
      IAT: 12,
      DelayImport: 13,
      ComDescriptor: 14,
      COMDescriptor: 14
      // alias
    };
    ImageDirectoryEntry_default = ImageDirectoryEntry;
  }
});

// node_modules/pe-library/dist/util/functions.js
function cloneObject(object) {
  var r = {};
  Object.keys(object).forEach(function(key) {
    r[key] = object[key];
  });
  return r;
}
function createDataView(bin, byteOffset, byteLength) {
  if ("buffer" in bin) {
    var newOffset = bin.byteOffset;
    var newLength = bin.byteLength;
    if (typeof byteOffset !== "undefined") {
      newOffset += byteOffset;
      newLength -= byteOffset;
    }
    if (typeof byteLength !== "undefined") {
      newLength = byteLength;
    }
    return new DataView(bin.buffer, newOffset, newLength);
  } else {
    return new DataView(bin, byteOffset, byteLength);
  }
}
function calculateCheckSumForPE(bin, storeToBinary) {
  var dosHeader = ImageDosHeader_default.from(bin);
  var view = new DataView(bin);
  var checkSumOffset = dosHeader.newHeaderAddress + 88;
  var result = 0;
  var limit = 4294967296;
  var update = function(dword) {
    result += dword;
    if (result >= limit) {
      result = result % limit + (result / limit | 0);
    }
  };
  var len = view.byteLength;
  var lenExtra = len % 4;
  var lenAlign = len - lenExtra;
  for (var i = 0; i < lenAlign; i += 4) {
    if (i !== checkSumOffset) {
      update(view.getUint32(i, true));
    }
  }
  if (lenExtra !== 0) {
    var extra = 0;
    for (var i = 0; i < lenExtra; i++) {
      extra |= view.getUint8(lenAlign + i) << (3 - i) * 8;
    }
    update(extra);
  }
  result = (result & 65535) + (result >>> 16);
  result += result >>> 16;
  result = (result & 65535) + len;
  if (storeToBinary) {
    view.setUint32(checkSumOffset, result, true);
  }
  return result;
}
function roundUp(val, align) {
  return Math.floor((val + align - 1) / align) * align;
}
function copyBuffer(dest, destOffset, src, srcOffset, length) {
  var ua8Dest = "buffer" in dest ? new Uint8Array(dest.buffer, dest.byteOffset + (destOffset || 0), length) : new Uint8Array(dest, destOffset, length);
  var ua8Src = "buffer" in src ? new Uint8Array(src.buffer, src.byteOffset + (srcOffset || 0), length) : new Uint8Array(src, srcOffset, length);
  ua8Dest.set(ua8Src);
}
function allocatePartialBinary(binBase, offset, length) {
  var b = new ArrayBuffer(length);
  copyBuffer(b, 0, binBase, offset, length);
  return b;
}
function cloneToArrayBuffer(binBase) {
  if ("buffer" in binBase) {
    var b = new ArrayBuffer(binBase.byteLength);
    new Uint8Array(b).set(new Uint8Array(binBase.buffer, binBase.byteOffset, binBase.byteLength));
    return b;
  } else {
    var b = new ArrayBuffer(binBase.byteLength);
    new Uint8Array(b).set(new Uint8Array(binBase));
    return b;
  }
}
function getFixedString(view, offset, length) {
  var actualLen = 0;
  for (var i = 0; i < length; ++i) {
    if (view.getUint8(offset + i) === 0) {
      break;
    }
    ++actualLen;
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(view.buffer, view.byteOffset + offset, actualLen).toString("utf8");
  } else if (typeof decodeURIComponent !== "undefined") {
    var s = "";
    for (var i = 0; i < actualLen; ++i) {
      var c = view.getUint8(offset + i);
      if (c < 16) {
        s += "%0" + c.toString(16);
      } else {
        s += "%" + c.toString(16);
      }
    }
    return decodeURIComponent(s);
  } else {
    var s = "";
    for (var i = 0; i < actualLen; ++i) {
      var c = view.getUint8(offset + i);
      s += String.fromCharCode(c);
    }
    return s;
  }
}
function setFixedString(view, offset, length, text) {
  if (typeof Buffer !== "undefined") {
    var u = new Uint8Array(view.buffer, view.byteOffset + offset, length);
    u.set(new Uint8Array(length));
    u.set(Buffer.from(text, "utf8").subarray(0, length));
  } else if (typeof encodeURIComponent !== "undefined") {
    var s = encodeURIComponent(text);
    for (var i = 0, j = 0; i < length; ++i) {
      if (j >= s.length) {
        view.setUint8(i + offset, 0);
      } else {
        var c = s.charCodeAt(j);
        if (c === 37) {
          var n = parseInt(s.substr(j + 1, 2), 16);
          if (typeof n === "number" && !isNaN(n)) {
            view.setUint8(i + offset, n);
          } else {
            view.setUint8(i + offset, 0);
          }
          j += 3;
        } else {
          view.setUint8(i + offset, c);
        }
      }
    }
  } else {
    for (var i = 0, j = 0; i < length; ++i) {
      if (j >= text.length) {
        view.setUint8(i + offset, 0);
      } else {
        var c = text.charCodeAt(j);
        view.setUint8(i + offset, c & 255);
      }
    }
  }
}
function binaryToString(bin) {
  if (typeof TextDecoder !== "undefined") {
    var dec = new TextDecoder();
    return dec.decode(bin);
  } else if (typeof Buffer !== "undefined") {
    var b = void 0;
    if ("buffer" in bin) {
      b = Buffer.from(bin.buffer, bin.byteOffset, bin.byteLength);
    } else {
      b = Buffer.from(bin);
    }
    return b.toString("utf8");
  } else {
    var view = void 0;
    if ("buffer" in bin) {
      view = new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
    } else {
      view = new Uint8Array(bin);
    }
    if (typeof decodeURIComponent !== "undefined") {
      var s = "";
      for (var i = 0; i < view.length; ++i) {
        var c = view[i];
        if (c < 16) {
          s += "%0" + c.toString(16);
        } else {
          s += "%" + c.toString(16);
        }
      }
      return decodeURIComponent(s);
    } else {
      var s = "";
      for (var i = 0; i < view.length; ++i) {
        var c = view[i];
        s += String.fromCharCode(c);
      }
      return s;
    }
  }
}
function stringToBinary(string) {
  if (typeof TextEncoder !== "undefined") {
    var enc = new TextEncoder();
    return cloneToArrayBuffer(enc.encode(string));
  } else if (typeof Buffer !== "undefined") {
    return cloneToArrayBuffer(Buffer.from(string, "utf8"));
  } else if (typeof encodeURIComponent !== "undefined") {
    var data = encodeURIComponent(string);
    var len = 0;
    for (var i = 0; i < data.length; ++len) {
      var c = data.charCodeAt(i);
      if (c === 37) {
        i += 3;
      } else {
        ++i;
      }
    }
    var bin = new ArrayBuffer(len);
    var view = new Uint8Array(bin);
    for (var i = 0, j = 0; i < data.length; ++j) {
      var c = data.charCodeAt(i);
      if (c === 37) {
        var n = parseInt(data.substring(i + 1, i + 3), 16);
        view[j] = n;
        i += 3;
      } else {
        view[j] = c;
        ++i;
      }
    }
    return bin;
  } else {
    var bin = new ArrayBuffer(string.length);
    new Uint8Array(bin).set([].map.call(string, function(c2) {
      return c2.charCodeAt(0);
    }));
    return bin;
  }
}
var init_functions = __esm({
  "node_modules/pe-library/dist/util/functions.js"() {
    init_ImageDosHeader();
  }
});

// node_modules/pe-library/dist/format/ImageDosHeader.js
var __extends3, ImageDosHeader, ImageDosHeader_default;
var init_ImageDosHeader = __esm({
  "node_modules/pe-library/dist/format/ImageDosHeader.js"() {
    init_functions();
    init_FormatBase();
    __extends3 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    ImageDosHeader = /** @class */
    function(_super) {
      __extends3(ImageDosHeader2, _super);
      function ImageDosHeader2(view) {
        return _super.call(this, view) || this;
      }
      ImageDosHeader2.from = function(bin, offset) {
        if (offset === void 0) {
          offset = 0;
        }
        return new ImageDosHeader2(createDataView(bin, offset, 64));
      };
      ImageDosHeader2.prototype.isValid = function() {
        return this.magic === ImageDosHeader2.DEFAULT_MAGIC;
      };
      Object.defineProperty(ImageDosHeader2.prototype, "magic", {
        get: function() {
          return this.view.getUint16(0, true);
        },
        set: function(val) {
          this.view.setUint16(0, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "lastPageSize", {
        get: function() {
          return this.view.getUint16(2, true);
        },
        set: function(val) {
          this.view.setUint16(2, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "pages", {
        get: function() {
          return this.view.getUint16(4, true);
        },
        set: function(val) {
          this.view.setUint16(4, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "relocations", {
        get: function() {
          return this.view.getUint16(6, true);
        },
        set: function(val) {
          this.view.setUint16(6, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "headerSizeInParagraph", {
        get: function() {
          return this.view.getUint16(8, true);
        },
        set: function(val) {
          this.view.setUint16(8, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "minAllocParagraphs", {
        get: function() {
          return this.view.getUint16(10, true);
        },
        set: function(val) {
          this.view.setUint16(10, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "maxAllocParagraphs", {
        get: function() {
          return this.view.getUint16(12, true);
        },
        set: function(val) {
          this.view.setUint16(12, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "initialSS", {
        get: function() {
          return this.view.getUint16(14, true);
        },
        set: function(val) {
          this.view.setUint16(14, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "initialSP", {
        get: function() {
          return this.view.getUint16(16, true);
        },
        set: function(val) {
          this.view.setUint16(16, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "checkSum", {
        get: function() {
          return this.view.getUint16(18, true);
        },
        set: function(val) {
          this.view.setUint16(18, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "initialIP", {
        get: function() {
          return this.view.getUint16(20, true);
        },
        set: function(val) {
          this.view.setUint16(20, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "initialCS", {
        get: function() {
          return this.view.getUint16(22, true);
        },
        set: function(val) {
          this.view.setUint16(22, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "relocationTableAddress", {
        get: function() {
          return this.view.getUint16(24, true);
        },
        set: function(val) {
          this.view.setUint16(24, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "overlayNum", {
        get: function() {
          return this.view.getUint16(26, true);
        },
        set: function(val) {
          this.view.setUint16(26, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "oemId", {
        // WORD e_res[4] (28,30,32,34)
        get: function() {
          return this.view.getUint16(36, true);
        },
        set: function(val) {
          this.view.setUint16(36, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "oemInfo", {
        get: function() {
          return this.view.getUint16(38, true);
        },
        set: function(val) {
          this.view.setUint16(38, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageDosHeader2.prototype, "newHeaderAddress", {
        // WORD e_res2[10] (40,42,44,46,48,50,52,54,56,58)
        get: function() {
          return this.view.getUint32(60, true);
        },
        set: function(val) {
          this.view.setUint32(60, val, true);
        },
        enumerable: false,
        configurable: true
      });
      ImageDosHeader2.size = 64;
      ImageDosHeader2.DEFAULT_MAGIC = 23117;
      return ImageDosHeader2;
    }(FormatBase_default);
    ImageDosHeader_default = ImageDosHeader;
  }
});

// node_modules/pe-library/dist/format/ImageFileHeader.js
var __extends4, ImageFileHeader, ImageFileHeader_default;
var init_ImageFileHeader = __esm({
  "node_modules/pe-library/dist/format/ImageFileHeader.js"() {
    init_FormatBase();
    __extends4 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    ImageFileHeader = /** @class */
    function(_super) {
      __extends4(ImageFileHeader2, _super);
      function ImageFileHeader2(view) {
        return _super.call(this, view) || this;
      }
      ImageFileHeader2.from = function(bin, offset) {
        if (offset === void 0) {
          offset = 0;
        }
        return new ImageFileHeader2(new DataView(bin, offset, 20));
      };
      Object.defineProperty(ImageFileHeader2.prototype, "machine", {
        get: function() {
          return this.view.getUint16(0, true);
        },
        set: function(val) {
          this.view.setUint16(0, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageFileHeader2.prototype, "numberOfSections", {
        get: function() {
          return this.view.getUint16(2, true);
        },
        set: function(val) {
          this.view.setUint16(2, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageFileHeader2.prototype, "timeDateStamp", {
        get: function() {
          return this.view.getUint32(4, true);
        },
        set: function(val) {
          this.view.setUint32(4, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageFileHeader2.prototype, "pointerToSymbolTable", {
        get: function() {
          return this.view.getUint32(8, true);
        },
        set: function(val) {
          this.view.setUint32(8, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageFileHeader2.prototype, "numberOfSymbols", {
        get: function() {
          return this.view.getUint32(12, true);
        },
        set: function(val) {
          this.view.setUint32(12, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageFileHeader2.prototype, "sizeOfOptionalHeader", {
        get: function() {
          return this.view.getUint16(16, true);
        },
        set: function(val) {
          this.view.setUint16(16, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageFileHeader2.prototype, "characteristics", {
        get: function() {
          return this.view.getUint16(18, true);
        },
        set: function(val) {
          this.view.setUint16(18, val, true);
        },
        enumerable: false,
        configurable: true
      });
      ImageFileHeader2.size = 20;
      return ImageFileHeader2;
    }(FormatBase_default);
    ImageFileHeader_default = ImageFileHeader;
  }
});

// node_modules/pe-library/dist/format/ImageOptionalHeader.js
var __extends5, ImageOptionalHeader, ImageOptionalHeader_default;
var init_ImageOptionalHeader = __esm({
  "node_modules/pe-library/dist/format/ImageOptionalHeader.js"() {
    init_FormatBase();
    __extends5 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    ImageOptionalHeader = /** @class */
    function(_super) {
      __extends5(ImageOptionalHeader2, _super);
      function ImageOptionalHeader2(view) {
        return _super.call(this, view) || this;
      }
      ImageOptionalHeader2.from = function(bin, offset) {
        if (offset === void 0) {
          offset = 0;
        }
        return new ImageOptionalHeader2(new DataView(bin, offset, 96));
      };
      Object.defineProperty(ImageOptionalHeader2.prototype, "magic", {
        get: function() {
          return this.view.getUint16(0, true);
        },
        set: function(val) {
          this.view.setUint16(0, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "majorLinkerVersion", {
        get: function() {
          return this.view.getUint8(2);
        },
        set: function(val) {
          this.view.setUint8(2, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "minorLinkerVersion", {
        get: function() {
          return this.view.getUint8(3);
        },
        set: function(val) {
          this.view.setUint8(3, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfCode", {
        get: function() {
          return this.view.getUint32(4, true);
        },
        set: function(val) {
          this.view.setUint32(4, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfInitializedData", {
        get: function() {
          return this.view.getUint32(8, true);
        },
        set: function(val) {
          this.view.setUint32(8, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfUninitializedData", {
        get: function() {
          return this.view.getUint32(12, true);
        },
        set: function(val) {
          this.view.setUint32(12, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "addressOfEntryPoint", {
        get: function() {
          return this.view.getUint32(16, true);
        },
        set: function(val) {
          this.view.setUint32(16, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "baseOfCode", {
        get: function() {
          return this.view.getUint32(20, true);
        },
        set: function(val) {
          this.view.setUint32(20, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "baseOfData", {
        get: function() {
          return this.view.getUint32(24, true);
        },
        set: function(val) {
          this.view.setUint32(24, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "imageBase", {
        get: function() {
          return this.view.getUint32(28, true);
        },
        set: function(val) {
          this.view.setUint32(28, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sectionAlignment", {
        get: function() {
          return this.view.getUint32(32, true);
        },
        set: function(val) {
          this.view.setUint32(32, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "fileAlignment", {
        get: function() {
          return this.view.getUint32(36, true);
        },
        set: function(val) {
          this.view.setUint32(36, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "majorOperatingSystemVersion", {
        get: function() {
          return this.view.getUint16(40, true);
        },
        set: function(val) {
          this.view.setUint16(40, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "minorOperatingSystemVersion", {
        get: function() {
          return this.view.getUint16(42, true);
        },
        set: function(val) {
          this.view.setUint16(42, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "majorImageVersion", {
        get: function() {
          return this.view.getUint16(44, true);
        },
        set: function(val) {
          this.view.setUint16(44, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "minorImageVersion", {
        get: function() {
          return this.view.getUint16(46, true);
        },
        set: function(val) {
          this.view.setUint16(46, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "majorSubsystemVersion", {
        get: function() {
          return this.view.getUint16(48, true);
        },
        set: function(val) {
          this.view.setUint16(48, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "minorSubsystemVersion", {
        get: function() {
          return this.view.getUint16(50, true);
        },
        set: function(val) {
          this.view.setUint16(50, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "win32VersionValue", {
        get: function() {
          return this.view.getUint32(52, true);
        },
        set: function(val) {
          this.view.setUint32(52, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfImage", {
        get: function() {
          return this.view.getUint32(56, true);
        },
        set: function(val) {
          this.view.setUint32(56, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfHeaders", {
        get: function() {
          return this.view.getUint32(60, true);
        },
        set: function(val) {
          this.view.setUint32(60, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "checkSum", {
        get: function() {
          return this.view.getUint32(64, true);
        },
        set: function(val) {
          this.view.setUint32(64, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "subsystem", {
        get: function() {
          return this.view.getUint16(68, true);
        },
        set: function(val) {
          this.view.setUint16(68, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "dllCharacteristics", {
        get: function() {
          return this.view.getUint16(70, true);
        },
        set: function(val) {
          this.view.setUint16(70, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfStackReserve", {
        get: function() {
          return this.view.getUint32(72, true);
        },
        set: function(val) {
          this.view.setUint32(72, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfStackCommit", {
        get: function() {
          return this.view.getUint32(76, true);
        },
        set: function(val) {
          this.view.setUint32(76, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfHeapReserve", {
        get: function() {
          return this.view.getUint32(80, true);
        },
        set: function(val) {
          this.view.setUint32(80, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfHeapCommit", {
        get: function() {
          return this.view.getUint32(84, true);
        },
        set: function(val) {
          this.view.setUint32(84, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "loaderFlags", {
        get: function() {
          return this.view.getUint32(88, true);
        },
        set: function(val) {
          this.view.setUint32(88, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader2.prototype, "numberOfRvaAndSizes", {
        get: function() {
          return this.view.getUint32(92, true);
        },
        set: function(val) {
          this.view.setUint32(92, val, true);
        },
        enumerable: false,
        configurable: true
      });
      ImageOptionalHeader2.size = 96;
      ImageOptionalHeader2.DEFAULT_MAGIC = 267;
      return ImageOptionalHeader2;
    }(FormatBase_default);
    ImageOptionalHeader_default = ImageOptionalHeader;
  }
});

// node_modules/pe-library/dist/format/ImageOptionalHeader64.js
function getUint64LE(view, offset) {
  return view.getUint32(offset + 4, true) * 4294967296 + view.getUint32(offset, true);
}
function setUint64LE(view, offset, val) {
  view.setUint32(offset, val & 4294967295, true);
  view.setUint32(offset + 4, Math.floor(val / 4294967296), true);
}
function getUint64LEBigInt(view, offset) {
  if (typeof BigInt === "undefined") {
    throw new Error("BigInt not supported");
  }
  return BigInt(4294967296) * BigInt(view.getUint32(offset + 4, true)) + BigInt(view.getUint32(offset, true));
}
function setUint64LEBigInt(view, offset, val) {
  if (typeof BigInt === "undefined") {
    throw new Error("BigInt not supported");
  }
  view.setUint32(offset, Number(val & BigInt(4294967295)), true);
  view.setUint32(offset + 4, Math.floor(Number(val / BigInt(4294967296) & BigInt(4294967295))), true);
}
var __extends6, ImageOptionalHeader64, ImageOptionalHeader64_default;
var init_ImageOptionalHeader64 = __esm({
  "node_modules/pe-library/dist/format/ImageOptionalHeader64.js"() {
    init_FormatBase();
    __extends6 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    ImageOptionalHeader64 = /** @class */
    function(_super) {
      __extends6(ImageOptionalHeader642, _super);
      function ImageOptionalHeader642(view) {
        return _super.call(this, view) || this;
      }
      ImageOptionalHeader642.from = function(bin, offset) {
        if (offset === void 0) {
          offset = 0;
        }
        return new ImageOptionalHeader642(new DataView(bin, offset, 112));
      };
      Object.defineProperty(ImageOptionalHeader642.prototype, "magic", {
        get: function() {
          return this.view.getUint16(0, true);
        },
        set: function(val) {
          this.view.setUint16(0, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "majorLinkerVersion", {
        get: function() {
          return this.view.getUint8(2);
        },
        set: function(val) {
          this.view.setUint8(2, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "minorLinkerVersion", {
        get: function() {
          return this.view.getUint8(3);
        },
        set: function(val) {
          this.view.setUint8(3, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfCode", {
        get: function() {
          return this.view.getUint32(4, true);
        },
        set: function(val) {
          this.view.setUint32(4, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfInitializedData", {
        get: function() {
          return this.view.getUint32(8, true);
        },
        set: function(val) {
          this.view.setUint32(8, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfUninitializedData", {
        get: function() {
          return this.view.getUint32(12, true);
        },
        set: function(val) {
          this.view.setUint32(12, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "addressOfEntryPoint", {
        get: function() {
          return this.view.getUint32(16, true);
        },
        set: function(val) {
          this.view.setUint32(16, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "baseOfCode", {
        get: function() {
          return this.view.getUint32(20, true);
        },
        set: function(val) {
          this.view.setUint32(20, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "imageBase", {
        get: function() {
          return getUint64LE(this.view, 24);
        },
        set: function(val) {
          setUint64LE(this.view, 24, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "imageBaseBigInt", {
        get: function() {
          return getUint64LEBigInt(this.view, 24);
        },
        set: function(val) {
          setUint64LEBigInt(this.view, 24, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sectionAlignment", {
        get: function() {
          return this.view.getUint32(32, true);
        },
        set: function(val) {
          this.view.setUint32(32, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "fileAlignment", {
        get: function() {
          return this.view.getUint32(36, true);
        },
        set: function(val) {
          this.view.setUint32(36, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "majorOperatingSystemVersion", {
        get: function() {
          return this.view.getUint16(40, true);
        },
        set: function(val) {
          this.view.setUint16(40, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "minorOperatingSystemVersion", {
        get: function() {
          return this.view.getUint16(42, true);
        },
        set: function(val) {
          this.view.setUint16(42, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "majorImageVersion", {
        get: function() {
          return this.view.getUint16(44, true);
        },
        set: function(val) {
          this.view.setUint16(44, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "minorImageVersion", {
        get: function() {
          return this.view.getUint16(46, true);
        },
        set: function(val) {
          this.view.setUint16(46, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "majorSubsystemVersion", {
        get: function() {
          return this.view.getUint16(48, true);
        },
        set: function(val) {
          this.view.setUint16(48, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "minorSubsystemVersion", {
        get: function() {
          return this.view.getUint16(50, true);
        },
        set: function(val) {
          this.view.setUint16(50, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "win32VersionValue", {
        get: function() {
          return this.view.getUint32(52, true);
        },
        set: function(val) {
          this.view.setUint32(52, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfImage", {
        get: function() {
          return this.view.getUint32(56, true);
        },
        set: function(val) {
          this.view.setUint32(56, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeaders", {
        get: function() {
          return this.view.getUint32(60, true);
        },
        set: function(val) {
          this.view.setUint32(60, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "checkSum", {
        get: function() {
          return this.view.getUint32(64, true);
        },
        set: function(val) {
          this.view.setUint32(64, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "subsystem", {
        get: function() {
          return this.view.getUint16(68, true);
        },
        set: function(val) {
          this.view.setUint16(68, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "dllCharacteristics", {
        get: function() {
          return this.view.getUint16(70, true);
        },
        set: function(val) {
          this.view.setUint16(70, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfStackReserve", {
        get: function() {
          return getUint64LE(this.view, 72);
        },
        set: function(val) {
          setUint64LE(this.view, 72, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfStackReserveBigInt", {
        get: function() {
          return getUint64LEBigInt(this.view, 72);
        },
        set: function(val) {
          setUint64LEBigInt(this.view, 72, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfStackCommit", {
        get: function() {
          return getUint64LE(this.view, 80);
        },
        set: function(val) {
          setUint64LE(this.view, 80, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfStackCommitBigInt", {
        get: function() {
          return getUint64LEBigInt(this.view, 80);
        },
        set: function(val) {
          setUint64LEBigInt(this.view, 80, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeapReserve", {
        get: function() {
          return getUint64LE(this.view, 88);
        },
        set: function(val) {
          setUint64LE(this.view, 88, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeapReserveBigInt", {
        get: function() {
          return getUint64LEBigInt(this.view, 88);
        },
        set: function(val) {
          setUint64LEBigInt(this.view, 88, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeapCommit", {
        get: function() {
          return getUint64LE(this.view, 96);
        },
        set: function(val) {
          setUint64LE(this.view, 96, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeapCommitBigInt", {
        get: function() {
          return getUint64LEBigInt(this.view, 96);
        },
        set: function(val) {
          setUint64LEBigInt(this.view, 96, val);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "loaderFlags", {
        get: function() {
          return this.view.getUint32(104, true);
        },
        set: function(val) {
          this.view.setUint32(104, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageOptionalHeader642.prototype, "numberOfRvaAndSizes", {
        get: function() {
          return this.view.getUint32(108, true);
        },
        set: function(val) {
          this.view.setUint32(108, val, true);
        },
        enumerable: false,
        configurable: true
      });
      ImageOptionalHeader642.size = 112;
      ImageOptionalHeader642.DEFAULT_MAGIC = 523;
      return ImageOptionalHeader642;
    }(FormatBase_default);
    ImageOptionalHeader64_default = ImageOptionalHeader64;
  }
});

// node_modules/pe-library/dist/format/ImageNtHeaders.js
var __extends7, ImageNtHeaders, ImageNtHeaders_default;
var init_ImageNtHeaders = __esm({
  "node_modules/pe-library/dist/format/ImageNtHeaders.js"() {
    init_functions();
    init_FormatBase();
    init_ImageDataDirectoryArray();
    init_ImageFileHeader();
    init_ImageOptionalHeader();
    init_ImageOptionalHeader64();
    __extends7 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    ImageNtHeaders = /** @class */
    function(_super) {
      __extends7(ImageNtHeaders2, _super);
      function ImageNtHeaders2(view) {
        return _super.call(this, view) || this;
      }
      ImageNtHeaders2.from = function(bin, offset) {
        if (offset === void 0) {
          offset = 0;
        }
        var magic = createDataView(bin, offset + ImageFileHeader_default.size, 6).getUint16(4, true);
        var len = 4 + ImageFileHeader_default.size + ImageDataDirectoryArray_default.size;
        if (magic === ImageOptionalHeader64_default.DEFAULT_MAGIC) {
          len += ImageOptionalHeader64_default.size;
        } else {
          len += ImageOptionalHeader_default.size;
        }
        return new ImageNtHeaders2(createDataView(bin, offset, len));
      };
      ImageNtHeaders2.prototype.isValid = function() {
        return this.signature === ImageNtHeaders2.DEFAULT_SIGNATURE;
      };
      ImageNtHeaders2.prototype.is32bit = function() {
        return this.view.getUint16(ImageFileHeader_default.size + 4, true) === ImageOptionalHeader_default.DEFAULT_MAGIC;
      };
      Object.defineProperty(ImageNtHeaders2.prototype, "signature", {
        get: function() {
          return this.view.getUint32(0, true);
        },
        set: function(val) {
          this.view.setUint32(0, val, true);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageNtHeaders2.prototype, "fileHeader", {
        get: function() {
          return ImageFileHeader_default.from(this.view.buffer, this.view.byteOffset + 4);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageNtHeaders2.prototype, "optionalHeader", {
        get: function() {
          var off = ImageFileHeader_default.size + 4;
          var magic = this.view.getUint16(off, true);
          if (magic === ImageOptionalHeader64_default.DEFAULT_MAGIC) {
            return ImageOptionalHeader64_default.from(this.view.buffer, this.view.byteOffset + off);
          } else {
            return ImageOptionalHeader_default.from(this.view.buffer, this.view.byteOffset + off);
          }
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ImageNtHeaders2.prototype, "optionalHeaderDataDirectory", {
        get: function() {
          return ImageDataDirectoryArray_default.from(this.view.buffer, this.view.byteOffset + this.getDataDirectoryOffset());
        },
        enumerable: false,
        configurable: true
      });
      ImageNtHeaders2.prototype.getDataDirectoryOffset = function() {
        var off = ImageFileHeader_default.size + 4;
        var magic = this.view.getUint16(off, true);
        if (magic === ImageOptionalHeader64_default.DEFAULT_MAGIC) {
          off += ImageOptionalHeader64_default.size;
        } else {
          off += ImageOptionalHeader_default.size;
        }
        return off;
      };
      ImageNtHeaders2.prototype.getSectionHeaderOffset = function() {
        return this.getDataDirectoryOffset() + ImageDataDirectoryArray_default.size;
      };
      ImageNtHeaders2.DEFAULT_SIGNATURE = 17744;
      return ImageNtHeaders2;
    }(FormatBase_default);
    ImageNtHeaders_default = ImageNtHeaders;
  }
});

// node_modules/pe-library/dist/format/ImageSectionHeaderArray.js
var __extends8, ImageSectionHeaderArray, ImageSectionHeaderArray_default;
var init_ImageSectionHeaderArray = __esm({
  "node_modules/pe-library/dist/format/ImageSectionHeaderArray.js"() {
    init_functions();
    init_ArrayFormatBase();
    __extends8 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    ImageSectionHeaderArray = /** @class */
    function(_super) {
      __extends8(ImageSectionHeaderArray2, _super);
      function ImageSectionHeaderArray2(view, length) {
        var _this = _super.call(this, view) || this;
        _this.length = length;
        return _this;
      }
      ImageSectionHeaderArray2.from = function(bin, length, offset) {
        if (offset === void 0) {
          offset = 0;
        }
        var size = length * 40;
        return new ImageSectionHeaderArray2(new DataView(bin, offset, size), length);
      };
      ImageSectionHeaderArray2.prototype.get = function(index) {
        return {
          name: getFixedString(this.view, index * 40, 8),
          virtualSize: this.view.getUint32(8 + index * 40, true),
          virtualAddress: this.view.getUint32(12 + index * 40, true),
          sizeOfRawData: this.view.getUint32(16 + index * 40, true),
          pointerToRawData: this.view.getUint32(20 + index * 40, true),
          pointerToRelocations: this.view.getUint32(24 + index * 40, true),
          pointerToLineNumbers: this.view.getUint32(28 + index * 40, true),
          numberOfRelocations: this.view.getUint16(32 + index * 40, true),
          numberOfLineNumbers: this.view.getUint16(34 + index * 40, true),
          characteristics: this.view.getUint32(36 + index * 40, true)
        };
      };
      ImageSectionHeaderArray2.prototype.set = function(index, data) {
        setFixedString(this.view, index * 40, 8, data.name);
        this.view.setUint32(8 + index * 40, data.virtualSize, true);
        this.view.setUint32(12 + index * 40, data.virtualAddress, true);
        this.view.setUint32(16 + index * 40, data.sizeOfRawData, true);
        this.view.setUint32(20 + index * 40, data.pointerToRawData, true);
        this.view.setUint32(24 + index * 40, data.pointerToRelocations, true);
        this.view.setUint32(28 + index * 40, data.pointerToLineNumbers, true);
        this.view.setUint16(32 + index * 40, data.numberOfRelocations, true);
        this.view.setUint16(34 + index * 40, data.numberOfLineNumbers, true);
        this.view.setUint32(36 + index * 40, data.characteristics, true);
      };
      ImageSectionHeaderArray2.itemSize = 40;
      return ImageSectionHeaderArray2;
    }(ArrayFormatBase_default);
    ImageSectionHeaderArray_default = ImageSectionHeaderArray;
  }
});

// node_modules/pe-library/dist/format/index.js
var format_exports = {};
__export(format_exports, {
  ArrayFormatBase: () => ArrayFormatBase_default,
  FormatBase: () => FormatBase_default,
  ImageDataDirectoryArray: () => ImageDataDirectoryArray_default,
  ImageDirectoryEntry: () => ImageDirectoryEntry_default,
  ImageDosHeader: () => ImageDosHeader_default,
  ImageFileHeader: () => ImageFileHeader_default,
  ImageNtHeaders: () => ImageNtHeaders_default,
  ImageOptionalHeader: () => ImageOptionalHeader_default,
  ImageOptionalHeader64: () => ImageOptionalHeader64_default,
  ImageSectionHeaderArray: () => ImageSectionHeaderArray_default,
  findImageSectionBlockByDirectoryEntry: () => findImageSectionBlockByDirectoryEntry,
  getImageDosHeader: () => getImageDosHeader,
  getImageNtHeadersByDosHeader: () => getImageNtHeadersByDosHeader,
  getImageSectionHeadersByNtHeaders: () => getImageSectionHeadersByNtHeaders
});
function getImageDosHeader(bin) {
  return ImageDosHeader_default.from(bin);
}
function getImageNtHeadersByDosHeader(bin, dosHeader) {
  return ImageNtHeaders_default.from(bin, dosHeader.newHeaderAddress);
}
function getImageSectionHeadersByNtHeaders(bin, dosHeader, ntHeaders) {
  return ImageSectionHeaderArray_default.from(bin, ntHeaders.fileHeader.numberOfSections, dosHeader.newHeaderAddress + ntHeaders.byteLength);
}
function findImageSectionBlockByDirectoryEntry(bin, dosHeader, ntHeaders, entryType) {
  var arr = ImageSectionHeaderArray_default.from(bin, ntHeaders.fileHeader.numberOfSections, dosHeader.newHeaderAddress + ntHeaders.byteLength);
  var len = arr.length;
  var rva = ntHeaders.optionalHeaderDataDirectory.get(entryType).virtualAddress;
  for (var i = 0; i < len; ++i) {
    var sec = arr.get(i);
    var vaEnd = sec.virtualAddress + sec.virtualSize;
    if (rva >= sec.virtualAddress && rva < vaEnd) {
      var ptr = sec.pointerToRawData;
      if (!ptr) {
        return null;
      }
      return bin.slice(ptr, ptr + sec.sizeOfRawData);
    }
    if (rva < sec.virtualAddress) {
      return null;
    }
  }
  return null;
}
var init_format = __esm({
  "node_modules/pe-library/dist/format/index.js"() {
    init_ArrayFormatBase();
    init_FormatBase();
    init_ImageDataDirectoryArray();
    init_ImageDirectoryEntry();
    init_ImageDosHeader();
    init_ImageFileHeader();
    init_ImageNtHeaders();
    init_ImageOptionalHeader();
    init_ImageOptionalHeader64();
    init_ImageSectionHeaderArray();
  }
});

// node_modules/pe-library/dist/util/generate.js
function fillDosStubData(bin) {
  var dos = ImageDosHeader_default.from(bin);
  dos.magic = ImageDosHeader_default.DEFAULT_MAGIC;
  dos.lastPageSize = DOS_STUB_SIZE % 512;
  dos.pages = Math.ceil(DOS_STUB_SIZE / 512);
  dos.relocations = 0;
  dos.headerSizeInParagraph = Math.ceil(ImageDosHeader_default.size / 16);
  dos.minAllocParagraphs = 0;
  dos.maxAllocParagraphs = 65535;
  dos.initialSS = 0;
  dos.initialSP = 128;
  dos.relocationTableAddress = ImageDosHeader_default.size;
  dos.newHeaderAddress = DOS_STUB_SIZE;
  copyBuffer(bin, ImageDosHeader_default.size, DOS_STUB_PROGRAM, 0, DOS_STUB_PROGRAM.length);
}
function estimateNewHeaderSize(is32Bit) {
  return (
    // magic
    4 + ImageFileHeader_default.size + (is32Bit ? ImageOptionalHeader_default.size : ImageOptionalHeader64_default.size) + ImageDataDirectoryArray_default.size
  );
}
function fillPeHeaderEmptyData(bin, offset, totalBinSize, is32Bit, isDLL) {
  var _bin;
  var _offset;
  if ("buffer" in bin) {
    _bin = bin.buffer;
    _offset = bin.byteOffset + offset;
  } else {
    _bin = bin;
    _offset = offset;
  }
  new DataView(_bin, _offset).setUint32(0, ImageNtHeaders_default.DEFAULT_SIGNATURE, true);
  var fh = ImageFileHeader_default.from(_bin, _offset + 4);
  fh.machine = is32Bit ? 332 : 34404;
  fh.numberOfSections = 0;
  fh.timeDateStamp = 0;
  fh.pointerToSymbolTable = 0;
  fh.numberOfSymbols = 0;
  fh.sizeOfOptionalHeader = (is32Bit ? ImageOptionalHeader_default.size : ImageOptionalHeader64_default.size) + ImageDataDirectoryArray_default.size;
  fh.characteristics = isDLL ? 8450 : 258;
  var oh = (is32Bit ? ImageOptionalHeader_default : ImageOptionalHeader64_default).from(_bin, _offset + 4 + ImageFileHeader_default.size);
  oh.magic = is32Bit ? ImageOptionalHeader_default.DEFAULT_MAGIC : ImageOptionalHeader64_default.DEFAULT_MAGIC;
  oh.sizeOfCode = 0;
  oh.sizeOfInitializedData = 0;
  oh.sizeOfUninitializedData = 0;
  oh.addressOfEntryPoint = 0;
  oh.baseOfCode = 4096;
  oh.imageBase = is32Bit ? 16777216 : 6442450944;
  oh.sectionAlignment = 4096;
  oh.fileAlignment = DEFAULT_FILE_ALIGNMENT;
  oh.majorOperatingSystemVersion = 6;
  oh.minorOperatingSystemVersion = 0;
  oh.majorSubsystemVersion = 6;
  oh.minorSubsystemVersion = 0;
  oh.sizeOfHeaders = roundUp(totalBinSize, oh.fileAlignment);
  oh.subsystem = 2;
  oh.dllCharacteristics = (is32Bit ? 0 : 32) + // IMAGE_DLL_CHARACTERISTICS_HIGH_ENTROPY_VA
  64 + // IMAGE_DLLCHARACTERISTICS_DYNAMIC_BASE
  256;
  oh.sizeOfStackReserve = 1048576;
  oh.sizeOfStackCommit = 4096;
  oh.sizeOfHeapReserve = 1048576;
  oh.sizeOfHeapCommit = 4096;
  oh.numberOfRvaAndSizes = ImageDataDirectoryArray_default.size / ImageDataDirectoryArray_default.itemSize;
}
function makeEmptyNtExecutableBinary(is32Bit, isDLL) {
  var bufferSize = roundUp(DOS_STUB_SIZE + estimateNewHeaderSize(is32Bit), DEFAULT_FILE_ALIGNMENT);
  var bin = new ArrayBuffer(bufferSize);
  fillDosStubData(bin);
  fillPeHeaderEmptyData(bin, DOS_STUB_SIZE, bufferSize, is32Bit, isDLL);
  return bin;
}
var DOS_STUB_PROGRAM, DOS_STUB_SIZE, DEFAULT_FILE_ALIGNMENT;
var init_generate = __esm({
  "node_modules/pe-library/dist/util/generate.js"() {
    init_ImageDataDirectoryArray();
    init_ImageDosHeader();
    init_ImageFileHeader();
    init_ImageNtHeaders();
    init_ImageOptionalHeader();
    init_ImageOptionalHeader64();
    init_functions();
    DOS_STUB_PROGRAM = new Uint8Array([
      14,
      31,
      186,
      14,
      0,
      180,
      9,
      205,
      33,
      184,
      1,
      76,
      205,
      33,
      68,
      79,
      83,
      32,
      109,
      111,
      100,
      101,
      32,
      110,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      46,
      13,
      13,
      10,
      36,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ]);
    DOS_STUB_SIZE = roundUp(ImageDosHeader_default.size + DOS_STUB_PROGRAM.length, 128);
    DEFAULT_FILE_ALIGNMENT = 512;
  }
});

// node_modules/pe-library/dist/NtExecutable.js
var NtExecutable, NtExecutable_default;
var init_NtExecutable = __esm({
  "node_modules/pe-library/dist/NtExecutable.js"() {
    init_ImageDataDirectoryArray();
    init_ImageDirectoryEntry();
    init_ImageDosHeader();
    init_ImageNtHeaders();
    init_ImageSectionHeaderArray();
    init_functions();
    init_generate();
    NtExecutable = /** @class */
    function() {
      function NtExecutable2(_headers, _sections, _ex) {
        this._headers = _headers;
        this._sections = _sections;
        this._ex = _ex;
        var dh = ImageDosHeader_default.from(_headers);
        var nh = ImageNtHeaders_default.from(_headers, dh.newHeaderAddress);
        this._dh = dh;
        this._nh = nh;
        this._dda = nh.optionalHeaderDataDirectory;
        _sections.sort(function(a, b) {
          var ra = a.info.pointerToRawData;
          var rb = a.info.pointerToRawData;
          if (ra !== rb) {
            return ra - rb;
          }
          var va = a.info.virtualAddress;
          var vb = b.info.virtualAddress;
          if (va === vb) {
            return a.info.virtualSize - b.info.virtualSize;
          }
          return va - vb;
        });
      }
      NtExecutable2.createEmpty = function(is32Bit, isDLL) {
        if (is32Bit === void 0) {
          is32Bit = false;
        }
        if (isDLL === void 0) {
          isDLL = true;
        }
        return this.from(makeEmptyNtExecutableBinary(is32Bit, isDLL));
      };
      NtExecutable2.from = function(bin, options) {
        var dh = ImageDosHeader_default.from(bin);
        var nh = ImageNtHeaders_default.from(bin, dh.newHeaderAddress);
        if (!dh.isValid() || !nh.isValid()) {
          throw new TypeError("Invalid binary format");
        }
        if (nh.fileHeader.numberOfSymbols > 0) {
          throw new Error("Binary with symbols is not supported now");
        }
        var fileAlignment = nh.optionalHeader.fileAlignment;
        var securityEntry = nh.optionalHeaderDataDirectory.get(ImageDirectoryEntry_default.Certificate);
        if (securityEntry.size > 0) {
          if (!(options === null || options === void 0 ? void 0 : options.ignoreCert)) {
            throw new Error("Parsing signed executable binary is not allowed by default.");
          }
        }
        var secOff = dh.newHeaderAddress + nh.getSectionHeaderOffset();
        var secCount = nh.fileHeader.numberOfSections;
        var sections = [];
        var tempSectionHeaderBinary = allocatePartialBinary(bin, secOff, secCount * ImageSectionHeaderArray_default.itemSize);
        var secArray = ImageSectionHeaderArray_default.from(tempSectionHeaderBinary, secCount, 0);
        var lastOffset = roundUp(secOff + secCount * ImageSectionHeaderArray_default.itemSize, fileAlignment);
        secArray.forEach(function(info) {
          if (!info.pointerToRawData || !info.sizeOfRawData) {
            info.pointerToRawData = 0;
            info.sizeOfRawData = 0;
            sections.push({
              info,
              data: null
            });
          } else {
            var secBin = allocatePartialBinary(bin, info.pointerToRawData, info.sizeOfRawData);
            sections.push({
              info,
              data: secBin
            });
            var secEndOffset = roundUp(info.pointerToRawData + info.sizeOfRawData, fileAlignment);
            if (secEndOffset > lastOffset) {
              lastOffset = secEndOffset;
            }
          }
        });
        var headers = allocatePartialBinary(bin, 0, secOff);
        var exData = null;
        var lastExDataOffset = bin.byteLength;
        if (securityEntry.size > 0) {
          lastExDataOffset = securityEntry.virtualAddress;
        }
        if (lastOffset < lastExDataOffset) {
          exData = allocatePartialBinary(bin, lastOffset, lastExDataOffset - lastOffset);
        }
        return new NtExecutable2(headers, sections, exData);
      };
      NtExecutable2.prototype.is32bit = function() {
        return this._nh.is32bit();
      };
      NtExecutable2.prototype.getTotalHeaderSize = function() {
        return this._headers.byteLength;
      };
      Object.defineProperty(NtExecutable2.prototype, "dosHeader", {
        get: function() {
          return this._dh;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(NtExecutable2.prototype, "newHeader", {
        get: function() {
          return this._nh;
        },
        enumerable: false,
        configurable: true
      });
      NtExecutable2.prototype.getRawHeader = function() {
        return this._headers;
      };
      NtExecutable2.prototype.getImageBase = function() {
        return this._nh.optionalHeader.imageBase;
      };
      NtExecutable2.prototype.getFileAlignment = function() {
        return this._nh.optionalHeader.fileAlignment;
      };
      NtExecutable2.prototype.getSectionAlignment = function() {
        return this._nh.optionalHeader.sectionAlignment;
      };
      NtExecutable2.prototype.getAllSections = function() {
        return this._sections;
      };
      NtExecutable2.prototype.getSectionByEntry = function(entry) {
        var dd = this._dda.get(entry);
        var r = this._sections.filter(function(sec) {
          var vaEnd = sec.info.virtualAddress + sec.info.virtualSize;
          return dd.virtualAddress >= sec.info.virtualAddress && dd.virtualAddress < vaEnd;
        }).shift();
        return r !== void 0 ? r : null;
      };
      NtExecutable2.prototype.setSectionByEntry = function(entry, section) {
        var sec = section ? { data: section.data, info: section.info } : null;
        var dd = this._dda.get(entry);
        var hasEntry = dd.size > 0;
        if (!sec) {
          if (!hasEntry) {
          } else {
            this._dda.set(entry, { size: 0, virtualAddress: 0 });
            var len = this._sections.length;
            for (var i = 0; i < len; ++i) {
              var sec_1 = this._sections[i];
              var vaStart = sec_1.info.virtualAddress;
              var vaLast = vaStart + sec_1.info.virtualSize;
              if (dd.virtualAddress >= vaStart && dd.virtualAddress < vaLast) {
                this._sections.splice(i, 1);
                this._nh.fileHeader.numberOfSections = this._sections.length;
                break;
              }
            }
          }
        } else {
          var rawSize = !sec.data ? 0 : sec.data.byteLength;
          var fileAlign = this._nh.optionalHeader.fileAlignment;
          var secAlign = this._nh.optionalHeader.sectionAlignment;
          var alignedFileSize = !sec.data ? 0 : roundUp(rawSize, fileAlign);
          var alignedSecSize = !sec.data ? 0 : roundUp(sec.info.virtualSize, secAlign);
          if (sec.info.sizeOfRawData < alignedFileSize) {
            sec.info.sizeOfRawData = alignedFileSize;
          } else {
            alignedFileSize = sec.info.sizeOfRawData;
          }
          if (!hasEntry) {
            var virtAddr_1 = 0;
            var rawAddr_1 = roundUp(this._headers.byteLength, fileAlign);
            this._sections.forEach(function(secExist) {
              if (secExist.info.pointerToRawData) {
                if (rawAddr_1 <= secExist.info.pointerToRawData) {
                  rawAddr_1 = secExist.info.pointerToRawData + secExist.info.sizeOfRawData;
                }
              }
              if (virtAddr_1 <= secExist.info.virtualAddress) {
                virtAddr_1 = secExist.info.virtualAddress + secExist.info.virtualSize;
              }
            });
            if (!alignedFileSize) {
              rawAddr_1 = 0;
            }
            if (!virtAddr_1) {
              virtAddr_1 = this.newHeader.optionalHeader.baseOfCode;
            }
            virtAddr_1 = roundUp(virtAddr_1, secAlign);
            sec.info.pointerToRawData = rawAddr_1;
            sec.info.virtualAddress = virtAddr_1;
            this._dda.set(entry, {
              size: rawSize,
              virtualAddress: virtAddr_1
            });
            this._sections.push(sec);
            this._nh.fileHeader.numberOfSections = this._sections.length;
            this._nh.optionalHeader.sizeOfImage = roundUp(virtAddr_1 + alignedSecSize, this._nh.optionalHeader.sectionAlignment);
          } else {
            this.replaceSectionImpl(dd.virtualAddress, sec.info, sec.data);
          }
        }
      };
      NtExecutable2.prototype.getExtraData = function() {
        return this._ex;
      };
      NtExecutable2.prototype.setExtraData = function(bin) {
        if (bin === null) {
          this._ex = null;
        } else {
          this._ex = cloneToArrayBuffer(bin);
        }
      };
      NtExecutable2.prototype.generate = function(paddingSize) {
        var dh = this._dh;
        var nh = this._nh;
        var secOff = dh.newHeaderAddress + nh.getSectionHeaderOffset();
        var size = secOff;
        size += this._sections.length * ImageSectionHeaderArray_default.itemSize;
        var align = nh.optionalHeader.fileAlignment;
        size = roundUp(size, align);
        this._sections.forEach(function(sec) {
          if (!sec.info.pointerToRawData) {
            return;
          }
          var lastOff = sec.info.pointerToRawData + sec.info.sizeOfRawData;
          if (size < lastOff) {
            size = lastOff;
            size = roundUp(size, align);
          }
        });
        var lastPosition = size;
        if (this._ex !== null) {
          size += this._ex.byteLength;
        }
        if (typeof paddingSize === "number") {
          size += paddingSize;
        }
        var bin = new ArrayBuffer(size);
        var u8bin = new Uint8Array(bin);
        u8bin.set(new Uint8Array(this._headers, 0, secOff));
        ImageDataDirectoryArray_default.from(bin, dh.newHeaderAddress + nh.getDataDirectoryOffset()).set(ImageDirectoryEntry_default.Certificate, {
          size: 0,
          virtualAddress: 0
        });
        var secArray = ImageSectionHeaderArray_default.from(bin, this._sections.length, secOff);
        this._sections.forEach(function(sec, i) {
          if (!sec.data) {
            sec.info.pointerToRawData = 0;
            sec.info.sizeOfRawData = 0;
          }
          secArray.set(i, sec.info);
          if (!sec.data || !sec.info.pointerToRawData) {
            return;
          }
          u8bin.set(new Uint8Array(sec.data), sec.info.pointerToRawData);
        });
        if (this._ex !== null) {
          u8bin.set(new Uint8Array(this._ex), lastPosition);
        }
        if (nh.optionalHeader.checkSum !== 0) {
          calculateCheckSumForPE(bin, true);
        }
        return bin;
      };
      NtExecutable2.prototype.rearrangeSections = function(rawAddressStart, rawDiff, virtualAddressStart, virtualDiff) {
        if (!rawDiff && !virtualDiff) {
          return;
        }
        var nh = this._nh;
        var secAlign = nh.optionalHeader.sectionAlignment;
        var dirs = this._dda;
        var len = this._sections.length;
        var lastVirtAddress = 0;
        for (var i = 0; i < len; ++i) {
          var sec = this._sections[i];
          var virtAddr = sec.info.virtualAddress;
          if (virtualDiff && virtAddr >= virtualAddressStart) {
            var iDir = dirs.findIndexByVirtualAddress(virtAddr);
            virtAddr += virtualDiff;
            if (iDir !== null) {
              dirs.set(iDir, {
                virtualAddress: virtAddr,
                size: sec.info.virtualSize
              });
            }
            sec.info.virtualAddress = virtAddr;
          }
          var fileAddr = sec.info.pointerToRawData;
          if (rawDiff && fileAddr >= rawAddressStart) {
            sec.info.pointerToRawData = fileAddr + rawDiff;
          }
          lastVirtAddress = roundUp(sec.info.virtualAddress + sec.info.virtualSize, secAlign);
        }
        nh.optionalHeader.sizeOfImage = lastVirtAddress;
      };
      NtExecutable2.prototype.replaceSectionImpl = function(virtualAddress, info, data) {
        var len = this._sections.length;
        for (var i = 0; i < len; ++i) {
          var s = this._sections[i];
          if (s.info.virtualAddress === virtualAddress) {
            var secAlign = this._nh.optionalHeader.sectionAlignment;
            var fileAddr = s.info.pointerToRawData;
            var oldFileAddr = fileAddr + s.info.sizeOfRawData;
            var oldVirtAddr = virtualAddress + roundUp(s.info.virtualSize, secAlign);
            s.info = cloneObject(info);
            s.info.virtualAddress = virtualAddress;
            s.info.pointerToRawData = fileAddr;
            s.data = data;
            var newFileAddr = fileAddr + info.sizeOfRawData;
            var newVirtAddr = virtualAddress + roundUp(info.virtualSize, secAlign);
            this.rearrangeSections(oldFileAddr, newFileAddr - oldFileAddr, oldVirtAddr, newVirtAddr - oldVirtAddr);
            {
              var dirs = this._dda;
              var iDir = dirs.findIndexByVirtualAddress(virtualAddress);
              if (iDir !== null) {
                dirs.set(iDir, {
                  virtualAddress,
                  size: info.virtualSize
                });
              }
            }
            break;
          }
        }
      };
      return NtExecutable2;
    }();
    NtExecutable_default = NtExecutable;
  }
});

// node_modules/pe-library/dist/NtExecutableResource.js
function removeDuplicates(a) {
  return a.reduce(function(p, c) {
    return p.indexOf(c) >= 0 ? p : p.concat(c);
  }, []);
}
function readString(view, offset) {
  var length = view.getUint16(offset, true);
  var r = "";
  offset += 2;
  for (var i = 0; i < length; ++i) {
    r += String.fromCharCode(view.getUint16(offset, true));
    offset += 2;
  }
  return r;
}
function readLanguageTable(view, typeEntry, name, languageTable, cb) {
  var off = languageTable;
  var nameEntry = {
    name,
    languageTable,
    characteristics: view.getUint32(off, true),
    dateTime: view.getUint32(off + 4, true),
    majorVersion: view.getUint16(off + 8, true),
    minorVersion: view.getUint16(off + 10, true)
  };
  var nameCount = view.getUint16(off + 12, true);
  var idCount = view.getUint16(off + 14, true);
  off += 16;
  for (var i = 0; i < nameCount; ++i) {
    var nameOffset = view.getUint32(off, true) & 2147483647;
    var dataOffset = view.getUint32(off + 4, true);
    if ((dataOffset & 2147483648) !== 0) {
      off += 8;
      continue;
    }
    var name_1 = readString(view, nameOffset);
    cb(typeEntry, nameEntry, { lang: name_1, dataOffset });
    off += 8;
  }
  for (var i = 0; i < idCount; ++i) {
    var id = view.getUint32(off, true) & 2147483647;
    var dataOffset = view.getUint32(off + 4, true);
    if ((dataOffset & 2147483648) !== 0) {
      off += 8;
      continue;
    }
    cb(typeEntry, nameEntry, { lang: id, dataOffset });
    off += 8;
  }
}
function readNameTable(view, type, nameTable, cb) {
  var off = nameTable;
  var typeEntry = {
    type,
    nameTable,
    characteristics: view.getUint32(off, true),
    dateTime: view.getUint32(off + 4, true),
    majorVersion: view.getUint16(off + 8, true),
    minorVersion: view.getUint16(off + 10, true)
  };
  var nameCount = view.getUint16(off + 12, true);
  var idCount = view.getUint16(off + 14, true);
  off += 16;
  for (var i = 0; i < nameCount; ++i) {
    var nameOffset = view.getUint32(off, true) & 2147483647;
    var nextTable = view.getUint32(off + 4, true);
    if (!(nextTable & 2147483648)) {
      off += 8;
      continue;
    }
    nextTable &= 2147483647;
    var name_2 = readString(view, nameOffset);
    readLanguageTable(view, typeEntry, name_2, nextTable, cb);
    off += 8;
  }
  for (var i = 0; i < idCount; ++i) {
    var id = view.getUint32(off, true) & 2147483647;
    var nextTable = view.getUint32(off + 4, true);
    if (!(nextTable & 2147483648)) {
      off += 8;
      continue;
    }
    nextTable &= 2147483647;
    readLanguageTable(view, typeEntry, id, nextTable, cb);
    off += 8;
  }
}
function divideEntriesImplByID(r, names, entries) {
  var entriesByString = {};
  var entriesByNumber = {};
  entries.forEach(function(e) {
    if (typeof e.lang === "string") {
      entriesByString[e.lang] = e;
      names.push(e.lang);
    } else {
      entriesByNumber[e.lang] = e;
    }
  });
  var strKeys = Object.keys(entriesByString);
  strKeys.sort().forEach(function(type) {
    r.s.push(entriesByString[type]);
  });
  var numKeys = Object.keys(entriesByNumber);
  numKeys.map(function(k) {
    return Number(k);
  }).sort(function(a, b) {
    return a - b;
  }).forEach(function(type) {
    r.n.push(entriesByNumber[type]);
  });
  return 16 + 8 * (strKeys.length + numKeys.length);
}
function divideEntriesImplByName(r, names, entries) {
  var entriesByString = {};
  var entriesByNumber = {};
  entries.forEach(function(e) {
    var _a, _b;
    if (typeof e.id === "string") {
      var a = (_a = entriesByString[e.id]) !== null && _a !== void 0 ? _a : entriesByString[e.id] = [];
      names.push(e.id);
      a.push(e);
    } else {
      var a = (_b = entriesByNumber[e.id]) !== null && _b !== void 0 ? _b : entriesByNumber[e.id] = [];
      a.push(e);
    }
  });
  var sSum = Object.keys(entriesByString).sort().map(function(id) {
    var o = {
      id,
      s: [],
      n: []
    };
    r.s.push(o);
    return divideEntriesImplByID(o, names, entriesByString[id]);
  }).reduce(function(p, c) {
    return p + 8 + c;
  }, 0);
  var nSum = Object.keys(entriesByNumber).map(function(k) {
    return Number(k);
  }).sort(function(a, b) {
    return a - b;
  }).map(function(id) {
    var o = {
      id,
      s: [],
      n: []
    };
    r.n.push(o);
    return divideEntriesImplByID(o, names, entriesByNumber[id]);
  }).reduce(function(p, c) {
    return p + 8 + c;
  }, 0);
  return 16 + sSum + nSum;
}
function divideEntriesImplByType(r, names, entries) {
  var entriesByString = {};
  var entriesByNumber = {};
  entries.forEach(function(e) {
    var _a, _b;
    if (typeof e.type === "string") {
      var a = (_a = entriesByString[e.type]) !== null && _a !== void 0 ? _a : entriesByString[e.type] = [];
      names.push(e.type);
      a.push(e);
    } else {
      var a = (_b = entriesByNumber[e.type]) !== null && _b !== void 0 ? _b : entriesByNumber[e.type] = [];
      a.push(e);
    }
  });
  var sSum = Object.keys(entriesByString).sort().map(function(type) {
    var o = { type, s: [], n: [] };
    r.s.push(o);
    return divideEntriesImplByName(o, names, entriesByString[type]);
  }).reduce(function(p, c) {
    return p + 8 + c;
  }, 0);
  var nSum = Object.keys(entriesByNumber).map(function(k) {
    return Number(k);
  }).sort(function(a, b) {
    return a - b;
  }).map(function(type) {
    var o = { type, s: [], n: [] };
    r.n.push(o);
    return divideEntriesImplByName(o, names, entriesByNumber[type]);
  }).reduce(function(p, c) {
    return p + 8 + c;
  }, 0);
  return 16 + sSum + nSum;
}
function calculateStringLengthForWrite(text) {
  var length = text.length;
  return length > 65535 ? 65535 : length;
}
function getStringOffset(target, strings) {
  var l = strings.length;
  for (var i = 0; i < l; ++i) {
    var s = strings[i];
    if (s.text === target) {
      return s.offset;
    }
  }
  throw new Error("Unexpected");
}
function writeString(view, offset, text) {
  var length = calculateStringLengthForWrite(text);
  view.setUint16(offset, length, true);
  offset += 2;
  for (var i = 0; i < length; ++i) {
    view.setUint16(offset, text.charCodeAt(i), true);
    offset += 2;
  }
  return offset;
}
function writeLanguageTable(view, offset, strings, data) {
  view.setUint32(offset, 0, true);
  view.setUint32(offset + 4, 0, true);
  view.setUint32(offset + 8, 0, true);
  view.setUint16(offset + 12, data.s.length, true);
  view.setUint16(offset + 14, data.n.length, true);
  offset += 16;
  data.s.forEach(function(e) {
    var strOff = getStringOffset(e.lang, strings);
    view.setUint32(offset, strOff, true);
    view.setUint32(offset + 4, e.offset, true);
    offset += 8;
  });
  data.n.forEach(function(e) {
    view.setUint32(offset, e.lang, true);
    view.setUint32(offset + 4, e.offset, true);
    offset += 8;
  });
  return offset;
}
function writeNameTable(view, offset, leafOffset, strings, data) {
  view.setUint32(offset, 0, true);
  view.setUint32(offset + 4, 0, true);
  view.setUint32(offset + 8, 0, true);
  view.setUint16(offset + 12, data.s.length, true);
  view.setUint16(offset + 14, data.n.length, true);
  offset += 16;
  data.s.forEach(function(e) {
    e.offset = leafOffset;
    leafOffset = writeLanguageTable(view, leafOffset, strings, e);
  });
  data.n.forEach(function(e) {
    e.offset = leafOffset;
    leafOffset = writeLanguageTable(view, leafOffset, strings, e);
  });
  data.s.forEach(function(e) {
    var strOff = getStringOffset(e.id, strings);
    view.setUint32(offset, strOff + 2147483648, true);
    view.setUint32(offset + 4, e.offset + 2147483648, true);
    offset += 8;
  });
  data.n.forEach(function(e) {
    view.setUint32(offset, e.id, true);
    view.setUint32(offset + 4, e.offset + 2147483648, true);
    offset += 8;
  });
  return leafOffset;
}
function writeTypeTable(view, offset, strings, data) {
  view.setUint32(offset, 0, true);
  view.setUint32(offset + 4, 0, true);
  view.setUint32(offset + 8, 0, true);
  view.setUint16(offset + 12, data.s.length, true);
  view.setUint16(offset + 14, data.n.length, true);
  offset += 16;
  var nextTableOffset = offset + 8 * (data.s.length + data.n.length);
  data.s.forEach(function(e) {
    e.offset = nextTableOffset;
    nextTableOffset += 16 + 8 * (e.s.length + e.n.length);
  });
  data.n.forEach(function(e) {
    e.offset = nextTableOffset;
    nextTableOffset += 16 + 8 * (e.s.length + e.n.length);
  });
  data.s.forEach(function(e) {
    var strOff = getStringOffset(e.type, strings);
    view.setUint32(offset, strOff + 2147483648, true);
    view.setUint32(offset + 4, e.offset + 2147483648, true);
    offset += 8;
    nextTableOffset = writeNameTable(view, e.offset, nextTableOffset, strings, e);
  });
  data.n.forEach(function(e) {
    view.setUint32(offset, e.type, true);
    view.setUint32(offset + 4, e.offset + 2147483648, true);
    offset += 8;
    nextTableOffset = writeNameTable(view, e.offset, nextTableOffset, strings, e);
  });
  return nextTableOffset;
}
var NtExecutableResource, NtExecutableResource_default;
var init_NtExecutableResource = __esm({
  "node_modules/pe-library/dist/NtExecutableResource.js"() {
    init_ImageDirectoryEntry();
    init_functions();
    NtExecutableResource = /** @class */
    function() {
      function NtExecutableResource2() {
        this.dateTime = 0;
        this.majorVersion = 0;
        this.minorVersion = 0;
        this.entries = [];
        this.sectionDataHeader = null;
        this.originalSize = 0;
      }
      NtExecutableResource2.prototype.parse = function(section, ignoreUnparsableData) {
        if (!section.data) {
          return;
        }
        var view = new DataView(section.data);
        this.dateTime = view.getUint32(4, true);
        this.majorVersion = view.getUint16(8, true);
        this.minorVersion = view.getUint16(10, true);
        var nameCount = view.getUint16(12, true);
        var idCount = view.getUint16(14, true);
        var off = 16;
        var res = [];
        var cb = function(t, n, l) {
          var off2 = view.getUint32(l.dataOffset, true) - section.info.virtualAddress;
          var size = view.getUint32(l.dataOffset + 4, true);
          var cp = view.getUint32(l.dataOffset + 8, true);
          if (off2 >= 0) {
            var bin = new Uint8Array(size);
            bin.set(new Uint8Array(section.data, off2, size));
            res.push({
              type: t.type,
              id: n.name,
              lang: l.lang,
              codepage: cp,
              bin: bin.buffer
            });
          } else {
            if (!ignoreUnparsableData) {
              throw new Error("Cannot parse resource directory entry; RVA seems to be invalid.");
            }
            res.push({
              type: t.type,
              id: n.name,
              lang: l.lang,
              codepage: cp,
              bin: new ArrayBuffer(0),
              rva: l.dataOffset
            });
          }
        };
        for (var i = 0; i < nameCount; ++i) {
          var nameOffset = view.getUint32(off, true) & 2147483647;
          var nextTable = view.getUint32(off + 4, true);
          if (!(nextTable & 2147483648)) {
            off += 8;
            continue;
          }
          nextTable &= 2147483647;
          var name_3 = readString(view, nameOffset);
          readNameTable(view, name_3, nextTable, cb);
          off += 8;
        }
        for (var i = 0; i < idCount; ++i) {
          var typeId = view.getUint32(off, true) & 2147483647;
          var nextTable = view.getUint32(off + 4, true);
          if (!(nextTable & 2147483648)) {
            off += 8;
            continue;
          }
          nextTable &= 2147483647;
          readNameTable(view, typeId, nextTable, cb);
          off += 8;
        }
        this.entries = res;
        this.originalSize = section.data.byteLength;
      };
      NtExecutableResource2.from = function(exe, ignoreUnparsableData) {
        if (ignoreUnparsableData === void 0) {
          ignoreUnparsableData = false;
        }
        var secs = [].concat(exe.getAllSections()).sort(function(a, b) {
          return a.info.virtualAddress - b.info.virtualAddress;
        });
        var entry = exe.getSectionByEntry(ImageDirectoryEntry_default.Resource);
        if (entry) {
          var reloc = exe.getSectionByEntry(ImageDirectoryEntry_default.BaseRelocation);
          for (var i = 0; i < secs.length; ++i) {
            var s = secs[i];
            if (s === entry) {
              for (var j = i + 1; j < secs.length; ++j) {
                if (!reloc || secs[j] !== reloc) {
                  throw new Error("After Resource section, sections except for relocation are not supported");
                }
              }
              break;
            }
          }
        }
        var r = new NtExecutableResource2();
        r.sectionDataHeader = entry ? cloneObject(entry.info) : null;
        if (entry) {
          r.parse(entry, ignoreUnparsableData);
        }
        return r;
      };
      NtExecutableResource2.prototype.replaceResourceEntry = function(entry) {
        for (var len = this.entries.length, i = 0; i < len; ++i) {
          var e = this.entries[i];
          if (e.type === entry.type && e.id === entry.id && e.lang === entry.lang) {
            this.entries[i] = entry;
            return;
          }
        }
        this.entries.push(entry);
      };
      NtExecutableResource2.prototype.getResourceEntriesAsString = function(type, id) {
        return this.entries.filter(function(entry) {
          return entry.type === type && entry.id === id;
        }).map(function(entry) {
          return [entry.lang, binaryToString(entry.bin)];
        });
      };
      NtExecutableResource2.prototype.replaceResourceEntryFromString = function(type, id, lang, value) {
        var entry = {
          type,
          id,
          lang,
          codepage: 1200,
          bin: stringToBinary(value)
        };
        this.replaceResourceEntry(entry);
      };
      NtExecutableResource2.prototype.removeResourceEntry = function(type, id, lang) {
        this.entries = this.entries.filter(function(entry) {
          return !(entry.type === type && entry.id === id && (typeof lang === "undefined" || entry.lang === lang));
        });
      };
      NtExecutableResource2.prototype.generateResourceData = function(virtualAddress, alignment, noGrow, allowShrink) {
        if (noGrow === void 0) {
          noGrow = false;
        }
        if (allowShrink === void 0) {
          allowShrink = false;
        }
        var r = {
          s: [],
          n: []
        };
        var strings = [];
        var size = divideEntriesImplByType(r, strings, this.entries);
        strings = removeDuplicates(strings);
        var stringsOffset = size;
        size += strings.reduce(function(prev, cur) {
          return prev + 2 + calculateStringLengthForWrite(cur) * 2;
        }, 0);
        size = roundUp(size, 8);
        var descOffset = size;
        size = this.entries.reduce(function(p, e) {
          e.offset = p;
          return p + 16;
        }, descOffset);
        var dataOffset = size;
        size = this.entries.reduce(function(p, e) {
          return roundUp(p, 8) + e.bin.byteLength;
        }, dataOffset);
        var alignedSize = roundUp(size, alignment);
        var originalAlignedSize = roundUp(this.originalSize, alignment);
        if (noGrow) {
          if (alignedSize > originalAlignedSize) {
            throw new Error("New resource data is larger than original");
          }
        }
        if (!allowShrink) {
          if (alignedSize < originalAlignedSize) {
            alignedSize = originalAlignedSize;
          }
        }
        var bin = new ArrayBuffer(alignedSize);
        var view = new DataView(bin);
        var o = descOffset;
        var va = virtualAddress + dataOffset;
        this.entries.forEach(function(e) {
          var len = e.bin.byteLength;
          if (typeof e.rva !== "undefined") {
            view.setUint32(o, e.rva, true);
          } else {
            va = roundUp(va, 8);
            view.setUint32(o, va, true);
            va += len;
          }
          view.setUint32(o + 4, len, true);
          view.setUint32(o + 8, e.codepage, true);
          view.setUint32(o + 12, 0, true);
          o += 16;
        });
        o = dataOffset;
        this.entries.forEach(function(e) {
          var len = e.bin.byteLength;
          copyBuffer(bin, o, e.bin, 0, len);
          o += roundUp(len, 8);
        });
        var stringsData = [];
        o = stringsOffset;
        strings.forEach(function(s) {
          stringsData.push({
            offset: o,
            text: s
          });
          o = writeString(view, o, s);
        });
        writeTypeTable(view, 0, stringsData, r);
        if (alignedSize > size) {
          var pad = "PADDINGX";
          for (var i = size, j = 0; i < alignedSize; ++i, ++j) {
            if (j === 8) {
              j = 0;
            }
            view.setUint8(i, pad.charCodeAt(j));
          }
        }
        return {
          bin,
          rawSize: size,
          dataOffset,
          descEntryOffset: descOffset,
          descEntryCount: this.entries.length
        };
      };
      NtExecutableResource2.prototype.outputResource = function(exeDest, noGrow, allowShrink) {
        if (noGrow === void 0) {
          noGrow = false;
        }
        if (allowShrink === void 0) {
          allowShrink = false;
        }
        var fileAlign = exeDest.getFileAlignment();
        var sectionData;
        if (this.sectionDataHeader) {
          sectionData = {
            data: null,
            info: cloneObject(this.sectionDataHeader)
          };
        } else {
          sectionData = {
            data: null,
            info: {
              name: ".rsrc",
              virtualSize: 0,
              virtualAddress: 0,
              sizeOfRawData: 0,
              pointerToRawData: 0,
              pointerToRelocations: 0,
              pointerToLineNumbers: 0,
              numberOfRelocations: 0,
              numberOfLineNumbers: 0,
              characteristics: 1073741888
              // read access and initialized data
            }
          };
        }
        var data = this.generateResourceData(0, fileAlign, noGrow, allowShrink);
        sectionData.data = data.bin;
        sectionData.info.sizeOfRawData = data.bin.byteLength;
        sectionData.info.virtualSize = data.rawSize;
        exeDest.setSectionByEntry(ImageDirectoryEntry_default.Resource, sectionData);
        var generatedSection = exeDest.getSectionByEntry(ImageDirectoryEntry_default.Resource);
        var view = new DataView(generatedSection.data);
        var o = data.descEntryOffset;
        var va = generatedSection.info.virtualAddress + data.dataOffset;
        for (var i = 0; i < data.descEntryCount; ++i) {
          var len = view.getUint32(o + 4, true);
          va = roundUp(va, 8);
          view.setUint32(o, va, true);
          va += len;
          o += 16;
        }
      };
      return NtExecutableResource2;
    }();
    NtExecutableResource_default = NtExecutableResource;
  }
});

// node_modules/pe-library/dist/version.js
var init_version = __esm({
  "node_modules/pe-library/dist/version.js"() {
  }
});

// node_modules/pe-library/dist/index.js
var init_dist = __esm({
  "node_modules/pe-library/dist/index.js"() {
    init_format();
    init_NtExecutable();
    init_NtExecutableResource();
    init_functions();
    init_version();
  }
});

// node_modules/resedit/dist/util/functions.js
function cloneObject2(object) {
  var r = {};
  Object.keys(object).forEach(function(key) {
    r[key] = object[key];
  });
  return r;
}
function createDataView2(bin, byteOffset, byteLength) {
  if ("buffer" in bin) {
    var newOffset = bin.byteOffset;
    var newLength = bin.byteLength;
    if (typeof byteOffset !== "undefined") {
      newOffset += byteOffset;
      newLength -= byteOffset;
    }
    if (typeof byteLength !== "undefined") {
      newLength = byteLength;
    }
    return new DataView(bin.buffer, newOffset, newLength);
  } else {
    return new DataView(bin, byteOffset, byteLength);
  }
}
function roundUp2(val, align) {
  return Math.floor((val + align - 1) / align) * align;
}
function copyBuffer2(dest, destOffset, src, srcOffset, length) {
  var ua8Dest = "buffer" in dest ? new Uint8Array(dest.buffer, dest.byteOffset + (destOffset || 0), length) : new Uint8Array(dest, destOffset, length);
  var ua8Src = "buffer" in src ? new Uint8Array(src.buffer, src.byteOffset + (srcOffset || 0), length) : new Uint8Array(src, srcOffset, length);
  ua8Dest.set(ua8Src);
}
function allocatePartialBinary2(binBase, offset, length) {
  var b = new ArrayBuffer(length);
  copyBuffer2(b, 0, binBase, offset, length);
  return b;
}
function cloneToArrayBuffer2(binBase) {
  if ("buffer" in binBase) {
    var b = new ArrayBuffer(binBase.byteLength);
    new Uint8Array(b).set(new Uint8Array(binBase.buffer, binBase.byteOffset, binBase.byteLength));
    return b;
  } else {
    var b = new ArrayBuffer(binBase.byteLength);
    new Uint8Array(b).set(new Uint8Array(binBase));
    return b;
  }
}
function readInt32WithLastOffset(view, offset, last) {
  return offset + 4 <= last ? view.getInt32(offset, true) : 0;
}
function readUint8WithLastOffset(view, offset, last) {
  return offset < last ? view.getUint8(offset) : 0;
}
function readUint16WithLastOffset(view, offset, last) {
  return offset + 2 <= last ? view.getUint16(offset, true) : 0;
}
function readUint32WithLastOffset(view, offset, last) {
  return offset + 4 <= last ? view.getUint32(offset, true) : 0;
}
var init_functions2 = __esm({
  "node_modules/resedit/dist/util/functions.js"() {
  }
});

// node_modules/resedit/dist/data/IconItem.js
function calcMaskSize(width, height) {
  var actualWidthBytes = roundUp2(Math.abs(width), 32) / 8;
  return actualWidthBytes * Math.abs(height);
}
var IconItem, IconItem_default;
var init_IconItem = __esm({
  "node_modules/resedit/dist/data/IconItem.js"() {
    init_functions2();
    IconItem = /** @class */
    function() {
      function IconItem2(width, height, bin, byteOffset, byteLength) {
        var view = createDataView2(bin, byteOffset, byteLength);
        var totalSize = view.byteLength;
        var headerSize = view.getUint32(0, true);
        if (headerSize > totalSize) {
          headerSize = totalSize;
        }
        var sizeImage = readUint32WithLastOffset(view, 20, headerSize);
        var bi = {
          width: readInt32WithLastOffset(view, 4, headerSize),
          height: readInt32WithLastOffset(view, 8, headerSize),
          planes: readUint16WithLastOffset(view, 12, headerSize),
          bitCount: readUint16WithLastOffset(view, 14, headerSize),
          compression: readUint32WithLastOffset(view, 16, headerSize),
          sizeImage,
          xPelsPerMeter: readInt32WithLastOffset(view, 24, headerSize),
          yPelsPerMeter: readInt32WithLastOffset(view, 28, headerSize),
          colorUsed: readUint32WithLastOffset(view, 32, headerSize),
          colorImportant: readUint32WithLastOffset(view, 36, headerSize),
          colors: []
        };
        var offset = 40;
        var colors = bi.colorUsed;
        if (!colors) {
          switch (bi.bitCount) {
            case 1:
              colors = 2;
              break;
            case 4:
              colors = 16;
              break;
            case 8:
              colors = 256;
              break;
          }
        }
        for (var i = 0; i < colors; ++i) {
          bi.colors.push({
            b: readUint8WithLastOffset(view, offset, totalSize),
            g: readUint8WithLastOffset(view, offset + 1, totalSize),
            r: readUint8WithLastOffset(view, offset + 2, totalSize)
          });
          offset += 4;
        }
        this.width = width;
        this.height = height;
        this.bitmapInfo = bi;
        var widthBytes = roundUp2(bi.bitCount * Math.abs(bi.width), 32) / 8;
        var absActualHeight = Math.abs(bi.height) / 2;
        var size = bi.compression !== 0 && sizeImage !== 0 ? sizeImage : widthBytes * absActualHeight;
        if (size + offset > totalSize) {
          throw new Error("Unexpected bitmap data in icon: bitmap size ".concat(size, " is larger than ").concat(totalSize, " - ").concat(offset));
        }
        this._pixels = allocatePartialBinary2(view, offset, size);
        offset += size;
        var maskSize = calcMaskSize(bi.width, absActualHeight);
        if (maskSize + offset <= totalSize) {
          this.masks = allocatePartialBinary2(view, offset, maskSize);
        } else {
          this.masks = new ArrayBuffer(maskSize);
        }
      }
      Object.defineProperty(IconItem2.prototype, "pixels", {
        /**
         * Bitmap pixel data.
         * @note
         * On set, if `bitmapInfo.sizeImage` is non-zero, `bitmapInfo.sizeImage` will be updated.
         */
        get: function() {
          return this._pixels;
        },
        /**
         * Bitmap pixel data.
         * @note
         * On set, if `bitmapInfo.sizeImage` is non-zero, `bitmapInfo.sizeImage` will be updated.
         */
        set: function(newValue) {
          this._pixels = newValue;
          if (this.bitmapInfo.sizeImage !== 0) {
            this.bitmapInfo.sizeImage = newValue.byteLength;
          }
        },
        enumerable: false,
        configurable: true
      });
      IconItem2.from = function(arg1, arg2, arg3, byteOffset, byteLength) {
        var width;
        var height;
        var bin;
        if (typeof arg3 === "object") {
          width = arg1;
          height = arg2;
          bin = arg3;
        } else {
          width = null;
          height = null;
          bin = arg1;
          byteOffset = arg2;
          byteLength = arg3;
        }
        return new IconItem2(width, height, bin, byteOffset, byteLength);
      };
      IconItem2.prototype.isIcon = function() {
        return true;
      };
      IconItem2.prototype.isRaw = function() {
        return false;
      };
      IconItem2.prototype.generate = function() {
        var bi = this.bitmapInfo;
        var absWidth = Math.abs(bi.width);
        var absWidthBytes = roundUp2(bi.bitCount * absWidth, 32) / 8;
        var absActualHeight = Math.abs(bi.height) / 2;
        var actualSizeImage = absWidthBytes * absActualHeight;
        var sizeMask = calcMaskSize(bi.width, absActualHeight);
        var colorCount = bi.colors.length;
        var totalSize = 40 + 4 * colorCount + actualSizeImage + sizeMask;
        var bin = new ArrayBuffer(totalSize);
        var view = new DataView(bin);
        view.setUint32(0, 40, true);
        view.setInt32(4, bi.width, true);
        view.setInt32(8, bi.height, true);
        view.setUint16(12, bi.planes, true);
        view.setUint16(14, bi.bitCount, true);
        view.setUint32(16, bi.compression, true);
        view.setUint32(20, bi.sizeImage, true);
        view.setInt32(24, bi.xPelsPerMeter, true);
        view.setInt32(28, bi.yPelsPerMeter, true);
        view.setUint32(32, bi.colorUsed, true);
        view.setUint32(36, bi.colorImportant > colorCount ? colorCount : bi.colorImportant, true);
        var offset = 40;
        bi.colors.forEach(function(c) {
          view.setUint8(offset, c.b);
          view.setUint8(offset + 1, c.g);
          view.setUint8(offset + 2, c.r);
          offset += 4;
        });
        copyBuffer2(bin, offset, this.pixels, 0, actualSizeImage);
        copyBuffer2(bin, offset + actualSizeImage, this.masks, 0, sizeMask);
        return bin;
      };
      return IconItem2;
    }();
    IconItem_default = IconItem;
  }
});

// node_modules/resedit/dist/data/RawIconItem.js
var RawIconItem, RawIconItem_default;
var init_RawIconItem = __esm({
  "node_modules/resedit/dist/data/RawIconItem.js"() {
    init_functions2();
    RawIconItem = /** @class */
    function() {
      function RawIconItem2(bin, width, height, bitCount, byteOffset, byteLength) {
        this.width = width;
        this.height = height;
        this.bitCount = bitCount;
        if (typeof byteOffset !== "number") {
          byteOffset = 0;
          byteLength = bin.byteLength;
        } else if (typeof byteLength !== "number") {
          byteLength = bin.byteLength - byteOffset;
        }
        this.bin = allocatePartialBinary2(bin, byteOffset, byteLength);
      }
      RawIconItem2.from = function(bin, width, height, bitCount, byteOffset, byteLength) {
        return new RawIconItem2(bin, width, height, bitCount, byteOffset, byteLength);
      };
      RawIconItem2.prototype.isIcon = function() {
        return false;
      };
      RawIconItem2.prototype.isRaw = function() {
        return true;
      };
      return RawIconItem2;
    }();
    RawIconItem_default = RawIconItem;
  }
});

// node_modules/resedit/dist/data/IconFile.js
function generateEntryBinary(icons) {
  var count = icons.length;
  if (count > 65535) {
    count = 65535;
  }
  var tmpIcons = icons.map(function(item) {
    if (item.data.isIcon()) {
      return {
        item,
        bin: item.data.generate(),
        offset: 0
      };
    } else {
      return {
        item,
        bin: item.data.bin,
        offset: 0
      };
    }
  });
  var size = tmpIcons.reduce(function(p, icon) {
    icon.offset = p;
    return p + icon.bin.byteLength;
  }, 6 + 16 * count);
  var bin = new ArrayBuffer(size);
  var view = new DataView(bin);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, count, true);
  var offset = 6;
  tmpIcons.forEach(function(icon) {
    var item = icon.item;
    var width;
    var height;
    var colors;
    var planes;
    var bitCount;
    if (item.data.isIcon()) {
      var bi = item.data.bitmapInfo;
      width = typeof item.width !== "undefined" ? item.width : Math.abs(bi.width);
      height = typeof item.height !== "undefined" ? item.height : Math.abs(bi.height / 2);
      colors = typeof item.colors !== "undefined" ? item.colors : bi.colorUsed || bi.colors.length;
      planes = typeof item.planes !== "undefined" ? item.planes : bi.planes;
      bitCount = typeof item.bitCount !== "undefined" ? item.bitCount : bi.bitCount;
    } else {
      width = typeof item.width !== "undefined" ? item.width : Math.abs(item.data.width);
      height = typeof item.height !== "undefined" ? item.height : Math.abs(item.data.height);
      colors = typeof item.colors !== "undefined" ? item.colors : 0;
      planes = typeof item.planes !== "undefined" ? item.planes : 1;
      bitCount = typeof item.bitCount !== "undefined" ? item.bitCount : item.data.bitCount;
    }
    var dataSize = icon.bin.byteLength;
    view.setUint8(offset, width >= 256 ? 0 : width);
    view.setUint8(offset + 1, height >= 256 ? 0 : height);
    view.setUint8(offset + 2, colors >= 256 ? 0 : colors);
    view.setUint8(offset + 3, 0);
    view.setUint16(offset + 4, planes, true);
    view.setUint16(offset + 6, bitCount, true);
    view.setUint32(offset + 8, dataSize, true);
    view.setUint32(offset + 12, icon.offset, true);
    offset += 16;
    copyBuffer2(bin, icon.offset, icon.bin, 0, dataSize);
  });
  return bin;
}
var IconFile, IconFile_default;
var init_IconFile = __esm({
  "node_modules/resedit/dist/data/IconFile.js"() {
    init_functions2();
    init_IconItem();
    init_RawIconItem();
    IconFile = /** @class */
    function() {
      function IconFile2(bin) {
        if (!bin) {
          this.icons = [];
          return;
        }
        var view = createDataView2(bin);
        var totalSize = view.byteLength;
        var icons = [];
        if (view.getUint16(2, true) === 1) {
          var count = view.getUint16(4, true);
          var offset = 6;
          for (var i = 0; i < count; ++i) {
            var dataSize = readUint32WithLastOffset(view, offset + 8, totalSize);
            var dataOffset = readUint32WithLastOffset(view, offset + 12, totalSize);
            var width = readUint8WithLastOffset(view, offset, totalSize);
            var height = readUint8WithLastOffset(view, offset + 1, totalSize);
            var bitCount = readUint8WithLastOffset(view, offset + 6, totalSize);
            var data = void 0;
            if (view.getUint32(dataOffset, true) === 40) {
              data = IconItem_default.from(width, height, bin, dataOffset, dataSize);
            } else {
              data = RawIconItem_default.from(bin, width || 256, height || 256, bitCount, dataOffset, dataSize);
            }
            icons.push({
              width,
              height,
              colors: readUint8WithLastOffset(view, offset + 2, totalSize),
              planes: readUint16WithLastOffset(view, offset + 4, totalSize),
              bitCount,
              data
            });
            offset += 16;
          }
        }
        this.icons = icons;
      }
      IconFile2.from = function(bin) {
        return new IconFile2(bin);
      };
      IconFile2.prototype.generate = function() {
        return generateEntryBinary(this.icons);
      };
      return IconFile2;
    }();
    IconFile_default = IconFile;
  }
});

// node_modules/resedit/dist/data/index.js
var data_exports = {};
__export(data_exports, {
  IconFile: () => IconFile_default,
  IconItem: () => IconItem_default,
  RawIconItem: () => RawIconItem_default
});
var init_data = __esm({
  "node_modules/resedit/dist/data/index.js"() {
    init_IconFile();
    init_IconItem();
    init_RawIconItem();
  }
});

// node_modules/resedit/dist/mui/MuiResourceInfo.js
function isValidMuiResourceEntry(resourceEntry) {
  var view = new DataView(resourceEntry.bin);
  if (view.getUint32(0, true) !== 4274912973) {
    return false;
  }
  var len = view.getUint32(4, true);
  if (len !== resourceEntry.bin.byteLength) {
    return false;
  }
  var version = view.getUint32(8, true);
  if (version !== 65536) {
    return false;
  }
  var fileType = view.getUint32(16, true);
  if ((fileType & 15) !== 1 && (fileType & 15) !== 2) {
    return false;
  }
  return true;
}
function parseMuiResourceData(resourceEntry) {
  var view = new DataView(resourceEntry.bin);
  var len = view.getUint32(4, true);
  var fileTypeNum = readUint32WithLastOffset(view, 16, len) & 240;
  var fileType = fileTypeNum === 16 ? "system" : "application";
  var isLn = (fileTypeNum & 15) !== 2;
  var systemAttributes = readUint32WithLastOffset(view, 20, len);
  var ultimateFallbackLocationNum = readUint32WithLastOffset(view, 24, len);
  var ultimateFallbackLocation = ultimateFallbackLocationNum === 2 ? "external" : "internal";
  var checksumMain = new Uint8Array(allocatePartialBinary2(resourceEntry.bin, 28, 16));
  var checksumService = new Uint8Array(allocatePartialBinary2(resourceEntry.bin, 44, 16));
  var mainNameTypesOffset = readUint32WithLastOffset(view, 84, len);
  var mainNameTypesLength = readUint32WithLastOffset(view, 88, len);
  var mainIDTypesOffset = readUint32WithLastOffset(view, 92, len);
  var mainIDTypesLength = readUint32WithLastOffset(view, 96, len);
  var muiNameTypesOffset = readUint32WithLastOffset(view, 100, len);
  var muiNameTypesLength = readUint32WithLastOffset(view, 104, len);
  var muiIDTypesOffset = readUint32WithLastOffset(view, 108, len);
  var muiIDTypesLength = readUint32WithLastOffset(view, 112, len);
  var languageOffset = readUint32WithLastOffset(view, 116, len);
  var languageLength = readUint32WithLastOffset(view, 120, len);
  var ultimateFallbackLanguageOffset = readUint32WithLastOffset(view, 124, len);
  var ultimateFallbackLanguageLength = readUint32WithLastOffset(view, 128, len);
  var o;
  var e;
  var s = "";
  var mainTypes = [];
  for (o = mainNameTypesOffset, e = mainNameTypesOffset + mainNameTypesLength; o < e; o += 2) {
    var char = readUint16WithLastOffset(view, o, len);
    if (char === 0) {
      if (o > mainNameTypesOffset && s === "") {
        break;
      }
      mainTypes.push(s);
      s = "";
    } else {
      s += String.fromCharCode(char);
    }
  }
  if (s !== "") {
    mainTypes.push(s);
  }
  for (o = mainIDTypesOffset, e = mainIDTypesOffset + mainIDTypesLength; o < e; o += 4) {
    var t = readUint32WithLastOffset(view, o, len);
    if (t > 0) {
      mainTypes.push(t);
    }
  }
  var muiTypes = [];
  for (s = "", o = muiNameTypesOffset, e = muiNameTypesOffset + muiNameTypesLength; o < e; o += 2) {
    var char = readUint16WithLastOffset(view, o, len);
    if (char === 0) {
      if (o > muiNameTypesOffset && s === "") {
        break;
      }
      muiTypes.push(s);
      s = "";
    } else {
      s += String.fromCharCode(char);
    }
  }
  if (s !== "") {
    muiTypes.push(s);
  }
  for (o = muiIDTypesOffset, e = muiIDTypesOffset + muiIDTypesLength; o < e; o += 4) {
    var t = readUint32WithLastOffset(view, o, len);
    if (t > 0) {
      muiTypes.push(t);
    }
  }
  for (s = "", o = languageOffset, e = languageOffset + languageLength; o < e; o += 2) {
    var char = readUint16WithLastOffset(view, o, len);
    if (char === 0) {
      break;
    }
    s += String.fromCharCode(char);
  }
  var language = s;
  for (s = "", o = ultimateFallbackLanguageOffset, e = ultimateFallbackLanguageOffset + ultimateFallbackLanguageLength; o < e; o += 2) {
    var char = readUint16WithLastOffset(view, o, len);
    if (char === 0) {
      break;
    }
    s += String.fromCharCode(char);
  }
  var ultimateFallbackLanguage = s;
  return {
    resLang: resourceEntry.lang,
    isLn,
    fileType,
    systemAttributes,
    checksumMain,
    checksumService,
    language,
    ultimateFallbackLanguage,
    ultimateFallbackLocation,
    mainTypes,
    muiTypes
  };
}
function generateMuiResourceData(data) {
  var binaryLength = 136;
  var mainNameTypesOffset = 0;
  var mainNameTypesLength = 0;
  var mainIDTypesOffset = 0;
  var mainIDTypesLength = 0;
  var muiNameTypesOffset = 0;
  var muiNameTypesLength = 0;
  var muiIDTypesOffset = 0;
  var muiIDTypesLength = 0;
  var languageOffset = 0;
  var languageLength = 0;
  var ultimateFallbackLanguageOffset = 0;
  var ultimateFallbackLanguageLength = 0;
  data.mainTypes.forEach(function(type) {
    if (typeof type === "number") {
      mainIDTypesLength += 4;
    } else {
      mainNameTypesLength += (type.length + 1) * 2;
    }
  });
  if (mainNameTypesLength > 0) {
    mainNameTypesLength += 6;
  }
  data.muiTypes.forEach(function(type) {
    if (typeof type === "number") {
      muiIDTypesLength += 4;
    } else {
      muiNameTypesLength += (type.length + 1) * 2;
    }
  });
  if (muiNameTypesLength > 0) {
    muiNameTypesLength += 6;
  }
  if (data.isLn) {
    if (data.ultimateFallbackLocation === "external") {
      ultimateFallbackLanguageLength = (data.ultimateFallbackLanguage.length + 1) * 2;
    }
  } else {
    languageLength = (data.language.length + 1) * 2;
  }
  if (mainNameTypesLength > 0) {
    mainNameTypesOffset = binaryLength;
    binaryLength += roundUp2(mainNameTypesLength, 8);
  }
  if (mainIDTypesLength > 0) {
    mainIDTypesOffset = binaryLength;
    binaryLength += roundUp2(mainIDTypesLength, 8);
  }
  if (muiNameTypesLength > 0) {
    muiNameTypesOffset = binaryLength;
    binaryLength += roundUp2(muiNameTypesLength, 8);
  }
  if (muiIDTypesLength > 0) {
    muiIDTypesOffset = binaryLength;
    binaryLength += roundUp2(muiIDTypesLength, 8);
  }
  if (languageLength > 0) {
    languageOffset = binaryLength;
    binaryLength += roundUp2(languageLength, 8);
  }
  if (ultimateFallbackLanguageLength > 0) {
    ultimateFallbackLanguageOffset = binaryLength;
    binaryLength += roundUp2(ultimateFallbackLanguageLength, 8);
  }
  var bin = new ArrayBuffer(binaryLength);
  var view = new DataView(bin);
  view.setUint32(0, 4274912973, true);
  view.setUint32(4, binaryLength, true);
  view.setUint32(8, 65536, true);
  view.setUint32(16, ((data.fileType === "system" ? 1 : 2) << 4) + (data.isLn ? 1 : 2), true);
  view.setUint32(20, data.systemAttributes, true);
  view.setUint32(24, data.isLn ? data.ultimateFallbackLocation === "internal" ? 1 : 2 : 0, true);
  copyBuffer2(bin, 28, data.checksumMain, 0, data.checksumMain.length < 16 ? data.checksumMain.length : 16);
  copyBuffer2(bin, 44, data.checksumService, 0, data.checksumService.length < 16 ? data.checksumService.length : 16);
  view.setUint32(84, mainNameTypesOffset, true);
  view.setUint32(88, mainNameTypesLength, true);
  view.setUint32(92, mainIDTypesOffset, true);
  view.setUint32(96, mainIDTypesLength, true);
  view.setUint32(100, muiNameTypesOffset, true);
  view.setUint32(104, muiNameTypesLength, true);
  view.setUint32(108, muiIDTypesOffset, true);
  view.setUint32(112, muiIDTypesLength, true);
  view.setUint32(116, languageOffset, true);
  view.setUint32(120, languageLength, true);
  view.setUint32(124, ultimateFallbackLanguageOffset, true);
  view.setUint32(128, ultimateFallbackLanguageLength, true);
  var offset = 136;
  if (mainNameTypesLength > 0) {
    data.mainTypes.forEach(function(type) {
      if (typeof type !== "number") {
        for (var i2 = 0; i2 < type.length; ++i2) {
          view.setUint16(offset, type.charCodeAt(i2), true);
          offset += 2;
        }
        offset += 2;
      }
    });
    offset += 6;
    offset = roundUp2(offset, 8);
  }
  if (mainIDTypesLength > 0) {
    data.mainTypes.forEach(function(type) {
      if (typeof type === "number") {
        view.setUint32(offset, type, true);
        offset += 4;
      }
    });
    offset = roundUp2(offset, 8);
  }
  if (muiNameTypesLength > 0) {
    data.muiTypes.forEach(function(type) {
      if (typeof type !== "number") {
        for (var i2 = 0; i2 < type.length; ++i2) {
          view.setUint16(offset, type.charCodeAt(i2), true);
          offset += 2;
        }
        offset += 2;
      }
    });
    offset += 6;
    offset = roundUp2(offset, 8);
  }
  if (muiIDTypesLength > 0) {
    data.muiTypes.forEach(function(type) {
      if (typeof type === "number") {
        view.setUint32(offset, type, true);
        offset += 4;
      }
    });
    offset = roundUp2(offset, 8);
  }
  if (languageLength > 0) {
    for (var i = 0; i < data.language.length; ++i) {
      view.setUint16(offset, data.language.charCodeAt(i), true);
      offset += 2;
    }
    offset += 2;
    offset = roundUp2(offset, 8);
  }
  if (ultimateFallbackLanguageLength > 0) {
    for (var i = 0; i < data.ultimateFallbackLanguage.length; ++i) {
      view.setUint16(offset, data.ultimateFallbackLanguage.charCodeAt(i), true);
      offset += 2;
    }
    offset += 2;
    offset = roundUp2(offset, 8);
  }
  return {
    type: "MUI",
    id: 1,
    lang: data.resLang,
    codepage: 1200,
    bin
  };
}
var MuiResourceInfo, MuiResourceInfo_default;
var init_MuiResourceInfo = __esm({
  "node_modules/resedit/dist/mui/MuiResourceInfo.js"() {
    init_functions2();
    MuiResourceInfo = /** @class */
    function() {
      function MuiResourceInfo2(_data) {
        this.data = _data;
      }
      MuiResourceInfo2.from = function(executableResource) {
        var muiResourceData = null;
        try {
          executableResource.entries.forEach(function(entry) {
            if (muiResourceData != null) {
              return;
            }
            if (entry.type === "MUI" && isValidMuiResourceEntry(entry)) {
              muiResourceData = parseMuiResourceData(entry);
            }
          });
        } catch (_a) {
        }
        return new MuiResourceInfo2(muiResourceData);
      };
      MuiResourceInfo2.createEmpty = function() {
        return new MuiResourceInfo2(null);
      };
      MuiResourceInfo2.prototype.generateEntry = function() {
        return this.data == null ? null : generateMuiResourceData(this.data);
      };
      MuiResourceInfo2.prototype.replaceMuiEntryForExecutables = function(targetExecutableResource) {
        var generated = this.generateEntry();
        {
          var found = false;
          for (var i = targetExecutableResource.entries.length - 1; i >= 0; --i) {
            var entry = targetExecutableResource.entries[i];
            if (entry.type === "MUI") {
              if (found || generated == null) {
                targetExecutableResource.entries.splice(i, 1);
              } else {
                targetExecutableResource.entries[i] = generated;
              }
              found = true;
            }
          }
          if (!found && generated != null) {
            targetExecutableResource.entries.unshift(generated);
          }
        }
      };
      return MuiResourceInfo2;
    }();
    MuiResourceInfo_default = MuiResourceInfo;
  }
});

// node_modules/resedit/dist/resource/VersionInfo.js
function readStringToNullChar(view, offset, last) {
  var r = "";
  while (offset + 2 <= last) {
    var c = view.getUint16(offset, true);
    if (!c) {
      break;
    }
    r += String.fromCharCode(c);
    offset += 2;
  }
  return r;
}
function writeStringWithNullChar(view, offset, value) {
  for (var i = 0; i < value.length; ++i) {
    view.setUint16(offset, value.charCodeAt(i), true);
    offset += 2;
  }
  view.setUint16(offset, 0, true);
  return offset + 2;
}
function createFixedInfo() {
  return {
    fileVersionMS: 0,
    fileVersionLS: 0,
    productVersionMS: 0,
    productVersionLS: 0,
    fileFlagsMask: 0,
    fileFlags: 0,
    fileOS: 0,
    fileType: 0,
    fileSubtype: 0,
    fileDateMS: 0,
    fileDateLS: 0
  };
}
function parseStringTable(view, offset, last) {
  var tableLen = view.getUint16(offset, true);
  var valueLen = view.getUint16(offset + 2, true);
  if (offset + tableLen < last) {
    last = offset + tableLen;
  }
  var tableName = readStringToNullChar(view, offset + 6, last);
  offset += roundUp2(6 + 2 * (tableName.length + 1), 4);
  var langAndCp = parseInt(tableName, 16);
  if (isNaN(langAndCp)) {
    throw new Error("Invalid StringTable data format");
  }
  offset += roundUp2(valueLen, 4);
  var r = {
    lang: Math.floor(langAndCp / 65536),
    codepage: langAndCp & 65535,
    values: {}
  };
  while (offset < last) {
    var childDataLen = view.getUint16(offset, true);
    var childValueLen = view.getUint16(offset + 2, true);
    var valueType = view.getUint16(offset + 4, true);
    if (valueType !== 1) {
      if (valueType !== 0 || childValueLen !== 2) {
        offset += roundUp2(childDataLen, 4);
        continue;
      }
    }
    var childDataLast = offset + childDataLen;
    if (childDataLast > last) {
      childDataLast = last;
    }
    var name_1 = readStringToNullChar(view, offset + 6, childDataLast);
    offset = roundUp2(offset + 6 + 2 * (name_1.length + 1), 4);
    if (valueType === 0) {
      var valueData = view.getUint16(offset, true);
      if (valueData === 0) {
        r.values[name_1] = "";
      }
      offset = roundUp2(offset + 2, 4);
    } else {
      var childValueLast = offset + childValueLen * 2;
      if (childValueLast > childDataLast) {
        childValueLast = childDataLast;
      }
      var value = readStringToNullChar(view, offset, childValueLast);
      offset = roundUp2(childValueLast, 4);
      r.values[name_1] = value;
    }
  }
  return [last, r];
}
function parseStringFileInfo(view, offset, last) {
  var valueLen = view.getUint16(offset + 2, true);
  offset += 36;
  offset += roundUp2(valueLen, 4);
  var r = [];
  var _loop_1 = function() {
    var childData = parseStringTable(view, offset, last);
    var table = childData[1];
    var a = r.filter(function(e) {
      return e.lang === table.lang && e.codepage === table.codepage;
    });
    if (a.length === 0) {
      r.push(table);
    } else {
      for (var key in table.values) {
        var value = table.values[key];
        if (value != null) {
          a[0].values[key] = value;
        }
      }
    }
    offset = roundUp2(childData[0], 4);
  };
  while (offset < last) {
    _loop_1();
  }
  return r;
}
function parseVarFileInfo(view, offset, last) {
  var valueLen = view.getUint16(offset + 2, true);
  offset += 32;
  offset += roundUp2(valueLen, 4);
  var r = [];
  while (offset < last) {
    var childDataLen = view.getUint16(offset, true);
    var childValueLen = view.getUint16(offset + 2, true);
    if (view.getUint16(offset + 4, true) !== 0) {
      offset += roundUp2(childDataLen, 4);
      continue;
    }
    var childDataLast = offset + childDataLen;
    if (childDataLast > last) {
      childDataLast = last;
    }
    var name_2 = readStringToNullChar(view, offset + 6, childDataLast);
    offset = roundUp2(offset + 6 + 2 * (name_2.length + 1), 4);
    if (name_2 !== "Translation" || childValueLen % 4 !== 0) {
      offset = roundUp2(childDataLast, 4);
      continue;
    }
    var _loop_2 = function(child2) {
      if (offset + 4 > childDataLast) {
        return "break";
      }
      var lang = view.getUint16(offset, true);
      var codepage = view.getUint16(offset + 2, true);
      offset += 4;
      if (r.filter(function(e) {
        return e.lang === lang && e.codepage === codepage;
      }).length === 0) {
        r.push({ lang, codepage });
      }
    };
    for (var child = 0; child < childValueLen; child += 4) {
      var state_1 = _loop_2(child);
      if (state_1 === "break")
        break;
    }
    offset = roundUp2(childDataLast, 4);
  }
  return r;
}
function parseVersionEntry(view, entry) {
  var totalLen = view.getUint16(0, true);
  var dataLen = view.getUint16(2, true);
  if (view.getUint16(4, true) !== 0) {
    throw new Error("Invalid version data format");
  }
  if (totalLen < dataLen + 40) {
    throw new Error("Invalid version data format");
  }
  if (readStringToNullChar(view, 6, totalLen) !== "VS_VERSION_INFO") {
    throw new Error("Invalid version data format");
  }
  var d = {
    lang: entry.lang,
    fixedInfo: createFixedInfo(),
    strings: [],
    translations: [],
    unknowns: []
  };
  var offset = 38;
  if (dataLen) {
    dataLen += 40;
    var sig = readUint32WithLastOffset(view, 40, dataLen);
    var sVer = readUint32WithLastOffset(view, 44, dataLen);
    if (sig === 4277077181 && sVer <= 65536) {
      d.fixedInfo = {
        fileVersionMS: readUint32WithLastOffset(view, 48, dataLen),
        fileVersionLS: readUint32WithLastOffset(view, 52, dataLen),
        productVersionMS: readUint32WithLastOffset(view, 56, dataLen),
        productVersionLS: readUint32WithLastOffset(view, 60, dataLen),
        fileFlagsMask: readUint32WithLastOffset(view, 64, dataLen),
        fileFlags: readUint32WithLastOffset(view, 68, dataLen),
        fileOS: readUint32WithLastOffset(view, 72, dataLen),
        fileType: readUint32WithLastOffset(view, 76, dataLen),
        fileSubtype: readUint32WithLastOffset(view, 80, dataLen),
        fileDateMS: readUint32WithLastOffset(view, 84, dataLen),
        fileDateLS: readUint32WithLastOffset(view, 88, dataLen)
      };
    }
    offset = dataLen;
  }
  offset = roundUp2(offset, 4);
  while (offset < totalLen) {
    var childLen = view.getUint16(offset, true);
    var childLast = offset + childLen;
    if (childLast > totalLen) {
      childLast = totalLen;
    }
    var name_3 = readStringToNullChar(view, offset + 6, childLast);
    switch (name_3) {
      case "StringFileInfo":
        d.strings = d.strings.concat(parseStringFileInfo(view, offset, childLast));
        break;
      case "VarFileInfo":
        d.translations = d.translations.concat(parseVarFileInfo(view, offset, childLast));
        break;
      default:
        d.unknowns.push({
          name: name_3,
          entireBin: allocatePartialBinary2(view, offset, childLen)
        });
        break;
    }
    offset += roundUp2(childLen, 4);
  }
  return d;
}
function generateStringTable(table) {
  var size = 24;
  var keys = Object.keys(table.values);
  size = keys.reduce(function(prev, key) {
    var value = table.values[key];
    if (value == null) {
      return prev;
    }
    var childHeaderSize = roundUp2(6 + 2 * (key.length + 1), 4);
    var newSize = roundUp2(prev + childHeaderSize + 2 * (value.length + 1), 4);
    return newSize > 65532 ? prev : newSize;
  }, size);
  var bin = new ArrayBuffer(size);
  var view = new DataView(bin);
  view.setUint16(0, size, true);
  view.setUint16(2, 0, true);
  view.setUint16(4, 1, true);
  var langAndCp = ((table.lang & 65535) * 65536 + (table.codepage & 65535)).toString(16).toLowerCase();
  if (langAndCp.length < 8) {
    var l = 8 - langAndCp.length;
    langAndCp = "00000000".substr(0, l) + langAndCp;
  }
  var offset = roundUp2(writeStringWithNullChar(view, 6, langAndCp), 4);
  keys.forEach(function(key) {
    var value = table.values[key];
    if (value == null) {
      return;
    }
    var childHeaderSize = roundUp2(6 + 2 * (key.length + 1), 4);
    var newSize = childHeaderSize + 2 * (value.length + 1);
    if (offset + newSize <= 65532) {
      view.setUint16(offset, newSize, true);
      if (value.length === 0) {
        view.setUint16(offset + 2, 2, true);
        view.setUint16(offset + 4, 0, true);
      } else {
        view.setUint16(offset + 2, value.length + 1, true);
        view.setUint16(offset + 4, 1, true);
      }
      offset = roundUp2(writeStringWithNullChar(view, offset + 6, key), 4);
      offset = roundUp2(writeStringWithNullChar(view, offset, value), 4);
    }
  });
  return bin;
}
function generateStringTableInfo(tables) {
  var size = 36;
  var tableBins = tables.map(function(table) {
    return generateStringTable(table);
  });
  size += tableBins.reduce(function(p, c) {
    return p + c.byteLength;
  }, 0);
  var bin = new ArrayBuffer(size);
  var view = new DataView(bin);
  view.setUint16(0, size, true);
  view.setUint16(2, 0, true);
  view.setUint16(4, 1, true);
  var offset = roundUp2(writeStringWithNullChar(view, 6, "StringFileInfo"), 4);
  tableBins.forEach(function(table) {
    var len = table.byteLength;
    copyBuffer2(bin, offset, table, 0, len);
    offset += len;
  });
  return bin;
}
function generateVarFileInfo(translations) {
  var size = 32;
  var translationsValueSize = translations.length * 4;
  size += 32 + translationsValueSize;
  var bin = new ArrayBuffer(size);
  var view = new DataView(bin);
  view.setUint16(0, size, true);
  view.setUint16(2, 0, true);
  view.setUint16(4, 1, true);
  var offset = roundUp2(writeStringWithNullChar(view, 6, "VarFileInfo"), 4);
  view.setUint16(offset, 32 + translationsValueSize, true);
  view.setUint16(offset + 2, translationsValueSize, true);
  view.setUint16(offset + 4, 0, true);
  offset = roundUp2(writeStringWithNullChar(view, offset + 6, "Translation"), 4);
  translations.forEach(function(translation) {
    view.setUint16(offset, translation.lang, true);
    view.setUint16(offset + 2, translation.codepage, true);
    offset += 4;
  });
  return bin;
}
function generateVersionEntryBinary(entry) {
  var size = 92;
  var stringTableInfoBin = generateStringTableInfo(entry.strings);
  var stringTableInfoLen = stringTableInfoBin.byteLength;
  size += stringTableInfoLen;
  var varFileInfoBin = generateVarFileInfo(entry.translations);
  var varFileInfoLen = varFileInfoBin.byteLength;
  size += varFileInfoLen;
  size = entry.unknowns.reduce(function(p, data) {
    return p + roundUp2(data.entireBin.byteLength, 4);
  }, size);
  var bin = new ArrayBuffer(size);
  var view = new DataView(bin);
  view.setUint16(0, size, true);
  view.setUint16(2, 52, true);
  view.setUint16(4, 0, true);
  var offset = roundUp2(writeStringWithNullChar(view, 6, "VS_VERSION_INFO"), 4);
  view.setUint32(offset, 4277077181, true);
  view.setUint32(offset + 4, 65536, true);
  view.setUint32(offset + 8, entry.fixedInfo.fileVersionMS, true);
  view.setUint32(offset + 12, entry.fixedInfo.fileVersionLS, true);
  view.setUint32(offset + 16, entry.fixedInfo.productVersionMS, true);
  view.setUint32(offset + 20, entry.fixedInfo.productVersionLS, true);
  view.setUint32(offset + 24, entry.fixedInfo.fileFlagsMask, true);
  view.setUint32(offset + 28, entry.fixedInfo.fileFlags, true);
  view.setUint32(offset + 32, entry.fixedInfo.fileOS, true);
  view.setUint32(offset + 36, entry.fixedInfo.fileType, true);
  view.setUint32(offset + 40, entry.fixedInfo.fileSubtype, true);
  view.setUint32(offset + 44, entry.fixedInfo.fileDateMS, true);
  view.setUint32(offset + 48, entry.fixedInfo.fileDateLS, true);
  offset += 52;
  copyBuffer2(bin, offset, stringTableInfoBin, 0, stringTableInfoLen);
  offset += stringTableInfoLen;
  copyBuffer2(bin, offset, varFileInfoBin, 0, varFileInfoLen);
  offset += varFileInfoLen;
  entry.unknowns.forEach(function(e) {
    var len = e.entireBin.byteLength;
    copyBuffer2(bin, offset, e.entireBin, 0, len);
    offset += roundUp2(len, 4);
  });
  return bin;
}
function clampInt(val, min, max) {
  if (isNaN(val) || val < min) {
    return min;
  } else if (val >= max) {
    return max;
  }
  return Math.floor(val);
}
function parseVersionArguments(arg1, arg2, arg3, arg4, arg5) {
  var _a;
  var major;
  var minor;
  var micro;
  var revision;
  var lang;
  if (typeof arg1 === "string" && (typeof arg2 === "undefined" || typeof arg2 === "number") && typeof arg3 === "undefined") {
    _a = arg1.split(".").map(function(token) {
      return clampInt(Number(token), 0, 65535);
    }).concat(0, 0, 0), major = _a[0], minor = _a[1], micro = _a[2], revision = _a[3];
    lang = arg2;
  } else {
    major = clampInt(Number(arg1), 0, 65535);
    minor = clampInt(Number(arg2), 0, 65535);
    micro = clampInt(typeof arg3 === "undefined" ? 0 : Number(arg3), 0, 65535);
    revision = clampInt(typeof arg4 === "undefined" ? 0 : Number(arg4), 0, 65535);
    lang = arg5;
  }
  return [major, minor, micro, revision, lang];
}
var VersionInfo, VersionInfo_default;
var init_VersionInfo = __esm({
  "node_modules/resedit/dist/resource/VersionInfo.js"() {
    init_functions2();
    VersionInfo = /** @class */
    function() {
      function VersionInfo2(entry) {
        if (!entry) {
          this.data = {
            lang: 0,
            fixedInfo: createFixedInfo(),
            strings: [],
            translations: [],
            unknowns: []
          };
        } else {
          var view = new DataView(entry.bin);
          this.data = parseVersionEntry(view, entry);
        }
      }
      VersionInfo2.createEmpty = function() {
        return new VersionInfo2();
      };
      VersionInfo2.create = function(arg1, fixedInfo, strings) {
        var lang;
        if (typeof arg1 === "object") {
          lang = arg1.lang;
          fixedInfo = arg1.fixedInfo;
          strings = arg1.strings;
        } else {
          lang = arg1;
        }
        var vi = new VersionInfo2();
        vi.data.lang = lang;
        for (var _fixedInfoKey in fixedInfo) {
          var fixedInfoKey = _fixedInfoKey;
          if (fixedInfoKey in fixedInfo) {
            var value = fixedInfo[fixedInfoKey];
            if (value != null) {
              vi.data.fixedInfo[fixedInfoKey] = value;
            }
          }
        }
        vi.data.strings = strings.map(function(_a) {
          var lang2 = _a.lang, codepage = _a.codepage, values = _a.values;
          return {
            lang: lang2,
            codepage,
            values: cloneObject2(values)
          };
        });
        vi.data.translations = strings.map(function(_a) {
          var lang2 = _a.lang, codepage = _a.codepage;
          return { lang: lang2, codepage };
        });
        return vi;
      };
      VersionInfo2.fromEntries = function(entries) {
        return entries.filter(function(e) {
          return e.type === 16;
        }).map(function(e) {
          return new VersionInfo2(e);
        });
      };
      Object.defineProperty(VersionInfo2.prototype, "lang", {
        /** A language value for this resource entry. */
        get: function() {
          return this.data.lang;
        },
        set: function(value) {
          this.data.lang = value;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(VersionInfo2.prototype, "fixedInfo", {
        /**
         * The property of fixed version info, containing file version, product version, etc.
         * (data: `VS_FIXEDFILEINFO`)
         *
         * Although this property is read-only, you can rewrite
         * each child fields directly to apply data.
         */
        get: function() {
          return this.data.fixedInfo;
        },
        enumerable: false,
        configurable: true
      });
      VersionInfo2.prototype.getAvailableLanguages = function() {
        return this.data.translations.slice(0);
      };
      VersionInfo2.prototype.replaceAvailableLanguages = function(languages) {
        this.data.translations = languages.slice(0);
      };
      VersionInfo2.prototype.getStringValues = function(language) {
        var a = this.data.strings.filter(function(e) {
          return e.lang === language.lang && e.codepage === language.codepage;
        }).map(function(e) {
          return e.values;
        });
        return a.length > 0 ? a[0] : {};
      };
      VersionInfo2.prototype.getAllLanguagesForStringValues = function() {
        return this.data.strings.map(function(_a) {
          var codepage = _a.codepage, lang = _a.lang;
          return { codepage, lang };
        });
      };
      VersionInfo2.prototype.setStringValues = function(language, values, addToAvailableLanguage) {
        if (addToAvailableLanguage === void 0) {
          addToAvailableLanguage = true;
        }
        var a = this.data.strings.filter(function(e) {
          return e.lang === language.lang && e.codepage === language.codepage;
        });
        var table;
        if (a.length === 0) {
          table = {
            lang: language.lang,
            codepage: language.codepage,
            values: {}
          };
          this.data.strings.push(table);
        } else {
          table = a[0];
        }
        for (var key in values) {
          var value = values[key];
          if (value != null) {
            table.values[key] = value;
          }
        }
        if (addToAvailableLanguage) {
          var t = this.data.translations.filter(function(e) {
            return e.lang === language.lang && e.codepage === language.codepage;
          });
          if (t.length === 0) {
            this.data.translations.push({
              lang: language.lang,
              codepage: language.codepage
            });
          }
        }
      };
      VersionInfo2.prototype.setStringValue = function(language, key, value, addToAvailableLanguage) {
        var _a;
        if (addToAvailableLanguage === void 0) {
          addToAvailableLanguage = true;
        }
        this.setStringValues(language, (_a = {}, _a[key] = value, _a), addToAvailableLanguage);
      };
      VersionInfo2.prototype.removeAllStringValues = function(language, removeFromAvailableLanguage) {
        if (removeFromAvailableLanguage === void 0) {
          removeFromAvailableLanguage = true;
        }
        var strings = this.data.strings;
        var len = strings.length;
        for (var i = 0; i < len; ++i) {
          var e = strings[i];
          if (e != null && e.lang === language.lang && e.codepage === language.codepage) {
            strings.splice(i, 1);
            if (removeFromAvailableLanguage) {
              var translations = this.data.translations;
              for (var j = 0; j < translations.length; j++) {
                var t = translations[j];
                if (t != null && t.lang === language.lang && t.codepage === language.codepage) {
                  translations.splice(j, 1);
                  break;
                }
              }
            }
            break;
          }
        }
      };
      VersionInfo2.prototype.removeStringValue = function(language, key, removeFromAvailableLanguage) {
        if (removeFromAvailableLanguage === void 0) {
          removeFromAvailableLanguage = true;
        }
        var strings = this.data.strings;
        var len = strings.length;
        for (var i = 0; i < len; ++i) {
          var e = strings[i];
          if (e != null && e.lang === language.lang && e.codepage === language.codepage) {
            try {
              delete e.values[key];
            } catch (_ex) {
            }
            if (removeFromAvailableLanguage && Object.keys(e.values).length === 0) {
              strings.splice(i, 1);
              var translations = this.data.translations;
              for (var j = 0; j < translations.length; j++) {
                var t = translations[j];
                if (t != null && t.lang === language.lang && t.codepage === language.codepage) {
                  translations.splice(j, 1);
                  break;
                }
              }
            }
            break;
          }
        }
      };
      VersionInfo2.prototype.generateResource = function() {
        var bin = generateVersionEntryBinary(this.data);
        return {
          type: 16,
          id: 1,
          lang: this.lang,
          codepage: 1200,
          bin
        };
      };
      VersionInfo2.prototype.outputToResourceEntries = function(entries) {
        var res = this.generateResource();
        var len = entries.length;
        for (var i = 0; i < len; ++i) {
          var e = entries[i];
          if (e != null && e.type === 16 && e.id === res.id && e.lang === res.lang) {
            entries[i] = res;
            return;
          }
        }
        entries.push(res);
      };
      VersionInfo2.prototype.getDefaultVersionLang = function(propName) {
        var num = Number(this.lang);
        if (this.lang !== "" && !isNaN(num)) {
          return num;
        }
        var a = this.data.strings.filter(function(e) {
          return propName in e.values && e.values[propName] != null;
        }).map(function(e) {
          return e.lang;
        });
        if (a.length === 1) {
          return a[0];
        }
        return 1033;
      };
      VersionInfo2.prototype.setFileVersion = function(arg1, arg2, arg3, arg4, arg5) {
        this.setFileVersionImpl.apply(this, parseVersionArguments(arg1, arg2, arg3, arg4, arg5));
      };
      VersionInfo2.prototype.setFileVersionImpl = function(major, minor, micro, revision, lang) {
        lang = typeof lang !== "undefined" ? lang : this.getDefaultVersionLang("FileVersion");
        this.fixedInfo.fileVersionMS = major << 16 | minor;
        this.fixedInfo.fileVersionLS = micro << 16 | revision;
        this.setStringValue({ lang, codepage: 1200 }, "FileVersion", "".concat(major, ".").concat(minor, ".").concat(micro, ".").concat(revision), true);
      };
      VersionInfo2.prototype.setProductVersion = function(arg1, arg2, arg3, arg4, arg5) {
        this.setProductVersionImpl.apply(this, parseVersionArguments(arg1, arg2, arg3, arg4, arg5));
      };
      VersionInfo2.prototype.setProductVersionImpl = function(major, minor, micro, revision, lang) {
        lang = typeof lang !== "undefined" ? lang : this.getDefaultVersionLang("ProductVersion");
        this.fixedInfo.productVersionMS = major << 16 | minor;
        this.fixedInfo.productVersionLS = micro << 16 | revision;
        this.setStringValue({ lang, codepage: 1200 }, "ProductVersion", "".concat(major, ".").concat(minor, ".").concat(micro, ".").concat(revision), true);
      };
      return VersionInfo2;
    }();
    VersionInfo_default = VersionInfo;
  }
});

// node_modules/resedit/dist/mui/muiUtils.js
function langIdToLanguageTag(langId) {
  return langIdToLanguageTagMap[langId] || "#".concat(langId);
}
function createChecksumBinary() {
  var r = new Uint8Array(16);
  for (var i = 0; i < 16; ++i) {
    r[i] = Math.floor(Math.random() * 256);
  }
  return r;
}
function cloneResourceEntry(entry) {
  return {
    type: entry.type,
    id: entry.id,
    lang: entry.lang,
    codepage: entry.codepage,
    bin: cloneToArrayBuffer2(entry.bin)
  };
}
function cloneResourceEntryWithLangIdAndReplaceVersionData(entry, langId) {
  if (entry.type !== 16) {
    var e = cloneResourceEntry(entry);
    e.lang = langId;
    return e;
  }
  var versionInfoBase = VersionInfo_default.fromEntries([entry])[0];
  var versionTranslation = versionInfoBase.getAllLanguagesForStringValues()[0];
  if (versionTranslation == null) {
    var e = cloneResourceEntry(entry);
    e.lang = langId;
    return e;
  }
  var stringValues = versionInfoBase.getStringValues(versionTranslation);
  var newVersionInfo = VersionInfo_default.create(langId, versionInfoBase.fixedInfo, [
    {
      lang: langId,
      codepage: 1200,
      values: stringValues
    }
  ]);
  return newVersionInfo.generateResource();
}
function makeLocalizedMuiResourceFromNeutralMuiResource(neutralMuiResource, langTag) {
  var result = MuiResourceInfo_default.createEmpty();
  if (neutralMuiResource.data != null) {
    result.data = {
      resLang: neutralMuiResource.data.resLang,
      isLn: false,
      fileType: neutralMuiResource.data.fileType,
      systemAttributes: neutralMuiResource.data.systemAttributes,
      checksumMain: new Uint8Array(neutralMuiResource.data.checksumMain),
      checksumService: new Uint8Array(neutralMuiResource.data.checksumService),
      language: langTag,
      ultimateFallbackLanguage: "",
      ultimateFallbackLocation: "external",
      mainTypes: neutralMuiResource.data.muiTypes.slice(),
      muiTypes: []
    };
  }
  return result;
}
function makeMuiResourcesFromSingleExecutable(baseExecutableResource, neutralResources, localizedResources, defaultLangId, is32bit, fallbackLangIdIfLocalizedNotExist) {
  if (is32bit === void 0) {
    is32bit = false;
  }
  if (fallbackLangIdIfLocalizedNotExist === void 0) {
    fallbackLangIdIfLocalizedNotExist = defaultLangId;
  }
  if (localizedResources.length === 0) {
    throw new Error("No localized resource type is specified");
  }
  if (!(defaultLangId in langIdToLanguageTagMap)) {
    throw new Error("Invalid or unknown defaultLangId value");
  }
  [3, 5, 6, 16].forEach(function(type) {
    if (neutralResources.indexOf(type) >= 0) {
      if (localizedResources.indexOf(type) < 0) {
        localizedResources = localizedResources.concat(type);
      }
      if (type === 3) {
        if (neutralResources.indexOf(14) < 0) {
          neutralResources = neutralResources.concat(14);
        }
        if (localizedResources.indexOf(14) < 0) {
          localizedResources = localizedResources.concat(14);
        }
      }
    }
  });
  if (neutralResources.indexOf("MUI") < 0) {
    neutralResources = neutralResources.concat("MUI");
  }
  if (localizedResources.indexOf("MUI") < 0) {
    localizedResources = localizedResources.concat("MUI");
  }
  var resourcesPerLangId = [];
  baseExecutableResource.entries.forEach(function(entry) {
    if (localizedResources.some(function(type) {
      return entry.type === type;
    })) {
      if (typeof entry.lang === "number") {
        var found = false;
        for (var i2 = 0, l = resourcesPerLangId.length; i2 < l; ++i2) {
          var data = resourcesPerLangId[i2];
          if (data[0] === entry.lang) {
            data[1].push(cloneResourceEntryWithLangIdAndReplaceVersionData(entry, entry.lang));
            found = true;
            break;
          }
        }
        if (!found) {
          resourcesPerLangId.push([
            entry.lang,
            [
              cloneResourceEntryWithLangIdAndReplaceVersionData(entry, entry.lang)
            ]
          ]);
        }
      }
    }
  });
  var defaultEntries;
  resourcesPerLangId.forEach(function(_a) {
    var langId = _a[0], entries = _a[1];
    if (langId === fallbackLangIdIfLocalizedNotExist) {
      defaultEntries = entries;
    }
  });
  if (defaultEntries != null) {
    resourcesPerLangId.forEach(function(_a) {
      var langId = _a[0], entries = _a[1];
      if (langId === fallbackLangIdIfLocalizedNotExist) {
        return;
      }
      var existingTypes = entries.map(function(entry) {
        return entry.type;
      });
      defaultEntries.forEach(function(entry) {
        if (existingTypes.some(function(type) {
          return entry.type === type;
        })) {
          return;
        }
        var newEntry = cloneResourceEntryWithLangIdAndReplaceVersionData(entry, langId);
        entries.push(newEntry);
      });
    });
  }
  var checksumMain = createChecksumBinary();
  var checksumService = createChecksumBinary();
  var lnMuiResourceInfo = MuiResourceInfo_default.createEmpty();
  lnMuiResourceInfo.data = {
    resLang: 1033,
    isLn: true,
    fileType: "application",
    systemAttributes: 0,
    checksumMain,
    checksumService,
    language: "",
    ultimateFallbackLanguage: langIdToLanguageTag(defaultLangId),
    ultimateFallbackLocation: "external",
    mainTypes: neutralResources.slice(),
    muiTypes: localizedResources.slice()
  };
  var generated = lnMuiResourceInfo.generateEntry();
  {
    var droppedLocalizedResources_1 = {};
    var _loop_1 = function(i2) {
      var entry = baseExecutableResource.entries[i2];
      if (entry.type === 16 && typeof entry.lang === "number") {
        entry = baseExecutableResource.entries[i2] = cloneResourceEntryWithLangIdAndReplaceVersionData(entry, entry.lang);
      }
      if (entry.type === "MUI") {
        baseExecutableResource.entries.splice(i2, 1);
      } else {
        if (!neutralResources.some(function(type) {
          return type === entry.type;
        })) {
          baseExecutableResource.entries.splice(i2, 1);
        } else if (localizedResources.some(function(type) {
          return type === entry.type;
        })) {
          var key = typeof entry.type === "number" ? "n".concat(entry.type) : "s".concat(entry.type);
          var a = droppedLocalizedResources_1[key] || (droppedLocalizedResources_1[key] = []);
          a.push(entry);
          baseExecutableResource.entries.splice(i2, 1);
        }
      }
    };
    for (var i = baseExecutableResource.entries.length - 1; i >= 0; --i) {
      _loop_1(i);
    }
    Object.keys(droppedLocalizedResources_1).forEach(function(key) {
      var a = droppedLocalizedResources_1[key];
      if (a.length > 0) {
        var foundEntry = a[0];
        for (var i2 = 0, l = a.length; i2 < l; ++i2) {
          var entry = a[i2];
          if (entry.lang === defaultLangId) {
            foundEntry = entry;
          }
        }
        baseExecutableResource.entries.push(foundEntry);
      }
    });
    if (generated != null) {
      baseExecutableResource.entries.unshift(generated);
    }
  }
  var muiExecutables = resourcesPerLangId.map(function(_a) {
    var langId = _a[0], resources = _a[1];
    var executable = NtExecutable_default.createEmpty(is32bit);
    var res = NtExecutableResource_default.from(executable);
    res.entries = resources;
    var langTag = langIdToLanguageTag(langId);
    var mui = MuiResourceInfo_default.createEmpty();
    mui.data = {
      resLang: 1033,
      isLn: false,
      fileType: "application",
      systemAttributes: 0,
      checksumMain,
      checksumService,
      language: langTag,
      ultimateFallbackLanguage: "",
      ultimateFallbackLocation: "external",
      mainTypes: localizedResources.slice(),
      muiTypes: []
    };
    var resource = mui.generateEntry();
    if (resource != null) {
      res.entries.unshift(resource);
    }
    res.outputResource(executable);
    return [langTag, executable];
  });
  return {
    baseExecutableResource,
    muiExecutables
  };
}
function makeMuiResourcesFromSingleExecutableAuto(baseExecutableResource, defaultLangId, is32bit, fallbackLangIdIfLocalizedNotExist) {
  if (is32bit === void 0) {
    is32bit = false;
  }
  if (fallbackLangIdIfLocalizedNotExist === void 0) {
    fallbackLangIdIfLocalizedNotExist = defaultLangId;
  }
  var addedResourceTypes = {};
  var neutralResources = ["MUI"];
  var localizedResources = ["MUI"];
  baseExecutableResource.entries.forEach(function(entry) {
    var addedTypeName = typeof entry.type === "number" ? "d".concat(entry.type) : "s".concat(entry.type);
    if (addedResourceTypes[addedTypeName]) {
      return;
    }
    addedResourceTypes[addedTypeName] = true;
    var found = false;
    defaultLocalizedTypes.forEach(function(_a) {
      var type = _a[0], alsoInNeutral = _a[1];
      if (entry.type === type) {
        found = true;
        localizedResources.push(type);
        if (alsoInNeutral) {
          neutralResources.push(type);
        }
      }
    });
    if (!found) {
      neutralResources.push(entry.type);
    }
  });
  return makeMuiResourcesFromSingleExecutable(baseExecutableResource, neutralResources, localizedResources, defaultLangId, is32bit, fallbackLangIdIfLocalizedNotExist);
}
var langIdToLanguageTagMap, defaultLocalizedTypes;
var init_muiUtils = __esm({
  "node_modules/resedit/dist/mui/muiUtils.js"() {
    init_dist();
    init_VersionInfo();
    init_functions2();
    init_MuiResourceInfo();
    langIdToLanguageTagMap = {
      // List is from https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-lcid/63d3d639-7fd2-4afb-abbe-0d5b5551eef8
      1: "ar",
      2: "bg",
      3: "ca",
      4: "zh-Hans",
      5: "cs",
      6: "da",
      7: "de",
      8: "el",
      9: "en",
      10: "es",
      11: "fi",
      12: "fr",
      13: "he",
      14: "hu",
      15: "is",
      16: "it",
      17: "ja",
      18: "ko",
      19: "nl",
      20: "no",
      21: "pl",
      22: "pt",
      23: "rm",
      24: "ro",
      25: "ru",
      26: "hr",
      27: "sk",
      28: "sq",
      29: "sv",
      30: "th",
      31: "tr",
      32: "ur",
      33: "id",
      34: "uk",
      35: "be",
      36: "sl",
      37: "et",
      38: "lv",
      39: "lt",
      40: "tg",
      41: "fa",
      42: "vi",
      43: "hy",
      44: "az",
      45: "eu",
      46: "hsb",
      47: "mk",
      48: "st",
      49: "ts",
      50: "tn",
      51: "ve",
      52: "xh",
      53: "zu",
      54: "af",
      55: "ka",
      56: "fo",
      57: "hi",
      58: "mt",
      59: "se",
      60: "ga",
      61: "yi",
      62: "ms",
      63: "kk",
      64: "ky",
      65: "sw",
      66: "tk",
      67: "uz",
      68: "tt",
      69: "bn",
      70: "pa",
      71: "gu",
      72: "or",
      73: "ta",
      74: "te",
      75: "kn",
      76: "ml",
      77: "as",
      78: "mr",
      79: "sa",
      80: "mn",
      81: "bo",
      82: "cy",
      83: "km",
      84: "lo",
      85: "my",
      86: "gl",
      87: "kok",
      88: "mni",
      89: "sd",
      90: "syr",
      91: "si",
      92: "chr",
      93: "iu",
      94: "am",
      95: "tzm",
      96: "ks",
      97: "ne",
      98: "fy",
      99: "ps",
      100: "fil",
      101: "dv",
      102: "bin",
      103: "ff",
      104: "ha",
      105: "ibb",
      106: "yo",
      107: "quz",
      108: "nso",
      109: "ba",
      110: "lb",
      111: "kl",
      112: "ig",
      113: "kr",
      114: "om",
      115: "ti",
      116: "gn",
      117: "haw",
      118: "la",
      119: "so",
      120: "ii",
      121: "pap",
      122: "arn",
      124: "moh",
      126: "br",
      128: "ug",
      129: "mi",
      130: "oc",
      131: "co",
      132: "gsw",
      133: "sah",
      134: "qut",
      135: "rw",
      136: "wo",
      140: "prs",
      145: "gd",
      146: "ku",
      147: "quc",
      1025: "ar-SA",
      1026: "bg-BG",
      1027: "ca-ES",
      1028: "zh-TW",
      1029: "cs-CZ",
      1030: "da-DK",
      1031: "de-DE",
      1032: "el-GR",
      1033: "en-US",
      1034: "es-ES_tradnl",
      1035: "fi-FI",
      1036: "fr-FR",
      1037: "he-IL",
      1038: "hu-HU",
      1039: "is-IS",
      1040: "it-IT",
      1041: "ja-JP",
      1042: "ko-KR",
      1043: "nl-NL",
      1044: "nb-NO",
      1045: "pl-PL",
      1046: "pt-BR",
      1047: "rm-CH",
      1048: "ro-RO",
      1049: "ru-RU",
      1050: "hr-HR",
      1051: "sk-SK",
      1052: "sq-AL",
      1053: "sv-SE",
      1054: "th-TH",
      1055: "tr-TR",
      1056: "ur-PK",
      1057: "id-ID",
      1058: "uk-UA",
      1059: "be-BY",
      1060: "sl-SI",
      1061: "et-EE",
      1062: "lv-LV",
      1063: "lt-LT",
      1064: "tg-Cyrl-TJ",
      1065: "fa-IR",
      1066: "vi-VN",
      1067: "hy-AM",
      1068: "az-Latn-AZ",
      1069: "eu-ES",
      1070: "hsb-DE",
      1071: "mk-MK",
      1072: "st-ZA",
      1073: "ts-ZA",
      1074: "tn-ZA",
      1075: "ve-ZA",
      1076: "xh-ZA",
      1077: "zu-ZA",
      1078: "af-ZA",
      1079: "ka-GE",
      1080: "fo-FO",
      1081: "hi-IN",
      1082: "mt-MT",
      1083: "se-NO",
      1085: "yi-001",
      1086: "ms-MY",
      1087: "kk-KZ",
      1088: "ky-KG",
      1089: "sw-KE",
      1090: "tk-TM",
      1091: "uz-Latn-UZ",
      1092: "tt-RU",
      1093: "bn-IN",
      1094: "pa-IN",
      1095: "gu-IN",
      1096: "or-IN",
      1097: "ta-IN",
      1098: "te-IN",
      1099: "kn-IN",
      1100: "ml-IN",
      1101: "as-IN",
      1102: "mr-IN",
      1103: "sa-IN",
      1104: "mn-MN",
      1105: "bo-CN",
      1106: "cy-GB",
      1107: "km-KH",
      1108: "lo-LA",
      1109: "my-MM",
      1110: "gl-ES",
      1111: "kok-IN",
      1112: "mni-IN",
      1113: "sd-Deva-IN",
      1114: "syr-SY",
      1115: "si-LK",
      1116: "chr-Cher-US",
      1117: "iu-Cans-CA",
      1118: "am-ET",
      1119: "tzm-Arab-MA",
      1120: "ks-Arab",
      1121: "ne-NP",
      1122: "fy-NL",
      1123: "ps-AF",
      1124: "fil-PH",
      1125: "dv-MV",
      1126: "bin-NG",
      1128: "ha-Latn-NG",
      1129: "ibb-NG",
      1130: "yo-NG",
      1131: "quz-BO",
      1132: "nso-ZA",
      1133: "ba-RU",
      1134: "lb-LU",
      1135: "kl-GL",
      1136: "ig-NG",
      1137: "kr-Latn-NG",
      1138: "om-ET",
      1139: "ti-ET",
      1140: "gn-PY",
      1141: "haw-US",
      1142: "la-VA",
      1143: "so-SO",
      1144: "ii-CN",
      1145: "pap-029",
      1146: "arn-CL",
      1148: "moh-CA",
      1150: "br-FR",
      1152: "ug-CN",
      1153: "mi-NZ",
      1154: "oc-FR",
      1155: "co-FR",
      1156: "gsw-FR",
      1157: "sah-RU",
      1158: "qut-GT",
      1159: "rw-RW",
      1160: "wo-SN",
      1164: "prs-AF",
      1165: "plt-MG",
      1166: "zh-yue-HK",
      1167: "tdd-Tale-CN",
      1168: "khb-Talu-CN",
      1169: "gd-GB",
      1170: "ku-Arab-IQ",
      1171: "quc-CO",
      1281: "qps-ploc",
      1534: "qps-ploca",
      2049: "ar-IQ",
      2051: "ca-ES-valencia",
      2052: "zh-CN",
      2055: "de-CH",
      2057: "en-GB",
      2058: "es-MX",
      2060: "fr-BE",
      2064: "it-CH",
      2065: "ja-Ploc-JP",
      2067: "nl-BE",
      2068: "nn-NO",
      2070: "pt-PT",
      2072: "ro-MD",
      2073: "ru-MD",
      2074: "sr-Latn-CS",
      2077: "sv-FI",
      2080: "ur-IN",
      2092: "az-Cyrl-AZ",
      2094: "dsb-DE",
      2098: "tn-BW",
      2107: "se-SE",
      2108: "ga-IE",
      2110: "ms-BN",
      2111: "kk-Latn-KZ",
      2115: "uz-Cyrl-UZ",
      2117: "bn-BD",
      2118: "pa-Arab-PK",
      2121: "ta-LK",
      2128: "mn-Mong-CN",
      2129: "bo-BT",
      2137: "sd-Arab-PK",
      2141: "iu-Latn-CA",
      2143: "tzm-Latn-DZ",
      2144: "ks-Deva-IN",
      2145: "ne-IN",
      2151: "ff-Latn-SN",
      2155: "quz-EC",
      2163: "ti-ER",
      2559: "qps-plocm",
      3073: "ar-EG",
      3076: "zh-HK",
      3079: "de-AT",
      3081: "en-AU",
      3082: "es-ES",
      3084: "fr-CA",
      3098: "sr-Cyrl-CS",
      3131: "se-FI",
      3152: "mn-Mong-MN",
      3153: "dz-BT",
      3167: "tmz-MA",
      3179: "quz-PE",
      4097: "ar-LY",
      4100: "zh-SG",
      4103: "de-LU",
      4105: "en-CA",
      4106: "es-GT",
      4108: "fr-CH",
      4122: "hr-BA",
      4155: "smj-NO",
      4191: "tzm-Tfng-MA",
      5121: "ar-DZ",
      5124: "zh-MO",
      5127: "de-LI",
      5129: "en-NZ",
      5130: "es-CR",
      5132: "fr-LU",
      5146: "bs-Latn-BA",
      5179: "smj-SE",
      6145: "ar-MA",
      6153: "en-IE",
      6154: "es-PA",
      6156: "fr-MC",
      6170: "sr-Latn-BA",
      6203: "sma-NO",
      7169: "ar-TN",
      7177: "en-ZA",
      7178: "es-DO",
      7180: "fr-029",
      7194: "sr-Cyrl-BA",
      7227: "sma-SE",
      8193: "ar-OM",
      8201: "en-JM",
      8202: "es-VE",
      8204: "fr-RE",
      8218: "bs-Cyrl-BA",
      8251: "sms-FI",
      9217: "ar-YE",
      9225: "en-029",
      9226: "es-CO",
      9228: "fr-CD",
      9242: "sr-Latn-RS",
      9275: "smn-FI",
      10241: "ar-SY",
      10249: "en-BZ",
      10250: "es-PE",
      10252: "fr-SN",
      10266: "sr-Cyrl-RS",
      11265: "ar-JO",
      11273: "en-TT",
      11274: "es-AR",
      11276: "fr-CM",
      11290: "sr-Latn-ME",
      12289: "ar-LB",
      12297: "en-ZW",
      12298: "es-EC",
      12300: "fr-CI",
      12314: "sr-Cyrl-ME",
      13313: "ar-KW",
      13321: "en-PH",
      13322: "es-CL",
      13324: "fr-ML",
      14337: "ar-AE",
      14345: "en-ID",
      14346: "es-UY",
      14348: "fr-MA",
      15361: "ar-BH",
      15369: "en-HK",
      15370: "es-PY",
      15372: "fr-HT",
      16385: "ar-QA",
      16393: "en-IN",
      16394: "es-BO",
      17409: "ar-Ploc-SA",
      17417: "en-MY",
      17418: "es-SV",
      18433: "ar-145",
      18441: "en-SG",
      18442: "es-HN",
      19465: "en-AE",
      19466: "es-NI",
      20489: "en-BH",
      20490: "es-PR",
      21513: "en-EG",
      21514: "es-US",
      22537: "en-JO",
      22538: "es-419",
      23561: "en-KW",
      23562: "es-CU",
      24585: "en-TR",
      25609: "en-YE",
      25626: "bs-Cyrl",
      26650: "bs-Latn",
      27674: "sr-Cyrl",
      28698: "sr-Latn",
      28731: "smn",
      29740: "az-Cyrl",
      29755: "sms",
      30724: "zh",
      30740: "nn",
      30746: "bs",
      30764: "az-Latn",
      30779: "sma",
      30783: "kk-Cyrl",
      30787: "uz-Cyrl",
      30800: "mn-Cyrl",
      30813: "iu-Cans",
      30815: "tzm-Tfng",
      31748: "zh-Hant",
      31764: "nb",
      31770: "sr",
      31784: "tg-Cyrl",
      31790: "dsb",
      31803: "smj",
      31807: "kk-Latn",
      31811: "uz-Latn",
      31814: "pa-Arab",
      31824: "mn-Mong",
      31833: "sd-Arab",
      31836: "chr-Cher",
      31837: "iu-Latn",
      31839: "tzm-Latn",
      31847: "ff-Latn",
      31848: "ha-Latn",
      31890: "ku-Arab",
      58380: "fr-015"
    };
    defaultLocalizedTypes = [
      [4, false],
      [5, false],
      [6, false],
      [9, false],
      [16, true]
      // RT_VERSION
    ];
  }
});

// node_modules/resedit/dist/mui/index.js
var mui_exports = {};
__export(mui_exports, {
  MuiResourceInfo: () => MuiResourceInfo_default,
  createChecksumBinary: () => createChecksumBinary,
  langIdToLanguageTag: () => langIdToLanguageTag,
  langIdToLanguageTagMap: () => langIdToLanguageTagMap,
  makeLocalizedMuiResourceFromNeutralMuiResource: () => makeLocalizedMuiResourceFromNeutralMuiResource,
  makeMuiResourcesFromSingleExecutable: () => makeMuiResourcesFromSingleExecutable,
  makeMuiResourcesFromSingleExecutableAuto: () => makeMuiResourcesFromSingleExecutableAuto
});
var init_mui = __esm({
  "node_modules/resedit/dist/mui/index.js"() {
    init_MuiResourceInfo();
    init_muiUtils();
  }
});

// node_modules/resedit/dist/resource/IconGroupEntry.js
function generateEntryBinary2(icons) {
  var count = icons.length;
  if (count > 65535) {
    count = 65535;
  }
  var size = 6 + 14 * icons.length;
  var bin = new ArrayBuffer(size);
  var view = new DataView(bin);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, count, true);
  var offset = 6;
  icons.forEach(function(icon) {
    view.setUint8(offset, icon.width >= 256 ? 0 : icon.width);
    view.setUint8(offset + 1, icon.height >= 256 ? 0 : icon.height);
    view.setUint8(offset + 2, icon.colors >= 256 ? 0 : icon.colors);
    view.setUint8(offset + 3, 0);
    view.setUint16(offset + 4, icon.planes, true);
    view.setUint16(offset + 6, icon.bitCount, true);
    view.setUint32(offset + 8, icon.dataSize, true);
    view.setUint16(offset + 12, icon.iconID, true);
    offset += 14;
  });
  return bin;
}
function findUnusedIconID(entries, lang, isCursor) {
  var type = isCursor ? 1 : 3;
  var filteredIDs = entries.filter(function(e) {
    return e.type === type && e.lang === lang && typeof e.id === "number";
  }).map(function(e) {
    return e.id;
  }).sort(function(a, b) {
    return a - b;
  });
  var idCurrent = 1;
  for (var _i = 0, filteredIDs_1 = filteredIDs; _i < filteredIDs_1.length; _i++) {
    var id = filteredIDs_1[_i];
    if (idCurrent < id) {
      return {
        id: idCurrent,
        last: false
      };
    } else if (idCurrent === id) {
      ++idCurrent;
    }
  }
  return {
    id: idCurrent,
    last: true
  };
}
var IconGroupEntry, IconGroupEntry_default;
var init_IconGroupEntry = __esm({
  "node_modules/resedit/dist/resource/IconGroupEntry.js"() {
    init_IconItem();
    init_RawIconItem();
    init_functions2();
    IconGroupEntry = /** @class */
    function() {
      function IconGroupEntry2(groupEntry) {
        var view = new DataView(groupEntry.bin);
        var totalSize = view.byteLength;
        var icons = [];
        if (view.getUint16(2, true) === 1) {
          var count = view.getUint16(4, true);
          var offset = 6;
          for (var i = 0; i < count; ++i) {
            icons.push({
              width: readUint8WithLastOffset(view, offset, totalSize),
              height: readUint8WithLastOffset(view, offset + 1, totalSize),
              colors: readUint8WithLastOffset(view, offset + 2, totalSize),
              planes: readUint16WithLastOffset(view, offset + 4, totalSize),
              bitCount: readUint16WithLastOffset(view, offset + 6, totalSize),
              dataSize: readUint32WithLastOffset(view, offset + 8, totalSize),
              iconID: readUint16WithLastOffset(view, offset + 12, totalSize)
            });
            offset += 14;
          }
        }
        this.id = groupEntry.id;
        this.lang = groupEntry.lang;
        this.icons = icons;
      }
      IconGroupEntry2.fromEntries = function(entries) {
        return entries.filter(function(e) {
          return e.type === 14;
        }).map(function(e) {
          return new IconGroupEntry2(e);
        });
      };
      IconGroupEntry2.prototype.generateEntry = function() {
        var bin = generateEntryBinary2(this.icons);
        return {
          type: 14,
          id: this.id,
          lang: this.lang,
          codepage: 0,
          bin
        };
      };
      IconGroupEntry2.prototype.getIconItemsFromEntries = function(entries) {
        var _this = this;
        return entries.map(function(e) {
          if (e.type !== 3 || e.lang !== _this.lang) {
            return null;
          }
          var c = _this.icons.filter(function(icon) {
            return e.id === icon.iconID;
          }).shift();
          if (!c) {
            return null;
          }
          return {
            entry: e,
            icon: c
          };
        }).filter(function(item) {
          return !!item;
        }).map(function(item) {
          var bin = item.entry.bin;
          var view = new DataView(bin);
          if (view.getUint32(0, true) === 40) {
            return IconItem_default.from(bin);
          } else {
            var c = item.icon;
            return RawIconItem_default.from(bin, c.width, c.height, c.bitCount);
          }
        });
      };
      IconGroupEntry2.replaceIconsForResource = function(destEntries, iconGroupID, lang, icons) {
        var entry = destEntries.filter(function(e2) {
          return e2.type === 14 && e2.id === iconGroupID && e2.lang === lang;
        }).shift();
        var tmpIconArray = icons.map(function(icon) {
          if (icon.isIcon()) {
            var width = icon.width, height = icon.height;
            if (width === null) {
              width = icon.bitmapInfo.width;
            }
            if (height === null) {
              height = icon.bitmapInfo.height;
              if (icon.masks !== null) {
                height = Math.floor(height / 2);
              }
            }
            return {
              base: icon,
              bm: {
                width,
                height,
                planes: icon.bitmapInfo.planes,
                bitCount: icon.bitmapInfo.bitCount
              },
              bin: icon.generate(),
              id: 0
            };
          } else {
            return {
              base: icon,
              bm: {
                width: icon.width,
                height: icon.height,
                planes: 1,
                bitCount: icon.bitCount
              },
              bin: icon.bin,
              id: 0
            };
          }
        });
        if (entry) {
          for (var i = destEntries.length - 1; i >= 0; --i) {
            var e = destEntries[i];
            if (e != null && e.type === 3) {
              if (!isIconUsed(e, destEntries, entry)) {
                destEntries.splice(i, 1);
              }
            }
          }
        } else {
          entry = {
            type: 14,
            id: iconGroupID,
            lang,
            codepage: 0,
            // set later
            bin: null
          };
          destEntries.push(entry);
        }
        var idInfo;
        tmpIconArray.forEach(function(icon) {
          if (!(idInfo === null || idInfo === void 0 ? void 0 : idInfo.last)) {
            idInfo = findUnusedIconID(destEntries, lang, false);
          } else {
            ++idInfo.id;
          }
          destEntries.push({
            type: 3,
            id: idInfo.id,
            lang,
            codepage: 0,
            bin: icon.bin
          });
          icon.id = idInfo.id;
        });
        var binEntry = generateEntryBinary2(tmpIconArray.map(function(icon) {
          var width = Math.abs(icon.bm.width);
          if (width >= 256) {
            width = 0;
          }
          var height = Math.abs(icon.bm.height);
          if (height >= 256) {
            height = 0;
          }
          var colors = 0;
          if (icon.base.isIcon()) {
            var bmBase = icon.base.bitmapInfo;
            colors = bmBase.colorUsed || bmBase.colors.length;
            if (!colors) {
              switch (bmBase.bitCount) {
                case 1:
                  colors = 2;
                  break;
                case 4:
                  colors = 16;
                  break;
              }
            }
            if (colors >= 256) {
              colors = 0;
            }
          }
          return {
            width,
            height,
            colors,
            planes: icon.bm.planes,
            bitCount: icon.bm.bitCount,
            dataSize: icon.bin.byteLength,
            iconID: icon.id
          };
        }));
        entry.bin = binEntry;
        function isIconUsed(icon, allEntries, excludeGroup) {
          return allEntries.some(function(e2) {
            if (e2.type !== 14 || e2.id === excludeGroup.id && e2.lang === excludeGroup.lang) {
              return false;
            }
            var g = new IconGroupEntry2(e2);
            return g.icons.some(function(c) {
              return c.iconID === icon.id;
            });
          });
        }
      };
      return IconGroupEntry2;
    }();
    IconGroupEntry_default = IconGroupEntry;
  }
});

// node_modules/resedit/dist/resource/StringTableItem.js
var StringTableItem, StringTableItem_default;
var init_StringTableItem = __esm({
  "node_modules/resedit/dist/resource/StringTableItem.js"() {
    StringTableItem = /** @class */
    function() {
      function StringTableItem2() {
        this.length = 16;
        this._a = [];
        this._a.length = 16;
        for (var i = 0; i < 16; ++i) {
          this._a[i] = "";
        }
      }
      StringTableItem2.fromEntry = function(bin, offset, byteLength) {
        var view = new DataView(bin, offset, byteLength);
        var ret = new StringTableItem2();
        var o = 0;
        for (var i = 0; i < 16; ++i) {
          var len = view.getUint16(o, true);
          o += 2;
          var s = "";
          for (var j = 0; j < len; ++j) {
            s += String.fromCharCode(view.getUint16(o, true));
            o += 2;
          }
          ret._a[i] = s;
        }
        return ret;
      };
      StringTableItem2.prototype.get = function(index) {
        var value = this._a[index];
        return value != null && value !== "" ? value : null;
      };
      StringTableItem2.prototype.getAll = function() {
        return this._a.map(function(s) {
          return s || null;
        });
      };
      StringTableItem2.prototype.set = function(index, val) {
        this._a[index] = "".concat(val !== null && val !== void 0 ? val : "").substr(0, 4097);
      };
      StringTableItem2.prototype.calcByteLength = function() {
        var len = 0;
        for (var i = 0; i < 16; ++i) {
          var item = this._a[i];
          len += 2;
          if (item != null) {
            len += 2 * item.length;
          }
        }
        return Math.floor((len + 15) / 16) * 16;
      };
      StringTableItem2.prototype.generate = function(bin, offset) {
        var out = new DataView(bin, offset);
        var len = 0;
        for (var i = 0; i < 16; ++i) {
          var s = this._a[i];
          var l = s == null ? 0 : s.length > 4097 ? 4097 : s.length;
          out.setUint16(len, l, true);
          len += 2;
          if (s != null) {
            for (var j = 0; j < l; ++j) {
              out.setUint16(len, s.charCodeAt(j), true);
              len += 2;
            }
          }
        }
        return Math.floor((len + 15) / 16) * 16;
      };
      return StringTableItem2;
    }();
    StringTableItem_default = StringTableItem;
  }
});

// node_modules/resedit/dist/resource/StringTable.js
var StringTable, StringTable_default;
var init_StringTable = __esm({
  "node_modules/resedit/dist/resource/StringTable.js"() {
    init_StringTableItem();
    StringTable = /** @class */
    function() {
      function StringTable2() {
        this.lang = 0;
        this.items = [];
      }
      StringTable2.fromEntries = function(lang, entries) {
        var r = new StringTable2();
        entries.forEach(function(e) {
          if (e.type !== 6 || e.lang !== lang || typeof e.id !== "number" || e.id <= 0) {
            return;
          }
          r.items[e.id - 1] = StringTableItem_default.fromEntry(e.bin, 0, e.bin.byteLength);
        });
        r.lang = lang;
        return r;
      };
      StringTable2.prototype.getAllStrings = function() {
        return this.items.map(function(e, i) {
          return e.getAll().map(function(x, j) {
            return x !== null && x !== "" ? { id: (i << 4) + j, text: x } : null;
          }).filter(function(x) {
            return !!x;
          });
        }).reduce(function(p, c) {
          return p.concat(c);
        }, []);
      };
      StringTable2.prototype.getById = function(id) {
        var _a;
        if (id < 0) {
          return null;
        }
        var entryIndex = id >> 4;
        var entryPos = id & 15;
        var e = this.items[entryIndex];
        return (_a = e === null || e === void 0 ? void 0 : e.get(entryPos)) !== null && _a !== void 0 ? _a : null;
      };
      StringTable2.prototype.setById = function(id, text) {
        if (id < 0) {
          return;
        }
        var entryIndex = id >> 4;
        var entryPos = id & 15;
        var e = this.items[entryIndex];
        if (!e) {
          this.items[entryIndex] = e = new StringTableItem_default();
        }
        e.set(entryPos, text);
      };
      StringTable2.prototype.generateEntries = function() {
        var _this = this;
        return this.items.map(function(e, i) {
          var len = e.calcByteLength();
          var bin = new ArrayBuffer(len);
          e.generate(bin, 0);
          return {
            type: 6,
            id: i + 1,
            lang: _this.lang,
            codepage: 1200,
            bin
          };
        }).filter(function(e) {
          return !!e;
        });
      };
      StringTable2.prototype.replaceStringEntriesForExecutable = function(res) {
        var entries = this.generateEntries();
        var dest = res.entries;
        for (var i = 0; i < dest.length; ++i) {
          var e = dest[i];
          if (e != null && e.type === 6 && e.lang === this.lang) {
            for (var j = dest.length - 1; j >= i; --j) {
              var e2 = dest[j];
              if (e2 != null && e2.type === 6 && e2.lang === this.lang) {
                dest.splice(j, 1);
              }
            }
            var f = dest.splice.bind(dest, i, 0);
            f.apply(void 0, entries);
            return;
          }
        }
        for (var i = 0; i < dest.length; ++i) {
          var e = dest[i];
          if (e != null && e.type === 6 && e.lang < this.lang) {
            var f = dest.splice.bind(dest, i + 1, 0);
            f.apply(void 0, entries);
            return;
          }
        }
        for (var i = dest.length - 1; i >= 0; --i) {
          var e = dest[i];
          if (e != null && e.type === 6) {
            var f = dest.splice.bind(dest, i + 1, 0);
            f.apply(void 0, entries);
            return;
          }
        }
        dest.push.apply(dest, entries);
      };
      return StringTable2;
    }();
    StringTable_default = StringTable;
  }
});

// node_modules/resedit/dist/resource/VersionFileFlags.js
var VersionFileFlags, VersionFileFlags_default;
var init_VersionFileFlags = __esm({
  "node_modules/resedit/dist/resource/VersionFileFlags.js"() {
    VersionFileFlags = {
      Debug: 1,
      Prerelease: 2,
      Patched: 4,
      PrivateBuild: 8,
      InfoInferred: 16,
      SpecialBuild: 32
    };
    VersionFileFlags_default = VersionFileFlags;
  }
});

// node_modules/resedit/dist/resource/VersionFileOS.js
var VersionFileOS, VersionFileOS_default;
var init_VersionFileOS = __esm({
  "node_modules/resedit/dist/resource/VersionFileOS.js"() {
    VersionFileOS = {
      Unknown: 0,
      _Windows16: 1,
      _PM16: 2,
      _PM32: 3,
      _Windows32: 4,
      DOS: 65536,
      OS2_16: 131072,
      OS2_32: 196608,
      NT: 262144,
      DOS_Windows16: 65537,
      DOS_Windows32: 65540,
      NT_Windows32: 262148,
      OS2_16_PM16: 131074,
      OS2_32_PM32: 196611
    };
    VersionFileOS_default = VersionFileOS;
  }
});

// node_modules/resedit/dist/resource/VersionFileSubtypes.js
var VersionFileDriverSubtype, VersionFileFontSubtype;
var init_VersionFileSubtypes = __esm({
  "node_modules/resedit/dist/resource/VersionFileSubtypes.js"() {
    VersionFileDriverSubtype = {
      Unknown: 0,
      Printer: 1,
      Keyboard: 2,
      Language: 3,
      Display: 4,
      Mouse: 5,
      Network: 6,
      System: 7,
      Installable: 8,
      Sound: 9,
      Comm: 10,
      VersionedPrinter: 12
    };
    VersionFileFontSubtype = {
      Unknown: 0,
      Raster: 1,
      Vector: 2,
      TrueType: 3
    };
  }
});

// node_modules/resedit/dist/resource/VersionFileType.js
var VersionFileType, VersionFileType_default;
var init_VersionFileType = __esm({
  "node_modules/resedit/dist/resource/VersionFileType.js"() {
    VersionFileType = {
      Unknown: 0,
      App: 1,
      DLL: 2,
      Driver: 3,
      Font: 4,
      VxD: 5,
      StaticLibrary: 7
    };
    VersionFileType_default = VersionFileType;
  }
});

// node_modules/resedit/dist/resource/index.js
var resource_exports = {};
__export(resource_exports, {
  IconGroupEntry: () => IconGroupEntry_default,
  StringTable: () => StringTable_default,
  VersionFileDriverSubtype: () => VersionFileDriverSubtype,
  VersionFileFlags: () => VersionFileFlags_default,
  VersionFileFontSubtype: () => VersionFileFontSubtype,
  VersionFileOS: () => VersionFileOS_default,
  VersionFileType: () => VersionFileType_default,
  VersionInfo: () => VersionInfo_default
});
var init_resource = __esm({
  "node_modules/resedit/dist/resource/index.js"() {
    init_IconGroupEntry();
    init_StringTable();
    init_VersionFileFlags();
    init_VersionFileOS();
    init_VersionFileSubtypes();
    init_VersionFileType();
    init_VersionInfo();
  }
});

// node_modules/resedit/dist/sign/data/DERObject.js
var RawDERObject;
var init_DERObject = __esm({
  "node_modules/resedit/dist/sign/data/DERObject.js"() {
    RawDERObject = /** @class */
    function() {
      function RawDERObject2(data) {
        this.data = data;
      }
      RawDERObject2.prototype.toDER = function() {
        return [].slice.call(this.data);
      };
      return RawDERObject2;
    }();
  }
});

// node_modules/resedit/dist/sign/data/derUtil.js
function makeDERLength(length) {
  if (length < 128) {
    return [length];
  }
  var r = [];
  while (true) {
    r.push(length & 255);
    if (length < 256) {
      break;
    }
    length >>= 8;
  }
  r.push(128 + r.length);
  return r.reverse();
}
function makeDERIA5String(text) {
  var r = [].map.call(text, function(c) {
    return c.charCodeAt(0);
  }).filter(function(n) {
    return n < 128;
  });
  return [22].concat(makeDERLength(r.length)).concat(r);
}
function makeDERBMPString(text) {
  var r = [].map.call(text, function(c) {
    return c.charCodeAt(0);
  });
  var ua = new Uint8Array(r.length * 2);
  var dv = new DataView(ua.buffer);
  r.forEach(function(v, i) {
    dv.setUint16(i * 2, v, false);
  });
  return [30].concat(makeDERLength(ua.length)).concat(
    // convert Uint8Array to number[] (not using spread operator)
    [].slice.call(ua)
  );
}
function makeDEROctetString(bin) {
  if (!(bin instanceof Array)) {
    bin = [].slice.call(bin);
  }
  return [4].concat(makeDERLength(bin.length)).concat(bin);
}
function makeDERTaggedData(tag, body) {
  return [160 + tag].concat(makeDERLength(body.length)).concat(body);
}
function makeDERSequence(body) {
  return [48].concat(makeDERLength(body.length)).concat(body);
}
function arrayToDERSet(items) {
  var r = items.reduce(function(prev, item) {
    return prev.concat(item instanceof Array ? item : item.toDER());
  }, []);
  return [49].concat(makeDERLength(r.length)).concat(r);
}
var init_derUtil = __esm({
  "node_modules/resedit/dist/sign/data/derUtil.js"() {
  }
});

// node_modules/resedit/dist/sign/data/ObjectIdentifier.js
var ObjectIdentifier, ObjectIdentifier_default;
var init_ObjectIdentifier = __esm({
  "node_modules/resedit/dist/sign/data/ObjectIdentifier.js"() {
    init_derUtil();
    ObjectIdentifier = /** @class */
    function() {
      function ObjectIdentifier2(value) {
        if (typeof value === "string") {
          this.value = value.split(/\./g).map(function(s) {
            return Number(s);
          });
        } else {
          this.value = value;
        }
      }
      ObjectIdentifier2.prototype.toDER = function() {
        var id = this.value;
        var r = [];
        if (id.length < 2) {
          throw new Error("Unexpected 'value' field");
        }
        r.push(id[0] * 40 + id[1]);
        for (var i = 2; i < id.length; ++i) {
          var val = id[i];
          var isFirst = true;
          var insertPos = r.length;
          while (true) {
            var v = val & 127;
            if (!isFirst) {
              v += 128;
            }
            r.splice(insertPos, 0, v);
            if (val < 128) {
              break;
            }
            isFirst = false;
            val = Math.floor(val / 128);
          }
        }
        return [6].concat(makeDERLength(r.length)).concat(r);
      };
      return ObjectIdentifier2;
    }();
    ObjectIdentifier_default = ObjectIdentifier;
  }
});

// node_modules/resedit/dist/sign/data/KnownOids.js
var OID_SHA1_NO_SIGN, OID_SHA256_NO_SIGN, OID_SHA384_NO_SIGN, OID_SHA512_NO_SIGN, OID_SHA224_NO_SIGN, OID_SHA512_224_NO_SIGN, OID_SHA512_256_NO_SIGN, OID_SHA3_224_NO_SIGN, OID_SHA3_256_NO_SIGN, OID_SHA3_384_NO_SIGN, OID_SHA3_512_NO_SIGN, OID_SHAKE128_NO_SIGN, OID_SHAKE256_NO_SIGN, OID_RSA, OID_DSA, OID_SIGNED_DATA, OID_CONTENT_TYPE, OID_MESSAGE_DIGEST, OID_SPC_STATEMENT_TYPE_OBJID, OID_SPC_SP_OPUS_INFO_OBJID, OID_SPC_INDIVIDUAL_SP_KEY_PURPOSE_OBJID, OID_RFC3161_COUNTER_SIGNATURE;
var init_KnownOids = __esm({
  "node_modules/resedit/dist/sign/data/KnownOids.js"() {
    init_ObjectIdentifier();
    OID_SHA1_NO_SIGN = new ObjectIdentifier_default([1, 3, 14, 3, 2, 26]);
    OID_SHA256_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 1]);
    OID_SHA384_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 2]);
    OID_SHA512_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 3]);
    OID_SHA224_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 4]);
    OID_SHA512_224_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 5]);
    OID_SHA512_256_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 6]);
    OID_SHA3_224_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 7]);
    OID_SHA3_256_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 8]);
    OID_SHA3_384_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 9]);
    OID_SHA3_512_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 10]);
    OID_SHAKE128_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 11]);
    OID_SHAKE256_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 12]);
    OID_RSA = new ObjectIdentifier_default([1, 2, 840, 113549, 1, 1, 1]);
    OID_DSA = new ObjectIdentifier_default([1, 2, 840, 10040, 4, 1]);
    OID_SIGNED_DATA = new ObjectIdentifier_default([1, 2, 840, 113549, 1, 7, 2]);
    OID_CONTENT_TYPE = new ObjectIdentifier_default([1, 2, 840, 113549, 1, 9, 3]);
    OID_MESSAGE_DIGEST = new ObjectIdentifier_default([1, 2, 840, 113549, 1, 9, 4]);
    OID_SPC_STATEMENT_TYPE_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 11]);
    OID_SPC_SP_OPUS_INFO_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 12]);
    OID_SPC_INDIVIDUAL_SP_KEY_PURPOSE_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 21]);
    OID_RFC3161_COUNTER_SIGNATURE = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 3, 3, 1]);
  }
});

// node_modules/resedit/dist/sign/certUtil.js
function toUint8Array(bin) {
  if ("buffer" in bin) {
    return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
  } else {
    return new Uint8Array(bin);
  }
}
function calculateDERLength(data, offset) {
  var actualLength = 0;
  var value = data[offset];
  if (value == null) {
    throw new Error('Invalid "offset" value');
  } else if (value < 128) {
    actualLength = value;
    ++offset;
  } else if (value === 128) {
    throw new Error("Not supported certificate data (variable length)");
  } else {
    var c = value & 127;
    ++offset;
    while (c--) {
      if (offset >= data.length) {
        throw new Error("Invalid certificate data (invalid sequence length)");
      }
      actualLength <<= 8;
      actualLength |= data[offset];
      ++offset;
    }
  }
  return [actualLength, offset];
}
function skipField(data, offsetOfDataHead) {
  var _a = calculateDERLength(data, offsetOfDataHead + 1), len = _a[0], off = _a[1];
  return off + len;
}
function pickCertificatesIfDERHasSignedData(ub, offset) {
  var _a, _b, _c, _d, _e;
  if (ub.length < offset + 2) {
    return null;
  }
  if (ub[offset] !== 48) {
    return null;
  }
  var tempLength;
  _a = calculateDERLength(ub, offset + 1), tempLength = _a[0], offset = _a[1];
  if (tempLength > ub.length - offset) {
    throw new Error("Invalid certificate data (insufficient data length)");
  }
  if (ub[offset] !== 6) {
    return null;
  }
  var signedDataOid = OID_SIGNED_DATA.toDER();
  for (var i = 0; i < signedDataOid.length; ++i) {
    if (ub[offset + i] !== signedDataOid[i]) {
      return null;
    }
  }
  offset += signedDataOid.length;
  if (ub[offset] !== 160) {
    throw new Error("Invalid certificate data (no content in contentInfo)");
  }
  _b = calculateDERLength(ub, offset + 1), tempLength = _b[0], offset = _b[1];
  if (offset + tempLength > ub.length) {
    throw new Error("Invalid certificate data (invalid length for content)");
  }
  if (ub[offset] !== 48) {
    throw new Error("Invalid certificate data (unexpected signedData)");
  }
  _c = calculateDERLength(ub, offset + 1), tempLength = _c[0], offset = _c[1];
  if (offset + tempLength > ub.length) {
    throw new Error("Invalid certificate data (invalid length for signedData)");
  }
  if (ub[offset] !== 2 || ub[offset + 1] !== 1 || ub[offset + 2] !== 1) {
    throw new Error("Invalid certificate data (unexpected signedData.version)");
  }
  offset += 3;
  if (ub[offset] !== 49) {
    throw new Error("Invalid certificate data (no signedData.digestAlgorithms)");
  }
  _d = calculateDERLength(ub, offset + 1), tempLength = _d[0], offset = _d[1];
  if (offset + tempLength > ub.length) {
    throw new Error("Invalid certificate data (invalid length for signedData.digestAlgorithms)");
  }
  offset += tempLength;
  if (ub[offset] !== 48) {
    throw new Error("Invalid certificate data (no signedData.contentInfo)");
  }
  _e = calculateDERLength(ub, offset + 1), tempLength = _e[0], offset = _e[1];
  if (offset + tempLength > ub.length) {
    throw new Error("Invalid certificate data (invalid length for signedData.contentInfo)");
  }
  offset += tempLength;
  if (ub[offset] !== 160) {
    throw new Error("Invalid certificate data (no signedData.certificates)");
  }
  var _f = calculateDERLength(ub, offset + 1), certsLength = _f[0], newOffset = _f[1];
  if (newOffset + certsLength > ub.length) {
    throw new Error("Invalid certificate data (invalid length for signedData.certificates)");
  }
  return ub.subarray(offset, newOffset + certsLength);
}
function pickIssuerAndSerialNumberDERFromCert(bin) {
  var _a, _b;
  if (Array.isArray(bin)) {
    if (bin.length === 0) {
      throw new Error("No data is specified.");
    }
    return pickIssuerAndSerialNumberDERFromCert(bin[0]);
  }
  var ub = toUint8Array(bin);
  if (ub.length < 2) {
    throw new Error("Invalid certificate data");
  }
  if (ub[0] !== 48) {
    throw new Error("Not supported certificate data (non-`Certificate`-format data)");
  }
  var certsBin = pickCertificatesIfDERHasSignedData(ub, 0);
  if (certsBin) {
    var _c = calculateDERLength(certsBin, 1), tempLength_1 = _c[0], eaten_1 = _c[1];
    if (eaten_1 + tempLength_1 > certsBin.length) {
      throw new Error("Invalid certificate data (invalid length for signedData.certificates)");
    }
    if (certsBin[eaten_1] !== 48) {
      throw new Error("Invalid certificate data (no signedData.certificates[0])");
    }
    var _d = calculateDERLength(certsBin, eaten_1 + 1), certLength = _d[0], tempOffset = _d[1];
    if (tempOffset + certLength > certsBin.length) {
      throw new Error("Invalid certificate data (invalid length for signedData.certificates[0])");
    }
    return pickIssuerAndSerialNumberDERFromCert(certsBin.subarray(eaten_1, tempOffset + certLength));
  }
  var tempLength;
  var eaten;
  _a = calculateDERLength(ub, 1), tempLength = _a[0], eaten = _a[1];
  if (tempLength > ub.length - eaten) {
    throw new Error("Invalid certificate data (insufficient data length)");
  }
  if (ub[eaten] !== 48) {
    throw new Error("Invalid certificate data (missing tbsCertificate)");
  }
  var tbsCertificateLen;
  _b = calculateDERLength(ub, eaten + 1), tbsCertificateLen = _b[0], eaten = _b[1];
  if (tbsCertificateLen > ub.length - eaten) {
    throw new Error("Invalid certificate data (invalid tbsCertificate length)");
  }
  var tbsOffsetLast = eaten + tbsCertificateLen;
  if (ub[eaten] === 160) {
    eaten = skipField(ub, eaten);
    if (eaten >= tbsOffsetLast) {
      throw new Error("Invalid certificate data (insufficient tbsCertificate data: after version)");
    }
  }
  if (ub[eaten] !== 2) {
    throw new Error("Invalid certificate data (invalid serialNumber)");
  }
  var offsetAfterSerialNumber = skipField(ub, eaten);
  if (eaten >= tbsOffsetLast) {
    throw new Error("Invalid certificate data (insufficient tbsCertificate data: after serialNumber)");
  }
  var serialNumberDER = [].slice.call(ub, eaten, offsetAfterSerialNumber);
  eaten = offsetAfterSerialNumber;
  if (ub[eaten] !== 48) {
    throw new Error("Invalid certificate data (invalid algorithmIdentifier)");
  }
  eaten = skipField(ub, eaten);
  if (eaten >= tbsOffsetLast) {
    throw new Error("Invalid certificate data (insufficient tbsCertificate data: after serialNumber)");
  }
  if (ub[eaten] !== 48) {
    throw new Error("Invalid certificate data (invalid issuer)");
  }
  var offsetAfterIssuer = skipField(ub, eaten);
  if (offsetAfterIssuer > tbsOffsetLast) {
    throw new Error("Invalid certificate data (insufficient tbsCertificate data: issuer)");
  }
  return [
    // return entire issuer sequence
    [].slice.call(ub, eaten, offsetAfterIssuer),
    serialNumberDER
  ];
}
function certBinToCertificatesDER(bin) {
  if (Array.isArray(bin)) {
    return bin.map(certBinToCertificatesDER).reduce(function(prev, cur) {
      return prev.concat(cur);
    }, []);
  }
  var ub = toUint8Array(bin);
  var certsBin = pickCertificatesIfDERHasSignedData(ub, 0);
  if (certsBin) {
    var _a = calculateDERLength(certsBin, 1), tempLength = _a[0], eaten = _a[1];
    if (eaten + tempLength > certsBin.length) {
      throw new Error("Invalid certificate data (invalid length for signedData.certificates)");
    }
    var offsetLast = eaten + tempLength;
    var rawData = [];
    for (var offset = eaten; offset < offsetLast; ) {
      if (certsBin[offset] !== 48) {
        throw new Error("Invalid certificate data (no signedData.certificates[*])");
      }
      var _b = calculateDERLength(certsBin, offset + 1), certLength = _b[0], tempOffset = _b[1];
      if (tempOffset + certLength > certsBin.length) {
        throw new Error("Invalid certificate data (invalid length for signedData.certificates[*])");
      }
      rawData.push(new RawDERObject(certsBin.subarray(offset, tempOffset + certLength)));
      offset = tempOffset + certLength;
    }
    return rawData;
  } else {
    return [new RawDERObject(ub)];
  }
}
var init_certUtil = __esm({
  "node_modules/resedit/dist/sign/certUtil.js"() {
    init_DERObject();
    init_KnownOids();
  }
});

// node_modules/resedit/dist/sign/data/AlgorithmIdentifier.js
var AlgorithmIdentifier, AlgorithmIdentifier_default;
var init_AlgorithmIdentifier = __esm({
  "node_modules/resedit/dist/sign/data/AlgorithmIdentifier.js"() {
    init_derUtil();
    AlgorithmIdentifier = /** @class */
    function() {
      function AlgorithmIdentifier2(algorithm) {
        this.algorithm = algorithm;
      }
      AlgorithmIdentifier2.prototype.toDER = function() {
        var r = this.algorithm.toDER();
        return makeDERSequence(r.concat(
          // parameters is not used now
          [5, 0]
        ));
      };
      return AlgorithmIdentifier2;
    }();
    AlgorithmIdentifier_default = AlgorithmIdentifier;
  }
});

// node_modules/resedit/dist/sign/data/Attribute.js
var Attribute, Attribute_default;
var init_Attribute = __esm({
  "node_modules/resedit/dist/sign/data/Attribute.js"() {
    init_derUtil();
    Attribute = /** @class */
    function() {
      function Attribute2(attrType, attrValues) {
        this.attrType = attrType;
        this.attrValues = attrValues;
      }
      Attribute2.prototype.toDER = function() {
        return makeDERSequence(this.attrType.toDER().concat(arrayToDERSet(this.attrValues)));
      };
      return Attribute2;
    }();
    Attribute_default = Attribute;
  }
});

// node_modules/resedit/dist/sign/data/ContentInfo.js
var ContentInfo, ContentInfo_default;
var init_ContentInfo = __esm({
  "node_modules/resedit/dist/sign/data/ContentInfo.js"() {
    init_derUtil();
    ContentInfo = /** @class */
    function() {
      function ContentInfo2(contentType, content) {
        this.contentType = contentType;
        this.content = content;
      }
      ContentInfo2.prototype.toDER = function() {
        return makeDERSequence(this.contentType.toDER().concat(makeDERTaggedData(0, this.content.toDER())));
      };
      return ContentInfo2;
    }();
    ContentInfo_default = ContentInfo;
  }
});

// node_modules/resedit/dist/sign/data/CertificateDataRoot.js
var __extends9, CertificateDataRoot, CertificateDataRoot_default;
var init_CertificateDataRoot = __esm({
  "node_modules/resedit/dist/sign/data/CertificateDataRoot.js"() {
    init_ContentInfo();
    __extends9 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    CertificateDataRoot = /** @class */
    function(_super) {
      __extends9(CertificateDataRoot2, _super);
      function CertificateDataRoot2() {
        return _super !== null && _super.apply(this, arguments) || this;
      }
      return CertificateDataRoot2;
    }(ContentInfo_default);
    CertificateDataRoot_default = CertificateDataRoot;
  }
});

// node_modules/resedit/dist/sign/data/DigestInfo.js
var DigestInfo, DigestInfo_default;
var init_DigestInfo = __esm({
  "node_modules/resedit/dist/sign/data/DigestInfo.js"() {
    init_derUtil();
    DigestInfo = /** @class */
    function() {
      function DigestInfo2(digestAlgorithm, digest) {
        this.digestAlgorithm = digestAlgorithm;
        this.digest = digest;
      }
      DigestInfo2.prototype.toDER = function() {
        var digest = this.digest;
        var digestArray;
        if ("buffer" in digest) {
          digestArray = new Uint8Array(digest.buffer, digest.byteOffset, digest.byteLength);
        } else {
          digestArray = new Uint8Array(digest);
        }
        var derData = this.digestAlgorithm.toDER().concat(makeDEROctetString(digestArray));
        return makeDERSequence(derData);
      };
      return DigestInfo2;
    }();
    DigestInfo_default = DigestInfo;
  }
});

// node_modules/resedit/dist/sign/data/IssuerAndSerialNumber.js
var IssuerAndSerialNumber, IssuerAndSerialNumber_default;
var init_IssuerAndSerialNumber = __esm({
  "node_modules/resedit/dist/sign/data/IssuerAndSerialNumber.js"() {
    init_derUtil();
    IssuerAndSerialNumber = /** @class */
    function() {
      function IssuerAndSerialNumber2(issuer, serialNumber) {
        this.issuer = issuer;
        this.serialNumber = serialNumber;
      }
      IssuerAndSerialNumber2.prototype.toDER = function() {
        return makeDERSequence(this.issuer.toDER().concat(this.serialNumber.toDER()));
      };
      return IssuerAndSerialNumber2;
    }();
    IssuerAndSerialNumber_default = IssuerAndSerialNumber;
  }
});

// node_modules/resedit/dist/sign/data/SignedData.js
var SignedData, SignedData_default;
var init_SignedData = __esm({
  "node_modules/resedit/dist/sign/data/SignedData.js"() {
    init_derUtil();
    SignedData = /** @class */
    function() {
      function SignedData2(version, digestAlgorithms, contentInfo, signerInfos, certificates, crls) {
        this.version = version;
        this.digestAlgorithms = digestAlgorithms;
        this.contentInfo = contentInfo;
        this.signerInfos = signerInfos;
        this.certificates = certificates;
        this.crls = crls;
      }
      SignedData2.prototype.toDER = function() {
        var r = [2, 1, this.version & 255].concat(arrayToDERSet(this.digestAlgorithms)).concat(this.contentInfo.toDER());
        if (this.certificates && this.certificates.length > 0) {
          var allCertsDER = arrayToDERSet(this.certificates);
          allCertsDER[0] = 160;
          r = r.concat(allCertsDER);
        }
        if (this.crls) {
          r = r.concat(makeDERTaggedData(1, arrayToDERSet(this.crls)));
        }
        r = r.concat(arrayToDERSet(this.signerInfos));
        return makeDERSequence(r);
      };
      return SignedData2;
    }();
    SignedData_default = SignedData;
  }
});

// node_modules/resedit/dist/sign/data/SignerInfo.js
var SignerInfo, SignerInfo_default;
var init_SignerInfo = __esm({
  "node_modules/resedit/dist/sign/data/SignerInfo.js"() {
    init_derUtil();
    SignerInfo = /** @class */
    function() {
      function SignerInfo2(version, issuerAndSerialNumber, digestAlgorithm, digestEncryptionAlgorithm, encryptedDigest, authenticatedAttributes, unauthenticatedAttributes) {
        this.version = version;
        this.issuerAndSerialNumber = issuerAndSerialNumber;
        this.digestAlgorithm = digestAlgorithm;
        this.digestEncryptionAlgorithm = digestEncryptionAlgorithm;
        this.encryptedDigest = encryptedDigest;
        this.authenticatedAttributes = authenticatedAttributes;
        this.unauthenticatedAttributes = unauthenticatedAttributes;
      }
      SignerInfo2.prototype.toDER = function() {
        var r = [2, 1, this.version & 255].concat(this.issuerAndSerialNumber.toDER()).concat(this.digestAlgorithm.toDER());
        if (this.authenticatedAttributes && this.authenticatedAttributes.length > 0) {
          var a = arrayToDERSet(this.authenticatedAttributes);
          a[0] = 160;
          r = r.concat(a);
        }
        r = r.concat(this.digestEncryptionAlgorithm.toDER()).concat(makeDEROctetString(this.encryptedDigest));
        if (this.unauthenticatedAttributes && this.unauthenticatedAttributes.length > 0) {
          var u = arrayToDERSet(this.unauthenticatedAttributes);
          u[0] = 161;
          r = r.concat(u);
        }
        return makeDERSequence(r);
      };
      return SignerInfo2;
    }();
    SignerInfo_default = SignerInfo;
  }
});

// node_modules/resedit/dist/sign/data/SpcIndirectDataContent.js
var __extends10, SPC_INDIRECT_DATA_OBJID, SpcAttributeTypeAndOptionalValue, SpcIndirectDataContent, SpcIndirectDataContent_default, SpcIndirectDataContentInfo;
var init_SpcIndirectDataContent = __esm({
  "node_modules/resedit/dist/sign/data/SpcIndirectDataContent.js"() {
    init_ContentInfo();
    init_derUtil();
    init_ObjectIdentifier();
    __extends10 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    SPC_INDIRECT_DATA_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 4]);
    SpcAttributeTypeAndOptionalValue = /** @class */
    function() {
      function SpcAttributeTypeAndOptionalValue2(type, value) {
        this.type = type;
        this.value = value;
      }
      SpcAttributeTypeAndOptionalValue2.prototype.toDER = function() {
        return makeDERSequence(this.type.toDER().concat(this.value.toDER()));
      };
      return SpcAttributeTypeAndOptionalValue2;
    }();
    SpcIndirectDataContent = /** @class */
    function() {
      function SpcIndirectDataContent2(data, messageDigest) {
        this.data = data;
        this.messageDigest = messageDigest;
      }
      SpcIndirectDataContent2.prototype.toDER = function() {
        return makeDERSequence(this.toDERWithoutHeader());
      };
      SpcIndirectDataContent2.prototype.toDERWithoutHeader = function() {
        return this.data.toDER().concat(this.messageDigest.toDER());
      };
      return SpcIndirectDataContent2;
    }();
    SpcIndirectDataContent_default = SpcIndirectDataContent;
    SpcIndirectDataContentInfo = /** @class */
    function(_super) {
      __extends10(SpcIndirectDataContentInfo2, _super);
      function SpcIndirectDataContentInfo2(content) {
        return _super.call(this, SPC_INDIRECT_DATA_OBJID, content) || this;
      }
      return SpcIndirectDataContentInfo2;
    }(ContentInfo_default);
  }
});

// node_modules/resedit/dist/sign/data/SpcLink.js
var __extends11, SpcLink, SpcLinkUrl, SpcLinkFile;
var init_SpcLink = __esm({
  "node_modules/resedit/dist/sign/data/SpcLink.js"() {
    init_DERObject();
    init_derUtil();
    __extends11 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    SpcLink = /** @class */
    function() {
      function SpcLink2(tag, value) {
        this.tag = tag;
        this.value = value;
      }
      SpcLink2.prototype.toDER = function() {
        var v = this.value.toDER();
        if (this.tag === 2) {
          return makeDERTaggedData(this.tag, v);
        } else {
          v[0] = 128 + this.tag;
          return v;
        }
      };
      return SpcLink2;
    }();
    SpcLinkUrl = /** @class */
    function(_super) {
      __extends11(SpcLinkUrl2, _super);
      function SpcLinkUrl2(url) {
        return _super.call(this, 0, new RawDERObject(makeDERIA5String(url))) || this;
      }
      return SpcLinkUrl2;
    }(SpcLink);
    SpcLinkFile = /** @class */
    function(_super) {
      __extends11(SpcLinkFile2, _super);
      function SpcLinkFile2(file) {
        var v = makeDERBMPString(file);
        v[0] = 128;
        return _super.call(this, 2, new RawDERObject(v)) || this;
      }
      return SpcLinkFile2;
    }(SpcLink);
  }
});

// node_modules/resedit/dist/sign/data/SpcPeImageData.js
var __extends12, SPC_PE_IMAGE_DATA_OBJID, SpcPeImageFlags, SpcPeImageData, SpcPeImageData_default, SpcPeImageAttributeTypeAndOptionalValue;
var init_SpcPeImageData = __esm({
  "node_modules/resedit/dist/sign/data/SpcPeImageData.js"() {
    init_derUtil();
    init_ObjectIdentifier();
    init_SpcIndirectDataContent();
    __extends12 = /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    SPC_PE_IMAGE_DATA_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 15]);
    SpcPeImageFlags = {
      IncludeResources: 0,
      IncludeDebugInfo: 1,
      IncludeImportAddressTable: 2
    };
    SpcPeImageData = /** @class */
    function() {
      function SpcPeImageData2(flags, file) {
        this.flags = flags;
        this.file = file;
      }
      SpcPeImageData2.prototype.toDER = function() {
        return makeDERSequence([3, 1, this.flags & 255].concat(
          // undocumented -- SpcLink must be tagged
          makeDERTaggedData(0, this.file.toDER())
        ));
      };
      return SpcPeImageData2;
    }();
    SpcPeImageData_default = SpcPeImageData;
    SpcPeImageAttributeTypeAndOptionalValue = /** @class */
    function(_super) {
      __extends12(SpcPeImageAttributeTypeAndOptionalValue2, _super);
      function SpcPeImageAttributeTypeAndOptionalValue2(value) {
        return _super.call(this, SPC_PE_IMAGE_DATA_OBJID, value) || this;
      }
      return SpcPeImageAttributeTypeAndOptionalValue2;
    }(SpcAttributeTypeAndOptionalValue);
  }
});

// node_modules/resedit/dist/sign/timestamp.js
function createTimestampRequest(data, algorithmIdentifier) {
  return new Uint8Array(makeDERSequence(
    // version
    [2, 1, 1].concat(makeDERSequence(algorithmIdentifier.toDER().concat(makeDEROctetString(toUint8Array(data))))).concat([1, 1, 255])
  )).buffer;
}
function pickSignedDataFromTimestampResponse(data) {
  var _a, _b, _c, _d, _e, _f;
  var ub = toUint8Array(data);
  if (ub.length < 2 || ub[0] !== 48) {
    throw new Error("Invalid or unexpected timestamp response");
  }
  var len;
  var offset;
  _a = calculateDERLength(ub, 1), len = _a[0], offset = _a[1];
  if (len > ub.length - offset) {
    throw new Error("Invalid or unexpected timestamp response (insufficient buffer)");
  }
  var dataLast = offset + len;
  if (ub[offset] !== 48) {
    throw new Error("Invalid or unexpected timestamp response (no PKIStatusInfo)");
  }
  _b = calculateDERLength(ub, offset + 1), len = _b[0], offset = _b[1];
  if (offset >= dataLast) {
    throw new Error("Invalid or unexpected timestamp response (invalid length for PKIStatusInfo)");
  }
  var timeStampTokenOffset = offset + len;
  if (ub[offset] !== 2 || ub[offset + 1] !== 1) {
    throw new Error("Invalid or unexpected timestamp response (invalid PKIStatusInfo.status)");
  }
  var status = ub[offset + 2];
  switch (status) {
    case 0:
    // granted
    case 1:
      break;
    case 2:
    // rejection
    case 3:
    // waiting
    case 4:
    // revocationWarning
    case 5: {
      var msg = "Timestamp response has error status ".concat(status);
      if (offset + 3 < timeStampTokenOffset && ub[offset + 3] === 48) {
        _c = calculateDERLength(ub, offset + 4), len = _c[0], offset = _c[1];
        if (offset + len <= timeStampTokenOffset && ub[offset] === 12) {
          _d = calculateDERLength(ub, offset + 1), len = _d[0], offset = _d[1];
          if (offset + len <= timeStampTokenOffset) {
            var statusString = (
              // pick UTF8String body
              [].slice.call(ub, offset, offset + len).map(function(val) {
                if (val >= 32 && val <= 126) {
                  return String.fromCharCode(val);
                } else {
                  var s = val.toString(16);
                  if (s.length === 1) {
                    s = "0" + s;
                  }
                  return "%" + s;
                }
              }).join("")
            );
            msg += ", text = " + decodeURIComponent(statusString);
          }
        }
      }
      throw new Error(msg);
    }
    default:
      throw new Error("Unexpected PKIStatusInfo.status: ".concat(status !== null && status !== void 0 ? status : "(unknown)"));
  }
  if (timeStampTokenOffset + 1 >= dataLast || ub[timeStampTokenOffset] !== 48) {
    throw new Error("Invalid or unexpected timestamp response (no TimeStampToken)");
  }
  _e = calculateDERLength(ub, timeStampTokenOffset + 1), len = _e[0], offset = _e[1];
  if (offset + len > dataLast) {
    throw new Error("Invalid or unexpected timestamp response (insufficient data for TimeStampToken)");
  }
  var signedDataOid = OID_SIGNED_DATA.toDER();
  if (ub[offset] !== 6) {
    throw new Error("Invalid or unexpected timestamp response (no contentType in TimeStampToken)");
  }
  for (var i = 0; i < signedDataOid.length; ++i) {
    if (ub[offset + i] !== signedDataOid[i]) {
      throw new Error("Invalid or unexpected timestamp response (unexpected TimeStampToken.contentType octet)");
    }
  }
  offset += signedDataOid.length;
  if (ub[offset] !== 160) {
    throw new Error("Invalid or unexpected timestamp response (no content in TimeStampToken)");
  }
  _f = calculateDERLength(ub, offset + 1), len = _f[0], offset = _f[1];
  if (offset + len > dataLast) {
    throw new Error("Invalid or unexpected timestamp response (invalid length for TimeStampToken.content)");
  }
  return allocatePartialBinary2(ub, offset, len);
}
var init_timestamp = __esm({
  "node_modules/resedit/dist/sign/timestamp.js"() {
    init_functions2();
    init_certUtil();
    init_derUtil();
    init_KnownOids();
  }
});

// node_modules/resedit/dist/sign/index.js
function makeSimpleIterator(data) {
  var done = false;
  return {
    next: function() {
      if (done) {
        return {
          done: true,
          value: void 0
        };
      } else {
        done = true;
        return {
          done: false,
          value: data
        };
      }
    }
  };
}
function validateSignerObject(signer) {
  if (!signer.encryptData && !signer.signData) {
    throw new Error("Signer object must implement either `encryptData` or `signData`.");
  }
}
function calculateExecutableDigest(executable, signer, alignment) {
  function inner() {
    var checkSumOffset, certificateTableOffset, rawHeader, targetSections, sectionCount, sectionStartOffset, sectionEndOffset, sectionHeadersSize, secHeader, secArray_1, off, _i, targetSections_1, section, exData, alignedLength, diff;
    return __generator(this, function(_a) {
      switch (_a.label) {
        case 0:
          checkSumOffset = executable.dosHeader.newHeaderAddress + 88;
          certificateTableOffset = executable.dosHeader.newHeaderAddress + executable.newHeader.getDataDirectoryOffset() + format_exports.ImageDataDirectoryArray.itemSize * format_exports.ImageDirectoryEntry.Certificate;
          rawHeader = executable.getRawHeader();
          targetSections = executable.getAllSections();
          sectionCount = targetSections.length;
          sectionStartOffset = rawHeader.byteLength;
          sectionEndOffset = roundUp2(sectionStartOffset + sectionCount * format_exports.ImageSectionHeaderArray.itemSize, executable.getFileAlignment());
          sectionHeadersSize = sectionEndOffset - sectionStartOffset;
          secHeader = new ArrayBuffer(sectionHeadersSize);
          {
            secArray_1 = format_exports.ImageSectionHeaderArray.from(secHeader, sectionCount);
            targetSections.forEach(function(sec, i) {
              secArray_1.set(i, sec.info);
            });
          }
          return [4, allocatePartialBinary2(rawHeader, 0, checkSumOffset)];
        case 1:
          _a.sent();
          return [4, allocatePartialBinary2(rawHeader, checkSumOffset + 4, certificateTableOffset - (checkSumOffset + 4))];
        case 2:
          _a.sent();
          off = certificateTableOffset + format_exports.ImageDataDirectoryArray.itemSize;
          return [4, allocatePartialBinary2(executable.getRawHeader(), off, executable.getTotalHeaderSize() - off)];
        case 3:
          _a.sent();
          return [4, secHeader];
        case 4:
          _a.sent();
          _i = 0, targetSections_1 = targetSections;
          _a.label = 5;
        case 5:
          if (!(_i < targetSections_1.length)) return [3, 8];
          section = targetSections_1[_i];
          if (!section.data) return [3, 7];
          return [4, section.data];
        case 6:
          _a.sent();
          _a.label = 7;
        case 7:
          _i++;
          return [3, 5];
        case 8:
          exData = executable.getExtraData();
          if (!(exData !== null)) return [3, 11];
          return [4, exData];
        case 9:
          _a.sent();
          alignedLength = roundUp2(exData.byteLength, alignment);
          diff = alignedLength - exData.byteLength;
          if (!(diff !== 0)) return [3, 11];
          return [4, new Uint8Array(diff).buffer];
        case 10:
          _a.sent();
          _a.label = 11;
        case 11:
          return [
            2
            /*return*/
          ];
      }
    });
  }
  return signer.digestData(inner());
}
function getAlgorithmIdentifierObject(type) {
  if (typeof type !== "string") {
    return new AlgorithmIdentifier_default(new ObjectIdentifier_default(type));
  }
  switch (type) {
    case "sha1":
    case "SHA1":
      return new AlgorithmIdentifier_default(OID_SHA1_NO_SIGN);
    case "sha256":
    case "SHA256":
      return new AlgorithmIdentifier_default(OID_SHA256_NO_SIGN);
    case "sha384":
    case "SHA384":
      return new AlgorithmIdentifier_default(OID_SHA384_NO_SIGN);
    case "sha512":
    case "SHA512":
      return new AlgorithmIdentifier_default(OID_SHA512_NO_SIGN);
    case "sha224":
    case "SHA224":
      return new AlgorithmIdentifier_default(OID_SHA224_NO_SIGN);
    case "sha512-224":
    case "SHA512-224":
      return new AlgorithmIdentifier_default(OID_SHA512_224_NO_SIGN);
    case "sha512-256":
    case "SHA512-256":
      return new AlgorithmIdentifier_default(OID_SHA512_256_NO_SIGN);
    case "sha3-224":
    case "SHA3-224":
      return new AlgorithmIdentifier_default(OID_SHA3_224_NO_SIGN);
    case "sha3-256":
    case "SHA3-256":
      return new AlgorithmIdentifier_default(OID_SHA3_256_NO_SIGN);
    case "sha3-384":
    case "SHA3-384":
      return new AlgorithmIdentifier_default(OID_SHA3_384_NO_SIGN);
    case "sha3-512":
    case "SHA3-512":
      return new AlgorithmIdentifier_default(OID_SHA3_512_NO_SIGN);
    case "shake128":
    case "SHAKE128":
      return new AlgorithmIdentifier_default(OID_SHAKE128_NO_SIGN);
    case "shake256":
    case "SHAKE256":
      return new AlgorithmIdentifier_default(OID_SHAKE256_NO_SIGN);
    default:
      throw new Error("Invalid or unsupported digest algorithm");
  }
}
function doSign(signer, digestAlgorithm, dataIterator) {
  if (signer.signData) {
    return signer.signData(dataIterator);
  } else {
    return signer.digestData(dataIterator).then(function(digestAttributes) {
      var digestInfoBin = new Uint8Array(new DigestInfo_default(digestAlgorithm, digestAttributes).toDER()).buffer;
      return signer.encryptData(makeSimpleIterator(digestInfoBin));
    });
  }
}
function generateExecutableWithSign(executable, signer, alignment) {
  validateSignerObject(signer);
  var certAlignment;
  if (typeof alignment === "number") {
    if (alignment <= 0) {
      throw new Error("Invalid alignment value");
    }
    certAlignment = alignment;
  } else {
    certAlignment = executable.getFileAlignment();
  }
  var digestAlgorithm = getAlgorithmIdentifierObject(signer.getDigestAlgorithm());
  var digestEncryptionAlgorithm;
  var a = signer.getEncryptionAlgorithm();
  if (typeof a !== "string") {
    digestEncryptionAlgorithm = new AlgorithmIdentifier_default(new ObjectIdentifier_default(a));
  } else {
    switch (a) {
      case "rsa":
      case "RSA":
        digestEncryptionAlgorithm = new AlgorithmIdentifier_default(OID_RSA);
        break;
      case "dsa":
      case "DSA":
        digestEncryptionAlgorithm = new AlgorithmIdentifier_default(OID_DSA);
        break;
      default:
        throw new Error("Invalid or unsupported digest encryption algorithm");
    }
  }
  var cert = signer.getCertificateData ? signer.getCertificateData() : signer.getPublicKeyData();
  var _a = pickIssuerAndSerialNumberDERFromCert(cert), issuer = _a[0], serialNumber = _a[1];
  return (
    // calculate digest
    calculateExecutableDigest(executable, signer, certAlignment).then(function(digest) {
      var content = new SpcIndirectDataContent_default(new SpcPeImageAttributeTypeAndOptionalValue(new SpcPeImageData_default(SpcPeImageFlags.IncludeResources, new SpcLinkFile(""))), new DigestInfo_default(digestAlgorithm, digest));
      return signer.digestData(makeSimpleIterator(new Uint8Array(content.toDERWithoutHeader()).buffer)).then(function(contentDigest) {
        var attributes = [
          new Attribute_default(
            OID_SPC_SP_OPUS_INFO_OBJID,
            // (SpcSpOpusInfo) null sequence
            [new RawDERObject([48, 0])]
          ),
          new Attribute_default(OID_CONTENT_TYPE, [
            SPC_INDIRECT_DATA_OBJID
          ]),
          new Attribute_default(OID_SPC_STATEMENT_TYPE_OBJID, [
            new RawDERObject(makeDERSequence(OID_SPC_INDIVIDUAL_SP_KEY_PURPOSE_OBJID.toDER()))
          ]),
          new Attribute_default(OID_MESSAGE_DIGEST, [
            new RawDERObject(makeDEROctetString(toUint8Array(contentDigest)))
          ])
        ];
        var attrBin = new Uint8Array(arrayToDERSet(attributes)).buffer;
        return doSign(signer, digestAlgorithm, makeSimpleIterator(attrBin)).then(function(signed) {
          return [content, attributes, signed];
        });
      });
    }).then(function(_a2) {
      var content = _a2[0], attributes = _a2[1], signed = _a2[2];
      var signerInfo = new SignerInfo_default(
        // version
        1,
        // issuerAndSerialNumber
        new IssuerAndSerialNumber_default(new RawDERObject(issuer), new RawDERObject(serialNumber)),
        // digestAlgorithm
        digestAlgorithm,
        // digestEncryptionAlgorithm
        digestEncryptionAlgorithm,
        // encryptedDigest
        toUint8Array(signed),
        // authenticatedAttributes
        attributes
      );
      if (!signer.timestampData) {
        return [content, signerInfo];
      }
      return signer.digestData(makeSimpleIterator(cloneToArrayBuffer2(signed))).then(function(digestEncryptedBase) {
        var digestEncrypted = createTimestampRequest(digestEncryptedBase, digestAlgorithm);
        return signer.timestampData(digestEncrypted).then(function(timestamp) {
          var timestampSignedData = pickSignedDataFromTimestampResponse(timestamp);
          signerInfo.unauthenticatedAttributes = [
            new Attribute_default(OID_RFC3161_COUNTER_SIGNATURE, [
              new ContentInfo_default(OID_SIGNED_DATA, new RawDERObject(toUint8Array(timestampSignedData)))
            ])
          ];
          return [content, signerInfo];
        });
      });
    }).then(function(_a2) {
      var content = _a2[0], signerInfo = _a2[1];
      var root = new CertificateDataRoot_default(OID_SIGNED_DATA, new SignedData_default(
        // version
        1,
        // digestAlgorithms
        [digestAlgorithm],
        // contentInfo
        new SpcIndirectDataContentInfo(content),
        // signerInfos
        [signerInfo],
        // certificates
        certBinToCertificatesDER(cert)
      ));
      var certBin = new Uint8Array(root.toDER());
      var resultBin = new ArrayBuffer(8 + certBin.length);
      var resultView = new DataView(resultBin);
      resultView.setUint32(0, certBin.length + 8, true);
      resultView.setUint16(4, 512, true);
      resultView.setUint16(6, 2, true);
      copyBuffer2(resultBin, 8, certBin, 0, certBin.byteLength);
      return resultBin;
    }).then(function(certBin) {
      var alignedSize = roundUp2(certBin.byteLength, certAlignment);
      var paddingSize = alignedSize;
      var exData = executable.getExtraData();
      if (exData !== null) {
        var diffSize = roundUp2(exData.byteLength, certAlignment) - exData.byteLength;
        paddingSize += diffSize;
      }
      var newBin = executable.generate(paddingSize);
      var certOffset = newBin.byteLength - alignedSize;
      var dirArray = format_exports.ImageDataDirectoryArray.from(newBin, executable.dosHeader.newHeaderAddress + executable.newHeader.getDataDirectoryOffset());
      dirArray.set(format_exports.ImageDirectoryEntry.Certificate, {
        size: alignedSize,
        virtualAddress: certOffset
      });
      calculateCheckSumForPE(newBin, true);
      copyBuffer2(newBin, certOffset, certBin, 0, certBin.byteLength);
      return newBin;
    })
  );
}
var __generator;
var init_sign = __esm({
  "node_modules/resedit/dist/sign/index.js"() {
    init_dist();
    init_functions2();
    init_certUtil();
    init_AlgorithmIdentifier();
    init_Attribute();
    init_CertificateDataRoot();
    init_ContentInfo();
    init_DERObject();
    init_derUtil();
    init_DigestInfo();
    init_IssuerAndSerialNumber();
    init_KnownOids();
    init_ObjectIdentifier();
    init_SignedData();
    init_SignerInfo();
    init_SpcIndirectDataContent();
    init_SpcLink();
    init_SpcPeImageData();
    init_timestamp();
    __generator = function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
  }
});

// node_modules/resedit/dist/version.js
var version_default2;
var init_version2 = __esm({
  "node_modules/resedit/dist/version.js"() {
    version_default2 = "3.1.0";
  }
});

// node_modules/resedit/dist/index.js
var dist_exports = {};
__export(dist_exports, {
  Data: () => data_exports,
  Format: () => format_exports,
  Mui: () => mui_exports,
  NtExecutable: () => NtExecutable_default,
  NtExecutableResource: () => NtExecutableResource_default,
  Resource: () => resource_exports,
  generateExecutableWithSign: () => generateExecutableWithSign,
  version: () => version_default2
});
var init_dist2 = __esm({
  "node_modules/resedit/dist/index.js"() {
    init_dist();
    init_data();
    init_mui();
    init_resource();
    init_sign();
    init_version2();
  }
});

// entry.js
module.exports = (init_dist2(), __toCommonJS(dist_exports));
