import verifySubselectors from './verifySubselectors'



//函数返回pure为false时的selector，这个selector接收store和ownProps使用stateSelector和dispatchSelector计算出各自的props
//该selector的返回值也是一个函数，这个函数接收store，props作为参数，返回最终的props
export function impureFinalPropsSelectorFactory(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch
) {
  return function impureFinalPropsSelector(state, ownProps) {
    return mergeProps(
      mapStateToProps(state, ownProps),
      mapDispatchToProps(dispatch, ownProps),
      ownProps
    )
  }
}


export function pureFinalPropsSelectorFactory(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch,
  { areStatesEqual, areOwnPropsEqual, areStatePropsEqual }
) {
  let hasRunAtLeastOnce = false  //是否已经执行过一次，没有执行过就不需要做是否改变的检查
  let state                      //记忆上一次的state
  let ownProps                   //记忆上一次的ownProps
  let stateProps                 //记忆mapStateToProps返回的props
  let dispatchProps              //记忆mapDispatchToProps返回的props
  let mergedProps                //记忆最后合并后的结果

  //第一次调用时，先保存所有的结果
  function handleFirstCall(firstState, firstOwnProps) {
    state = firstState
    ownProps = firstOwnProps
    stateProps = mapStateToProps(state, ownProps)
    dispatchProps = mapDispatchToProps(dispatch, ownProps)
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    hasRunAtLeastOnce = true
    return mergedProps
  }

  //当state和props都发生了改变时
  function handleNewPropsAndNewState() {
    //由于ownProps发生了改变，需要调用mapStateToprops生成新的props
    stateProps = mapStateToProps(state, ownProps)

    if (mapDispatchToProps.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps(dispatch, ownProps)  //同理生成新的props

    mergedProps = mergeProps(stateProps, dispatchProps, ownProps) //合并新的props
    return mergedProps
  }

  //当props发生改变时
  function handleNewProps() {
    //根据是否依赖ownProps来获得新的props
    if (mapStateToProps.dependsOnOwnProps)
      stateProps = mapStateToProps(state, ownProps)
    //同理
    if (mapDispatchToProps.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps(dispatch, ownProps)
    //合并
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    return mergedProps
  }

  function handleNewState() {
    const nextStateProps = mapStateToProps(state, ownProps)
    const statePropsChanged = !areStatePropsEqual(nextStateProps, stateProps)
    stateProps = nextStateProps

    if (statePropsChanged)
      mergedProps = mergeProps(stateProps, dispatchProps, ownProps)

    return mergedProps
  }


  //除第一次调用外，每次都需要对各种结果进行检查，然后记录必要的结果
  function handleSubsequentCalls(nextState, nextOwnProps) {
    const propsChanged = !areOwnPropsEqual(nextOwnProps, ownProps)
    const stateChanged = !areStatesEqual(nextState, state)
    state = nextState
    ownProps = nextOwnProps

    if (propsChanged && stateChanged) return handleNewPropsAndNewState()
    if (propsChanged) return handleNewProps()
    if (stateChanged) return handleNewState()
    return mergedProps
  }

  return function pureFinalPropsSelector(nextState, nextOwnProps) {
    return hasRunAtLeastOnce
      ? handleSubsequentCalls(nextState, nextOwnProps)
      : handleFirstCall(nextState, nextOwnProps)
  }
}

// TODO: Add more comments

// If pure is true, the selector returned by selectorFactory will memoize its results,
// allowing connectAdvanced's shouldComponentUpdate to return false if final
// props have not changed. If false, the selector will always return a new
// object and shouldComponentUpdate will always return true.


export default function finalPropsSelectorFactory(dispatch, {
  initMapStateToProps,
  initMapDispatchToProps,
  initMergeProps,
  ...options
}) {
  const mapStateToProps = initMapStateToProps(dispatch, options)
  const mapDispatchToProps = initMapDispatchToProps(dispatch, options)
  const mergeProps = initMergeProps(dispatch, options)

  if (process.env.NODE_ENV !== 'production') {
    verifySubselectors(mapStateToProps, mapDispatchToProps, mergeProps, options.displayName)
  }
  /*跟据pure的值选择函数
  如果pure是true, 那么selectorFactory返回的selector会负责存储最后结果。
  如果结果没有发生改变，那么connectAdvanced的shouldComponentUpdate就会返回false。
  如果pure是false, 那么selector永远会返回一个新的对象，同时shouldComponentUpdate永远都返回true*/
  const selectorFactory = options.pure
    ? pureFinalPropsSelectorFactory
    : impureFinalPropsSelectorFactory


  //它会返回一个函数，这个函数会接收store和props作为参数，每次当store和props发生改变时就会调用该函数，返回最终的props
  return selectorFactory(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    dispatch,
    options
  )
}
