import React from "react";
import PropTypes from "prop-types";
import { createLocation, locationsAreEqual } from "history";
import invariant from "tiny-invariant";

import Lifecycle from "./Lifecycle";
import RouterContext from "./RouterContext";
import generatePath from "./generatePath";



function Redirect({ computedMatch, to, push = false }) {
  return (
    <RouterContext.Consumer>
      {context => {
        invariant(context, "You should not use <Redirect> outside a <Router>");

        const { history, staticContext } = context;
        //选择跳转方法
        const method = push ? history.push : history.replace;
        //根据跳转路径生成location对象
        const location = createLocation(
          //如果已经匹配完成，就直接根据匹配结果中的路径参数与路径生成最终要跳转的路径
          computedMatch ? typeof to === "string"
            ? generatePath(to, computedMatch.params)
              : {
                  ...to,
                  pathname: generatePath(to.pathname, computedMatch.params)
                }
                //如果没有提前匹配，就按照渲染路径生成location 对象
            : to
        );

        // When rendering in a static context,
        // set the new location immediately.
        if (staticContext) {
          method(location);
          return null;
        }

        return (
          <Lifecycle
            onMount={() => {
              method(location);
            }}
            onUpdate={(self, prevProps) => {
              //防止重定向到原地址
              if (!locationsAreEqual(prevProps.to, location)) {
                method(location);
              }
            }}
            to={to}
          />
        );
      }}
    </RouterContext.Consumer>
  );
}

if (__DEV__) {
  Redirect.propTypes = {
    push: PropTypes.bool,
    from: PropTypes.string,
    to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired
  };
}

export default Redirect;
