import React from "react";
import { __RouterContext as RouterContext } from "react-router";
import { createLocation } from "history";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";

function isModifiedEvent(event) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

/*
* Link组件主要做了下面几件事：
* 首先就是渲染一个a元素，通过to属性的值生成一个location对象，在使用该对象生成一个可用的a元素的href值
* 在a元素上绑定事件处理函数。
* 当触发事件函数是，根据属性replace判断采用哪种跳转方式。
*
* */


//Link组件实质上渲染了一个<a>元素
class Link extends React.Component {

  handleClick(event, history) {
    //如果Link上绑定了click事件，那么先处理Link上的事件
    if (this.props.onClick) this.props.onClick(event);

    if (
      !event.defaultPrevented &&  //如果取消了默认操作，则跳过
      event.button === 0 &&       // 如果是非左键单击，则跳过
      (!this.props.target || this.props.target === "_self") && // let browser handle "target=_blank" etc.
      !isModifiedEvent(event)     // 如果是组合键的单击，则跳过
    ) {
      event.preventDefault();
      //根据参数选择跳转方式
      const method = this.props.replace ? history.replace : history.push;
      //执行跳转
      method(this.props.to);
    }
  }

  render() {

    const { innerRef, replace, to, ...rest } = this.props;

    return (
      <RouterContext.Consumer>
        {/*如果没接收到context，说明Link组件不是Router的子组件*/}
        {context => {
          invariant(context, "You should not use <Link> outside a <Router>");

          //这里location是要跳转到的页面的location对象，这里是使用当前location和to生成目标的location对象，
          //因为to有可能是相对路径，所以要计算出绝对路径
          const location =
            typeof to === "string"
              ? createLocation(to, null, null, context.location)
              : to;
          //创建可用的url
          const href = location ? context.history.createHref(location) : "";

          return (
            /*a中没有Link的innerRef，replace，to属性*/
            <a
              {...rest}
              onClick={event => this.handleClick(event, context.history)}
              href={href}
              ref={innerRef}
            />
          );
        }}
      </RouterContext.Consumer>
    );
  }
}

if (__DEV__) {
  const toType = PropTypes.oneOfType([PropTypes.string, PropTypes.object]);
  const innerRefType = PropTypes.oneOfType([PropTypes.string, PropTypes.func]);

  Link.propTypes = {
    innerRef: innerRefType,
    onClick: PropTypes.func,
    replace: PropTypes.bool,
    target: PropTypes.string,
    to: toType.isRequired
  };
}

export default Link;
