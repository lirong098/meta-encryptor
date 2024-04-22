const path = require("path");
// const { ProvidePlugin } = require("webpack");
// const EsmWebpackPlugin = require("@purtuga/esm-webpack-plugin");
// const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
module.exports = {
  mode: "production", // development
  entry: "./src/index.js",
  output: {
    path: path.join(__dirname, "/build"), // 决定出口文件在哪里
    filename: "index.js", // 设置出口文件的名字。默认情况下，它叫main.js
    library: {
      name: "metaEncryptor",
      type: "commonjs2",
    },
    // library: "metaEncryptor",
    // libraryTarget: "commonjs2",
  },
  // plugins: [new EsmWebpackPlugin()],
  target: "electron-main",
  externals: {
    Buffer: "require('buffer').Buffer",
  },
  // module: {
  //   rules: [
  //     {
  //       test: /.js$/,
  //       use: [
  //         {
  //           loader: "babel-loader",
  //           options: {
  //             presets: [["@babel/preset-env"]],
  //           },
  //         },
  //       ], // es6转es5
  //     },
  //   ],
  // },
};
