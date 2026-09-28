'use strict';
// حزمة buffer للمتصفح لا تدعم base64url، نضيفها هنا
const { Buffer } = require('buffer');
if (!Buffer.__b64url) {
  const toStr = Buffer.prototype.toString;
  Buffer.prototype.toString = function (enc, ...rest) {
    if (enc === 'base64url') return toStr.call(this, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return toStr.call(this, enc, ...rest);
  };
  const from = Buffer.from;
  Buffer.from = function (v, enc, ...rest) {
    if (enc === 'base64url' && typeof v === 'string') return from.call(this, v.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return from.call(this, v, enc, ...rest);
  };
  Buffer.__b64url = true;
}
module.exports = { Buffer };
