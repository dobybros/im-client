export default class NetworkUtils {
  static uuid(len, radix) {
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
    var uuid = [], i;
    radix = radix || chars.length;

    if (len) {
      // Compact form
      for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
    } else {
      // rfc4122, version 4 form
      var r;

      // rfc4122 requires these characters
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
      uuid[14] = '4';

      // Fill in random data.  At i==19 set the high bits of clock sequence as
      // per rfc4122, sec. 4.1.5
      for (i = 0; i < 36; i++) {
        if (!uuid[i]) {
          r = 0 | Math.random()*16;
          uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
        }
      }
    }

    return uuid.join('');
  }

  static toBytesInt32(num) {
    let arr = new Uint8Array([
      (num & 0xff000000) >> 24,
      (num & 0x00ff0000) >> 16,
      (num & 0x0000ff00) >> 8,
      (num & 0x000000ff)
    ]);
    return arr;
  }

  static fromBytesInt32(array) {
    var num = 0;
    num += array[0] << 24 & 0xff000000;
    num += array[1] << 16 & 0x00ff0000;
    num += array[2] << 8 & 0x0000ff00;
    num += array[3] & 0x000000ff;
    return num;
  }

  static toBytesShort(num) {
    let arr = new Uint8Array([
      (num & 0x0000ff00) >> 8,
      (num & 0x000000ff)
    ]);
    return arr;
  }
  static fromBytesShort(array) {
    var num = 0;
    num += array[0] << 8 & 0x0000ff00;
    num += array[1] & 0x000000ff;
    return num;
  }

  static toBytesByte(num) {
    let arr = new Uint8Array([
      (num & 0x000000ff)
    ]);
    return arr;
  }

  static fromBytesByte(array) {
    var num = 0;
    num = array[0] & 0x000000ff;
    return num;
  }

}