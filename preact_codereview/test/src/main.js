import {Component,h} from "../preact/preact";
/* @jsx h */
class App extends Component{
    constructor(){
        super();
        this.state={
            times:0
        };
    }

    handleClick=()=>{
        this.setState({
            times:this.state.times+1
        })
    };
    render(){
        return (
            <div>
                <h2>{this.state.times}</h2>
                <button onClick={this.handleClick}>click</button>
            </div>
        )
    }
}

export default App;