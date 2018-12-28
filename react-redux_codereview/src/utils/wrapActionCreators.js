import { bindActionCreators } from 'redux'

export default function wrapActionCreators(actionCreators) {
  return dispatch => bindActionCreators(actionCreators, dispatch)
}



function actionCreator1(){
	return {
		type:'example1'
	}
}
function actionCreator2(){
	return{
		type:'example2'
	}
}
//当传入一个函数时：
bindActionCreators(actionCreator,dispatch);
//返回值为： 
(...args)=>{
	return dispatch(actionCreator(...args))
}

//当传入多个函数组成的对象时
bindActionCreators(
	{
		actionCreator1:actionCreator1,
		actionCreator2:actionCreator2
	},
	dispatch
)
//返回值为
{
	actionCreator1:(...args)=>dispatch(actionCreator1(...args)),
	actionCreator2:(...args)=>dispatch(actionCreator2(...args))
}
