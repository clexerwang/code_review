import { Component } from '../component';

/** Retains a pool of Components for re-use, keyed on component name.
 *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
 *	@private
 */
//组件回收的共享池，这里保存的是通过collectComponent函数所回收的组件，它是按照组件名component.constructor.name来进行保存的
const components = {};


/** Reclaim a component for later re-use by the recycler. */
export function collectComponent(component) {
	let name = component.constructor.name;
	(components[name] || (components[name] = [])).push(component);
}


/** Create a component. Normalizes differences between PFC's and classful Components. */
//Ctor = vnode.nodeName，由于虚拟dom为组件类型，那么vnode.nodeName就为一个函数，这里就是取函数的name属性
//createComponent函数返回一个拥有props，context属性的组件实例
export function createComponent(Ctor, props, context) {

	let list = components[Ctor.name], //先看看组件池中有没有相同构造函数的组件实例
		inst;

    //如果为传统的组件
	if (Ctor.prototype && Ctor.prototype.render) {
		//根据构造函数创建实例
		inst = new Ctor(props, context);
		Component.call(inst, props, context);
	}
	//如果为函数式组件
	else {

		inst = new Component(props, context);
		inst.constructor = Ctor;
		//doRender会将Ctor函数返回的虚拟dom作为结果返回
		inst.render = doRender;
	}

    //如果组件池中有同类型组件
	if (list) {
		for (let i=list.length; i--; ) {
			if (list[i].constructor===Ctor) {
			    //把之前的组件实例的nextBase放入新的组件实例的nextBase中
				inst.nextBase = list[i].nextBase;
				list.splice(i, 1);
				break;
			}
		}
	}
	//返回实例
	return inst;
}


/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
	return this.constructor(props, context);
}
