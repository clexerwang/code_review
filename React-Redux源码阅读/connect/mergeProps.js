import verifyPlainObject from '../utils/verifyPlainObject'




//mergeProps的默认行为，即将mapStateToProps，mepDispatchToProps，ownProps合并后返回
export function defaultMergeProps(stateProps, dispatchProps, ownProps) {
  return { ...ownProps, ...stateProps, ...dispatchProps }
}



// wrapMergePropsFunc负责接收mergeProps参数，并返回initMergePropsProxy函数，
// 而initMergePropsProxy函数负责接收dispatch，option参数，并返回mergePropsProxy函数

// mergePropsProxy函数接收mapStateToProps，mapDispatchToProps的返回值以及ownProps，并使用wrapMergePropsFunc接收到的mergeProps函数将他们合并，
// 然后根据option来执行不同的更新策略，并返回合并的结果。
export function wrapMergePropsFunc(mergeProps) {
  //这里在执行match函数时会返回
  return function initMergePropsProxy(
    dispatch,
    { displayName, pure, areMergedPropsEqual }
  ) {

    let hasRunOnce = false
    let mergedProps

    return function mergePropsProxy(stateProps, dispatchProps, ownProps) {
      const nextMergedProps = mergeProps(stateProps, dispatchProps, ownProps)
      //当不是第一次执行时，也就是处于更新过程时，这是就需要使用pure来判断组件是否只与props和store的状态相关，
      //如果是，那么pure就是ture，这样凡是props和store之外的更新都会被组件忽略
      if (hasRunOnce) {
        // 如果pure是true，就会查看前后的mergeProps是否相等，如果相等就说明props和store的状态没有变化，就不会更新
        // 如果pure是false，就不会比较前后的mergeProps直接更新
        if (!pure || !areMergedPropsEqual(nextMergedProps, mergedProps))
          mergedProps = nextMergedProps
      } else {
        hasRunOnce = true
        mergedProps = nextMergedProps

        if (process.env.NODE_ENV !== 'production')
          verifyPlainObject(mergedProps, displayName, 'mergeProps')
      }

      return mergedProps
    }
  }
}

//当mergeProps参数是函数类型，就执行warpMergePropsFunc并传入
export function whenMergePropsIsFunction(mergeProps) {
  return typeof mergeProps === 'function'
    ? wrapMergePropsFunc(mergeProps)
    : undefined
}

//如果mergeProps参数是null，就执行warpMergePropsFunc并传入() => defaultMergeProps
export function whenMergePropsIsOmitted(mergeProps) {
  return !mergeProps ? () => defaultMergeProps : undefined
}

export default [whenMergePropsIsFunction, whenMergePropsIsOmitted]
