import React from "react";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";
import warning from "tiny-warning";

import RouterContext from "./RouterContext";
import matchPath from "./matchPath";




/*
* Switch组件首先先获得location对象，然后依次与子组件的渲染路径进行匹配，
* 当匹配到能够渲染的子组件时就开始渲染子组件，并向子组件的props传入其匹配信息computedMatch。
* 同时如果子组件没有设置渲染路径那么在匹配时该子组件会默认返回已匹配。
*
* computedMatch的格式为：
* {
*   path,                                           //组件的渲染路径
*   url: path === "/" && url === "" ? "/" : url,    //url中与组件渲染路径匹配的部分
*   isExact,                                        //是否整个url都与渲染路径匹配
*   params: {                                       //组件渲染路径中的参数，及其匹配后对应的值
*       key:value,
*       key:value
*   }
* }
*
* 匹配的具体过程：
* 匹配使用了path-to-regexp库，先获取组件的匹配规则，包括渲染路径path，exact，sensitive，strict。
* 然后通过compilePath方法按照匹配规则生成对应的正则表达式，然后再使用正则表达式与路径进行匹配，返回匹配信息。
* 在生成正则表达式时进行了缓存，缓存的格式为:
*   {
*     //按照匹配规则分类缓存
*     falsefalsefalse:{
*         '/index/dash/:id':{
*             //生成的正则表达式
*             regexp:'',
*             //渲染路径中的参数,以及对应的值
*             keys:{
*               'id':'lihua'
*             }
*         }
*     }
*
*   }
*   且缓存的数量最多为10000，超过将不再缓存新的正则
* */


class Switch extends React.Component {
  render() {
    return (
      <RouterContext.Consumer>
        {context => {
          invariant(context, "You should not use <Switch> outside a <Router>");

          //Switch获取location是为了进行组件和路由的匹配，
          //location的来源有两个，一个是自身的location属性，另一个就是history中的location属性
          const location = this.props.location || context.location;

          let element, match;
          //使用location依次与子组件进行匹配
          React.Children.forEach(this.props.children, child => {
            //match用来存储匹配结果，如果为空说明还没有匹配到
            if (match == null && React.isValidElement(child)) {
              element = child;
              //获取子组件的渲染路径
              const path = child.props.path || child.props.from;
              //如果有渲染路径，就用获取到的location与渲染路径进行匹配，options参数为子组件其他的渲染要求
              //如果子组件没有渲染路径，那么就默认渲染，所以直接返回父组件获得的match作为匹配信息。
              match = path
                ? matchPath(location.pathname, { ...child.props, path })
                : context.match;
            }
          });
          //在渲染子组件时，传入子组件的匹配信息
          return match
            ? React.cloneElement(element, { location, computedMatch: match })
            : null;
        }}
      </RouterContext.Consumer>
    );
  }
}

if (__DEV__) {
  Switch.propTypes = {
    children: PropTypes.node,
    location: PropTypes.object
  };

  Switch.prototype.componentDidUpdate = function(prevProps) {
    warning(
      !(this.props.location && !prevProps.location),
      '<Switch> elements should not change from uncontrolled to controlled (or vice versa). You initially used no "location" prop and then provided one on a subsequent render.'
    );

    warning(
      !(!this.props.location && prevProps.location),
      '<Switch> elements should not change from controlled to uncontrolled (or vice versa). You provided a "location" prop initially but omitted it on a subsequent render.'
    );
  };
}

export default Switch;
