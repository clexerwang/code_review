import ActionTypes from './utils/actionTypes'
import warning from './utils/warning'
import isPlainObject from './utils/isPlainObject'

function getUndefinedStateErrorMessage(key, action) {
  const actionType = action && action.type
  const actionDescription =
    (actionType && `action "${String(actionType)}"`) || 'an action'

  return (
    `Given ${actionDescription}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state. ` +
    `If you want this reducer to hold no value, you can return null instead of undefined.`
  )
}

function getUnexpectedStateShapeWarningMessage(
  inputState,
  reducers,
  action,
  unexpectedKeyCache
) {
  const reducerKeys = Object.keys(reducers)
  // 这里是在判断初始state是通过createState获得的还是从reducer的state参数默认值获得的
  // 因为在createStore中会执行reducer并传入ActionTypes.INIT类型的action
  const argumentName =
    action && action.type === ActionTypes.INIT
      ? 'preloadedState argument passed to createStore'
      : 'previous state received by the reducer'

  if (reducerKeys.length === 0) {
    return (
      'Store does not have a valid reducer. Make sure the argument passed ' +
      'to combineReducers is an object whose values are reducers.'
    )
  }

  if (!isPlainObject(inputState)) {
    return (
      `The ${argumentName} has unexpected type of "` +
      {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    )
  }


  const unexpectedKeys = Object.keys(inputState).filter(
    key => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
  )

  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })

  if (action && action.type === ActionTypes.REPLACE) return

  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    )
  }
}



//用来判断这些reducer是否有默认的返回值
function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(key => {
    const reducer = reducers[key]
    //依次执行reducer，传入空值，获取默认返回值。
    const initialState = reducer(undefined, { type: ActionTypes.INIT })

    if (typeof initialState === 'undefined') {
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
          `If the state passed to the reducer is undefined, you must ` +
          `explicitly return the initial state. The initial state may ` +
          `not be undefined. If you don't want to set a value for this reducer, ` +
          `you can use null instead of undefined.`
      )
    }
    //这里是为了防止有的reducer专门对类型为ActionTypes.INIT的action做了处理，所以又传入了一个随机字符串来检测。
    if (typeof reducer(undefined, {type: ActionTypes.PROBE_UNKNOWN_ACTION()}) === 'undefined') {
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
          `Don't try to handle ${
            ActionTypes.INIT
          } or other actions in "redux/*" ` +
          `namespace. They are considered private. Instead, you must return the ` +
          `current state for any unknown actions, unless it is undefined, ` +
          `in which case you must return the initial state, regardless of the ` +
          `action type. The initial state may not be undefined, but can be null.`
      )
    }
  })
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */

/*
* combineReducer所做的就是将传入的对象去重后存入到finalReducers中，
* 然后执行每个reducer且只传入action，目的是检测每个reducer是否都有默认的非空返回值
* 最后返回一个函数作为reducer。
*
*
* 当执行这个reducer时，具体过程为：
* 按照finalReducers中的键从currentState中取值，然后将值传入finalReducers中对应的reducer里执行，然后将返回值再传给currentState中对应的位置。
*
* */



export default function combineReducers(reducers) {
  //取出reducers中所有的键
  const reducerKeys = Object.keys(reducers)
  const finalReducers = {}

  //依次将每个键的值保存到finalReducers中，这里用来过滤掉非函数类型的reducer
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i]

    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        warning(`No reducer provided for key "${key}"`)
      }
    }

    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key]
    }
  }
  //再从finalReducers中取出所有键
  const finalReducerKeys = Object.keys(finalReducers)
  let unexpectedKeyCache
  if (process.env.NODE_ENV !== 'production') {
    unexpectedKeyCache = {}
  }
  let shapeAssertionError
  try {
    //检测每个reducer是否都有默认返回值
    assertReducerShape(finalReducers)
  } catch (e) {
    shapeAssertionError = e
  }
  //返回这个combination函数，他将作为一个新的reducer，之后就可以把它传入到createStore中了。
  return function combination(state = {}, action) {
    if (shapeAssertionError) {
      throw shapeAssertionError
    }

    if (process.env.NODE_ENV !== 'production') {

      // 这里说一下这个函数的作用：
      // 在执行combineReducers时会出入一个对象这里称为state1，用来表示state中每个属性所对应的reducer函数，比如：
      // combineReducers({
      //        name:reducerName,
      //        age:reducerAge
      // })
      // 同时在执行createStore函数时也会传入一个对象这里称为state2，用来表示初始的state，比如：
      // createStore(reducers,{name:'11',sex:'female'});
      //
      // 在执行createStore时，会先执行一次dispatch用来获得初始的state，他就会将传入自己的初始state发送到reducers中。
      // 当reducers是由combineReducers生成的时候，此时就会将state1和state2进行对比，如果一个属性只存在于state1，那么就会将该属性设为忽略
      //
      const warningMessage = getUnexpectedStateShapeWarningMessage(
        state,
        finalReducers,
        action,
        unexpectedKeyCache
      )
      if (warningMessage) {
        warning(warningMessage)
      }
    }

    //判断前后状态是否改变
    let hasChanged = false
    const nextState = {}

    for (let i = 0; i < finalReducerKeys.length; i++) {
      //这里是按照按照combineReducers的参数的键从state中取值，然后传入对应的reducer中进行更新
      const key = finalReducerKeys[i]   //从combineReducers的参数中取键
      const reducer = finalReducers[key]  //取对应的reducer
      const previousStateForKey = state[key]  //从state中取值

      const nextStateForKey = reducer(previousStateForKey, action)  //执行reducer

      if (typeof nextStateForKey === 'undefined') {
        const errorMessage = getUndefinedStateErrorMessage(key, action)
        throw new Error(errorMessage)
      }
      //举例combineReducers({a:reducer1,b:reducer2}),
      //这里nextState的结构也为{a,b}值为reducer1和reducer2的默认返回值
      nextState[key] = nextStateForKey
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey
    }
    return hasChanged ? nextState : state
  }
}
