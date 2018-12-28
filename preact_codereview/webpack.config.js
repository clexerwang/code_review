const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const config = {
    mode:"development",
    devServer:{
        contentBase:path.resolve(__dirname,'dist')
    },
    entry:{
        "bundle":path.resolve(__dirname,"src/index.js")
    },
    output:{
        path:path.resolve(__dirname,"dist"),
        filename:"[name].js"
    },
    module:{
        rules:[
            {
                test:/(\.js|\.jsx)$/,
                use:{
                    loader:"babel-loader"
                },
                exclude:/node_modules/
            }
        ]
    },
    plugins:[new HtmlWebpackPlugin({
        template:path.resolve(__dirname,"index.temp.html")
    })]
};
module.exports=config;