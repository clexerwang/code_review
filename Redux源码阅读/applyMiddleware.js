import compose from './compose'

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */




export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    const store = createStore(...args);
    //这里作用是控制中间件在compose时才可以使用dispatch，在这之前使用dispatch都会报错
    let dispatch = () => {
      throw new Error(
        `Dispatching while constructing your middleware is not allowed. ` +
          `Other middleware would not be applied to this dispatch.`
      )
    };

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args) //这里将一个会报错的函数作为dispatch传递给了中间件
    };
    //传递给中间件所需的getState，dispatch
    const chain = middlewares.map(middleware => middleware(middlewareAPI));

    dispatch = compose(...chain)(store.dispatch);

    //这一步相当于Object.assign({},store,{dispatch:dispatch})，
    // 将上面需要接受action的函数当作新的dispatch传递给新的store对象，
    // 在这之后只要只要给新的store.dispatch传入action并执行，他就可以嵌套的执行中间件。
    return {
      ...store,
      dispatch
    }
  }
}




// applyMiddleware接收中间件返回一个enhancer，enhancer接收createStore函数，返回一个增强后的createStore函数
// 在执行增强后的createStore中，

function applyMiddleWare(...middlewares){
  return function(createStore){
     return function(...args){
       // 先生成store对象
       const store = createStore(...args);
       // 将dispatch变成一个不可用的函数
       let dispatch = () =>{
         throw new Error()
       };
       // 中间件所需参数
       const middlewareAPI = {
         getState:store.getState,
         dispatch:function(...args){return dispatch(...args)}
       };

       const chain = middlewares.map(function(middleware){
         return middleware(middlewareAPI)
       });

       //执行compose是为了让中间件前后嵌套起来
       dispatch = compose(...chain)(store.dispatch);

       //applyMiddleware最后是返回一个store对象，它的dispatch方法被改写为一个顺序执行中间件的函数，并最终调用原来的dispatch
       return {
         ...store,
         dispatch
       }
      }
  }
}
applyMiddleware(loggerMiddleware)(createStore)(rootReducer);







