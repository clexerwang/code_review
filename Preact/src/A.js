import {Component,h} from "../preact/preact";


/*@jsx h */
class A extends Component{


    render(){
        return (
            <div>{this.props.name}</div>
        )
    }
}

export default A;