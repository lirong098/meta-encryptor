import Provider from "./Dataprovider";
const path = require('path');
import fs from "fs";

const {DataProvider, unsealData, checkSealedData, headerAndBlockBufferFromFile} = Provider;

export const FileProvider = function(_key, _srcPath, _dstPath){
  if(new.target === undefined){
    throw new Error("FileProvider must be called with the new keyword.")
  }
  this.keyPair = _key;
  this.srcPath = _srcPath;
  this.dstPath = _dstPath;
  this.srcStat = fs.statSync(this.srcPath);
  this.srcReachEnd = false;
  this.srcCount = 0;

  this.paused = false;
  this.stopped = false;
}

FileProvider.prototype.pause= function(){
  this.paused = true
}


FileProvider.prototype.unsealFile = async function(decoder, progressHandler){
  let hb = headerAndBlockBufferFromFile(this.srcPath);
  let inputStream = fs.createReadStream(this.srcPath);
  let dataStream = fs.createWriteStream(this.dstPath);
  let hash = await unsealData(this.keyPair, inputStream, hb, dataStream, decoder, progressHandler);

  await new Promise((resolve)=>{
    dataStream.end();
    dataStream.close();
    dataStream.on('finish', ()=>{
      resolve();
    });
  });
  return hash;
}
