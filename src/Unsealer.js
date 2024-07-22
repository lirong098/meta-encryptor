import keccak256 from "keccak256";
import ByteBuffer, {
  LITTLE_ENDIAN
} from "bytebuffer";

import {
  header_t,
  header_t2buffer,
  buffer2header_t,
  block_info_t2buffer,
  buffer2block_info_t,
  ntpackage2batch,
  toNtInput,
  fromNtInput,
  batch2ntpackage
} from "./header_util.js"
const {
  Transform
} = require('stream');
var log = require("loglevel").getLogger("meta-encryptor/Unsealer");
import YPCNt_Object from "./ypcntobject"

import{MaxItemSize, HeaderSize} from "./limits.js";

const YPCNtObject = YPCNt_Object()
import YPCCryptoFun from "./ypccrypto.js";
const YPCCrypto = YPCCryptoFun();

export class Unsealer extends Transform{
  constructor(options) {
    super(options);
    this.accumulatedBuffer = Buffer.alloc(0);
    this.keyPair = options.keyPair;
    this.progressHandler = options.progressHandler;
    this.isHeaderReady = false;
    this.dataHash = keccak256(Buffer.from("Fidelius", "utf-8"));
    this.readItemCount = 0;
  }

  _transform(chunk, encoding, callback) {
    //log.debug("enter transform")
    this.accumulatedBuffer = Buffer.concat([this.accumulatedBuffer, chunk]);
    log.debug("accu buffer " + this.accumulatedBuffer.length)
    if(!this.isHeaderReady){
      if(this.accumulatedBuffer.length >= HeaderSize){
        const header = this.accumulatedBuffer.slice(0, HeaderSize);
        this.header = buffer2header_t(ByteBuffer.wrap(header, LITTLE_ENDIAN));
        this.accumulatedBuffer = this.accumulatedBuffer.slice(HeaderSize);
        this.isHeaderReady = true;
      }
    }

    try{

      if(this.isHeaderReady){
        while(this.accumulatedBuffer.length > 8){
          let offset = 0;
          let buf = ByteBuffer.wrap(this.accumulatedBuffer.slice(0, 8), LITTLE_ENDIAN);
          let item_size = buf.readUint64(offset).toNumber()
          offset += 8;
          if(this.accumulatedBuffer.length >= item_size + offset){
            let cipher = this.accumulatedBuffer.slice(offset, offset + item_size);
            this.accumulatedBuffer = this.accumulatedBuffer.slice(offset + item_size);

            let msg = YPCCrypto.decryptMessage(Buffer.from(this.keyPair["private_key"], 'hex'), cipher);
            //TODO check if msg is null, i.e., decrypt failed
            let batch = ntpackage2batch(msg);
            log.debug("got batch with length " + batch.length)
            for(let i = 0; i < batch.length; i++){
              //log.debug("start from n")
              let b = fromNtInput(batch[i]);
              //log.debug("end from n")

              this.push(b);

             let k = Buffer.from(
                this.dataHash.toString("hex") + Buffer.from(batch[i]).toString("hex"),
                "hex"
              );
             this.dataHash = keccak256(k);
            }
            this.readItemCount += 1;
            if(this.progressHandler !== undefined &&
              this.progressHandler !== null){
              this.progressHandler(this.header.item_number, this.readItemCount);
            }
            if(this.readItemCount === this.header.item_number){
              log.trace("all done")
              this.push(null);
            }
          }else{
            break;
          }
        }
      }
      callback();
    }catch(err){
      log.error("err " + err)
      callback(err);
    }
  }

  _flush(callback) {
    callback();
  }
}
