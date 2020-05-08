//ArrayList.js
var ArrayList = (function ArrayList() {

  var _arrayList = function () {
    this.arr = [];
  }
  _arrayList.prototype.size = function () {
    return this.arr.length;
  }
  _arrayList.prototype.add = function () {
    if (arguments.length == 1) {
      this.arr.push(arguments[0]);
    } else if (arguments.length >= 2) {
      var deleteItem = this.arr[arguments[0]];
      this.arr.splice(arguments[0], 1, arguments[1], deleteItem)
    }
    return this;
  }
  /**
   * 插入元素
   * @param index 待插入的下标位置
   * @param obj 待插入元素
   */
  _arrayList.prototype.insert = function (index, obj) {
    //index为0，插入到最头上。也就是说插入到index元素的前面
    this.arr.splice(index, 0, obj);
  }
  /**
   * 替换元素
   * @param index 数组下标
   * @param obj 待替换元素
   */
  _arrayList.prototype.set = function (index, obj) {
    //index为0，则替换下标为0的（数组中第一个）元素为obj
    this.arr.splice(index, 1, obj);
  }
  _arrayList.prototype.get = function (index) {
    return this.arr[index];
  }
  _arrayList.prototype.getObj = function (obj) {
    return this.arr[this.indexOf(obj)]
  }
  _arrayList.prototype.removeIndex = function (index) {
    if (index !== -1)
      this.arr.splice(index, 1);
  }
  _arrayList.prototype.remove = function (obj) {
    this.removeIndex(this.indexOf(obj));
  }
  _arrayList.prototype.indexOf = function (obj) {
    for (var i = 0; i < this.arr.length; i++) {
      if (this.arr[i] === obj) {
        return i;
      };
    }
    return -1;
  }
  _arrayList.prototype.isEmpty = function () {
    return this.arr.length == 0;
  }
  _arrayList.prototype.clear = function () {
    this.arr = [];
  }
  //     _arrayList.prototype.copy=function(){
  //         var newList = new ArrayList();
  //         var arr = this.arr.concat();
  //         for(var i = 0; i < arr.length; i++) {
  //             newList.add(arr[i]);
  //         }
  //         return newList;
  //     }
  _arrayList.prototype.contains = function (obj) {
    return this.indexOf(obj) != -1;
  }
  _arrayList.prototype.iterate = function (callback) {
    if (this.arr) {
      if (callback && typeof callback.iterate === 'function') {
        //Aplomb this.arr may be changed while iterating.
        //Aplomb may consider clone array for iterating, but it is the balance of performance.
        for (var i = 0; i < this.arr.length; i++) {
          var isBreak = callback.iterate(this.arr[i]);
          if(isBreak) {
            break
          }
        }
      } else if (typeof callback === "function") {
        for (var i = 0; i < this.arr.length; i++) {
          var isBreak = callback(this.arr[i]);
          if(isBreak) {
            break
          }
        }
      }
    }
  }
  return _arrayList;
})();

export {
  ArrayList
}