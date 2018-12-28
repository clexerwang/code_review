import {Component,h} from "../preact/preact";
import B from './B.js';

/*@jsx h */
class A extends Component{


    render(){
        return (
            <B />
        )
    }
}

export default A;