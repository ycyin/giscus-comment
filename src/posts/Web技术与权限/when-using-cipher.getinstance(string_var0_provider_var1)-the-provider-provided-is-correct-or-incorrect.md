---
title: 使用RSA加解密时注意Cipher.getInstance(String var0,Provider var1)提供的Provider是否正确
date: 2021-10-19 22:03:53
tag:
  - RSA
  - BouncyCastleProvider
category: Web技术&安全
---

## 前言

项目中，APP（IOS和Android）与后台（JAVA）对接时，某个接口的数据经过IOS端的RSA加密后，后台总是解密出来的不对。本文不讨论RSA算法细节，只记录使用中注意事项。

## 错误来源

我们的RSA使用规则是后台生成密钥对，对外提供公钥的指数(Exponent)和模数(Modulus)，然后接口调用者需要根据这两个参数去生成公钥，然后使用公钥对数据加密后传输给后台，后台再解密。

```java
// 生成密钥对
KeyPairGenerator keyPairGen = KeyPairGenerator.getInstance("RSA",new BouncyCastleProvider());
keyPairGen.initialize(1024);
KeyPair keyPair = keyPairGen.generateKeyPair();

// 省略...saveKeyPair,保存生成的公钥、私钥

RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();

// 将公钥中的指数(Exponent)和模数(Modulus)转为某种编码/加密格式提供给前端APP
String modulus = new String(xxxMethod(publicKey.getModulus().toByteArray()));
String exponent = new String(xxxMethod(publicKey.getPublicExponent().toByteArray()));
```

**Android**

Android还好解决，因为可以直接使用JAVA代码。

根据获取到的指数(Exponent)和模数(Modulus)生成PublicKey并加密：

```java
// 根据指数(Exponent)和模数(Modulus)生成PublicKey
RSAPublicKeySpec publicKeySpec = new RSAPublicKeySpec(new BigInteger(modulus),
        new BigInteger(exponent));
KeyFactory keyFactory = KeyFactory.getInstance("RSA",new BouncyCastleProvider());
PublicKey publicKey = keyFactory.generatePublic(publicKeySpec);

// 加密
Cipher ci = Cipher.getInstance(keyFactory.getAlgorithm(),new BouncyCastleProvider());
ci.init(Cipher.ENCRYPT_MODE, publicKey);
byte[] bytes = ci.doFinal(data);
String encryptResult = Base64.encodeBase64String(bytes);
```

这时候加密后的字符串传给后台就可以解密了。

```java
// 读取之前保存的KeyPair
KeyPair keyPair = xxxgetKeyPair()
String privateKeyBase64Str = Base64.encodeBase64String(keyPair.getPrivate().getEncoded());
String encryptPasswordBase64Str = "encryptResult:加密后的Base64后的字符串";
// 对私钥Base64解码
byte[] keyBytes = Base64.decodeBase64(privateKeyBase64Str);
// 对密码Base64解码
byte[] en_data = Base64.decodeBase64(encryptPasswordBase64Str);
try {
   // 取得私钥
   PKCS8EncodedKeySpec pkcs8KeySpec = new PKCS8EncodedKeySpec(keyBytes);
   KeyFactory keyFactory = KeyFactory.getInstance("RSA");
   Key privateKey = keyFactory.generatePrivate(pkcs8KeySpec);
   // 对数据解密
   Cipher cipher = Cipher.getInstance(keyFactory.getAlgorithm(), new BouncyCastleProvider());
   cipher.init(Cipher.DECRYPT_MODE, privateKey);
   byte[] bytes  =  cipher.doFinal(en_data);
   // 打印解密后的密码
   System.out.println("解密后："+new String(bytes));
} catch (Exception e) {
   e.printStackTrace();
}
```

**IOS**

ios就有问题，主要问题：ios不能使用java代码，同时ios的同事也没有找到可以通过指数(Exponent)和模数(Modulus)生成PublicKey的方法，需要我们直接提供公钥(publicKey)。

```java
// 读取之前保存的KeyPair
KeyPair keyPair = xxxgetKeyPair();
String publicKey = Base64.encodeBase64String(keyPair.getPublic().getEncoded());
```

后来直接新写一个接口直接将公钥提供给IOS端，IOS端直接拿publicKey进行加密内容，这时问题就来了，后台无法解密。

## 错误解决

通过多次尝试，使用相同的密钥对，发现IOS端的RSA自己加密解密没有问题，后端前同事写的RSA自己加密解密也没有问题（<span style="color:red">注意：此处无需尝试IOS端公钥加密为何与后端同一公钥加密同一字符串结果不同，因为使用RSA公钥加密同一字符串每一次结果本来就不一样</span>）。IOS端使用公钥加密后后端用私钥解密出来的不对。

通过许久排查，发现后端对数据解密时的`Cipher.getInstance`，指定了安全服务提供者`BouncyCastleProvider`，去掉这个就可以了。

```java
Cipher cipher = Cipher.getInstance(keyFactory.getAlgorithm());
```

估计就是IOS端使用的RSA工具类对数据加密时使用的这个安全服务提供者不对应导致的。其中，后端使用的安全服务提供者`BouncyCastleProvider`来自于bcprov-jdk15on包中。

```
<dependency>
   <groupId>org.bouncycastle</groupId>
   <artifactId>bcprov-jdk15on</artifactId>
</dependency>
```

## 参考

- IOS端RSA加密工具：[ideawu/Objective-C-RSA: Doing RSA encryption and decryption with Objective-C on iOS (github.com)](https://github.com/ideawu/Objective-C-RSA)
- 后端RSA加密工具参考：[java RSAUtils 加密工具类_After 95-CSDN博客](https://blog.csdn.net/after95/article/details/79954310)
- 后端RSA加解密工具类源码：<a :href="$withBase('/code/RSAUtils.zip')" download="RSAUtils.zip">点击下载</a>
- JDK RSAPublicKey 官方文档：[RSAPublicKey (Java Platform SE 7 ) (oracle.com)](https://docs.oracle.com/javase/7/docs/api/java/security/interfaces/RSAPublicKey.html)
- [BouncyCastle - 廖雪峰的官方网站 (liaoxuefeng.com)](https://www.liaoxuefeng.com/wiki/1252599548343744/1305362418368545)
- [为什么RSA公钥每次加密得到的结果都不一样？_洛奇看世界-CSDN博客](https://blog.csdn.net/guyongqiangx/article/details/74930951)

