import {Component, h, render} from './preact';
/** @jsx h */


class App extends Component{
    constructor(){
        super();
        this.state={
            time:new Date().toLocaleTimeString()
        };
    }

    start(){
      setInterval(()=>{
          this.setState({
              time:new Date().toLocaleTimeString()
          })
      },1000)
    }
    render(){
        return (
            <div className={'p'}>
                <div>{this.state.time}</div>
                <button onClick={this.start.bind(this)}>start</button>
            </div>
            )
      }
}




render(
    <App />
    , document.getElementById('root'),document.querySelector('.p'));








