import isPlainObject from './isPlainObject'
import warning from './warning'


//用来检查某个对象是否为纯对象，即使用“{}”或“new Object”创建的对象
export default function verifyPlainObject(value, displayName, methodName) {
  if (!isPlainObject(value)) {
    warning(
      `${methodName}() in ${displayName} must return a plain object. Instead received ${value}.`
    )
  }
}
