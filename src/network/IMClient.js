import IMWSConnection from "./IMWSConnection";
import SortedMap from "../utils/SortedMap";
import {log} from "../utils/logger";

const logger = log("tc-class-core", "IMClient")
const STATUS_INIT = 1
const STATUS_CONNECTING = 2
const STATUS_CONNECTED = 5
const STATUS_DISCONNECTED = 10

const DEVICE_TOKEN = "dt"
export default class IMClient {
  constructor(parameters) {
    let {account, service, auth, terminal, imLoginUrl, needMsgQueue} = parameters
    this.terminal = parseInt(terminal)
    this.account = account
    this.service = service
    this.auth = auth
    this.debug = true
    this.imLoginUrl = imLoginUrl
    this.status = STATUS_INIT
    if (needMsgQueue !== false)
      this.msgQueue = new SortedMap()
  }

  start() {
    this.connectWebSocket()
  }


  close() {
    if (this.client) {
      logger.info('closed by hand, will not retry...')
      this.sendEvent(".status", {type: "disconnected"})
      this._eventListener = null
      console.trace()
      this.needRetry = false
      this.client.disconnect()
    } else {
      logger.warn("im client not fount, skip close action")
    }
  }

  status() {
    return this.status
  }

  connectWebSocket() {
    // cat
    // this.logUrl = "https://imapi.aculearn.com/rest/acuim/login"
    // develop
    // this.logUrl = "http://dev.9spirit.cn:8089/rest/acuim/login"
    // bj
    // this.logUrl = "https://imapi.acucom.net:6443/rest/acuim/login"
    // xin jia po jian yu
    // this.logUrl = "https://imapi.direct-acu-sdocker/rest/acuim/login"
    if (this.client) {
      this.client.disconnect()
    }
    this.status = STATUS_CONNECTING
    this.client = new IMWSConnection(this.imLoginUrl, {
      account: this.account,
      service: this.service,
      auth: this.auth,
      terminal: this.terminal,
      debug: this.debug,
    })
    this.retryTimes = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 2000, 3000, 3000, 5000, 5000, 5000, 5000, 5000, 5000, 7000, 7000, 7000, 7000, 7000, 7000, 10000, 10000, 10000, 10000, 10000, 10000, 20000, 20000, 20000, 30000]
    this.retryIndex = 0
    this.needRetry = true
    this.client.setEventListener(this.handleConnectionData.bind(this))

    this.client.init()
  }

  handleConnectionData(event, obj) {
    switch (event) {
      case  ".status": {
        this.sendEvent(".status", obj.type, obj.error)
        if (this.debug) console.log("im log " + obj.type + (obj !== undefined ? (" obj " + JSON.stringify(obj)) : ""))
        var action = obj.type
        var dataJson = {
          // from : from,
          action: action
        }
        switch (obj.type) {
          case "connected":
            this.status = STATUS_CONNECTED
            this.retryIndex = 0
            this.needRetry = true
            clearInterval(this.intervalId)

            let pingInterval = 7000
            if (obj.imconfig && obj.imconfig.pingInterval) {
              pingInterval = obj.imconfig.pingInterval
            }
            this.intervalId = setInterval(function () {
              // this.client.justPing() // need server implement for small ping. which no response
              this.client.ping(function (data) {
                if (this.debug) console.log("ping result " + ((new Date()).getTime() - data.time))

                //TODO ping
              })
            }.bind(this), pingInterval)
            break
          case "disconnected":
            this.status = STATUS_DISCONNECTED
            clearInterval(this.intervalId)
            if (this.needRetry) {
              var reconnectTime = this.retryTimes[this.retryIndex]
              if (this.debug) console.log("im disconnected, will reconnect in " + reconnectTime / 1000 + "s...")
              setTimeout(function () {
                if (this.needRetry) {
                  if (!this.client) {
                    this.client.disconnect()
                  }
                  this.status = STATUS_CONNECTING
                  this.client = new IMWSConnection(this.imLoginUrl, {
                    account: this.account,
                    service: this.service,
                    auth: this.auth,
                    terminal: this.terminal,
                    debug: this.debug,
                    prefix: this.prefix
                  })
                  this.client.setEventListener(this.handleConnectionData.bind(this))
                  this.client.init()
                } else {
                  if (this.debug) console.log("im disconnected, will not retry from timeout...")
                }
              }.bind(this), reconnectTime)

              if (this.retryIndex >= this.retryTimes.length - 1) {
                this.retryIndex = this.retryTimes.length - 1
              } else {
                this.retryIndex++
              }
            } else {
              if (this.debug) console.log("im disconnected, will not retry...")
            }
            break
          case "offlineMessageConsumed":
            if (this.msgQueue) {
              while (!this.msgQueue.isEmpty()) {

                var msg = this.msgQueue.removeIndex(0)
                if (this.client) {
                  var result = this.client.send(msg.message, msg.callback)
                  if (!result) {
                    if (msg.message.id && !this.msgQueue.containsKey(msg.message.id)) {
                      this.msgQueue.insert(0, msg.message.id, msg)
                    }
                    break
                  }
                }
              }
            }
            break
        }
      }
        break
      case  ".message": {
        this.sendEvent(".message", obj)
        //TODO received message
      }
        break
      case  ".result": {
        // if(this.debug) console.log("im log" + type + (obj !== undefined ? (" obj " + JSON.stringify(obj)) : ""))
        if (obj.data.code === 1075) {
          //TODO 被登出的逻辑
          this.sendEvent(".status", 'kickout')
          logger.info('has been kick out, will not retry...')
          this.needRetry = false
          return
        }
        if (obj.data.code === 1094) {
          logger.info('server say goodbye, will not retry...')
          this.sendEvent(".status", 'bye')
          this.needRetry = false
          return
        }

        var forId = obj.data.forId
        if (forId !== undefined && !forId.startsWith("ping_")) {
          //TODO ping result
        }
      }
        break
      // case :
      //   break
      default:
        break
    }
  }

  setEventListener(eventListener) {
    if (typeof eventListener === 'function') {
      this._eventListener = eventListener
    }
  }

  sendEvent(event, message, error) {
    this._eventListener && this._eventListener(event, message, error)
  }

  send(message, callback) {
    if (this.client) {
      var result = this.client.send(message, callback)
      if (!result && this.msgQueue) {
        if (message.id && !this.msgQueue.containsKey(message.id)) {
          this.msgQueue.put(message.id, {message, callback})
        }
      }
    }
  }
}
