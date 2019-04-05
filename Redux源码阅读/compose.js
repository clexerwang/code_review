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

每次归并都会返回一个函数，这个函数将参数a,b嵌套执行，并接收一个参数，将这个参数放入嵌套中。


这样处理过后，传入的中间件将会按照从右往左的顺序依次执行

*/















