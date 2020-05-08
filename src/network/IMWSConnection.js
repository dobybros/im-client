import * as protobuf from 'protobufjs'
import * as pako from 'pako'
import NetworkUtils from "../../utils/NetworkUtils"
import request from "./HttpRequest"
import {HashMap} from "../../utils/HashMap"
import {log} from "../../utils/logger"

const logger = log('tc-class-core', 'IMWSConnection')
const TERMINAL_WEB_MOBILE = 5
const TERMINAL_WEB_PC = 6
const TERMINAL_WEB = 7

const TYPE_IN_IDENTITY = 1
const TYPE_OUT_OUTGOINGMESSAGE = 10
const TYPE_OUT_OUTGOINGDATA = 11
const TYPE_IN_INCOMINGMESSAGE = 15
const TYPE_IN_INCOMINGDATA = 16
const TYPE_IN_ACKNOWLEDGE = 3
const TYPE_OUT_RESULT = 100
const TYPE_IN_PING = -3
const TYPE_INOUT_CHUNK = 20

const CONTENTTYPE_TEXT = "text"
const CONTENTTYPE_IMAGE = "image"
const CONTENTTYPE_AUDIO = "audio"
const CONTENTTYPE_LOCATION = "location"
const CONTENTTYPE_PRODUCT = "product"
const CONTENTTYPE_CONTACT = "contact"
const CONTENTTYPE_COUPON = "coupon"

const CONTENTTYPE_ORDER = "order"
const CONTENTTYPE_GOTOPAGE = "gotopage"

const CONTENTTYPE_GETSESSION = "msggetsession"
const CONTENTTYPE_USERSESSIONINIT = "usinit"
const CONTENTTYPE_MSGHISTORY = "msghis"
const CONTENTTYPE_UPDATEUNREAD = "msgupread"
const CONTENTTYPE_DELETESESSION = "usdel"

const ENCODE_PB = 1
const ENCODE_JSON = 10
const ENCODE_JAVABINARY = 20

const CONTENTENCODE_JSON = 1
const CONTENTENCODE_GZIP_JSON = 2

const appId = "aculearn"
const sdkVersion = 1
const key = "mykey"

export default class IMWSConnection {
  constructor(loginUrl, user) {
    let {terminal, account, service, auth, deviceToken, debug} = user
    if (loginUrl === undefined)
      throw Error("loginUrl is undefined while creating IMClient")
    this.loginUrl = loginUrl
    if (user === undefined)
      throw Error("user cannot be null, need user json has fields, account, service, terminal")
    this.terminal = parseInt(terminal)
    this.account = account
    this.service = service
    this.auth = auth
    this.deviceToken = deviceToken ? deviceToken : "dt"
    this.debug = true
    if (this.debug === undefined)
      this.debug = false

    if (this.account === undefined)
      throw Error("account cannot be null")
    if (this.service === undefined)
      throw Error("service cannot be null")

    if (!this.isWSSupported()) {
      throw Error("WebSocket support is needed")
    }

    this.callbackMap = new HashMap()
  }

  init() {
    if (!this.mobilePB) {
      // const mobileProto = require('./Mobile.proto');
      protobuf.load("/Mobile.proto", function (err, root) {
        if (err) {
          if (this.debug) logger.error(err)
          this.sendEvent(".status", {type: "disconnected"})
        } else {
          this.mobilePB = root
          this.connect()
        }
      }.bind(this))
    } else {
      this.connect()
    }
  }

  decode(data, dataEncode) {
    if (!dataEncode)
      dataEncode = CONTENTENCODE_JSON
    switch (dataEncode) {
      case CONTENTENCODE_JSON:
        return this.binaryToStr(data)
      case CONTENTENCODE_GZIP_JSON:
        return this.binaryToStr(pako.ungzip(data, {to: "byte"}))
      default:
        return undefined
    }
  }

  async connect() {
    let requestBody = {
      account: this.account,
      terminal: this.terminal,
      appId: "appId",
      service: this.service
    }
    try {
      const jsonData = await request('post', this.loginUrl, requestBody, {classtoken: this.auth})
      let count = 0
      if (jsonData) {
        logger.debug(jsonData)
      }
      if (jsonData.code === 1) {
        let data = jsonData["data"]
        let wsPort = data["wsport"]
        if (!wsPort) {
          throw Error("No websocket port is specified")
        }
        let server = data["s"]
        let sid = data["sid"]
        let host = data["host"]
        if (!sid || !server) {
          throw Error("Login server failed, sid " + sid + " server " + server)
        }
        this.server = server
        this.sid = sid

        this.connectWS(host, wsPort)
      }
    } catch (err) {
      if (this.debug) logger.error(err["description"])
      let type = 'disconnected'
      if (err.data && 4000 <= err.data.code && err.data.code <= 5000) {
        type = 'outofdate'
      }
      this.sendEvent(".status", {type: type})
    }
  }

  isWSSupported() {
    if ("WebSocket" in window) {
      return true
    } else {
      logger.err("WebSocket doesn't be supported")
      return false
    }
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close()
      } catch (e) {
        logger.warn("WS close error", e)
      }
    }
  }

  connectWS(host, port) {
    // 打开一个 web socket
    logger.debug(`Connecting ws with host: ${host}, port: ${port}...`)
    var ws = new WebSocket((location.protocol == 'http:' ? 'ws' : 'wss') + '://' + host + ':' + port + '/' + this.server)
    this.ws = ws

    this.ws.onopen = function () {
      // Web Socket 已连接上，使用 send() 方法发送数据
      if (this.debug) logger.debug('==onopen==')
      this.ws.send(this.server)

      var IdentityConstructor = this.mobilePB.lookupType("Identity")
      var payload = {
        sessionId: this.sid,
        userId: this.account,
        terminal: this.terminal,
        deviceToken: this.deviceToken,
        sdkVersion: sdkVersion,
        key: key,
        appId: appId,
        code: this.sid,
        service: this.service
      }
      var errMsg = IdentityConstructor.verify(payload)
      if (errMsg)
        throw Error(errMsg)

      var identity = IdentityConstructor.create(payload)
      var buffer = IdentityConstructor.encode(identity).finish()

      var array = new Uint8Array(1 + 2 + 1 + 1 + 4 + buffer.length)
      var offset = 0
      array.set(NetworkUtils.toBytesByte(1), offset)
      offset += 1
      array.set(NetworkUtils.toBytesShort(1), offset)
      offset += 2
      array.set(NetworkUtils.toBytesByte(1), offset)
      offset += 1
      array.set(NetworkUtils.toBytesByte(1), offset)
      offset += 1
      array.set(NetworkUtils.toBytesInt32(buffer.length), offset)
      offset += 4
      array.set(buffer, offset)
      this.ws.send(array)

      // this.ws.send(utils.toBytesByte(1));
      // this.ws.send(utils.toBytesShort(1));
      //
      // this.ws.send(utils.toBytesByte(1));
      // this.ws.send(utils.toBytesByte(1));
      // this.ws.send(utils.toBytesInt32(buffer.length));
      // this.ws.send(buffer);

    }.bind(this)

    this.ws.onmessage = async function (evt) {
      // if (this.debug) logger.debug('==onmessage==');
      // var fileReader = new FileReader()
      // fileReader.onload = function (event) {

      if (evt.data.arrayBuffer && typeof evt.data.arrayBuffer === 'function') {
        const arrayBuffer = await evt.data.arrayBuffer()
        const type = NetworkUtils.fromBytesByte(new Uint8Array(arrayBuffer, 0, 1)) //type is byte
        const length = NetworkUtils.fromBytesInt32(new Uint8Array(arrayBuffer, 1, 4)) //length is int
        if (length === -1) {
          this.myChunkData = undefined
          this.myChunkData = {
            type: type
          }
        } else {
          const data = new Uint8Array(arrayBuffer, 5, length) //binary datas
          this.handleData(type, data)
        }
      } else {
        var fileReader = new FileReader()
        fileReader.onload = function (event) {
          var type = NetworkUtils.fromBytesByte(new Uint8Array(event.target.result, 0, 1)) //type is byte
          var length = NetworkUtils.fromBytesInt32(new Uint8Array(event.target.result, 1, 4)) //length is int
          if (length == -1) {
            this.myChunkData = undefined
            this.myChunkData = {
              type: type
            }
          } else {
            var data = new Uint8Array(event.target.result, 5, length)//binary datas
            this.handleData(type, data)
          }
        }.bind(this)
        fileReader.readAsArrayBuffer(evt.data)
      }


    }.bind(this)

    this.ws.onclose = function () {
      // 关闭 websocket
//           alert("连接已关闭...");
      if (this.debug) logger.debug('==onclose==')
      this.connected = false
      this.sendEvent(".status", {type: "disconnected"})
      if (this.callbackMap !== undefined) {
        this.callbackMap.forEach(function (value, key) {
          value.callback(undefined, "disconnected")
        })
        this.callbackMap.clear()
      }
    }.bind(this)

    this.ws.onerror = function (ev) {
      logger.error("ws onerror", ev)
    }
  }

  handleData(type, data) {
    switch (type) {
      case TYPE_INOUT_CHUNK:
        var ChunkConstructor = this.mobilePB.lookupType("Chunk")
        var chunk = ChunkConstructor.decode(data)

        if (this.myChunkData !== undefined && typeof chunk.totalSize === "number" && chunk.content !== undefined && chunk.content.length > 0) {
          if (chunk.offset === undefined)
            chunk.offset = 0
          if (chunk.offset === 0 || this.myChunkData.buffer === undefined) {
            this.myChunkData.buffer = new Uint8Array(chunk.totalSize)
          }
          this.myChunkData.buffer.set(chunk.content, chunk.offset)

          if (chunk.offset + chunk.content.length >= chunk.totalSize) {
            this.handleData(this.myChunkData.type, this.myChunkData.buffer)
            this.myChunkData = undefined
          }

          if (this.debug) logger.debug("chunk " + chunk)
        } else {
          if (this.debug) logger.warn("chunk " + chunk + " ignored")
        }


        break
      case TYPE_OUT_RESULT:
        var ResultConstructor = this.mobilePB.lookupType("Result")
        var result = ResultConstructor.decode(data)
//                         if(result.code !== 1) {
//                             throw Error("Code not 1, " + result.code + " description " + result.description);
//                         }

        if (result.content !== undefined && result.content.length > 0) {
//                             var dec = new TextDecoder();
//                             var messageStr = dec.decode(result.content);
//           var messageStr = this.binaryToStr(pako.ungzip(result.content, {to: "byte"}));
//           var messageStr = this.binaryToStr(result.content);
          var messageStr = this.decode(result.content, result.contentEncode)
          var contentJson = JSON.parse(messageStr)
          result.content = contentJson
        }

        if (result.forId !== undefined) {
          var callbackData = this.callbackMap.get(result.forId)
          if (callbackData && typeof callbackData.callback === 'function') {
            callbackData.callback({data: result})
            this.callbackMap.remove(result.forId)
          }
        }
        if (result.code === 1 && !this.connected) {
          this.connected = true
          this.sendEvent(".status", {type: "connected", imconfig: result.content.imconfig})
        } else if (result.code === 11) {
          this.sendEvent(".status", {type: "offlineMessageConsumed"})
        } else if (result.code === 2025) {
          this.disconnect()
          this.sendEvent(".status", {type: "disconnected"})
        } else {
          this.sendEvent(".result", {data: result})
        }

        if (this.debug && result.forId.indexOf('ping') === -1) logger.debug("result ", result)
        break
      case TYPE_OUT_OUTGOINGMESSAGE:
        var OutgoingMessageConstructor = this.mobilePB.lookupType("OutgoingMessage")
        var outgoingMsg = OutgoingMessageConstructor.decode(data)
        if (outgoingMsg.contentType !== undefined && outgoingMsg.content !== undefined) {
          var message = undefined
          // var messageStr = this.binaryToStr(outgoingMsg.content);
          // var messageStr = this.binaryToStr(pako.ungzip(outgoingMsg.content, {to: "byte"}));
          var messageStr = this.decode(outgoingMsg.content, outgoingMsg.contentEncode)
          message = JSON.parse(messageStr)
          if (message !== undefined) {
            outgoingMsg.content = message
          } else {
            outgoingMsg.content = {
              text: "Unknown message for type " + outgoingMsg.contentType
            }
            outgoingMsg.contentType = CONTENTTYPE_TEXT
          }
        }
        if (outgoingMsg.id !== undefined && outgoingMsg.needAck) {
          var AcknowledgeConstructor = this.mobilePB.lookupType("Acknowledge")
          var payload = {
            msgIds: [outgoingMsg.id],
            service: this.service
          }
          var errMsg = AcknowledgeConstructor.verify(payload)
          if (errMsg)
            throw Error(errMsg)

          var ack = AcknowledgeConstructor.create(payload)
          var buffer = AcknowledgeConstructor.encode(ack).finish()

          var array = new Uint8Array(1 + 4 + buffer.length)
          var offset = 0
          array.set(NetworkUtils.toBytesByte(TYPE_IN_ACKNOWLEDGE), offset)
          offset += 1
          array.set(NetworkUtils.toBytesInt32(buffer.length), offset)
          offset += 4
          array.set(buffer, offset)
          this.ws.send(array)

          // this.ws.send(NetworkUtils.toBytesByte(TYPE_IN_ACKNOWLEDGE));
          // this.ws.send(NetworkUtils.toBytesInt32(buffer.length));
          // this.ws.send(buffer);
          if (this.debug) logger.debug("Ack ", payload)
        }
        this.sendEvent(".message", outgoingMsg)
        this.sendEvent(".message." + outgoingMsg.contentType, outgoingMsg)
        if (this.debug) logger.debug("outgoingMsg ", outgoingMsg)
        break
      case TYPE_OUT_OUTGOINGDATA:
        var OutgoingDataConstructor = this.mobilePB.lookupType("OutgoingData")
        var outgoingData = OutgoingDataConstructor.decode(data)
        if (outgoingData.contentType !== undefined && outgoingData.content !== undefined) {
          var message = undefined
          // var messageStr = this.binaryToStr(outgoingData.content);
          // var messageStr = this.binaryToStr(pako.ungzip(outgoingData.content, {to: "byte"}));
          let messageStr = ''
          if (outgoingData.content.length) {
            messageStr = this.decode(outgoingData.content, outgoingData.contentEncode)
            message = JSON.parse(messageStr)
          } else {
            message = {}
          }
          if (message !== undefined) {
            outgoingData.content = message
          } else {
            outgoingData.content = {
              text: "Unknown message for type " + outgoingData.contentType
            }
            outgoingData.contentType = CONTENTTYPE_TEXT
          }
        }
        if (outgoingData.id !== undefined && outgoingData.needAck) {
          var AcknowledgeConstructor = this.mobilePB.lookupType("Acknowledge")
          var payload = {
            msgIds: [outgoingData.id],
            service: this.service
          }
          var errMsg = AcknowledgeConstructor.verify(payload)
          if (errMsg)
            throw Error(errMsg)

          var ack = AcknowledgeConstructor.create(payload)
          var buffer = AcknowledgeConstructor.encode(ack).finish()

          var array = new Uint8Array(1 + 4 + buffer.length)
          var offset = 0
          array.set(NetworkUtils.toBytesByte(TYPE_IN_ACKNOWLEDGE), offset)
          offset += 1
          array.set(NetworkUtils.toBytesInt32(buffer.length), offset)
          offset += 4
          array.set(buffer, offset)
          this.ws.send(array)

          // this.ws.send(NetworkUtils.toBytesByte(TYPE_IN_ACKNOWLEDGE));
          // this.ws.send(NetworkUtils.toBytesInt32(buffer.length));
          // this.ws.send(buffer);
          if (this.debug) logger.debug("Ack ", payload)
        }
        // this.sendEvent(".message." + outgoingData.contentType, outgoingData);
        logger.debug("outgoingData ", outgoingData)
        this.sendEvent(".message", outgoingData)
        break
    }
  }

  strToBinary(str) {
    var bytes = new Array()
    var len, c
    len = str.length
    for (var i = 0; i < len; i++) {
      c = str.charCodeAt(i)
      if (c >= 0x010000 && c <= 0x10FFFF) {
        bytes.push(((c >> 18) & 0x07) | 0xF0)
        bytes.push(((c >> 12) & 0x3F) | 0x80)
        bytes.push(((c >> 6) & 0x3F) | 0x80)
        bytes.push((c & 0x3F) | 0x80)
      } else if (c >= 0x000800 && c <= 0x00FFFF) {
        bytes.push(((c >> 12) & 0x0F) | 0xE0)
        bytes.push(((c >> 6) & 0x3F) | 0x80)
        bytes.push((c & 0x3F) | 0x80)
      } else if (c >= 0x000080 && c <= 0x0007FF) {
        bytes.push(((c >> 6) & 0x1F) | 0xC0)
        bytes.push((c & 0x3F) | 0x80)
      } else {
        bytes.push(c & 0xFF)
      }
    }
    return bytes
  }

  binaryToStr(arr) {
    if (typeof arr === 'string') {
      return arr
    }
    var str = '',
      _arr = arr
    for (var i = 0; i < _arr.length; i++) {
      var one = _arr[i].toString(2),
        v = one.match(/^1+?(?=0)/)
      if (v && one.length == 8) {
        var bytesLength = v[0].length
        var store = _arr[i].toString(2).slice(7 - bytesLength)
        for (var st = 1; st < bytesLength; st++) {
          store += _arr[st + i].toString(2).slice(2)
        }
        str += String.fromCharCode(parseInt(store, 2))
        i += bytesLength - 1
      } else {
        str += String.fromCharCode(_arr[i])
      }
    }
    return str
  }

  getCommonTextMessageJSON(outgoingMsg) {
    var json = {
      id: outgoingMsg.id,
      chatGroupId: outgoingMsg.userId,
      userId: outgoingMsg.userId,
      createTime: outgoingMsg.time,
      contentType: outgoingMsg.contentType,
      content: {
        text: outgoingMsg.content.text
      }
    }
    return json
  }

  send(message, callback) {
    if (this.ws === undefined || this.ws.readyState !== this.ws.OPEN) {
      this.sendEvent(".sendFailed", {data: message})
      return false
    }
    logger.debug("incoming data,", {...message})
    if (this.mobilePB === undefined) {
      throw Error("Protocol is not prepared...")
    }
    if (typeof message !== "object")
      throw Error("message is undefined, send failed.")
    var content = message.content
    if (typeof content !== "object")
      content = {}
    // throw Error("content is undefined, send failed.");
    var contentType = message.contentType
    if (typeof contentType !== "string")
      throw Error("contentType is undefined, send failed.")
    var userIds = message.userIds
    var userId = message.userId
    if (typeof userIds !== "object" && typeof userIds !== "string" && typeof userId !== "string") {
//             throw Error("userIds is undefined, send failed.");
    } else {
      if (typeof userIds !== "object" && typeof userIds !== "string")
        userIds = userId

      if (typeof userIds === "string") {
        userIds = [userIds]
      }
      message.userIds = userIds
    }

    var theContent, buffer, errMsg

    var contentStr = JSON.stringify(content)
    buffer = this.strToBinary(contentStr)
    buffer = pako.gzip(buffer, {to: "byte"})
    if (this.debug) logger.debug("send... ")
    var IncomingConstructor
    var type
    if (message.userIds === undefined) {
      IncomingConstructor = this.mobilePB.lookupType("IncomingData")
      type = TYPE_IN_INCOMINGDATA
    } else {
      IncomingConstructor = this.mobilePB.lookupType("IncomingMessage")
      if (message.id === undefined) {
        message.id = NetworkUtils.uuid(12)
      }
      type = TYPE_IN_INCOMINGMESSAGE
    }
    message.content = buffer
    message.service = this.service
    message.contentEncode = CONTENTENCODE_GZIP_JSON

    var errMsg = IncomingConstructor.verify(message)
    if (errMsg)
      throw Error(errMsg)

    var msg = IncomingConstructor.create(message)
    var buffer = IncomingConstructor.encode(msg).finish()

    var array = new Uint8Array(1 + 4 + buffer.length)
    var offset = 0
    array.set(NetworkUtils.toBytesByte(type), offset)
    offset += 1
    array.set(NetworkUtils.toBytesInt32(buffer.length), offset)
    offset += 4
    array.set(buffer, offset)
    this.ws.send(array)

    // this.ws.send(NetworkUtils.toBytesByte(type));
    // this.ws.send(NetworkUtils.toBytesInt32(buffer.length));
    if (typeof callback === 'function') {
      this.callbackMap.put(message.id, {callback: callback, time: (new Date()).getTime()})
    }
    // this.ws.send(buffer);
    // if (this.debug) logger.debug("IncomingMessage type " + contentType + " content ", content)
    return true
  }

  justPing() {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      var array = new Uint8Array(1)
      array.set(NetworkUtils.toBytesByte(111), 0)
      this.ws.send(array)
    }
  }

  ping(callback) {
    if (this.ws === undefined || this.ws.readyState !== this.ws.OPEN) {
      // this.sendEvent( ".sendFailed", {data: message});
      return
    }
    if (this.mobilePB === undefined) {
      throw Error("Protocol is not prepared...")
    }
    // var content = {
    //     id : NetworkUtils.uuid(4)
    // };

    var theContent, buffer, errMsg

    // var contentStr = JSON.stringify(content);
    // buffer = this.strToBinary(contentStr);

    var message = {
      id: "ping_" + NetworkUtils.uuid(4)
    }
//         if(this.debug) logger.debug("send... ");
    var IncomingConstructor
    var type
    IncomingConstructor = this.mobilePB.lookupType("IncomingMessage")
    type = TYPE_IN_PING

    message.content = buffer
    message.service = this.service
    message.contentEncode = CONTENTENCODE_JSON

    var errMsg = IncomingConstructor.verify(message)
    if (errMsg)
      throw Error(errMsg)

    var msg = IncomingConstructor.create(message)
    var buffer = IncomingConstructor.encode(msg).finish()

    var array = new Uint8Array(1 + 4 + buffer.length)
    var offset = 0
    array.set(NetworkUtils.toBytesByte(type), offset)
    offset += 1
    array.set(NetworkUtils.toBytesInt32(buffer.length), offset)
    offset += 4
    array.set(buffer, offset)

    this.ws.send(array)

    // this.ws.send(NetworkUtils.toBytesByte(type));
    // this.ws.send(NetworkUtils.toBytesInt32(buffer.length));
    if (typeof callback === 'function') {
      this.callbackMap.put(message.id, {callback: callback, time: (new Date()).getTime()})
    }
    // this.ws.send(buffer);
    if (this.debug && message.id.indexOf('ping') === -1) logger.debug("IncomingMessage type ping content ", message)
  }

  setEventListener(eventListener) {
    if (typeof eventListener === 'function') {
      this.eventListener = eventListener
    }
  }

  sendEvent(event, data) {
    this.eventListener && this.eventListener(event, data)
  }
}
