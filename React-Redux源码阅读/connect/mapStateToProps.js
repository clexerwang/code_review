import { wrapMapToPropsConstant, wrapMapToPropsFunc } from './wrapMapToProps'



//当mapStateToProps是函数类型，就调用wrapMapToPropsFunc并将mapStateToProps传入
export function whenMapStateToPropsIsFunction(mapStateToProps) {
  return typeof mapStateToProps === 'function'
    ? wrapMapToPropsFunc(mapStateToProps, 'mapStateToProps')
    : undefined
}

//当mapStateToProps是null，就调用wrapMapToPropsConstant并使用() => ({})代替mapStateToProps传入
export function whenMapStateToPropsIsMissing(mapStateToProps) {
  return !mapStateToProps ? wrapMapToPropsConstant(() => ({})) : undefined
}

export default [whenMapStateToPropsIsFunction, whenMapStateToPropsIsMissing]
