import {Component,h} from "../preact/preact";
import A from './A.js';
/* @jsx h */
class App extends Component{
    state={
        name:2222222
    }
    click=()=>{
        this.setState({
            name:1111111
        })
    }

    render(){
        return (
            <div>
                <button onClick={this.click}>adadasd</button>
                <A name={this.state.name}/>
            </div>
        )
    }
}

export default App;