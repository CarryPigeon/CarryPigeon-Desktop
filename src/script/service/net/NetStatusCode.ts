enum StatusCode {
  Secusse = 200,
  Fail = 100,
}

class HandleStatusCode{
  public async HandleTcpNetStatusCode(code: StatusCode){}
  public async HandleHttpNetStatusCode(code: StatusCode) {}
}