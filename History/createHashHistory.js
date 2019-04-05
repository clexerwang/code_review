import warning from 'tiny-warning';
import invariant from 'tiny-invariant';

import { createLocation, locationsAreEqual } from './LocationUtils';
import {
  addLeadingSlash,
  stripLeadingSlash,
  stripTrailingSlash,
  hasBasename,
  stripBasename,
  createPath
} from './PathUtils';
import createTransitionManager from './createTransitionManager';
import {
  canUseDOM,
  getConfirmation,
  supportsGoWithoutReloadUsingHash
} from './DOMUtils';

const HashChangeEvent = 'hashchange';

const HashPathCoders = {
  hashbang: {
    encodePath: path =>
      path.charAt(0) === '!' ? path : '!/' + stripLeadingSlash(path),
    decodePath: path => (path.charAt(0) === '!' ? path.substr(1) : path)
  },
  noslash: { //  #
    encodePath: stripLeadingSlash,
    decodePath: addLeadingSlash
  },
  slash: { //    #/
    encodePath: addLeadingSlash,
    decodePath: addLeadingSlash
  }
};
//获取当前的hash
function getHashPath() {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  const href = window.location.href;
  const hashIndex = href.indexOf('#');
  return hashIndex === -1 ? '' : href.substring(hashIndex + 1);
}

//设置window.location.hash的值
function pushHashPath(path) {
  window.location.hash = path;
}

function replaceHashPath(path) {
  const hashIndex = window.location.href.indexOf('#');
  window.location.replace(
    window.location.href.slice(0, hashIndex >= 0 ? hashIndex : 0) + '#' + path
  );
}



function createHashHistory(props = {}) {
  invariant(canUseDOM, 'Hash history needs a DOM');

  const globalHistory = window.history;
  //判断执行go()时是否会导致页面重新加载
  const canGoWithoutReload = supportsGoWithoutReloadUsingHash();

  //默认hash类型为slash
  const { getUserConfirmation = getConfirmation, hashType = 'slash' } = props;
  const basename = props.basename
    ? stripTrailingSlash(addLeadingSlash(props.basename))
    : '';

  //根据hash类型获取对应的编码解码方式
  const { encodePath, decodePath } = HashPathCoders[hashType];

  const transitionManager = createTransitionManager();

  let forceNextPop = false;
  let ignorePath = null;


  //获取hash
  const path = getHashPath();
  //转换hash格式
  const encodedPath = encodePath(path);
  //如果转换前后格式不一致，就替换
  if (path !== encodedPath) replaceHashPath(encodedPath);

  //生成location对象
  const initialLocation = getDOMLocation();

  let allPaths = [createPath(initialLocation)];

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

  //生成location对象
  function getDOMLocation() {
    let path = decodePath(getHashPath());

    warning(
      !basename || hasBasename(path, basename),
      'You are attempting to use a basename on a page whose URL path does not begin ' +
        'with the basename. Expected path "' +
        path +
        '" to begin with "' +
        basename +
        '".'
    );
    //去掉basename
    if (basename) path = stripBasename(path, basename);

    return createLocation(path);
  }

  function setState(nextState) {
    Object.assign(history, nextState);
    history.length = globalHistory.length;
    transitionManager.notifyListeners(history.location, history.action);
  }


  function handleHashChange() {
    //获取hash，并转换成规定的格式
    const path = getHashPath();
    const encodedPath = encodePath(path);
    //如果转换前后不一致，
    if (path !== encodedPath) {
      //替换成转换后的标准格式
      replaceHashPath(encodedPath);
    } else {
      //生成location
      const location = getDOMLocation();
      //保存旧的location
      const prevLocation = history.location;

      // 如果前后location相同，且不是快速回跳，就忽略这次事件
      if (!forceNextPop && locationsAreEqual(prevLocation, location)) return;
      //这里为什么要忽略呢。。。是因为比如：用户点击了Link标签，执行了push方法来改变hash。那么同时也会触发hashChange事件，
      //所以在事件处理函数中就要忽略这个hashchange事件。
      if (ignorePath === createPath(location)) return;
      ignorePath = null;

      handlePop(location);
    }
  }

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

  function revertPop(fromLocation) {
    const toLocation = history.location;

    // TODO: We could probably make this more reliable by
    // keeping a list of paths we've seen in sessionStorage.
    // Instead, we just default to 0 for paths we don't know.

    let toIndex = allPaths.lastIndexOf(createPath(toLocation));

    if (toIndex === -1) toIndex = 0;

    let fromIndex = allPaths.lastIndexOf(createPath(fromLocation));

    if (fromIndex === -1) fromIndex = 0;

    const delta = toIndex - fromIndex;

    if (delta) {
      forceNextPop = true;
      go(delta);
    }
  }

  function createHref(location) {
    return '#' + encodePath(basename + createPath(location));
  }

  //在执行push时，此时页面的hash并未改变，path参数表示要跳转到的路径
  function push(path, state) {
    warning(
      state === undefined,
      'Hash history cannot push state; it is ignored'
    );

    const action = 'PUSH';
    //生成新的location对象
    const location = createLocation(
      path,
      undefined,
      undefined,
      history.location //当前的location对象
    );

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return;

        const path = createPath(location);
        const encodedPath = encodePath(basename + path);
        //如果当前的hash和新的hash不相同，说明hash发生了改变
        const hashChanged = getHashPath() !== encodedPath;
        //如果hash改变了
        if (hashChanged) {
          ignorePath = path;
          //改变hash
          pushHashPath(encodedPath);
          //寻找旧的路径记录的位置
          const prevIndex = allPaths.lastIndexOf(createPath(history.location));
          //替换之后的所有路径记录
          const nextPaths = allPaths.slice(
            0,
            prevIndex === -1 ? 0 : prevIndex + 1
          );
          nextPaths.push(path);
          allPaths = nextPaths;
          //更新
          setState({ action, location });
        } else {
          //如果hash没改变
          warning(
            false,
            'Hash history cannot PUSH the same path; a new entry will not be added to the history stack'
          );

          setState();
        }
      }
    );
  }

  function replace(path, state) {
    warning(
      state === undefined,
      'Hash history cannot replace state; it is ignored'
    );

    const action = 'REPLACE';
    const location = createLocation(
      path,
      undefined,
      undefined,
      history.location
    );

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return;

        const path = createPath(location);
        const encodedPath = encodePath(basename + path);
        const hashChanged = getHashPath() !== encodedPath;

        if (hashChanged) {
          // We cannot tell if a hashchange was caused by a REPLACE, so we'd
          // rather setState here and ignore the hashchange. The caveat here
          // is that other hash histories in the page will consider it a POP.
          ignorePath = path;
          replaceHashPath(encodedPath);
        }

        const prevIndex = allPaths.indexOf(createPath(history.location));

        if (prevIndex !== -1) allPaths[prevIndex] = path;

        setState({ action, location });
      }
    );
  }

  function go(n) {
    warning(
      canGoWithoutReload,
      'Hash history go(n) causes a full page reload in this browser'
    );

    globalHistory.go(n);
  }

  function goBack() {
    go(-1);
  }

  function goForward() {
    go(1);
  }

  function checkDOMListeners(delta) {
    listenerCount += delta;

    if (listenerCount === 1 && delta === 1) {
      window.addEventListener(HashChangeEvent, handleHashChange);
    } else if (listenerCount === 0) {
      window.removeEventListener(HashChangeEvent, handleHashChange);
    }
  }

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

export default createHashHistory;
