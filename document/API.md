# CarryPigeon Desktop API 文档

## 概述

本文档描述了 CarryPigeon Desktop 应用程序提供的 API 接口。

## 文件上传 API

### FileUploadAPI 接口

文件上传请求的数据结构。

#### 属性

| 属性名 | 类型 | 描述 | 必需 |
|--------|------|------|------|
| size | number \| undefined | 文件大小（字节） | 否 |
| sha256 | string \| undefined | 文件的 SHA256 哈希值 | 否 |

### FileAPIService 类

处理文件上传相关操作的服务类。

#### 方法

##### requestUpload(size: number, sha256: string)

请求上传文件。

**参数**
- `size` (number): 文件大小（字节）
- `sha256` (string): 文件的 SHA256 哈希值

**返回值**
无

**示例**
```typescript
const fileService = new FileAPIService();
fileService.requestUpload(1024, "a1b2c3d4e5f6...");
```

**实现细节**
该方法创建一个 FileUploadAPI 对象，将其序列化为 JSON 字符串，然后通过 TCP 服务发送到服务器。

## 网络通信

### TcpService 类

处理与服务器之间的 TCP 连接和通信。

#### 构造函数

##### constructor(socket: string)

创建一个新的 TCP 连接。

**参数**
- `socket` (string): 服务器地址，格式为 "host:port"

**异常**
- 如果 socket 参数为空或无效，将抛出错误

#### 方法

##### createConnection(socket: string)

创建一个新的 TCP 连接。

**参数**
- `socket` (string): 服务器地址，格式为 "host:port"

**返回值**
- net.Socket: 创建的 TCP 套接字

##### send(data: string)

通过 TCP 连接发送数据。

**参数**
- `data` (string): 要发送的数据

**返回值**
无

### TCP_SERVICE

全局 TCP 服务实例，用于与服务器通信。

**类型**
- TcpService

**使用方法**
```typescript
import { TCP_SERVICE } from "../../script/service/net/TcpService";

// 发送数据
TCP_SERVICE.send(JSON.stringify(data));
```

### praseJsonBody 模块

处理 JSON 数据的解析和任务分发。

#### 函数

##### praseJsonToStruct(str: string)

将 JSON 字符串解析为结构化对象。

**参数**
- `str` (string): 要解析的 JSON 字符串

**返回值**
- JsonBodyType | null: 解析后的对象，如果解析失败则返回 null

##### pushTask(data: string)

解析 JSON 数据并处理相应的任务。

**参数**
- `data` (string): 要处理的 JSON 数据

**返回值**
无

## 加密服务

### EncryptInterface 接口

定义加密服务的基本接口。

#### 方法

##### encrypt(data: string): string

加密数据。

##### decrypt(data: string): string

解密数据。

### EncryptClass 抽象类

实现 EncryptInterface 的抽象基类。

#### 方法

##### encrypt(data: string): string

抽象方法，用于加密数据。

##### decrypt(data: string): string

抽象方法，用于解密数据。

### Encryption 类

提供加密功能的包装类。

#### 构造函数

##### constructor(socket: string, encryptClass?: EncryptClassWithConstructor<EncryptClass>)

创建一个新的加密服务实例。

**参数**
- `socket` (string): TCP 连接地址
- `encryptClass` (可选): 自定义加密类构造函数，默认使用 OfficialEncryptClass

#### 方法

##### encrypt(data: string): string

加密数据。

##### decrypt(data: string): string

解密数据。

### OfficialEncryptClass 类

官方实现的加密类，使用 ECC 和 AES 混合加密。

#### 构造函数

##### constructor(socket: string)

创建一个新的官方加密实例。

**参数**
- `socket` (string): TCP 连接地址

#### 方法

##### swapKey(userId: number): Promise<void>

与服务器交换密钥。

**参数**
- `userId` (number): 用户 ID

##### encrypt(data: string): string

使用 AES 加密数据。

##### decrypt(data: string): string

使用 AES 解密数据。

### ECC 模块

提供椭圆曲线加密相关功能。

#### 函数

##### generateECCKeyPair(): Promise<{privateKey: CryptoKey, publicKey: string}>

生成 ECC 密钥对。

**返回值**
- Promise: 包含私钥和公钥的对象

##### praseAESKeyPair(base64Key: string): Promise<CryptoKey>

解析 AES 密钥。

**参数**
- `base64Key` (string): Base64 编码的密钥

**返回值**
- Promise: 解析后的 CryptoKey

## 数据结构

### JSONDict 类型

表示 JSON 字典的类型定义。

```typescript
export interface JSONDictInterface{
    [key: string]: string | number | boolean | null ;
}
```

### CommonRequestBody 接口

通用请求体结构。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| id | number | 请求 ID |
| route | string | 请求路由 |
| data | JSONDict | 请求数据 |

### CommonResponseBody 接口

通用响应体结构。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| id | number | 响应 ID |
| code | number | 响应代码 |
| data | JSONDict | 响应数据 |

### SwapKey 接口

密钥交换数据结构。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| id | number | 用户 ID |
| key | string | 密钥 |

### CommonNotificationMessage 类

通用通知消息类。

#### 构造函数

##### constructor(id: number, route: string, data: JSONDict)

创建一个新的通知消息。

**参数**
- `id` (number): 消息 ID
- `route` (string): 消息路由
- `data` (JSONDict): 消息数据

### 消息相关接口

#### SendTextMessage 接口

发送文本消息的数据结构。

| 属性名 | 类型 | 描述 |
|--------|------|------|
| to_id | number | 接收者 ID |
| text | string | 消息文本 |

#### SendMessage 接口

通用发送消息的数据结构。

| 属性名 | 类型 | 描述 |
|--------|------|------|
| to_id | number | 接收者 ID |
| domain | string | 消息域 |
| type | number | 消息类型 |
| data | JSONDict | 消息数据 |

#### MessageStruct 接口

消息结构定义。

| 属性名 | 类型 | 描述 |
|--------|------|------|
| id | number | 消息 ID |
| send_user_id | number | 发送者 ID |
| to_id | number | 接收者 ID |
| domain | number | 消息域 |
| type | number | 消息类型 |
| data | JSONDict | 消息数据 |
| send_time | number | 发送时间 |

## 注意事项

1. 所有 API 调用都是异步的，但当前实现没有返回 Promise，这意味着调用者无法直接获取操作结果。
2. 文件上传 API 目前只支持发送请求，不包含处理响应的逻辑。
3. TCP 服务的配置通过 Config["socket"] 设置，如果配置无效，将使用默认的 "localhost:8080"。
4. 加密服务需要先调用 swapKey 方法交换密钥，然后才能进行加密和解密操作。
5. 消息相关接口提供了多种消息类型的定义，但具体的实现可能需要根据业务需求进行扩展。

## 更新日志

### v1.0.0
- 初始版本
- 添加文件上传 API
- 添加 TCP 服务支持
- 添加加密服务
- 添加消息相关接口
- 添加数据结构定义