interface EncryptClass {
  encrypt: (data: string) => string
  decrypt: (data: string) => string
}

class OfficialEncryptClass implements EncryptClass {
  public encrypt(data: string): string {
    return data;
  }
  public decrypt(data: string): string {
    return data;
  }
}

class Encryption {
  private encryptClass: EncryptClass;
  constructor(encryptClass: EncryptClass) {
    this.encryptClass = encryptClass;
  }

  /**
   * 第三方加密
   * @param data 待加密数据
   * @returns 加密后数据
   */
  public thirdPartyEncrypt(data: string): string {
    return this.encryptClass.encrypt(data);
  }
  /**
   * 第三方解密
   * @param data 待解密数据
   * @returns 解密后数据
   */
  public thirdPartyDecrypt(data: string): string {
    return this.encryptClass.decrypt(data);
  }
}