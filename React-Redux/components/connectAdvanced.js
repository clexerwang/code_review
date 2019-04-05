import hoistStatics from 'hoist-non-react-statics'
import invariant from 'invariant'
import React, { Component, PureComponent } from 'react'
import { isValidElementType, isContextConsumer } from 'react-is'

import { ReactReduxContext } from './Context'

const stringifyComponent = Comp => {
  try {
    return JSON.stringify(Comp)
  } catch (err) {
    return String(Comp)
  }
}
/*

 可以用户自定义的属性有：
    storeKey,
    forwardRef,
    context,
    pure,
    areStatesEqual,
    areOwnPropsEqual,
    areStatePropsEqual,
    areMergedPropsEqual

*/



/*
*
* 在React-redux中是在传入的组件上包裹了一个Connect组件，那么在Connect组件中：
* props：指被包裹组件的props，
* mergeProps：指混合了mapDispatchToProps，mapStateToProps，props的值，Connect组件将把他通过props传递给被包裹组件。
*
* */


export default function connectAdvanced(
  selectorFactory,
  {
    getDisplayName = name => `ConnectAdvanced(${name})`,
    methodName = 'connectAdvanced',
    shouldHandleStateChanges = true,//如果mapStateToProps为空，则为false,貌似没有使用
    renderCountProp = undefined, //该属性已被移除
    withRef = false,             //该属性已被移除
    storeKey = 'store',
    forwardRef = false,
    context = ReactReduxContext,
    ...connectOptions
  } = {}
) {
  invariant(
      //如果renderCountProp存在，就会报错
      renderCountProp === undefined,
      `renderCountProp is removed. render counting is built into the latest React dev tools profiling extension`
  )

  invariant(
    !withRef,
    'withRef is removed. To access the wrapped instance, use a ref on the connected component'
  )

  const customStoreWarningMessage =
    'To use a custom Redux store for specific components,  create a custom React context with ' +
    "React.createContext(), and pass the context object to React Redux's Provider and specific components" +
    ' like:  <Provider context={MyContext}><ConnectedComponent context={MyContext} /></Provider>. ' +
    'You may also pass a {context : MyContext} option to connect'

  invariant(
    storeKey === 'store',
    'storeKey has been removed and does not do anything. ' +
      customStoreWarningMessage
  )

  //react的contextAPI
  const Context = context

  return function wrapWithConnect(WrappedComponent) {
    if (process.env.NODE_ENV !== 'production') {
      invariant(
        isValidElementType(WrappedComponent),
        `You must pass a component to the function returned by ` +
          `${methodName}. Instead received ${stringifyComponent(
            WrappedComponent
          )}`
      )
    }


    const wrappedComponentName =
      WrappedComponent.displayName || WrappedComponent.name || 'Component'
    //报错时用来显示出问题的组件
    const displayName = getDisplayName(wrappedComponentName)

   /* connectOptions为：
      {
        initMapStateToProps,
        initMapDispatchToProps,
        initMergeProps,
        pure,
        areStatesEqual,
        areOwnPropsEqual,
        areStatePropsEqual,
        areMergedPropsEqual
      }*/
    const selectorFactoryOptions = {
      ...connectOptions,
      getDisplayName,
      methodName,
      renderCountProp,
      shouldHandleStateChanges,
      storeKey,
      displayName,
      wrappedComponentName,
      WrappedComponent
    }

    const { pure } = connectOptions


    let OuterBaseComponent = Component
    let FinalWrappedComponent = WrappedComponent

    // 根据pure判断是否使用PureComponent，
    // PureComponent通过prop和state的浅比较来实现shouldComponentUpdate
    if (pure) {
      OuterBaseComponent = PureComponent
    }

    //返回selectDerivedProps函数
    function makeDerivedPropsSelector() {
      let lastProps
      let lastState
      let lastDerivedProps
      let lastStore
      let sourceSelector

      //state是store.state，props是被包裹组件的props，store就是store对象
      return function selectDerivedProps(state, props, store) {

        //初次执行时因为lastProps，lastState是undefined，所以这里一定是false
        if (pure && lastProps === props && lastState === state) {

          return lastDerivedProps
        }

        //初次执行时这里一定为true
        if (store !== lastStore) {
          //更新lastStore
          lastStore = store
          //执行selectorFactory，获得最新的mergeProps函数，他等待获得最新的state和props来生成最终的mergedProps
          sourceSelector = selectorFactory(
            store.dispatch,
            selectorFactoryOptions
          )
        }

        lastProps = props
        lastState = state

        //传入最新的state和props，计算出最终的mergedProps
        const nextProps = sourceSelector(state, props)

        //更新lastDerivedProps
        lastDerivedProps = nextProps
        return lastDerivedProps
      }
    }

    function makeChildElementSelector() {
      let lastChildProps, lastForwardRef, lastChildElement

      return function selectChildElement(childProps, forwardRef) {

        //这里比较新旧mergedProps是否相同，判断是否触发更新
        //如果不相同就通过返回一个新的组件来触发更新
        if (childProps !== lastChildProps || forwardRef !== lastForwardRef) {
          lastChildProps = childProps
          lastForwardRef = forwardRef
          lastChildElement = (
            <FinalWrappedComponent {...childProps} ref={forwardRef} />
          )
        }
        console.log(lastChildElement)
        return lastChildElement
      }
    }



    class Connect extends OuterBaseComponent {

      constructor(props) {
        super(props)
        invariant(
          forwardRef ? !props.wrapperProps[storeKey] : !props[storeKey],
          'Passing redux store in props has been removed and does not do anything. ' +
            customStoreWarningMessage
        )
        this.selectDerivedProps = makeDerivedPropsSelector()
        this.selectChildElement = makeChildElementSelector()
        this.renderWrappedComponent = this.renderWrappedComponent.bind(this)
      }

      renderWrappedComponent(value) {
        
        invariant(
          value,
          `Could not find "store" in the context of ` +
            `"${displayName}". Either wrap the root component in a <Provider>, ` +
            `or pass a custom React context provider to <Provider> and the corresponding ` +
            `React context consumer to ${displayName} in connect options.`
        )

        //从context 中获取数据
        const { storeState, store } = value
        //这里的props已经被静态提升过，所以这个props与被包裹组件的props相同
        let wrapperProps = this.props;
        let forwardedRef

        if (forwardRef) {
          wrapperProps = this.props.wrapperProps;
          forwardedRef = this.props.forwardedRef;
        }

        //selectDerivedProps是根据新的state，store来生成新的mergedProps
        let derivedProps = this.selectDerivedProps(
          storeState,
          wrapperProps,
          store
        );

        //而selectChildElement的作用是根据新的mergedProps来判断需不需要更新子组件
        return this.selectChildElement(derivedProps, forwardedRef)
      }

      render() {
        const ContextToUse =
          this.props.context &&
          this.props.context.Consumer &&
          isContextConsumer(<this.props.context.Consumer />)
            ? this.props.context
            : Context;

        return (
          <ContextToUse.Consumer>
            {this.renderWrappedComponent}
          </ContextToUse.Consumer>
        )
      }
    }







    Connect.WrappedComponent = WrappedComponent
    Connect.displayName = displayName

    if (forwardRef) {
      const forwarded = React.forwardRef(function forwardConnectRef(
        props,
        ref
      ) {
        return <Connect wrapperProps={props} forwardedRef={ref} />
      })

      forwarded.displayName = displayName
      forwarded.WrappedComponent = WrappedComponent
      return hoistStatics(forwarded, WrappedComponent)
    }
    //先进行了静态属性提升
    return hoistStatics(Connect, WrappedComponent)
  }
}
