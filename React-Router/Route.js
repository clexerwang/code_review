import React from "react";
import { isValidElementType } from "react-is";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";
import warning from "tiny-warning";

import RouterContext from "./RouterContext";
import matchPath from "./matchPath";

function isEmptyChildren(children) {
  return React.Children.count(children) === 0;
}


/*
* Route组件的主要功能也是判断location是否与渲染路径匹配，
* 判断的过程与Switch相同，但是有一点要注意，如果Route组件是被包裹在Switch中的，
* 那么被Switch匹配到的组件在渲染时会接收到Switch的匹配信息computedMatch，这时组件就不需要再执行一次匹配了，
* 如果没有computedMatch，就看Route是否有path属性，如果没有就默认渲染，那么就返回上级组件的match表示已匹配。
*
*
*
* */


class Route extends React.Component {
  render() {
    return (
      <RouterContext.Consumer>
        {context => {
          invariant(context, "You should not use <Route> outside a <Router>");

          const location = this.props.location || context.location;
          //按照computedMatch->匹配path->无path默认匹配的优先级
          //如果没有computedMatch说明上级不是Switch，那么就要使用自己的path进行匹配，如过没有path属性就默认渲染
          const match = this.props.computedMatch
            ? this.props.computedMatch : this.props.path ? matchPath(location.pathname, this.props) : context.match;

          const props = { ...context, location, match };

          let { children, component, render } = this.props;

          // Preact uses an empty array as children by
          // default, so use null if that's the case.
          if (Array.isArray(children) && children.length === 0) {
            children = null;
          }
          //先执行children获取要渲染的返回值，
          //所以children可以传入函数，但是必须有返回值
          if (typeof children === "function") {
            children = children(props);

            if (children === undefined) {
              if (__DEV__) {
                const { path } = this.props;

                warning(
                  false,
                  "You returned `undefined` from the `children` function of " +
                    `<Route${path ? ` path="${path}"` : ""}>, but you ` +
                    "should have returned a React element or `null`"
                );
              }

              children = null;
            }
          }
          /*
          * Route将history，location，match，使用context传递给通过children渲染的组件，使用props传递给通过component，render渲染的组件
          * 按照children->component->render的优先级渲染子节点
          *
          * 这里说一下component与render的区别：
          * component是使用React.createElement来创建组件的，render则是直接执行来渲染返回值
          * component中可以是返回组件的函数，也可以是一个组件类，render必须是一个返回组件的函数,
          * component传入组件类时，与render没有区别；
          * 由于component使用的是React.createElement,所以当传入函数时，React认为这是一个函数组件，且由于每次的函数并不是同一个对象，
          * 那么在diff过程中就会认为则不是同一类组件，这就会导致组件不触发更新过程，而是执行卸载与挂载过程。
          * 所以对于函数推荐使用render，对于组件类推荐使用component
          * */

          return (
            <RouterContext.Provider value={props}>
              {children && !isEmptyChildren(children)
                ? children
                : props.match
                  ? component
                    ? React.createElement(component, props)
                    : render
                      ? render(props)
                      : null
                  : null}
            </RouterContext.Provider>
          );
        }}
      </RouterContext.Consumer>
    );
  }
}

if (__DEV__) {
  Route.propTypes = {
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
    //自定义验证器
    component: (props, propName) => {
      if (props[propName] && !isValidElementType(props[propName])) {
        return new Error(
          `Invalid prop 'component' supplied to 'Route': the prop is not a valid React component`
        );
      }
    },
    exact: PropTypes.bool,
    location: PropTypes.object,
    path: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string)
    ]),
    render: PropTypes.func,
    sensitive: PropTypes.bool,
    strict: PropTypes.bool
  };

  Route.prototype.componentDidMount = function() {
    warning(
      !(
        this.props.children &&
        !isEmptyChildren(this.props.children) &&
        this.props.component
      ),
      "You should not use <Route component> and <Route children> in the same route; <Route component> will be ignored"
    );

    warning(
      !(
        this.props.children &&
        !isEmptyChildren(this.props.children) &&
        this.props.render
      ),
      "You should not use <Route render> and <Route children> in the same route; <Route render> will be ignored"
    );

    warning(
      !(this.props.component && this.props.render),
      "You should not use <Route component> and <Route render> in the same route; <Route render> will be ignored"
    );
  };

  Route.prototype.componentDidUpdate = function(prevProps) {
    warning(
      !(this.props.location && !prevProps.location),
      '<Route> elements should not change from uncontrolled to controlled (or vice versa). You initially used no "location" prop and then provided one on a subsequent render.'
    );

    warning(
      !(!this.props.location && prevProps.location),
      '<Route> elements should not change from controlled to uncontrolled (or vice versa). You provided a "location" prop initially but omitted it on a subsequent render.'
    );
  };
}

export default Route;
