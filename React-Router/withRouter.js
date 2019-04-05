import React from "react";
import PropTypes from "prop-types";
import hoistStatics from "hoist-non-react-statics";

import Route from "./Route";

//将组件包裹在Route中渲染

function withRouter(Component) {
  const C = props => {

    const { wrappedComponentRef, ...remainingProps } = props;

    return (
      <Route
        children={routeComponentProps => (
          <Component
            {...remainingProps}
            {...routeComponentProps}
            ref={wrappedComponentRef}
          />
        )}
      />
    );
  };

  C.displayName = `withRouter(${Component.displayName || Component.name})`;
  C.WrappedComponent = Component;

  if (__DEV__) {
    C.propTypes = {
      wrappedComponentRef: PropTypes.func
    };
  }

  return hoistStatics(C, Component);
}

export default withRouter;
