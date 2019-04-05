import warning from 'tiny-warning';

function createTransitionManager() {
  let prompt = null;


  // 设置prompt，即Prompt组件message属性的值，一个页面上只能有一个prompt，当渲染一个包含Prompt组件的页面时，
  // Prompt组件在挂载阶段就会更新prompt值。
  function setPrompt(nextPrompt) {
    warning(prompt == null, 'A history supports only one prompt at a time');

    prompt = nextPrompt;

    return () => {
      if (prompt === nextPrompt) prompt = null;
    };
  }


  // 通过执行prompt获得提示信息，通过getUserConfirmation去显示获得的提示信息并跳转，
  // getUserConfirmation有两个参数result和callback，result是prompt的返回值(一般是要显示的提示信息)，callback是进行页面跳转的函数，

  // getUserConfirmation所要做的事情是：
  // 1、显示提示信息；2、执行callback(callback会根据提示信息的返回值来决定是否跳转)

  // prompt就是Prompt组件的message属性的值，可以用户自定义
  // getUserConfirmation方法可以也用户自定义。


  // confirmTransitionTo的执行过程是：
  // 先判断有没有设置prompt：
  //    如果没有设置就直接跳转。
  //    如果设置了，就看prompt的返回值是不是可显示的类型（String）：
  //        如果是可显示的类型，那么就判断getUserConfirmation是否是函数类型，
  //          如果getUserConfirmation是函数类型，就执行它。
  //          如果getUserConfirmation不是函数类型的，那么就要报错，并且直接跳转；
  //        如果是不可显示的类型，那就只能根据这个值是否为空来判断要不要跳转。
  function confirmTransitionTo(
    location,
    action,
    getUserConfirmation,
    callback
  ) {


    if (prompt != null) {
      const result =
        typeof prompt === 'function' ? prompt(location, action) : prompt;


      if (typeof result === 'string') {

        if (typeof getUserConfirmation === 'function') {
          getUserConfirmation(result, callback);
        } else {
          warning(
            false,
            'A history needs a getUserConfirmation function in order to use a prompt message'
          );

          callback(true);
        }
      } else {
        // Return false from a transition hook to cancel the transition.
        callback(result !== false);
      }
    } else {
      callback(true);
    }
  }
  //这里保存了所有添加进来的监听函数
  let listeners = [];


  function appendListener(fn) {
    let isActive = true;

    function listener(...args) {
      if (isActive) fn(...args);
    }

    listeners.push(listener);

    return () => {
      isActive = false;
      listeners = listeners.filter(item => item !== listener);
    };
  }

  function notifyListeners(...args) {
    listeners.forEach(listener => listener(...args));
  }

  return {
    setPrompt,
    confirmTransitionTo,
    appendListener,
    notifyListeners
  };
}

export default createTransitionManager;
