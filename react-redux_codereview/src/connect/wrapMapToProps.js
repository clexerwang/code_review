import verifyPlainObject from '../utils/verifyPlainObject'





//该方法主要是用来判断mapStateToProps和mapDispatchToProps中是否需要用到ownProps，
//即当组件的props更新时，是否需要调用mapStateToProps,mapDispatchToProps进行更新
export function getDependsOnOwnProps(mapToProps) {
  //如果有dependsOnOwnProps属性，就根据这个属性的值进行判断，如果没有该属性，就根据函数形参的数量进行判断
  return (mapToProps.dependsOnOwnProps !== null && mapToProps.dependsOnOwnProps !== undefined)
    ? Boolean(mapToProps.dependsOnOwnProps)
    : mapToProps.length !== 1 //这里function.length表示函数声明时规定的要传入的形参的个数,如果为1表示不需要传入ownProps
}



/*
 当mapStateToProps为null或者mapDispatchToProps为Objerct或null时，会执行该函数。

 该函数会返回一个initConstantSelector函数，initConstantSelector函数的返回值为constantSelecotr函数，
 而constantSelector函数的返回值为执行warpMapToPropsConstant时传入的函数的返回值
*/
export function wrapMapToPropsConstant(getConstant) { 
  return function initConstantSelector(dispatch, options) { 
    const constant = getConstant(dispatch, options)

    function constantSelector() { return constant }
    constantSelector.dependsOnOwnProps = false 
    return constantSelector
  } 
}


//这个方法主要是针对mapStateToProps和mapDispatchToProps是function的情况
export function wrapMapToPropsFunc(mapToProps, methodName) {

  //现在如果首次执行了这个函数，会发生什么：
  return function initProxySelector(dispatch, { displayName }) {
              //先给proxy赋值一个函数，proxy函数的作用是返回proxy.mapToProps函数的运行结果，
              //根据proxy.dependsOnOwnProps来判断proxy.mapToProps是否需要ownProps
              
              const proxy = function mapToPropsProxy(stateOrDispatch, ownProps) {
                            return proxy.dependsOnOwnProps? proxy.mapToProps(stateOrDispatch, ownProps): proxy.mapToProps(stateOrDispatch)
                          }

              // allow detectFactoryAndVerify to get ownProps
              proxy.dependsOnOwnProps = true
              //proxy.mapToProps函数的作用就是返回传入的mapToProps的运行结果
              proxy.mapToProps = function detectFactoryAndVerify(stateOrDispatch, ownProps) {     
                                      //把mapToProps传入proxy.mapToProps
                                      proxy.mapToProps = mapToProps
                                      //proxy.dependsOnOwnProps用来表示传入的mapToProps是否需要ownProps
                                      proxy.dependsOnOwnProps = getDependsOnOwnProps(mapToProps)
                                      //接着执行proxy函数，前面说过proxy函数的作用就是返回proxy.mapToProps的运行结果，
                                      //而上面已经将传入的mapToProps赋给了proxy.mapToProps,所以这里返回的就是传入的mapToPorps的运行结果
                                      let props = proxy(stateOrDispatch, ownProps)


                                      //根据文档所说，mapStateToProps和mapDispatchToProps都可以返回一个函数，
                                      //当返回的是函数时，就将这个函数当作真正的mapStateToProps或mapDispatchToProps
                                      if (typeof props === 'function') { //如果返回值是函数
                                          //将返回值作为真正的mapToProps
                                          proxy.mapToProps = props
                                          //然后根据真正的mapToProps再次判断是否需要ownProps
                                          proxy.dependsOnOwnProps = getDependsOnOwnProps(props)
                                          //再次执行函数，保存真正的mapToProps的返回值
                                          props = proxy(stateOrDispatch, ownProps)
                                      }

                                      if (process.env.NODE_ENV !== 'production') 
                                          verifyPlainObject(props, displayName, methodName)

                                      return props
                                  }

              return proxy
          }
}
