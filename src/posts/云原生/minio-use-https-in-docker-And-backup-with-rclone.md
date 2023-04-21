---
title: '在minio中开启https访问以及使用rclone备份minio桶'
date: 2023-04-16 18:10:16
tags:
  - minio
  - rclone
categories: 云原生
description: 在docker运行的minio中开启https访问，以及如何使用rclone备份minio桶文件
---

## 背景和环境

根据上一篇文章搭建好了Choerodon，启动的Minio文件服务使用docker安装，文件存储在本地属于单点存储，具有数据丢失的风险。现在需要对minio存储的文件进行备份到另外一台机器，通过调研决定使用rclone进行备份。在实际操作中发现rclone需要让minio开启https访问。以下是使用的相关组件及其版本信息：

minio：RELEASE.2020-01-03T19-12-21Z

rclone：v1.51.0

## minio开启https

### 自签证书

```bash
#1 生成服务器端私钥
openssl genrsa -out server.key 2048
#2 生成服务器端公钥
openssl rsa -in server.key -pubout -out server.pem

# 生成CA证书
#3 生成 CA 私钥
openssl genrsa -out ca.key 2048
#4
openssl req -new -key ca.key -out ca.csr
#5 生成CA证书
openssl x509 -req -in ca.csr -signkey ca.key -out ca.crt -days 3650

# 生成服务器证书
#6 服务器端需要向 CA 机构申请签名证书，在申请签名证书之前依然是创建自己的 CSR 文件
openssl req -new -key server.key -out server.csr
#7 向自己的 CA 机构申请证书，签名过程需要 CA 的证书和私钥参与，最终颁发一个带有 CA 签名的证书
openssl x509 -req -CA ca.crt -CAkey ca.key -CAcreateserial -in server.csr -out server.crt -d
#8 生成cer文件 使用openssl 进行转换
openssl x509 -in server.crt -out server.cer -outform der -days 3650
```

> 注意:执行生成csr的命令会出现需要填写的项目，可以直接回车跳过，但是Common Name那一项建议填写你的域名，如果是本地的话，可以写localhost。

### minio挂载证书

首先，根据官网描述（[How to secure access to MinIO server with TLS](https://link.juejin.cn/?target=https%3A%2F%2Fdocs.min.io%2Fdocs%2Fhow-to-secure-access-to-minio-server-with-tls.html)），将TLS的公私钥放到：**{{HOME}}/.minio/certs** 里就行。

**注意：**

- 私钥需要命名为：private.key
- 公钥需要命名为：public.crt

我这里是使用docker部署的minio，所以直接挂载到对应目录即可。

```bash
mkdir -p /data/minio-config/config/certs
cp  server.key /data/minio-config/config/certs/private.key
cp  server.crt /data/minio-config/config/certs/public.crt
```

docker-compose片段：

```yaml
    volumes:
      - 'data:/export'
      - /etc/localtime:/etc/localtime:ro
      - /data/minio-config/config:/root/.minio
```

### nginx代理https

```nginx
server {
   listen 443 ssl;
   server_name minio.c7n.x;
   ssl_certificate /data/nginx/config/ssl/server.crt;
   ssl_certificate_key /data/nginx/config/ssl/server.key;
   ssl_session_timeout  5m;
   ssl_protocols  TLSv1 TLSv1.1 TLSv1.2;
   ssl_ciphers  ALL:!ADH:!EXPORT56:RC4+RSA:+HIGH:+MEDIUM:+LOW:+SSLv2:+EXP;
   ssl_prefer_server_ciphers   on;
   client_max_body_size     220M;
   proxy_request_buffering off;
   location / {
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header Host $http_host;
      proxy_connect_timeout 300;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      chunked_transfer_encoding off;
      proxy_pass https://minio:9000/;
    }
}
```

## 使用rclone备份

### 导入证书

为了不在使用rclone命令时[使用标签指定证书](https://rclone.org/commands/rclone_serve_http/#tls-ssl)，可以把证书导入到linux系统中，根据[官方文档：Rclone gives x509: failed to load system roots and no roots provided error](https://rclone.org/faq/#rclone-gives-x509-failed-to-load-system-roots-and-no-roots-provided-error)说明，rclone会从以下路径加载证书：

```
"/etc/ssl/certs/ca-certificates.crt", // Debian/Ubuntu/Gentoo etc.
"/etc/pki/tls/certs/ca-bundle.crt",   // Fedora/RHEL
"/etc/ssl/ca-bundle.pem",             // OpenSUSE
"/etc/pki/tls/cacert.pem",            // OpenELEC
```

由于我是RHEL系统，所以需要向`/etc/pki/tls/certs/ca-bundle.crt`添加：

```bash
cat server.crt >> /etc/pki/tls/certs/ca-bundle.crt
```

或者也可以直接往`/etc/pki/ca-trust/source/anchors/`目录放即可（我使用的方式）：

```bash
cp server.crt /etc/pki/ca-trust/source/anchors/
update-ca-trust
```

### 执行备份

生成配置：生成的文件位置在`/root/.config/rclone/rclone.conf`

```bash
rclone config
```

执行备份：

```bash
rclone copy minio:knowledgebase-service /root/ycyin/minio/knowledgebase-service -vv # -vv打印debug日志
```

后面可以写一个cron定时任务脚本定时执行这条命令进行备份。

### 恢复备份

```bash
rclone copy /root/ycyin/minio/knowledgebase-service minio:knowledgebase-service -vv
```

## 遇到的坑

rclone版本太高导致报400错误：后来发现是因为rclone版本太高与minio不匹配导致的。我的minio版本RELEASE.2020-01-03T19-12-21Z，使用rclone报错的版本是v1.62.2。后来我也没找到对应的版本关系列表，找了一个与minio版本RELEASE.2020-01-03T19-12-21Z发布日期相近的版本rclone：v1.51.0就可以了。

## 参考：

<https://www.jianshu.com/p/9454f4e2a12e>

<https://min.io/docs/minio/linux/reference/minio-mc.html>

<https://rclone.org/s3/#minio>