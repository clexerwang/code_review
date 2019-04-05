import {Component,h} from "../preact/preact";
/*@jsx h */
class B extends Component{
    state = {
        name:1
    }
    click = ()=>{
        this.setState({
            name:2
        },function(){
            console.log(1)
        })
    }

    render(){
        return (
            <div onClick = {this.click}>
                {this.props.name}
            </div>
        )
    }
}

export default B;