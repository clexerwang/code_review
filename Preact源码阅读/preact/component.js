import { FORCE_RENDER } from './constants';
import { extend } from './util';
import { renderComponent } from './vdom/component';
import { enqueueRender } from './render-queue';

/** Base Component class.
 *	Provides `setState()` and `forceUpdate()`, which trigger rendering.
 *	@public
 *
 *	@example
 *	class MyFoo extends Component {
 *		render(props, state) {
 *			return <div />;
 *		}
 *	}
 */

//组件有四个属性和两个方法
export function Component(props, context) {
	//组件的_dirty为true表示组件的状态更新了，需要重新渲染
	this._dirty = true;

	/** @public
	 *	@type {object}
	 */
	this.context = context;

	/** @public
	 *	@type {object}
	 */
	this.props = props;

	/** @public
	 *	@type {object}
	 */
	this.state = this.state || {};
}


extend(Component.prototype, {

	/** Returns a `boolean` indicating if the component should re-render when receiving the given `props` and `state`.
	 *	@param {object} nextProps
	 *	@param {object} nextState
	 *	@param {object} nextContext
	 *	@returns {Boolean} should the component re-render
	 *	@name shouldComponentUpdate
	 *	@function
	 */


	/** Update component state by copying properties from `state` to `this.state`.
	 *	@param {object} state		A hash of state properties to update with new values
	 *	@param {function} callback	A function to be called once component state is updated
	 */
	setState(state, callback) {
		let s = this.state;


		if (!this.prevState) this.prevState = extend({}, s); //如果prevState没有保存值，则把当前的组件状态存入prevState中
		extend(s, typeof state==='function' ? state(s, this.props) : state); //通过state立即更新当前组件的状态
		if (callback) (this._renderCallbacks = (this._renderCallbacks || [])).push(callback); //如果有回调函数，就把回调函数加入到组件的_renderCallbacks中
		enqueueRender(this);  //把组件加入到异步更新队列中等待更新
	},


	/** Immediately perform a synchronous re-render of the component.
	 *	@param {function} callback		A function to be called after component is re-rendered.
	 *	@private
	 */
	//强制更新
	forceUpdate(callback) {
		if (callback) (this._renderCallbacks = (this._renderCallbacks || [])).push(callback);
		renderComponent(this, FORCE_RENDER);  //同步更新组件
	},


	/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
	 *	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
	 *	@param {object} props		Props (eg: JSX attributes) received from parent element/component
	 *	@param {object} state		The component's current state
	 *	@param {object} context		Context object (if a parent component has provided context)
	 *	@returns VNode
	 */
	//空方法
	render() {}

});
