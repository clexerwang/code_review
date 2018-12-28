import hoistStatics from 'hoist-non-react-statics'
import invariant from 'invariant'
import { Component, createElement } from 'react'
import { isValidElementType } from 'react-is'

import Subscription from '../utils/Subscription'
import { storeShape, subscriptionShape } from '../utils/PropTypes'

let hotReloadingVersion = 0
const dummyState = {}
function noop() {}
function makeSelectorStateful(sourceSelector, store) {
  // wrap the selector in an object that tracks its results between runs.
  const selector = {
    run: function runComponentSelector(props) {
      try {
        const nextProps = sourceSelector(store.getState(), props)
        /*关于pure对组件更新的影响
        首先，pure影响了selectorFactory中对selector函数的选择，
        当pure为true时，说明该组件只受store和props的影响，selector选择的函数为pureFinalPropsSelector
        当pure为false时，说明该组件不只受store和props的影响，selector选择的函数为impureFinalPropsSelector，
        该函数会直接返回一个新的props，无论store和props是否改变都会触发组件的更新。

        而不同函数造成的影响为：
        首次执行时，pureFinalPropsSelector会生成一个新的props，并保存在它的闭包的mergeProps中，之后将这个props返回出来保存在上面的nextProps中，
        由于首次执行selector.props为null，所以会触发更新。当第二次执行时，如果store和props没有发生改变，这时pureFinalPropsSelector仍然返回的是
        上次生成的保存在mergeProps中的props来作为nextProps，这时就形成了nextProps和selector.props引用的为同一个对象，所以严格相等，不会触发更新。
        而impureFinalPropsSelector函数就不同了，不管是否相等它始终会生成一个新的props作为nextProps，使得nextProps于selector.props相比始终不相等，
        因而就会触发更新。
        */
        if (nextProps !== selector.props || selector.error) {
          selector.shouldComponentUpdate = true
          selector.props = nextProps
          selector.error = null
        }
      } catch (error) {
        selector.shouldComponentUpdate = true
        selector.error = error
      }
    }
  }

  return selector
}

export default function connectAdvanced(

  selectorFactory,
  {
    getDisplayName = name => `ConnectAdvanced(${name})`,
    methodName = 'connectAdvanced',
    renderCountProp = undefined,
    // determines whether this HOC subscribes to store changes（决定这个高阶组件是否监听了store改变）
    shouldHandleStateChanges = true,
    storeKey = 'store',
    withRef = false,
    ...connectOptions
  } = {}
) {
  const subscriptionKey = storeKey + 'Subscription'  
  const version = hotReloadingVersion++
  const contextTypes = {
    [storeKey]: storeShape,
    [subscriptionKey]: subscriptionShape,
  }
  const childContextTypes = {
    [subscriptionKey]: subscriptionShape,
  }
  return function wrapWithConnect(WrappedComponent) {
    invariant(
      isValidElementType(WrappedComponent),
      `You must pass a component to the function returned by ` +
      `${methodName}. Instead received ${JSON.stringify(WrappedComponent)}`
    )

    const wrappedComponentName = WrappedComponent.displayName
      || WrappedComponent.name
      || 'Component'
    const displayName = getDisplayName(wrappedComponentName)
    const selectorFactoryOptions = {
      ...connectOptions,
      getDisplayName,
      methodName,
      renderCountProp,
      shouldHandleStateChanges,
      storeKey,
      withRef,
      displayName,
      wrappedComponentName,
      WrappedComponent
    }
    class Connect extends Component {
      constructor(props, context) {
        super(props, context)

        this.version = version
        this.state = {}
        this.renderCount = 0
        this.store = props[storeKey] || context[storeKey]
        this.propsMode = Boolean(props[storeKey])  
        this.setWrappedInstance = this.setWrappedInstance.bind(this)

        invariant(this.store,
          `Could not find "${storeKey}" in either the context or props of ` +
          `"${displayName}". Either wrap the root component in a <Provider>, ` +
          `or explicitly pass "${storeKey}" as a prop to "${displayName}".`
        )

        this.initSelector()
        this.initSubscription()
      }

      getChildContext() {
        /*
        **首先说明：以下所说的所有组件，都是经过connect()()处理过的(毕竟没经过处理的组件，也不可能出现在这个函数里^_^)，
          凡是被connect()()处理过的组件都会拥有subscription对象；
          其次：组件的subscription对象的作用主要是为了调节上下级组件之间的更新次序，保证父级组件要在子组件之前更新，
          内部的流程就是：每个组件都会有一个subscription对象，subscription对象负责管理该组件的listeners，
          listeners中保存了所有监听该组件的子组件的回调函数，当该组件需要更新时，会先进行更新，然后调用listeners中子组件的回调函数，
          通知子组件进行更新，这就保证了组件更新的先后顺序。
          因为需要对通过context获得store的组件进行更新顺序的控制，所以通过context获得props的组件需要获得上级组件的subscription，
          对于通过props获得store的组件，它会将自己上级的subscription转发给子组件。
        **
        
        每个组件获得store都有两种方式：props和context
        1）如果组件是通过props的方式获得的store，那么组件的subscription.parentSub的值为null(表示他不需要依赖父级组件)；
        2）如果组件是通过context的方式获得store，那么组件的subscription.parentSub的值为context[subscriptionKey]，即父级组件的subscription对象
        3）每个组件都会通过context向下传递subscription对象，如果组件是通过context获得的store，就向下传递自己的subscription，如果组件是通过props获得的store就向下传递父级的subscription
        4）只有两种情况下组件的parentSub的值为null：通过props获得store的组件、离Provider最近的组件
        
        注意一点：parentSub只能反映出该组件是否需要监听上级组件，不能反映上级组件的任何情况。
        */
        const subscription = this.propsMode ? null : this.subscription
        return { [subscriptionKey]: subscription || this.context[subscriptionKey] }
      }
      componentDidMount() {
        if (!shouldHandleStateChanges) return
        //当组件挂载完毕后，将该组件的监听函数传入上级组件的listeners中
        this.subscription.trySubscribe()
        this.selector.run(this.props)
        if (this.selector.shouldComponentUpdate) this.forceUpdate()
      }
      componentWillReceiveProps(nextProps) {
        this.selector.run(nextProps)
      }
      shouldComponentUpdate() {
        return this.selector.shouldComponentUpdate
      }
      componentWillUnmount() {
        if (this.subscription) this.subscription.tryUnsubscribe()
        this.subscription = null
        this.notifyNestedSubs = noop
        this.store = null
        this.selector.run = noop
        this.selector.shouldComponentUpdate = false
      }
      getWrappedInstance() {
        invariant(withRef,
          `To access the wrapped instance, you need to specify ` +
          `{ withRef: true } in the options argument of the ${methodName}() call.`
        )
        return this.wrappedInstance
      }

      setWrappedInstance(ref) {
        this.wrappedInstance = ref
      }
      initSelector() {

        const sourceSelector = selectorFactory(this.store.dispatch, selectorFactoryOptions)
        this.selector = makeSelectorStateful(sourceSelector, this.store)
        this.selector.run(this.props)
      }
      initSubscription() {
        if (!shouldHandleStateChanges) return
        //如果组件通过props获得store，parentSub就为null(因为组件不需要监听上级组件了)
        //如果组件通过context获得store，parentSub就为context[subscriptionKey](组件需要监听上级组件)
        const parentSub = (this.propsMode ? this.props : this.context)[subscriptionKey]
        this.subscription = new Subscription(this.store, parentSub, this.onStateChange.bind(this))
        this.notifyNestedSubs = this.subscription.notifyNestedSubs.bind(this.subscription)
      }
      onStateChange() {
        this.selector.run(this.props)
        if (!this.selector.shouldComponentUpdate) {
          //如果组件不需要更新，那就跳过该组件的更新，然后通知子组件
          this.notifyNestedSubs()
        } else {
          //如果组件需要更新
          this.componentDidUpdate = this.notifyNestedSubsOnComponentDidUpdate
          this.setState(dummyState)
        }
      }
      notifyNestedSubsOnComponentDidUpdate() {
        this.componentDidUpdate = undefined
        //在组件更新完成后，通知子组件更新
        this.notifyNestedSubs()
      }
      isSubscribed() {
        return Boolean(this.subscription) && this.subscription.isSubscribed()
      }
      addExtraProps(props) {
        if (!withRef && !renderCountProp && !(this.propsMode && this.subscription)) return props
        const withExtras = { ...props }
        if (withRef) withExtras.ref = this.setWrappedInstance
        if (renderCountProp) withExtras[renderCountProp] = this.renderCount++
        if (this.propsMode && this.subscription) withExtras[subscriptionKey] = this.subscription
        return withExtras
      }

      render() {
        const selector = this.selector
        selector.shouldComponentUpdate = false

        if (selector.error) {
          throw selector.error
        } else {
          return createElement(WrappedComponent, this.addExtraProps(selector.props))
        }
      }
    }
    
    Connect.WrappedComponent = WrappedComponent
    Connect.displayName = displayName
    Connect.childContextTypes = childContextTypes
    Connect.contextTypes = contextTypes
    Connect.propTypes = contextTypes

    if (process.env.NODE_ENV !== 'production') {
      Connect.prototype.componentWillUpdate = function componentWillUpdate() {
        if (this.version !== version) {
          this.version = version
          this.initSelector()
          let oldListeners = [];

          if (this.subscription) {
            oldListeners = this.subscription.listeners.get()
            this.subscription.tryUnsubscribe()
          }
          this.initSubscription()
          if (shouldHandleStateChanges) {
            this.subscription.trySubscribe()
            oldListeners.forEach(listener => this.subscription.listeners.subscribe(listener))
          }
        }
      }
    }

    return hoistStatics(Connect, WrappedComponent)
  }
}
