import verifyPlainObject from '../utils/verifyPlainObject'


// 该函数用来处理mapDispatchToProps和mapStateToProps是Object或null类型的情况，
// 当处于以上情况时，在执行本函数前会先对mapDispatchToProps进行预处理，将它变为函数类型：
// 如果是Object类型就变成()=>bindActionCreator(mapDispatchToProps,dispatch),这里是将mapDispatchToProps中的每一项都用dispatch包裹了起来
// 如果是null就变成()=>({dispatch})

// 在本函数中，会返回initConstantSelector函数，它的返回值是constantSelector函数，这个constantSelector函数就是处理过后的mapDispatchToProps，
// 它拥有dependsOnOwnProps属性表示是否依赖组件的props，同时它和函数类型的mapDispatchToProps返回相同的值。
export function wrapMapToPropsConstant(getConstant) {
  //这里在执行match函数时会返回
  return function initConstantSelector(dispatch, options) {
    const constant = getConstant(dispatch, options)

    function constantSelector() {
      return constant
    }
    constantSelector.dependsOnOwnProps = false
    return constantSelector
  }
}


// 判断mapStateToProp和mapDispatchToProps函数是否依赖于组件的props
export function getDependsOnOwnProps(mapToProps) {

  return mapToProps.dependsOnOwnProps !== null &&
    //如果这个dependsOnOwnProps属性存在，就依靠该属性判断
    //如果属性不存在，就依靠函数的参数个数来判断，如果大于一个那肯定就依赖
    (mapToProps.dependsOnOwnProps !== undefined
    ? Boolean(mapToProps.dependsOnOwnProps)
    : mapToProps.length !== 1)
}



// 该函数用来处理mapDispatchToProps或mapStateToProps是函数类型的情况，

// 它的处理流程与上面的wrapMapToPropsConstant大致相同，会返回一个initProxySelector函数，而initProxySelector的返回值是proxy函数，

// proxy函数有dependsOnOwnProps属性和mapToProps属性，

// proxy所做的就是执行自己的mapToProps属性并根据dependsOnOwnProps属性判断要不要传入ownProps，

// 开始时mapToProps是一个默认的函数，这个函数所做的就是：

// 1、将wrapMapToPropsFunc接收到的mapDispatchToProps或mapStateToProps赋值给proxy的mapToProps属性，

// 2、根据新的proxy.mapToProps属性来更新proxy.dependsOnOwnProps的值（默认为true），

// 3、执行proxy，就像上面所说的在proxy中会执行proxy.mapToProps，并将执行结果保存在props中。

// 然后这里会有一个判断，如果props是一个函数，那么会把这个函数当作真正的mapStateToProps或mapDispatchToProps，并再次重复执行上面的步骤，获得最终的props


export function wrapMapToPropsFunc(mapToProps, methodName) {
  //这里在执行match函数时会返回
  return function initProxySelector(dispatch, { displayName }) {

    const proxy = (stateOrDispatch, ownProps)=>{
      return proxy.dependsOnOwnProps
        ? proxy.mapToProps(stateOrDispatch, ownProps)
        : proxy.mapToProps(stateOrDispatch)
    }

    proxy.dependsOnOwnProps = true

    proxy.mapToProps = function(
      stateOrDispatch,
      ownProps
    ) {
      proxy.mapToProps = mapToProps
      proxy.dependsOnOwnProps = getDependsOnOwnProps(mapToProps)
      let props = proxy(stateOrDispatch, ownProps)

      if (typeof props === 'function') {
        proxy.mapToProps = props
        proxy.dependsOnOwnProps = getDependsOnOwnProps(props)
        props = proxy(stateOrDispatch, ownProps)
      }

      if (process.env.NODE_ENV !== 'production')
        verifyPlainObject(props, displayName, methodName)

      return props
    }

    return proxy
  }
}





