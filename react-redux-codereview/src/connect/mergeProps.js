import verifyPlainObject from '../utils/verifyPlainObject'

export function defaultMergeProps(stateProps, dispatchProps, ownProps) {
  return { ...ownProps, ...stateProps, ...dispatchProps }
}

//
export function wrapMergePropsFunc(mergeProps) {
  //该函数主要是用来
  return function initMergePropsProxy(
    dispatch, { displayName, pure, areMergedPropsEqual }
  ) {
    //判断是否执行过一次
    let hasRunOnce = false
    //用来存储最终的props
    let mergedProps

    return function mergePropsProxy(stateProps, dispatchProps, ownProps) {
      //通过传入的mergeProps计算出要传给组件的props
      const nextMergedProps = mergeProps(stateProps, dispatchProps, ownProps)
      //如果不是第一次运行（因为只有第二次及以上运行时才会涉及到比较props和store前后是否改变）
      if (hasRunOnce) {
        //这里的pure就是connect函数的第四个参数中的pure，
        //当pure为ture时表示该组件的状态只依赖于props和store，
        //即当props和store经过对比并没有发生变化，那么就不会调用mapStateToProps,mapDispatchToProps和mergeProps
        if (!pure || !areMergedPropsEqual(nextMergedProps, mergedProps))//如果pure为false，或者pure为true且前后的mergeProps不相等
          //mergeProps中保存最新的值
          mergedProps = nextMergedProps        

      } else { //如果是第一次运行

        hasRunOnce = true
        mergedProps = nextMergedProps

        if (process.env.NODE_ENV !== 'production')
          verifyPlainObject(mergedProps, displayName, 'mergeProps')
      }

      return mergedProps
    }
  }
}
//用来判断mergeProps是否为function，
//如果mergeProps为function，返回 ( dispatch, { displayName, pure, areMergedPropsEqual })=>(stateProps, dispatchProps, ownProps)=>mergedProps
export function whenMergePropsIsFunction(mergeProps) {
  return (typeof mergeProps === 'function')
    ? wrapMergePropsFunc(mergeProps)
    : undefined
}


//用来判断mergeProps是否为null，
//如果mergeProps为null，说明用户没有对mergeProps做更多的处理，那么直接传入默认的mergeProps
export function whenMergePropsIsOmitted(mergeProps) {
  return (!mergeProps)
    ? () => defaultMergeProps
    : undefined
}

export default [
  whenMergePropsIsFunction,
  whenMergePropsIsOmitted
]
