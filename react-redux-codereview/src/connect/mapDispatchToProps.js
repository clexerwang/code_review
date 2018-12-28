import { bindActionCreators } from 'redux'
import { wrapMapToPropsConstant, wrapMapToPropsFunc } from './wrapMapToProps'

export function whenMapDispatchToPropsIsFunction(mapDispatchToProps) {
  return (typeof mapDispatchToProps === 'function')
    ? wrapMapToPropsFunc(mapDispatchToProps, 'mapDispatchToProps')
    : undefined
}

export function whenMapDispatchToPropsIsMissing(mapDispatchToProps) {
  return (!mapDispatchToProps)
    ? wrapMapToPropsConstant(dispatch => ({ dispatch }))
    : undefined
}


/*注: 在whenMapDispatchToPropsIsObject只是返回(dispatch, options)=>()=>disptachedActions，
  然后会在selectorFactory里面传入dispatch和options，并根据dependsOnOwnProps调用，最后获得里面的constant。
  最后会在mergeProps方法里面，把state, constant, props进行合并
*/
export function whenMapDispatchToPropsIsObject(mapDispatchToProps) {
  return (mapDispatchToProps && typeof mapDispatchToProps === 'object')
    ? wrapMapToPropsConstant(dispatch => bindActionCreators(mapDispatchToProps, dispatch))
    : undefined
}

export default [
  whenMapDispatchToPropsIsFunction,
  whenMapDispatchToPropsIsMissing,
  whenMapDispatchToPropsIsObject
]
