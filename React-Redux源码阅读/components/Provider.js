import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { ReactReduxContext } from './Context'


// Provider使用context向子组件传递store，
// Provider在挂载时在store上绑定监听函数，这样当store的状态发生改变时就会调用监听函数，
// 监听函数负责获取store最新的状态，然后更新Provider的state。
class Provider extends Component {
  constructor(props) {
    super(props)

    const { store } = props

    this.state = {
      storeState: store.getState(),
      store
    }
  }

  componentDidMount() {
    this._isMounted = true
    this.subscribe()
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe()

    this._isMounted = false
  }

  componentDidUpdate(prevProps) {
    //如果换了store对象，那就重新监听新的store对象
    if (this.props.store !== prevProps.store) {
      if (this.unsubscribe) this.unsubscribe()

      this.subscribe()
    }
  }

  subscribe() {
    const { store } = this.props

    this.unsubscribe = store.subscribe(() => {
      const newStoreState = store.getState()
      //判断Provider有没有挂载
      if (!this._isMounted) {
        return
      }
      this.setState(providerState => {
        //判断state的值有没有发生变化，如果没有变化就不需要更新
        if (providerState.storeState === newStoreState) {
          return null
        }
        //返回最新的state
        return { storeState: newStoreState }
      })
    })

    // 组件的state是在constructor中获得的，
    // 为了防止在执行constructor和componentDidMount之间store的状态发生了改变，
    // 在组件挂载完成后会再更新一次state
    const postMountStoreState = store.getState()
    if (postMountStoreState !== this.state.storeState) {
      this.setState({ storeState: postMountStoreState })
    }
  }

  render() {
    const Context = this.props.context || ReactReduxContext

    return (
      <Context.Provider value={this.state}>
        {this.props.children}
      </Context.Provider>
    )
  }
}

Provider.propTypes = {
  store: PropTypes.shape({
    subscribe: PropTypes.func.isRequired,
    dispatch: PropTypes.func.isRequired,
    getState: PropTypes.func.isRequired
  }),
  context: PropTypes.object,
  children: PropTypes.any
}

export default Provider
