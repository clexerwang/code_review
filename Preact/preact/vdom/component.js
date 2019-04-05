import { SYNC_RENDER, NO_RENDER, FORCE_RENDER, ASYNC_RENDER, ATTR_KEY } from '../constants';
import options from '../options';
import { extend } from '../util';
import { enqueueRender } from '../render-queue';
import { getNodeProps } from './index';
import { diff, mounts, diffLevel, flushMounts, recollectNodeTree, removeChildren } from './diff';
import { createComponent, collectComponent } from './component-recycler';
import { removeNode } from '../dom/index';

export function setComponentProps(component, props, opts, context, mountAll) {
    if (component._disable) return;
    //为组件实例加锁
    component._disable = true;

    //为组件获取最新的ref和key
    if ((component.__ref = props.ref)) delete props.ref;
    if ((component.__key = props.key)) delete props.key;

    //判断想要触发的钩子函数
    if (!component.base || mountAll) {
        if (component.componentWillMount) component.componentWillMount();//这里没有传入值
    }
    else if (component.componentWillReceiveProps) {
        component.componentWillReceiveProps(props, context);//这里传入最新的props和context
    }

    //为组件保存旧的context和props，获取最新的context和props。
    if (context && context!==component.context) {
        //将component.context放入component.prevContext中
        if (!component.prevContext) component.prevContext = component.context;
        component.context = context;
    }
    //获得props，存储旧props
    if (!component.prevProps) component.prevProps = component.props;
    component.props = props;

    component._disable = false;


    //根据参数执行不同的渲染方法
    if (opts!==NO_RENDER) {
        if (opts===SYNC_RENDER || options.syncComponentUpdates!==false  || !component.base) {
            renderComponent(component, SYNC_RENDER, mountAll);
        }
        else {
            enqueueRender(component);
        }
    }
    //组件渲染完成后，如果组件有ref属性，则以组件自己为参数执行ref
    if (component.__ref) component.__ref(component);
}










export function renderComponent(component, opts, mountAll, isChild) {

    if (component._disable) return;

    //取出组件的props，state，context这些值都是由虚拟dom得来的，所以他们是组件的最新状态
    let props = component.props,
        state = component.state,
        context = component.context,


        //这里是获取组件之前的状态
        previousProps = component.prevProps || props,
        previousState = component.prevState || state,
        previousContext = component.prevContext || context,

        isUpdate = component.base,

        /*
         component.nextBase的来源：
         1、在diff过程中，当虚拟dom是组件类型，而真实dom不是由组件渲染时，会将真实dom存入由虚拟dom生成的组件实例的nextBase中。
         2、当组件实例要被卸载时，它所渲染的dom就会被存入nextBase中，然后组件实例会被放入组件池中。
         */
        nextBase = component.nextBase,

        //initialBase就是组件实例的要进行修改的dom，他有两个来源：component.base和component.nextBase。
        initialBase = isUpdate || nextBase,

        initialChildComponent = component._component,

        skip = false,
        rendered, inst, cbase;


    //如果component.base不为空，表示组件处于更新过程，则触发组件componentWillUpdate函数
    if (isUpdate) {

        /*
        由于组件在执行生命周期函数shouldComponentUpdate，componentWillUpdate时，组件应该是之前的状态，
        所以这里先让组件保留更新之前的状态，保证接下来如果触发shouldComponentUpdate，componentWillUpdate时组件的状态正确。
        */
        component.props = previousProps;
        component.state = previousState;
        component.context = previousContext;

       /*
        如果组件不是强制更新状态且shouldComponentUpdate为false，则组件不能被更新
        非强制状态下shouldComponentUpdate返回false表示组件不能被更新
        强制更新可以无视shouldComponentUpdate的结果
        */
        if (opts!==FORCE_RENDER && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context)===false) {
            //跳过此次的更新过程
            skip = true;
        }
        //如果要执行更新
        else if (component.componentWillUpdate) {
            //触发componentWillUpdate，此时组件的状态仍为旧的状态，但是componentWillUpdate中要传入新的状态
            component.componentWillUpdate(props, state, context);
        }

        //因为在componentWillUpdate中可能会改变props，state，context所以要再赋值一次
        component.props = props;
        component.state = state;
        component.context = context;
    }

    component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
    //需要注意的是只有_dirty为false才可以被放入更新队列，然后_dirty会被置为true，这样组件实例就不会被多次放入更新队列。
    component._dirty = false;

    //具体过程，不管是更新还是首次渲染都会执行
    if (!skip) {

        //执行组件实例的render函数，返回组件实例render中的虚拟dom对象
        rendered = component.render(props, state, context);

        //如果组件存在函数getChildContext，则生成当前需要传递给组件内部的context
        if (component.getChildContext) {
            context = extend(extend({}, context), component.getChildContext());
        }

        //childComponent为组件实例内部的虚拟dom的节点名称
        let childComponent = rendered && rendered.nodeName,
            toUnmount, base;

        //如果组件实例内部最新的虚拟dom为组件类型
        if (typeof childComponent==='function') {

            //通过getNodeProps函数获得内部虚拟dom的attributes，children属性，保存在childProps中
            let childProps = getNodeProps(rendered);

            //因为现在组件实例的子组件还没有挂载，所以组件之间的联系还没有建立，所以_component属性指向的是旧的子组件
            inst = initialChildComponent; //initialChildComponent = component._component


            //inst指component触发更新前的内部的组件实例，childComponent指component触发更新后的内部的组件实例。
            //如果触发更新前后组件实例内部的虚拟dom类型相同，
            if (inst && inst.constructor === childComponent && childProps.key === inst.__key) {
                setComponentProps(inst, childProps, SYNC_RENDER, context, false);
            }
            //如果触发更新前后组件实例内部的虚拟dom类型不相同
            else {
                //准备卸载旧子组件实例
                toUnmount = inst;
                //使用虚拟dom创建组件实例，并把父子组件之间的_compoent,_prentComponent属性指向设置好
                //ins就保存了新的组件实例
                component._component = inst = createComponent(childComponent, childProps, context);

                inst.nextBase = inst.nextBase || nextBase;

                inst._parentComponent = component;

                //然后通过调用setComponentProps来设置组件的ref和key等，以及调用组件的相关生命周期函数(例如:componentWillReceiveProps)
                //这里需要保证mountAll必须为false，如果mountAll为true，在setComponentProps中就一定会执行componentWillReceiveProps。
                setComponentProps(inst, childProps, NO_RENDER, context, false);
                //然后同步的渲染
                renderComponent(inst, SYNC_RENDER, mountAll, true);
                /* 所以我们就要注意为什么在调用函数setComponentProps时没有采用SYNC_RENDER模式，SYNC_RENDER模式也本身就会触发renderComponent去渲染组件
                *  其原因就是为了在调用renderComponent赋予isChild值为true。
                *  调用完renderComponent之后，inst.base中已经是我们子组件渲染的真实dom节点。*/

            }
            //将新渲染出来的base保存
            base = inst.base;
        }
        //如果组件实例 内部虚拟dom不为组件类型
        else {

            cbase = initialBase; //initialBase == isUpdate || nextBase;
            //旧的子组件实例，如果有说明当前组件实例之前为高阶组件
            toUnmount = initialChildComponent; //initialChildComponent = component._component;

            /*
            这里只针对更新过程，因为初次渲染initialChildComponent为null
            因为initialChildComponent == component._component，所以这里toUnmount如果为true，表示组件为高阶组件(之前的组件渲染的是函数类型的元素(即组件))
            但现在却渲染的是非函数类型（非组件类型）的，赋值toUnmount = initialChildComponent，表示直接卸载的子组件，
            并且由于cbase对应的是之前的渲染的组件的dom节点，但因为现在渲染的不再是组件类型因此就无法使用了，需要赋值cbase = null以使得重新渲染。
            而component._component = null目的就是切断之前组件间的父子关系，毕竟现在返回的都不是组件。
            */
            if (toUnmount) {
                cbase = component._component = null;
            }

            /*
            如果是更新过程，initialBase就是组件渲染的真实dom，
            如果是挂载过程，如果组件之前没有被卸载过，initialBase为组件第一次挂载时进行diff的真实dom，
                          如果卸载过，initialBase就是组件卸载前渲染的真实dom
            如果initialBase为false，那么肯定是挂载过程，这里恒为true
            */
            if (initialBase || opts===SYNC_RENDER) {
                //如果组件实例是首次渲染，cbase为空

                // cbase存在说明组件实例不是高阶组件，这里清除掉旧的真实dom与组件实例之间的联系
                if (cbase)
                    cbase._component = null;

                /*
                由于mountAll初始值为false，所以这里 mountAll || !isUpdate 的值是由isUpdate来决定，
                也就是说对于初次挂载，rendered内部的diff过程中mountAll将全为true
                */
                base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
            }
        }

        /*
        这里主要就是用来判断组件是否还可以重用？
        如果生成的dom和原本的dom不一样，并且子组件也不一样，就只好卸载了
        */
        if (initialBase && base!==initialBase && inst!==initialChildComponent) {

            let baseParent = initialBase.parentNode;
            //如果baseParent存在说明是更新过程，如果新的dom不是旧dom的父节点
            if (baseParent && base!==baseParent) {
                baseParent.replaceChild(base, initialBase);
                /*
                如果没有需要卸载的组件实例，说明之前并不是高阶组件，因此只需要将之前的真实dom与组件的关系断开，并回收真实dom就可以了
                */
                if (!toUnmount) {
                    initialBase._component = null;
                    recollectNodeTree(initialBase, false);
                }
            }
        }
        //如果有需要卸载的子组件，说明之前是高阶组件，需要回收子组件
        if (toUnmount) {
            unmountComponent(toUnmount);
        }

        component.base = base;
        // 这里的作用为：比如有A，B，C，D四个组件依次嵌套，当C组件触发了更新，就会调用renderComponent传入C组件实例，
        // 那么在C组件更新完毕后，就要设置新的dom与上级组件的关系，
        // 这里就会以C组件实例为起点，因为更新是从C组件开始的，所以isChild为false，
        // 开始向上寻找C组件的父组件，并设置他们与新的dom的关系。
        if (base && !isChild) {
            //如果是最上层组件，就循环设置base属性
            let componentRef = component,
                t = component;
            while ((t=t._parentComponent)) {
                (componentRef = t).base = base;
            }
            base._component = componentRef;
            base._componentConstructor = componentRef.constructor;
        }
    }
    //渲染过程执行完毕



    //mountAll表示是否强制同步
    if (!isUpdate || mountAll) {
        mounts.unshift(component);
    }
    //如果经历了更新过程，就触发更新完后的钩子函数
    else if (!skip) {

        //确保子节点的componentDidMount钩子函数在父节点的componentDidUpdate函数之前被调用
        if (component.componentDidUpdate) {
            component.componentDidUpdate(previousProps, previousState, previousContext);
        }
        if (options.afterUpdate) options.afterUpdate(component);
    }



    /*
    如果组件存在_renderCallbacks属性(存储对应的setState的回调函数，因为setState函数实质也是通过renderComponent实现的)，
    则在此处将其弹出并执行。
    */
    if (component._renderCallbacks!=null) {
        while (component._renderCallbacks.length) component._renderCallbacks.pop().call(component);
    }

    if (!diffLevel && !isChild) flushMounts();
}



export function buildComponentFromVNode(dom, vnode, context, mountAll) {


    let c = dom && dom._component,  //判断要diff的dom是否包含在一个组件内，如果是就返回最上级组件对象
        originalComponent = c,
        oldDom = dom,
        isDirectOwner = c && dom._componentConstructor===vnode.nodeName, //判断虚拟dom和最上级组件的类型是否相同
        isOwner = isDirectOwner,

        props = getNodeProps(vnode); //getNodeProps是将虚拟dom的attributes属性以及children属性都存到props中


    // 按照网上博客的意思，dom的_component属性可能会被修改，不指向最上层的组件实例，所以这里就从dom指向的组件开始继续向上找
    // 以A，B，C，D，dom为例，正常情况下dom._component指向组件A，
    // 但是有可能dom._component被修改，使得指向了组件B，那么这个循环就是继续向上找
    while (c && !isOwner && (c=c._parentComponent)) {
        isOwner = c.constructor===vnode.nodeName;
    }
    
    if (c && isOwner && (!mountAll || c._component)) {

        setComponentProps(c, props, ASYNC_RENDER, context, mountAll);

        //把组件实例最终所渲染的dom传给真实dom
        dom = c.base;
    }
    //除此之外
    else {
        //如果当dom是由组件渲染但与虚拟dom的组件类型不相同时
        if (originalComponent && !isDirectOwner) {

            //不再保存组件的base，直接卸载dom所在的组件
            unmountComponent(originalComponent);

            dom = oldDom = null;
        }

        //由虚拟dom根据组件的构造函数生成组件实例对象c
        c = createComponent(vnode.nodeName, props, context);


        // 当dom不是由组件渲染，且组件实例还没有nextBase，那就把旧dom存到组件实例的nextBase中
        // 之后就不需要进行新旧dom的对比了，所以直接把旧的dom置为空
        // 如果组件实例有nextBase，那么旧dom就没有用处了，留到最后进行回收
        if (dom && !c.nextBase) {
            //对于一个组件实例，如果他是第一次渲染，那么它的nextBase中存储的就是和他进行diff的真实dom，
            //当组件被卸载过，它的nextBase中就会存储它上次渲染的真实dom。
            c.nextBase = dom;
            //此时旧的dom已经没有用了，置空
            oldDom = null;
        }

        //开始渲染组件
        setComponentProps(c, props, SYNC_RENDER, context, mountAll);


        //把组件生成的真实节点传递给dom
        dom = c.base;

        if (oldDom && dom!==oldDom) {
            //回收旧dom
            oldDom._component = null;
            recollectNodeTree(oldDom, false);
        }
    }
    return dom;
}


export function unmountComponent(component) {

	//卸载组件时先触发beforeUnmount

	if (options.beforeUnmount) options.beforeUnmount(component);

	//组件所渲染的真实dom
	let base = component.base;
	//为组件加锁，之后组件的状态不可被改变
	component._disable = true;

	//触发组件的componentWillUnmount
	if (component.componentWillUnmount) component.componentWillUnmount();

	//将组建的dom置空
	component.base = null;

	// recursively tear down & recollect high-order component children:
	//如果有子组件则递归的卸载子组件
	let inner = component._component;
	if (inner) {
		unmountComponent(inner);
	}
	//如果有真实dom
	else if (base) {
		
		if (base[ATTR_KEY] && base[ATTR_KEY].ref) base[ATTR_KEY].ref(null);

		//把真实dom存入nextBase中，可以在以后用
		component.nextBase = base;
		//从dom树上删除真实dom节点
		removeNode(base);
		//将组件实例放入组件池中
		collectComponent(component);


		//将dom的子节点删除
		removeChildren(base);

	}

	if (component.__ref) component.__ref(null);
}
