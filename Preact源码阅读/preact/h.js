import { VNode } from './vnode';
import options from './options';


const stack = [];

const EMPTY_CHILDREN = [];

//生成VNode对象
export function h(nodeName, attributes) {

	let children=EMPTY_CHILDREN, lastSimple, child, simple = false, i;
	//将子节点存入stack中
	for (i=arguments.length; i-- > 2; ) {
		stack.push(arguments[i]);
	}

	//如果节点属性中拥有children属性，则把children属性的值存入stack中
	if (attributes && attributes.children!=null) {
		if (!stack.length) stack.push(attributes.children);
		//删除属性中的children属性
		delete attributes.children;
	}
	//循环对子节点进行处理
	while (stack.length) {
		//如果取出的子节点是数组类型的，则将数组中的所有节点放入stack中
		if ((child = stack.pop()) && child.pop!==undefined) {
			for (i=child.length; i--; ) stack.push(child[i]);
		}
		//对于单个的子节点
		else {
			//如果子节点是布尔类型的值，直接把子节点取空
			if (typeof child==='boolean') child = null;

			//如果nodeName是组件类型，就跳过对子节点的转换
			if (simple = typeof nodeName!=='function'){//如果nodeName不是组件类型

                //如果nodeName子节点为空，就置空
				if (child==null) child = '';
				//如果nodeName子节点是数字类型，就转为字符类型
				else if (typeof child==='number') child = String(child);

				else if (typeof child!=='string') simple = false;
			}
			/*
			这里说明一下，simple主要是用来表示子节点的类型，因为只有在nodeName不是组件类型的情况下才会处理子节点，
			所以上面就借用了一下对nodeName类型判断的结果对simple进行了赋值,所以simple与nodeName是否为原生节点没有关系
			*/

			//lastSimple记录了上一个子节点是否为简单类型节点
			if (simple && lastSimple) {
				//如果相邻两个子节点都是简单类型，则合并两个子节点，并存入children中
				children[children.length-1] += child;
			}
			else if (children===EMPTY_CHILDREN) {
				children = [child];
			}
			else {
				children.push(child);
			}
			lastSimple = simple;
		}
	}

	let p = new VNode();
	p.nodeName = nodeName;
	p.children = children;
	p.attributes = attributes==null ? undefined : attributes;
	p.key = attributes==null ? undefined : attributes.key;

	if (options.vnode!==undefined) options.vnode(p);
	return p;
}






