/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

export default function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg
  }

  if (funcs.length === 1) {
    return funcs[0]
  }

  return funcs.reduce((a, b) => (...args) => a(b(...args)))
}

/*
funcs.reduce(function(a,b){
  return function(...args){
    return a(b(...args))
  }
});


reduce方法需要传入两个参数，一个回调函数，一个初始值。
以数组[1,2,3,4]为例，在[1,2,3,4].reduce(function(a,b,c,d){})中，
由于没有传入初始值，那么reduce将会从数组的第二位开始进行处理，将数组的第一位当作初始值，则函数第一次执行时具体参数为：
1：函数的初始值或上次执行的返回值
2：当前要处理的值
1：当前要处理的值的索引值
[1,2,3,4]：处理的数组

args参数的作用就是将接收到的下一个函数传入到嵌套的最里层。
第一次执行返回：
function 1(...args){
  return a(b(...args))
}

第二次执行返回：
function 2(...args){
  return 1(c(...args))
}
此时函数1内部为：
function 1(c(...args)){
  return a(b(c(...args)))
}

*/















