// encapsulates the subscription logic for connecting a component to the redux store, as
// well as nesting subscriptions of descendant components, so that we can ensure the
// ancestor components re-render before descendants

const CLEARED = null
const nullListeners = { notify() {} }



/*如果第一次执行subscribe时：
    此时next与current相等都为CLEARED，然后将current的副本赋值给next，并将监听函数存入next中；
    当紧接着第二次执行subscribe时：
    此时next与current不相等，直接将监听函数存入next中；
  只有当执行notify函数时，会执行next = current，
  当执行unSubscribe时，如果执行过notify，则将current赋值给next，并将next中对应的监听函数取消，
  如果没有执行notify，则直接将next中对应的监听函数取消
*/



function createListenerCollection() {
  let current = []
  let next = []
  return {
    clear() {
      next = CLEARED
      current = CLEARED
    },
    notify() {
      const listeners = current = next
      //依次执行每个监听函数
      for (let i = 0; i < listeners.length; i++) {
        listeners[i]()
      }
    },
    get() {
      return next
    },
    subscribe(listener) {
      let isSubscribed = true
      //对next进行操作前，要先将current与next分隔开。
      if (next === current) 
        next = current.slice()
      next.push(listener)
      return function unsubscribe() {
        
        //如果isSubscribed为false则直接返回，或者isSubscribed为true且current===null也直接返回
        if (!isSubscribed || current === CLEARED) return

        //如果isSubscribed为true且current！===CLEARED
        isSubscribed = false
        
        //执行notify时会将next与current进行统一，这时current与next引用的是同一个数组，
        //所以当要操作next时需要先将current与next分割开
        if (next === current) next = current.slice()
        next.splice(next.indexOf(listener), 1)
      }
    }
  }
}

export default class Subscription {
  constructor(store, parentSub, onStateChange) {
    this.store = store
    this.parentSub = parentSub
    this.onStateChange = onStateChange
    this.unsubscribe = null
    this.listeners = nullListeners
  }

  addNestedSub(listener) {
    this.trySubscribe()
    return this.listeners.subscribe(listener)
  }

  notifyNestedSubs() {
    this.listeners.notify()
  }

  isSubscribed() {
    return Boolean(this.unsubscribe)
  }

  //将监听函数绑定在父级组件的subscription对象上
  trySubscribe() {
    //先判断是否已经绑定过
    if (!this.unsubscribe) {
      //如果parentSub不为空，说明该组件的上级组件中存在通过context获得store的组件
      //如果parentSub为空，说明该组件通过props获得store，或者该组件为最接近Provider的组件
      this.unsubscribe = this.parentSub
        ? this.parentSub.addNestedSub(this.onStateChange)
        : this.store.subscribe(this.onStateChange)
 
      this.listeners = createListenerCollection()
    }
  }

  tryUnsubscribe() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
      this.listeners.clear()
      this.listeners = nullListeners
    }
  }
}
