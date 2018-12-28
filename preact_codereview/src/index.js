import {Component,h,render} from "../preact/preact";
import App from './App';
import Play from './A';
/*@jsx h */
class Index extends Component{
    constructor(){
        super();
        this.state={
            play:true
        }
    }
    handleClick=()=>{
        this.setState({
            play:!this.state.play
        })
    };

    render(){
        return (
            <div>
                <App/>
                <button onClick = {this.handleClick}>click</button>
            </div>
        )
    }
}

render(<Index/>,document.querySelector('#root'),document.querySelector('#old'));