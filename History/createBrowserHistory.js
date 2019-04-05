import warning from 'tiny-warning';
import invariant from 'tiny-invariant';

import { createLocation } from './LocationUtils';
import {
  addLeadingSlash,
  stripTrailingSlash,
  hasBasename,
  stripBasename,
  createPath
} from './PathUtils';
import createTransitionManager from './createTransitionManager';
import {
  canUseDOM,
  getConfirmation,
  supportsHistory,
  supportsPopStateOnHashChange,
  isExtraneousPopstateEvent
} from './DOMUtils';

const PopStateEvent = 'popstate';
const HashChangeEvent = 'hashchange';

//  从window.history中获取state
function getHistoryState() {
  try {
    return window.history.state || {};
  } catch (e) {
    return {};
  }
}


function createBrowserHistory(props = {}) {
  //判断是否为浏览器环境
  invariant(canUseDOM, 'Browser history needs a DOM');
  //判断是否支持history对象
  const globalHistory = window.history;
  const canUseHistory = supportsHistory();

  //判断当改变hash值时是否会触发popState事件，如果会触发那么就不需要处理hashChange事件了，如果不能触发，那就需要使用hashChange事件来代替
  const needsHashChangeListener = !supportsPopStateOnHashChange();

  //读取相关的设置
  const {
    //是否直接刷新
    forceRefresh = false,
    //显示提示信息的函数
    getUserConfirmation = getConfirmation,
    //location.key的长度
    keyLength = 6
  } = props;
  //如果传入了basename就生成标准的basename(以'/'开头，不以'/'结尾)
  const basename = props.basename
    ? stripTrailingSlash(addLeadingSlash(props.basename))
    : '';


  //获取初始的location对象,初始时window.history.state为null
  const initialLocation = getDOMLocation(getHistoryState());
  let allKeys = [initialLocation.key];


  //是否直接强制跳转
  let forceNextPop = false;


  //生成一个跳转管理器，他拥有：setPrompt，confirmTransitionTo，appendListener，notifyListeners
  const transitionManager = createTransitionManager();


  let listenerCount = 0;
  let isBlocked = false;




  const history = {
    length: globalHistory.length,
    action: 'POP',
    location: initialLocation,
    createHref,
    push,
    replace,
    go,
    goBack,
    goForward,
    block,
    listen
  };





  // 为createLocation准备path，state，key参数；
  // state，key从函数的参数中获取
  // path从window.location中获取，其中path中不包括basename部分
  function getDOMLocation(historyState) {
    const { key, state } = historyState || {};
    const { pathname, search, hash } = window.location;

    let path = pathname + search + hash;

    warning(
      !basename || hasBasename(path, basename),
      'You are attempting to use a basename on a page whose URL path does not begin ' +
        'with the basename. Expected path "' +
        path +
        '" to begin with "' +
        basename +
        '".'
    );

    if (basename) path = stripBasename(path, basename);

    return createLocation(path, state, key);
  }







  //生成随机key值
  function createKey() {
    return Math.random()
      .toString(36)
      .substr(2, keyLength);
  }










  // 更新history的状态，触发所有监听函数，
  // 在React-Router中就是将组件的setState作为监听函数放入listeners中，
  // 当触发了popState，pushState，replaceState等事件时，就会执行这里的setState函数
  // 从而触发组件的更新，渲染不同的组件。
  function setState(nextState) {
    Object.assign(history, nextState);
    history.length = globalHistory.length;
    transitionManager.notifyListeners(history.location, history.action);
  }







  function handlePopState(event) {
    //通过判断事件的state是否为undefined来判断是否忽略，但是在IOS的chrome上即使state为undefined也不能忽略
    if (isExtraneousPopstateEvent(event)) return;
    //处理popState事件，注意popState事件的state属性就是对应location的state的副本
    //触发了popState事件，说明location发生了变化，所以要使用getDOMLocation生成新的location
    handlePop(getDOMLocation(event.state));
  }







  function handleHashChange() {
    handlePop(getDOMLocation(getHistoryState()));
  }







  // popState的事件处理函数
  // forceNextPop为true直接执行setState触发监听函数不更新history的状态，
  // 否则执行transitionManager.confirmTransitionTo进行正常的跳转流程
  function handlePop(location) {
    if (forceNextPop) {
      forceNextPop = false;
      setState();
    } else {

      const action = 'POP';

      transitionManager.confirmTransitionTo(
        location,
        action,
        getUserConfirmation,
        ok => {
          if (ok) {
            setState({ action, location });
          } else {
            revertPop(location);
          }
        }
      );
    }
  }






  // 当阻止跳转时，执行该函数
  // 当要从'/a'跳转到'/b'时，由于跳转失败，在执行revertPop时fromLocation就是'/b'，toLocation就是'/a'
  function revertPop(fromLocation) {
    //由于只有允许跳转时才会执行setState更新history，所以现在的history仍然是执行跳转前的状态
    const toLocation = history.location;


    //这里是寻找新旧location相差的位置
    let toIndex = allKeys.indexOf(toLocation.key);
    if (toIndex === -1) toIndex = 0;
    let fromIndex = allKeys.indexOf(fromLocation.key);
    if (fromIndex === -1) fromIndex = 0;


    const delta = toIndex - fromIndex;

    if (delta) {
      //因为history仍然是跳转前的状态，所以这里将forceNextPop设为true，
      //因为接下来要执行go进行跳转，会触发popstate事件，就是告诉popstate更新history了，直接跳转
      forceNextPop = true;
      go(delta);
    }
  }




  //生成真实可用的路径
  function createHref(location) {
    return basename + createPath(location);
  }






  // pushState的包装版本，
  // 生成新的location对象，然后就执行transitionManager.confirmTransitionTo进行正常的跳转。
  // 跳转的过程中使用pushState改变路由
  function push(path, state) {
    warning(
      !(
        typeof path === 'object' &&
        path.state !== undefined &&
        state !== undefined
      ),
      'You should avoid providing a 2nd state argument to push when the 1st ' +
        'argument is a location-like object that already has state; it is ignored'
    );

    const action = 'PUSH';
    const location = createLocation(path, state, createKey(), history.location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return;

        const href = createHref(location);
        const { key, state } = location;

        if (canUseHistory) {
          //使用pushState
          globalHistory.pushState({ key, state }, null, href);

          //如果要使用刷新，那就直接导航到新地址
          if (forceRefresh) {
            window.location.href = href;
          } else {
            //这里是不刷新的流程

            //pushState的特点是会使用新记录替换后面的所有记录
            const prevIndex = allKeys.indexOf(history.location.key);
            //丢弃当前之后的记录
            const nextKeys = allKeys.slice(
              0,
              prevIndex === -1 ? 0 : prevIndex + 1
            );
            //插入新纪录
            nextKeys.push(location.key);
            allKeys = nextKeys;
            //开始更新
            setState({ action, location });
          }
        } else {
          warning(
            state === undefined,
            'Browser history cannot push state in browsers that do not support HTML5 history'
          );

          window.location.href = href;
        }
      }
    );
  }





  //replace与push的流程相同，唯一不同是replace不会丢弃后面的记录，只会用心记录替换当前记录
  function replace(path, state) {
    warning(
      !(
        typeof path === 'object' &&
        path.state !== undefined &&
        state !== undefined
      ),
      'You should avoid providing a 2nd state argument to replace when the 1st ' +
        'argument is a location-like object that already has state; it is ignored'
    );

    const action = 'REPLACE';
    const location = createLocation(path, state, createKey(), history.location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return;

        const href = createHref(location);
        const { key, state } = location;

        if (canUseHistory) {
          globalHistory.replaceState({ key, state }, null, href);

          if (forceRefresh) {
            window.location.replace(href);
          } else {
            const prevIndex = allKeys.indexOf(history.location.key);

            if (prevIndex !== -1) allKeys[prevIndex] = location.key;

            setState({ action, location });
          }
        } else {
          warning(
            state === undefined,
            'Browser history cannot replace state in browsers that do not support HTML5 history'
          );

          window.location.replace(href);
        }
      }
    );
  }
  function go(n) {
    globalHistory.go(n);
  }
  function goBack() {
    go(-1);
  }
  function goForward() {
    go(1);
  }





  //用来绑定popState的事件处理函数
  function checkDOMListeners(delta) {
    listenerCount += delta;
    // 开始时Router组件已经使用listen绑定了一个事件处理函数，
    // 所以当Prompt组件使用block绑定时listenerCount的值是2，就不会再次绑定了，因为事件处理程序可以共用
    // 同理，因为只绑定了一个事件处理，所以只有当listenerCount减为0时才需要移除事件处理函数。
    if (listenerCount === 1 && delta === 1) {
      window.addEventListener(PopStateEvent, handlePopState);

      if (needsHashChangeListener)
        window.addEventListener(HashChangeEvent, handleHashChange);
    } else if (listenerCount === 0) {
      window.removeEventListener(PopStateEvent, handlePopState);

      if (needsHashChangeListener)
        window.removeEventListener(HashChangeEvent, handleHashChange);
    }
  }






  //设置prompt
  function block(prompt = false) {
    const unblock = transitionManager.setPrompt(prompt);

    if (!isBlocked) {
      checkDOMListeners(1);
      isBlocked = true;
    }

    return () => {
      if (isBlocked) {
        isBlocked = false;
        checkDOMListeners(-1);
      }

      return unblock();
    };
  }




  //向listeners中添加监听函数
  function listen(listener) {
    const unlisten = transitionManager.appendListener(listener);
    checkDOMListeners(1);

    return () => {
      checkDOMListeners(-1);
      unlisten();
    };
  }



  return history;
}

export default createBrowserHistory;
