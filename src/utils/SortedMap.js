export default class SortedMap {
  constructor() {
    this.keys = []
    this.values = {}
  }

  put(key, value) {
    if(typeof key === 'string') {
      var pos = this.keys.indexOf(key)
      if(pos == -1) {
        this.keys.push(key)
        this.values[key] = value
      }
    } else {
      console.error("SortedMap#put key need to be string, but ", value)
    }
  }

  isEmpty() {
    return this.keys.length == 0
  }

  get(key) {
    return this.values[key]
  }

  getIndex(index) {
    if(index >= 0 && index < this.keys.length) {
      return this.values[this.keys[index]]
    }
    return undefined
  }

  removeIndex(index) {
    if(index >= 0 && index < this.keys.length) {
      var value = this.values[this.keys[index]]
      this.remove(this.keys[index])
      return value
    }
    return undefined
  }

  insert(index, key, value) {
    if(typeof key === 'string') {
      var pos = this.keys.indexOf(key)
      if(pos == -1) {
        this.keys.splice(index, 0, key)
        this.values[key] = value
      }
    }
  }

  keys() {
    return this.keys
  }

  values() {
    var theValues = []
    this.keys.forEach(function (key) {
      theValues.push(this.values[key])
    })
    return theValues
  }

  forEach(iterateKeyValues) {
    if(iterateKeyValues) {
      this.keys.forEach(function (key) {
        iterateKeyValues(key, this.values[key])
      }.bind(this))
    }
  }

  remove(key) {
    var pos = this.keys.indexOf(key)
    if(pos != -1) {
      this.keys.splice(pos, 1)
      delete this.values[key]
    }
  }

  containsKey(key) {
    var pos = this.keys.indexOf(key)
    return pos != -1
  }

  clear() {
    this.keys = []
    this.values = {}
  }
}