const {
  Readable
} = require('stream');
import ByteBuffer, {
  LITTLE_ENDIAN
} from "bytebuffer";
const fs = require('fs');
import{MaxItemSize, HeaderSize, BlockInfoSize,
  MagicNum, CurrentBlockFileVersion} from "./limits.js";
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

var log = require("loglevel").getLogger("meta-encryptor/SealedFileStream");

function supportsConstruct() {
  return typeof Readable.prototype._construct === 'function';
}

export class SealedFileStream extends Readable{
  constructor(filePath, options){
    super(options);
    this.filePath = filePath;
    this.isHeaderSent = false;
    this.contentSize= 0;
    this.start = options ? options.start || 0 : 0;
    this.end = options ? options.end : undefined;
    this.startReadPos = 0;
    this.initialized = false;
    log.debug("SealedFileStream: ", this)
    if (!supportsConstruct()) {
      this._construct((err) => {
        if (err) {
          this.emit("error", err);
          return;
        }
        this.initialized = true;
        this.emit('readable')
      })
    }
  }

  async _construct(callback) {
    try {
      log.debug("open file " + this.filePath)
      this.fileHandle = await fs.promises.open(this.filePath, 'r');
      const fileStats = await this.fileHandle.stat();
      this.header = Buffer.alloc(HeaderSize);
      log.debug("to read, " + fileStats.size);
      await new Promise((resolve)=>{
        this.fileHandle.read(this.header, 0, HeaderSize, fileStats.size - HeaderSize)
        .then(({bytesRead}) =>{
          if(bytesRead!= HeaderSize){
            throw new Error("Cannot read header. File too small");
          }

          const header = buffer2header_t(ByteBuffer.wrap(this.header, LITTLE_ENDIAN));

          if (header.version_number != CurrentBlockFileVersion) {
            throw new Error("only support version ", CurrentBlockFileVersion, ", yet got ", header.version_number);
          }
          if(!header.magic_number.equals(MagicNum)){
            throw new Error("Invalid magic number, maybe wrong file");
          }
          this.contentSize = fileStats.size - HeaderSize - BlockInfoSize * header.block_number;
          if(this.contentSize <= 0){
            throw new Error("Invalid file size.");
          }
          let endPosition = this.end !== undefined ? this.end : this.contentSize;
          this.end = Math.min(endPosition, this.contentSize);
          resolve();
        });
      }) ;
      callback();
    } catch (err) {
      log.error("got err " + err)
      callback(err);
    }
  }

  _read(size) {
    log.debug("_read initialized:", this.initialized);
    if (!this.initialized) {
      return;
    }
    if(!this.isHeaderSent){
      if(size < HeaderSize - this.startReadPos){
        this.push(this.header.slice(this.startReadPos, this.startReadPos + size));
        this.startReadPos += size;
        if(this.startReadPos == HeaderSize){
          this.startReadPos = this.start;
          this.isHeaderSent = true;
        }
      }else{
        this.push(this.header);
        this.startReadPos = this.start;
        this.isHeaderSent = true;
      }
    }else{
      const buffer = Buffer.alloc(size);
      log.debug("read file from ", this.startReadPos);
      this.fileHandle.read(buffer, 0, size, this.startReadPos)
        .then(({ bytesRead }) => {
          if (bytesRead > 0) {
            log.debug("read data " + bytesRead + ", " + this.contentSize + ", " + this.startReadPos);
            let reachEnd = false;
            if(this.end - this.startReadPos <= bytesRead){
              bytesRead = this.end - this.startReadPos;
              reachEnd = true;
              log.debug("reach end");
            }

            log.debug("push data " + bytesRead);
            this.startReadPos += bytesRead;
            this.push(buffer.slice(0, bytesRead));
            if(reachEnd){
              log.debug("reach end done");
              this.push(null);
            }
        } else {
          if(this.startReadPos != this.end){
            throw new Error("Does't reach end, yet cannot read more data");
          }
          this.push(null);
        }
      })
      .catch(err => {
        log.error("err: ", err)
        this.destroy(err);
      });
    }
  }

  _destroy(err, callback) {
    if (this.fileHandle) {
      this.fileHandle.close().then(() => callback(err)).catch(callback);
    } else {
      callback(err);
    }
  }
}
