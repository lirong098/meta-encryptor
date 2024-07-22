const {
  Readable
} = require('stream');
import ByteBuffer, {
  LITTLE_ENDIAN
} from "bytebuffer";
const fs = require('fs');
import{MaxItemSize, HeaderSize, MagicNum} from "./limits.js";
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

export class SealedFileStream extends Readable{
  constructor(filePath, options){
    super(options);
    this.filePath = filePath;
    this.isHeaderSent = false;
    this.startReadPos = 0;
    this.contentSize= 0;
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

          if (header.version_number != 2) {
            throw new Error("only support version 2, yet got ", header.version_number);
          }
          if(!header.magic_number.equals(MagicNum)){
            throw new Error("Invalid magic number, maybe wrong file");
          }
          this.contentSize = fileStats.size - HeaderSize - 32 * header.block_number;
          if(this.contentSize <= 0){
            throw new Error("Invalid file size.");
          }
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
    if(!this.isHeaderSent){
      if(size < HeaderSize - this.startReadPos){
        this.push(this.header.slice(this.startReadPos, this.startReadPos + size));
        this.startReadPos += size;
        if(this.startReadPos == HeaderSize){
          this.startReadPos = 0;
          this.isHeaderSent = true;
        }
      }else{
        this.push(this.header);
        this.startReadPos = 0;
        this.isHeaderSent = true;
      }
    }else{
      const buffer = Buffer.alloc(size);
      this.fileHandle.read(buffer, 0, size, this.startReadPos)
        .then(({ bytesRead }) => {
          if (bytesRead > 0) {
            log.debug("read data " + bytesRead + ", " + this.contentSize + ", " + this.startReadPos);
            let reachEnd = false;
            if(this.contentSize - this.startReadPos <= bytesRead){
              bytesRead = this.contentSize - this.startReadPos;
              reachEnd = true;
            }

            log.debug("push data " + bytesRead);
            this.startReadPos += bytesRead;
            this.push(buffer.slice(0, bytesRead));
            if(reachEnd){
              this.push(null);
            }
        } else {
          if(this.startReadPos != this.contentSize){
            throw new Error("Does't reach end, yet cannot read more data");
          }
          this.push(null);
        }
      })
      .catch(err => {
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