import React from "react";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";

import Lifecycle from "./Lifecycle";
import RouterContext from "./RouterContext";


//Prompt组件所做的就是在挂载时使用block方法设置prompt
function Prompt({ message, when = true }) {
  return (
    <RouterContext.Consumer>
      {context => {
        invariant(context, "You should not use <Prompt> outside a <Router>");

        //如果不需要提示消息，那么就返回bull，不再渲染Prompt了
        if (!when || context.staticContext) return null;
        //获取block方法
        const method = context.history.block;

        return (
          <Lifecycle
            //当挂载时，就设置block
            onMount={self => {
              self.release = method(message);
            }}
            //当更新后，如果前后的提示消息不相同，就先解除上一个，然后设置新的提示消息
            onUpdate={(self, prevProps) => {
              if (prevProps.message !== message) {
                self.release();
                self.release = method(message);
              }
            }}
            onUnmount={self => {
              self.release();
            }}
            message={message}
          />
        );
      }}
    </RouterContext.Consumer>
  );
}

if (__DEV__) {
  const messageType = PropTypes.oneOfType([PropTypes.func, PropTypes.string]);

  Prompt.propTypes = {
    when: PropTypes.bool,
    message: messageType.isRequired
  };
}

export default Prompt;
