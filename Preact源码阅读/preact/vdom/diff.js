import { ATTR_KEY } from '../constants';
import { isSameNodeType, isNamedNode } from './index';
import { buildComponentFromVNode } from './component';
import { createNode, setAccessor } from '../dom/index';
import { unmountComponent } from './component';
import options from '../options';
import { removeNode } from '../dom/index';

/** Queue of components that have been mounted and are awaiting componentDidMount */
//用来存储已经挂载并且等待触发componentDidMount事件的组件
export const mounts = [];
/** Diff recursion count, used to track the end of the diff cycle. */
export let diffLevel = 0;
/** Global flag indicating if the diff is currently within an SVG */
let isSvgMode = false;
/** Global flag indicating if the diff is performing hydration */
let hydrating = false;

/** Invoke queued componentDidMount lifecycle methods */
export function flushMounts() {
    let c;
    while ((c=mounts.pop())) {
        if (options.afterMount) options.afterMount(c);
        if (c.componentDidMount) c.componentDidMount();
    }
}

/*
isChild：
isChild是在renderComponent中使用的:
    1、if(base && !isChild) {....}
    2、if(!diffLevel && !isChild) flushMounts();

首先isChild的作用就是标识组件在当前的渲染过程中所处的位置，以A，B，C，D为例：
在首次渲染过程中，B，C，D的isChild都为true。
但是在更新过程中，比如B触发了更新，这时B的isChild是false，C，D的isChild才为true。


在1中的作用：
通过isChild来判断当前组件在组件嵌套中的位置，从而给组件设置对应的组件关系。
顺便说一下为什么只有当组件内部也为组件类型且前后组件类型不相同时才把isChild设为true，
首先只有当组件内部也为组件类型时才是高阶组件，才需要通过isChild设置组件间的关系；
其次只有当组件类型不相同时才需要设置，如果前后组件类型相同的话，那么diff过程就会在之前组件的基础上进行修改，而之前组件的关系已经设置好了，
不需要再设置所以不需要传入isChild。

在2的作用：
首先，要知道如果执行了diff函数，且没有退出，那么diffLevel的值一定就会是1。
对于初次挂载过程来说，开始时一定会执行diff函数，且只有整个初次挂载过程结束后diffLevel才会变成0，所以isChild在首次挂载过程中是不起作用的，默认为false。

那么什么时候才会在不执行diff的情况下先执行renderComponent呢？
只有在更新过程中，当在某组件中调用了setState时，会把该组件传入renderComponent中，
此时diffLevel为0，isChild才会起作用，isChild的作用就是表示当前的组件是否是一串连续的组件嵌套中的子组件，通过isChild来判断是否已经退出到了触发更新的组件上。



componentRoot：
componentRoot在两个地方使用了：
diff中的 if (!componentRoot) flushMounts();
idiff中的 !dom._component || componentRoot;

componentRoot表示当前在diff的虚拟dom是某个组件内部的。

首先看一下在diff中的componentRoot，只有当要退出diff过程时才会执行到这一句，
这句的作用就是决定要不要触发mounts数组中的组件的componentDidMount钩子函数，
在首次渲染中，只有在退出首次渲染时才会执行到这句，而此时componentRoot一定为false，所以一定会执行。
在更新过程中，当某个组件内部是dom类型时，此时在对内部进行diff时，componentRoot取值为true，所以在退出diff时不会执行flushMounts，
而是会在renderComponent中通过判断diffLevel和isChild来判断是否执行flushMounts。
所以当diffLevel为0时为什么不在退出diff时执行flushMounts呢？
因为执行完diff后，在renderComponent中还要判断是否将上级组件加入到mounts中（根据mountAll判断），判断完以后才应该执行flushMounts。

所以ComponentRoot的作用就是表示当前diff的dom是否处于组件内部，如果在组件内部那么当dom完成diff后通过componentRoot阻止立即执行flushMounts，
而是在一层一层的退出renderComponent时通过diffLevel和isChild来判断是否已经退出到最外层组件，然后再执行flushMounts。

关于第二个用处，看L25.
 */


/*啊，怕忘还是举个例子吧
有如下组件结构：
A --> B --> C --> D --> <div>d</div>

当组件A触发了更新且所有子组件前后类型都不相同时，执行renderComponent(A,isChild为undefined),
由于组件A内部仍是组件，所以执行renderComponent(B，isChild为true)，在组件B中与之前情况类似，也触发renderComponent(C，isChild为true)，
然后renderComponent(D,isChild为true)，最后由于D内部不是组件类型，开始执行diff(componentRoot为true)，
在当diff执行完成退出时，由于此时ComponentRoot为true所以不会执行diff中的flushMounts，然后退出到renderComponent(D,isChild为true)中，
通过isUpdate||mountAll 判断是否要将D加入到mounts中，由于此时isChild为true，所以也不会执行其中的flushMounts，
以此类推直到renderComponent(A,isChild为undefined)，由于此时isChild为undefined，表示已经退出到了触发更新的组件上来，此时就可以执行flushMounts了。
*/




export function diff(dom, vnode, context, mountAll, parent, componentRoot) {

    if (!diffLevel++) {

        //当第一次开始diff时，检查挂载点是否为SVG元素
        isSvgMode = parent!=null && parent.ownerSVGElement!==undefined;

        //当要diff的元素存在且是初次渲染时，hydrating为true
        hydrating = dom != null && !(ATTR_KEY in dom);

    }
    //idiff会返回虚拟dom与真实dom进行diff之后创建的真实dom节点
    let ret = idiff(dom, vnode, context, mountAll, componentRoot);



    //这里是有选择性的把真实dom加入到父节点中，原因是某些节点并不是新创建的，而是原有节点修改了属性，所以它仍然还在父节点下，不需要插入了
    if (parent && ret.parentNode!==parent)
        parent.appendChild(ret);


    if (!--diffLevel) {
        hydrating = false;
        if (!componentRoot) flushMounts();
    }
    return ret;
}


function idiff(dom, vnode, context, mountAll, componentRoot) {

    let out = dom,
        //判断挂载点是否为SVG
        prevSvgMode = isSvgMode;

    //虚拟dom为空值(null,undefined,boolean)就渲染为空文本节点
    if (vnode==null || typeof vnode==='boolean') {
        vnode = '';
    }



    if (typeof vnode==='string' || typeof vnode==='number') {

         /*
         !dom._component || componentRoot表示：
         如果dom是由组件渲染的，那么虚拟dom也要是由组件渲染的（componentRoot为true表示当前diff的虚拟dom是由组件渲染的）：
         因为如果dom是由组件渲染，那么它就会保存着与之前组件的关系，componentRoot为true表示当前虚拟dom在diff完之后还需要建立组件关系，
         这样就可以清除掉dom之前的组件关系。如果为false就表示没有后续的处理了，此时diff完成之后的dom仍然保持着与之前组件的关系。

         相反如果dom不是由组件渲染的，那么dom中也就不会保存与之前组件的关系，这样不管虚拟dom是不是由组件渲染都没有关系。
         */
        if (dom && dom.splitText!==undefined && dom.parentNode && (!dom._component || componentRoot)) {
            if (dom.nodeValue !== vnode) {
                dom.nodeValue = vnode;
            }
        }
        else {
            //如果dom不是一个文本节点,就先由虚拟dom生成文本节点out
            out = document.createTextNode(vnode);
            if (dom) {
                if (dom.parentNode) {
                    //由out替换dom
                    dom.parentNode.replaceChild(out, dom);
                }
                //回收dom
                recollectNodeTree(dom, true);
            }
        }

        out[ATTR_KEY] = true;
        return out;
    }


    //如果虚拟dom的类型是组件
    let vnodeName = vnode.nodeName;

    if (typeof vnodeName==='function') {
        //根据虚拟dom生成组件实例
        return buildComponentFromVNode(dom, vnode, context, mountAll);
    }


    /*
    *接下来是虚拟dom为原生类型的情况
    */
    
    //判断虚拟dom是否为SVG
    if(vnodeName === 'svg'){
        isSvgMode = true;
    }else if(vnodeName === 'foreignObject'){
        isSvgMode = false;
    }

    vnodeName = String(vnodeName);

    if (!dom || !isNamedNode(dom, vnodeName)) {
        out = createNode(vnodeName, isSvgMode);

        if (dom) {
            // 移动dom中的子元素到out中
            while (dom.firstChild) out.appendChild(dom.firstChild);

            //替换
            if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

            //回收被替换掉的dom
            //如果dom是组件渲染出来的真实dom，那么就会卸载dom所在的组件；
            //如果dom不是由组件渲染，那么根据第二个参数来判断是只递归的卸载dom的子节点，还是连同dom一起卸载
            recollectNodeTree(dom, true);
        }
    }



    /*
    * 如果dom存在且dom与虚拟dom类型相同那么out仍然为初始时的dom节点
    * 如果dom不存在，那么out就为由虚拟dom所生成的dom节点
    * 如果dom存在且dom的类型和虚拟dom的类型不相同，那么out就是由虚拟dom生成的dom节点并且挂载了dom的子节点。
    */
    //接下来开始处理子节点

    let fc = out.firstChild,
        props = out[ATTR_KEY], // props = out._preactattr;
        vchildren = vnode.children;



    //props为空，说明当前的dom元素是第一次进行diff，所以在这里为dom创建ATTR_KEY属性，用来标识该dom已经diff过了
    if (props == null) {
        props = out[ATTR_KEY] = {};
        for (let a=out.attributes, i=a.length; i--; ) {
            props[a[i].name] = a[i].value;
        }
    }



    // 在更新过程中：如果dom和虚拟dom都只有一个文本子节点，那么直接修改nodeValue
    if (!hydrating && vchildren && vchildren.length===1 && typeof vchildren[0]==='string' && fc!=null && fc.splitText!==undefined && fc.nextSibling==null) {
        if (fc.nodeValue !== vchildren[0]) {
            fc.nodeValue = vchildren[0];
        }
    }
    // otherwise, if there are existing or new children, diff them:
    //除了上面的情况之外，对虚拟dom的子节点进行diff
    else if (vchildren && vchildren.length || fc!=null) {
         /*
         关于hydrating || props.dangdangerouslySetInnerHTMLerouslySetInnerHTML!=null ：
         hydrating为true表示dom存在且是首次渲染，那么在这个判断中，如果hydrating为true，就表示dom是首次渲染的，
         对于innerDiffNode函数来说，也就是知道了dom的子元素肯定也是首次渲染的。
         如果hydrating为false，说明dom不是首次渲染，对于innerDiffNode函数来说，dom的子元素就一定不是首次渲染了吗？
         那就要看dangerouslySetInnerHTML属性了，dangerouslySetInnerHTML属性的作用是重写dom的内容，那么如果dom有这个属性，
         就说明dom重写了子节点，子节点仍然是处于首次渲染。
         所以总的来说这个判断句就是用来判断子元素是否是初次渲染。
         */
        innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML!=null);
    }


    //更新out的属性
    //如果out为最初的dom节点，那么out的属性可能不太符合jsx的规范，所以需要进行改变
    //如果out为由虚拟dom生成的节点，那么out目前还没有属性，需要更新属性

    //如果out不是首次渲染，那props中就保存的它之前的属性，
    //如果out是首次渲染，如果out不是由createNode创建则props中是out的元素属性，如果out是由createNode创建，则props为空
    diffAttributes(out, vnode.attributes, props);


    // restore previous SVG mode: (in case we're exiting an SVG namespace)
    isSvgMode = prevSvgMode;

    return out;
}



function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {

    let originalChildren = dom.childNodes, //真实Dom的子节点
        children = [],  //保存没有key属性的子节点
        keyed = {},     //用来保存拥有key属性的子节点
        keyedLen = 0,   //表示keyed中的节点的个数
        min = 0,
        len = originalChildren.length, //真实Dom的子节点数量
        childrenLen = 0,
        vlen = vchildren ? vchildren.length : 0, //虚拟Dom节点的子节点的数量
        j, c, f, vchild, child;

    //把真实Dom的子节点分类
    if (len!==0) {

        for (let i=0; i<len; i++) {
            let child = originalChildren[i],
                props = child[ATTR_KEY],    //child._preactattr
                /*
                vlen && props 主要考虑了两点：
                	如果vlen为0，就说明虚拟dom没有子节点，那就不需要比较了，因为要按照虚拟dom进行更新，所以子节点会全部被移除。
                	如果props为undefined：说明子节点是第一次渲染，而key是在每次更新时使用，所以也不需要(因为在首次渲染时，拥有相同key的真实dom和虚拟dom之间没有什么必然的联系)
                所以直接将key置为null，为了提高效率
                 */
                key = (vlen && props) ? (child._component ? child._component.__key : props.key) : null;
            //把真实Dom的子节点按照key存进keyed对象中
            if (key!=null) {
                keyedLen++;
                keyed[key] = child;
            }
            //如果是更新过程的节点，加入children中
            //如果是首次diff的非空文本节点或其他类型节点，加入children中
            else if (props || (child.splitText!==undefined ? (isHydrating ? child.nodeValue.trim() : true) : isHydrating)) {
                children[childrenLen++] = child;
            }
        }

    }
    //将虚拟dom的子节点与真实dom的子节点进行diff
    if (vlen!==0) {
        for (let i=0; i<vlen; i++) {
            vchild = vchildren[i];
            child = null;
            //优先寻找有相同key的子节点
            let key = vchild.key;
            if (key!=null) {
                if (keyedLen && keyed[key]!==undefined) {
                    child = keyed[key];
                    keyed[key] = undefined;
                    keyedLen--;
                }
            }
            // 如果虚拟dom的key为空，就从真实dom没有key的子节点中选择类型相同的子节点。
            else if (!child && min<childrenLen) {
                for (j=min; j<childrenLen; j++) {
                    if (children[j]!==undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
                        child = c;
                        children[j] = undefined;

                        //这两步是为了在取出子节点后改变childrenLen的长度
                        //如果j等于childrenLen-1，说明现在循环到了最后一个子节点的位置，那么把节点赋值给child后，把数组的长度减一就相当于从数组中取出了节点。
                        //如果j等于min，也就是说现在循环到了第一个子节点，那么只要把初始位置加一，就也相当于从数组中取出了节点
                        if (j===childrenLen-1) childrenLen--;
                        if (j===min) min++;
                        break;
                    }
                }
            }

            //把key值匹配的虚拟Dom节点和真实Dom节点进行Diff
            //返回Diff好的子节点
            child = idiff(child, vchild, context, mountAll);

            //f是与当前虚拟dom子节点的位置相对应的真实dom的子节点
            f = originalChildren[i];

            //以i = 0 为例：
            //child为第[0]个虚拟dom子节点diff后返回的真实dom
            //f为dom中的第[0]个子节点

            //如果diff后的子节点和真实dom中对应位置的子节点不相同时：
            if (child && child!==dom && child!==f) {
                //如果f为空，说明真实dom在该位置原来没有子节点，那就把diff后的子节点插入到该位置
                if (f==null) {
                    dom.appendChild(child);
                }
                //如果f的兄弟节点和diff后的子节点相同，那就直接移除f，这样它的兄弟节点就顶替了f的位置
                else if (child===f.nextSibling) {
                    removeNode(f);
                }
                //其余直接把diff后的子节点插入到其对应的位置
                else {
                    dom.insertBefore(child, f);
                }
            } //这些操作是为了让diff后的子节点按照其在虚拟dom中的位置插入到真实dom中
        }
    }


    // 移除剩余无用的节点
    if (keyedLen) {
        for (let i in keyed) if (keyed[i]!==undefined) recollectNodeTree(keyed[i], false);
    }

    while (min<=childrenLen) {
        if ((child = children[childrenLen--])!==undefined) recollectNodeTree(child, false);
    }
}



// 回收节点
export function recollectNodeTree(node, unmountOnly) {
    //获取节点所在的最上层直接组件
    let component = node._component;
    if (component) {
        // if node is owned by a Component, unmount that component (ends up recursing back here)
        unmountComponent(component);
    }
    else {
        // If the node's VNode had a ref function, invoke（引用） it with null here.
        // (this is part of the React spec, and smart for unsetting references)
        if (node[ATTR_KEY]!=null && node[ATTR_KEY].ref) node[ATTR_KEY].ref(null);
        // 如果要全部卸载
        if (unmountOnly===false || node[ATTR_KEY]==null) {
            removeNode(node);
        }
        // 否则只卸载子节点
        removeChildren(node);
    }
}


export function removeChildren(node) {

    node = node.lastChild;
    while (node) {
        let next = node.previousSibling;
        recollectNodeTree(node, true);
        node = next;
    }
}



//attrs：虚拟dom的属性，old：dom元素的现有属性
function diffAttributes(dom, attrs, old) {
    let name;
    // remove attributes no longer present on the vnode by setting them to undefined
    for (name in old) {
        //遍历old对象，如果一个属性存在于old，但不存在于attrs中时,就要把这个属性置为空
        if (!(attrs && attrs[name]!=null) && old[name]!=null) {
            setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
        }
    }

    // add new & update changed attributes
    //然后按照attrs来更新old中的属性
    for (name in attrs) {
        //首先属性不能是children和innerHTML
        //属性不能是children，原因children表示的是子元素，其实Preact在h函数已经做了处理，这里其实是不会存在children属性的。
        //属性也不能是innerHTML。其实这一点Preact与React是在这点是相同的,不能通过innerHTML给dom添加内容，只能通过dangerouslySetInnerHTML进行设置
        if (name !== 'children' && name !== 'innerHTML') {

            //如果old中没有该属性，就要按照attrs把该属性赋值在old中
            if (!(name in old)) {
                setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);

                /*如果old中有该属性，那么如果该属性为value或checked
				这么判断的主要目的就是如果属性值是value或者checked表明该dom属于表单元素，
				防止该表单元素是不受控的，导致缓存的属性可能不等于当前dom中的属性。
				所以要从dom中判断属性的值是否相等*/
            } else if (name === 'value' || name === 'checked') {
                //如果attrs和dom中的该属性的值不相同
                if (attrs[name] !== dom[name]) {
                    //就要更新old中该属性的值
                    setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
                }
                //如果old中有该属性，且该属性不是value或checked，
                //那么如果attrs和old中的属性值不相同时
            } else if (attrs[name] !== old[name]) {
                setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
            }
        }
    }
}
