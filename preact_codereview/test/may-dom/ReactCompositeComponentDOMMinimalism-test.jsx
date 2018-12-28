import PropTypes from '../../lib/ReactPropTypes';
import ReactTestUtils from "../../lib/ReactTestUtils";
import React from '../../src/May';
import { render, unmountComponentAtNode, findDOMNode } from '../../src/may-dom/MayDom'
var ReactDOM = {
    render: render,
    unmountComponentAtNode: unmountComponentAtNode,
    findDOMNode: findDOMNode
}
React.render = render;


describe("ReactCompositeComponentDOMMinimalism",function() {
    // this.timeout(200000);

    var LowerLevelComposite = class extends React.Component {
        render() {
            return <div>{this.props.children}</div>;
        }
    };

    var MyCompositeComponent = class extends React.Component {
        render() {
            return <LowerLevelComposite>{this.props.children}</LowerLevelComposite>;
        }
    };

    var expectSingleChildlessDiv = function(instance) {
        var el = ReactDOM.findDOMNode(instance);
        expect(el.tagName).toBe("DIV");
        expect(el.children.length).toBe(0);
    };

    it("should not render extra nodes for non-interpolated text", () => {
        var instance = <MyCompositeComponent>A string child</MyCompositeComponent>;
        instance = ReactTestUtils.renderIntoDocument(instance);
        expectSingleChildlessDiv(instance);
    });

    it("should not render extra nodes for non-interpolated text", () => {
        var instance = <MyCompositeComponent>{"Interpolated String Child"}</MyCompositeComponent>;
        instance = ReactTestUtils.renderIntoDocument(instance);
        expectSingleChildlessDiv(instance);
    });

    it("should not render extra nodes for non-interpolated text", () => {
        var instance = (
            <MyCompositeComponent>
                <ul>This text causes no children in ul, just innerHTML</ul>
            </MyCompositeComponent>
        );
        instance = ReactTestUtils.renderIntoDocument(instance);
        var el = ReactDOM.findDOMNode(instance);
        expect(el.tagName).toBe("DIV");
        expect(el.children.length).toBe(1);
        expect(el.children[0].tagName).toBe("UL");
        expect(el.children[0].children.length).toBe(0);
    });
});
