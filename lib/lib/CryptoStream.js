'use strict';

var _stream = require('stream');

var _ICrypto = require('./ICrypto');

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

var _settings = require('../settings');

var _settings2 = _interopRequireDefault(_settings);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   Copyright (c) 2015 Particle Industries, Inc.  All rights reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   This program is free software; you can redistribute it and/or
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   modify it under the terms of the GNU Lesser General Public
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   License as published by the Free Software Foundation, either
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   version 3 of the License, or (at your option) any later version.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   This program is distributed in the hope that it will be useful,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   but WITHOUT ANY WARRANTY; without even the implied warranty of
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   Lesser General Public License for more details.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   You should have received a copy of the GNU Lesser General Public
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *   License along with this program; if not, see <http://www.gnu.org/licenses/>.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               * 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var CryptoStream = function (_Transform) {
  _inherits(CryptoStream, _Transform);

  function CryptoStream(options) {
    _classCallCheck(this, CryptoStream);

    var _this = _possibleConstructorReturn(this, (CryptoStream.__proto__ || Object.getPrototypeOf(CryptoStream)).call(this, options));

    _this._getCipher = function (callback) {
      var cipher = null;
      if (_this._encrypt) {
        cipher = _crypto2.default.createCipheriv(_settings2.default.cryptoSalt, _this._key, _this._iv);
      } else {
        cipher = _crypto2.default.createDecipheriv(_settings2.default.cryptoSalt, _this._key, _this._iv);
      }

      var cipherText = null;

      cipher.on('readable', function () {
        if (!cipher) {
          return;
        }

        var chunk = cipher.read();

        /*
         The crypto stream error was coming from the additional null packet
         before the end of the stream
           IE
         <Buffer a0 4a 2e 8e 2d ce de 12 15 03 7a 42 44 ca 84 88 72 64 77 61 72
          65 2f 6f 74 61 5f 63 68 75 6e 6b>
         <Buffer 5f 73 69 7a 65 ff 35 31 32>
         null
         CryptoStream transform error TypeError: Cannot read property 'length' of
          null
         Coap Error: Error: Invalid CoAP version. Expected 1, got: 3
           The if statement solves (I believe) all of the node version dependency
         issues
           */
        if (!chunk) {
          return;
        }

        if (!cipherText) {
          cipherText = Buffer.from(chunk);
        } else {
          cipherText = Buffer.concat([Buffer.from(cipherText), Buffer.from(chunk)], cipherText.length + chunk.length);
        }
      });
      cipher.on('end', function () {
        this.push(cipherText);

        if (this._encrypt && cipherText) {
          this._iv = new Buffer(16);
          cipherText.copy(this._iv, 0, 0, 16);
        }
        cipherText = null;
        callback();
      });

      return cipher;
    };

    _this._transform = function (chunk, encoding, callback) {
      try {
        //assuming it comes in full size pieces
        var cipher = _this._getCipher(callback);
        cipher.write(chunk);
        cipher.end();
        cipher = null;

        //ASSERT: we just DECRYPTED an incoming message
        //THEN:
        //  update the initialization vector to the first 16 bytes of the
        //  encrypted message we just got
        if (!_this.encrypt) {
          _this._iv = new Buffer(16);
          chunk.copy(_this._iv, 0, 0, 16);
        }
      } catch (exception) {
        _logger2.default.error("CryptoStream transform error " + exception);
      }
    };

    _this._key = options.key;
    _this._iv = options.iv;
    _this._encrypt = !!options.encrypt;
    return _this;
  }

  return CryptoStream;
}(_stream.Transform);

module.exports = CryptoStream;