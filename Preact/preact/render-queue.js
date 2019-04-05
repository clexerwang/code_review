import options from './options';
import { defer } from './util';
import { renderComponent } from './vdom/component';

/** Managed queue of dirty components to be re-rendered */

let items = [];

//用来异步渲染组件
export function enqueueRender(component) {
	/*组件_dirty属性的默认值是false
	先将组件的_dirty重新设为true，然后将组件放入items数组中，
	这里也是为了保证，在连续调用setState时组件的更新只执行一次
	与react不同的是，每次执行setState时，state的值都会立即改变
	异步执行rerender函数。*/
	if (!component._dirty && (component._dirty = true) && items.push(component)==1) {
		(options.debounceRendering || defer)(rerender);
	}
}

export function rerender() {
	let p, list = items;
	items = []; //取出items中的组件
	//通过_dirty判断每个组件是否要重新渲染
	while ( (p = list.pop()) ) {
		//对需要重新渲染的组件进行渲染
		if (p._dirty) renderComponent(p);
	}
}
