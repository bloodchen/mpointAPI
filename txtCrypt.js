const crypto = require("crypto");
const algorithm = "aes-256-ctr";
const IV_LENGTH = 16;

class txtCrypt {
  static encode(text, pass) {
    pass = Buffer.concat([Buffer.from(pass), Buffer.alloc(32,'1')], 32);
    //console.log("pass:",pass);
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv(algorithm, pass, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }
  static decode(text, pass) {
    pass = Buffer.concat([Buffer.from(pass), Buffer.alloc(32,'1')], 32);
    //console.log("pass:",pass);
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv(algorithm, pass, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } 
}
module.exports = txtCrypt;