enum StatusCode {
  Secusse = 200,
  Fail = 100,
}

class HandleStatusCode{
  public async HandleTcpNetStatusCode(_code: StatusCode){}
  public async HandleHttpNetStatusCode(_code: StatusCode) {}
}