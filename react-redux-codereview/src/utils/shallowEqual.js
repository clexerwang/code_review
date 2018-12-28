//浅比较函数



const hasOwn = Object.prototype.hasOwnProperty
//严格判断x,y是否相等
function is(x, y) { 
  if (x === y) {
    //在x,y都等于0时判断+0和-0为false
    return x !== 0 || y !== 0 || 1 / x === 1 / y
  } else {
    //x,y为NaN时，返回true
    return x !== x && y !== y
  }
}

export default function shallowEqual(objA, objB) {
  if (is(objA, objB)) return true
  //对于引用类型，需要进一步判断
  if (typeof objA !== 'object' || objA === null ||
      typeof objB !== 'object' || objB === null) {
    return false
  }

  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) return false

  for (let i = 0; i < keysA.length; i++) {
    if (!hasOwn.call(objB, keysA[i]) ||
        !is(objA[keysA[i]], objB[keysA[i]])) {
      return false
    }
  }

  return true
}
