---
title: '在Nginx的容器镜像中隐藏Nginx的Server响应头'
date: 2023-1-10 17:45:34
tag:
  - Docker
  - Nginx
category: 云原生
description: 以Nginx基底的镜像，如何在浏览器的访问响应头中删除Server信息？主要是需要添加headers-more-nginx-module这个模块来实现
---

前端应用部署在K8s中，Nginx以容器的方式运行。由于一些安全因素，我们需要将Nginx返回的响应头中Server隐藏掉不让访问者知道我们的服务器信息（包括服务器类型和版本号）。

<!-- more -->

## 方案

对于隐藏版本号，我们可以在配置文件中，http区段中插入`server_tokens off;`后重新载入配置文件即可实现。

对于隐藏服务类型，目前了解到有两种方案：方案一是修改源码，重新编译Nginx；方案二是加载`headers-more-nginx-module`这个模块。因为我们是在容器中运行的Nginx，所以我们考虑方案二更为简单。

## 实现

通过二次`docker build`镜像，将`headers-more-nginx-module`这个模块的so文件，放到`/etc/nginx/modules/`目录下，然后在nginx.conf中第一行添加`load_module /etc/nginx/modules/ngx_http_headers_more_filter_module.so;` 动态加载这个模块。（注意：动态加载模块在[nginx1.9.11](http://nginx.org/en/docs/ngx_core_module.html#load_module)之后支持）


首先，我们可以在prebuilt-nginx-modules[^1]这个库中找到大佬编译的关于加载nginx模块的prebuilt镜像；

然后在这个prebuilt镜像基础上打出我们自己需要对应版本的so模块文件[^2]，并使用一个特殊的空镜像scratch，将我们的构建产物保留，以供后面生产环境的镜像快速复用拿到我们的so模块文件：

<span style="color:red">注意：NGINX_VERSION和MODULE_VERSION的版本对应</span>，写这篇文章时headers-more-nginx-module[^3]只发布了0.34版本最高支持nginx1.22.0

我也将这个镜像放到了dockerhub中：[yinyicao/headers-more-nginx-module:1.22.0-0.34](https://hub.docker.com/r/yinyicao/headers-more-nginx-module)

```dockerfile
ARG NGINX_VERSION=1.22.0
FROM soulteary/prebuilt-nginx-modules:base-${NGINX_VERSION} AS Builder

ARG MODULE_VERSION=0.34
ARG MODULE_NAME=headers-more-nginx-module

COPY ${MODULE_NAME}-${MODULE_VERSION}.tar.gz /usr/src/v${MODULE_VERSION}.tar.gz
RUN cd /usr/src && \
    tar -zxC /usr/src -f v${MODULE_VERSION}.tar.gz && \
    cd /usr/src && \
    mv ${MODULE_NAME}-${MODULE_VERSION}/ ${MODULE_NAME} && \
    cd /usr/src/nginx && \
    CONFARGS=$(nginx -V 2>&1 | sed -n -e 's/^.*arguments: //p') \
    CONFARGS=${CONFARGS/-Os -fomit-frame-pointer -g/-Os} && \
    echo $CONFARGS && \
    ./configure --with-compat --prefix=/etc/nginx --sbin-path=/usr/sbin/nginx --modules-path=/usr/lib/nginx/modules --conf-path=/etc/nginx/nginx.conf --error-log-path=/var/log/nginx/error.log --http-log-path=/var/log/nginx/access.log --pid-path=/var/run/nginx.pid --lock-path=/var/run/nginx.lock --http-client-body-temp-path=/var/cache/nginx/client_temp --http-proxy-temp-path=/var/cache/nginx/proxy_temp --http-fastcgi-temp-path=/var/cache/nginx/fastcgi_temp --http-uwsgi-temp-path=/var/cache/nginx/uwsgi_temp --http-scgi-temp-path=/var/cache/nginx/scgi_temp --user=nginx --group=nginx --with-compat --with-file-aio --with-threads --with-http_addition_module --with-http_auth_request_module --with-http_dav_module --with-http_flv_module --with-http_gunzip_module --with-http_gzip_static_module --with-http_mp4_module --with-http_random_index_module --with-http_realip_module --with-http_secure_link_module --with-http_slice_module --with-http_ssl_module --with-http_stub_status_module --with-http_sub_module --with-http_v2_module --with-mail --with-mail_ssl_module --with-stream --with-stream_realip_module --with-stream_ssl_module --with-stream_ssl_preread_module --with-cc-opt='-g -ffile-prefix-map=/data/builder/debuild/nginx-1.22.0/debian/debuild-base/nginx-1.22.0=. -fstack-protector-strong -Wformat -Werror=format-security -Wp,-D_FORTIFY_SOURCE=2 -fPIC' --with-ld-opt='-Wl,-z,relro -Wl,-z,now -Wl,--as-needed -pie' --add-dynamic-module=../${MODULE_NAME}/ && \
    make modules
FROM scratch
COPY --from=Builder /usr/src/nginx/objs/ngx_http_headers_more_filter_module.so /
```

最后，只需要根据我们要用的nginx基底镜像，将生成的`ngx_http_headers_more_filter_module.so`这个文件复制到nginx的模块目录并在nginx.conf中加载即可。

```dockerfile
FROM nginxinc/nginx-unprivileged:1.22.0

USER 0

# Modify timezone
ENV TZ=Asia/Shanghai

RUN apt-get update; \
    apt-get install -y --no-install-recommends \
        vim \
        curl \
        ca-certificates; \
    apt-get upgrade -y --no-install-recommends; \
    rm -rf /var/lib/apt/lists/*;

# Nginx conf
ADD default.conf /etc/nginx/conf.d/default.conf
ADD nginx.conf /etc/nginx/nginx.conf

# aliyun mirror
RUN cp /etc/apt/sources.list /etc/apt/sources.list.bak; \
    sed -i 's http://.*.debian.org http://mirrors.aliyun.com g' /etc/apt/sources.list

RUN echo 'root:changeit' | chpasswd

# 从上一个镜像中复制ngx_http_headers_more_filter_module.so，headers-more-nginx-module:1.22.0-0.34就是上一个Dockerfile打出来的镜像名
COPY --from=headers-more-nginx-module:1.22.0-0.34 /ngx_http_headers_more_filter_module.so /etc/nginx/modules/
```

不要忘了提前在nginx.conf中使用load_module加载这个模块：

```nginx
load_module /etc/nginx/modules/ngx_http_headers_more_filter_module.so;

worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /tmp/nginx.pid;


events {
    worker_connections  1024;
}


http {
    proxy_temp_path /tmp/proxy_temp;
    client_body_temp_path /tmp/client_temp;
    fastcgi_temp_path /tmp/fastcgi_temp;
    uwsgi_temp_path /tmp/uwsgi_temp;
    scgi_temp_path /tmp/scgi_temp;

    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    #tcp_nopush     on;

    keepalive_timeout  65;

    #gzip  on;
    more_clear_headers 'Server';

    include /etc/nginx/conf.d/*.conf;
}
```

这样打出来的nginx镜像在访问时的响应头中就不会有Server信息了。

## 参考：

[^1]:<https://hub.docker.com/r/soulteary/prebuilt-nginx-modules>
[^2]:<https://soulteary.com/2021/03/22/how-to-use-nginx-third-party-modules-efficiently-in-the-container-era.html>
[^3]:<https://github.com/openresty/headers-more-nginx-module>
[^4]:<https://github.com/nginxinc/docker-nginx-unprivileged>