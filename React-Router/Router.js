import React from "react";
import PropTypes from "prop-types";
import warning from "tiny-warning";

import RouterContext from "./RouterContext";


/*
* Router组件通过context向子组件传递：
* {
*   history: this.props.history,     //全局的history对象
*   location: this.state.location,   //当前的location对象
*   match: Router.computeRootMatch(this.state.location.pathname), //返回一个默认值
*   staticContext: this.props.staticContext   //服务端渲染时使用，MemoryRouter会传递这个属性
* }
* 对象，同时在constructor中使用history的listen方法绑定了一个监听函数，当路由发生变化时就会触发监听函数，
* 该监听函数主要负责获取最新的location对象，并触发组件更新。
*/
class Router extends React.Component {
  static computeRootMatch(pathname) {
    return { path: "/", url: "/", params: {}, isExact: pathname === "/" };
  }

  constructor(props) {
    super(props);

    this.state = {
      location: props.history.location
    };

    // 之所以需要在constructor中就开始监听location的改变，是因为初次渲染时子组件中很可能会有Redirect组件，
    // 那么在挂载Redirect时，它可能会执行push/replace动作，所以会导致在Router挂载前后的location不相同。
    this._isMounted = false;
    this._pendingLocation = null;

    //如果是在浏览器环境下
    if (!props.staticContext) {
      //先绑定监听函数，使得路由改变时可以触发组件的更新
      this.unlisten = props.history.listen(location => {
        // 这里是用来判断，当location改变时Router有没有挂载，
        // 如果已经挂载了，那么就更新
        if (this._isMounted) {
          this.setState({ location });
        } else {
          //如果还没有挂载那么就把新的location放在pendingLocation中，这样当组件挂载后会从里面取出最新值
          this._pendingLocation = location;
        }
      });
    }
  }


  componentDidMount() {
    this._isMounted = true;
    // 如果this._pendingLocation存在，说明location有新值，则取出
    if (this._pendingLocation) {
      //更新
      this.setState({ location: this._pendingLocation });
    }
  }

  componentWillUnmount() {
    if (this.unlisten) this.unlisten();
  }

  render() {
    return (
      <RouterContext.Provider
        children={this.props.children || null}
        value={{
          history: this.props.history,
          location: this.state.location,
          match: Router.computeRootMatch(this.state.location.pathname),
          staticContext: this.props.staticContext
        }}
      />
    );
  }
}

if (__DEV__) {
  Router.propTypes = {
    children: PropTypes.node,
    history: PropTypes.object.isRequired,
    staticContext: PropTypes.object
  };

  Router.prototype.componentDidUpdate = function(prevProps) {
    warning(
      prevProps.history === this.props.history,
      "You cannot change <Router history>"
    );
  };
}

export default Router;
