---
title: 两个docker工具:runlike和whaler
date: 2022-11-10 10:39:39
tag:
  - Docker
category: 云原生
description: 两个非常好用的工具，一个是runlike，一个是whaler,runlike：通过容器打印出容器的启动命令,whaler：通过镜像导出dockerfile
---

- [`runlike`](https://github.com/lavie/runlike)：通过容器打印出容器的启动命令
- [`whaler`](https://github.com/P3GLEG/Whaler)：通过镜像导出`dockerfile`

### 找回Docker容器运行的命令

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock assaflavie/runlike -p [container_id|container_name]
```

例如：我们查看名字为`mysql`这个容器当时的`docker run`所有命令参数

```bash
root@Ubuntu:~# docker run --rm -v /var/run/docker.sock:/var/run/docker.sock assaflavie/runlike -p mysql
docker run \
        --name=mysql \
        --hostname=e37b183a716d \
        --mac-address=02:42:ac:11:00:03 \
        --env=MYSQL_ROOT_PASSWORD=root \
        --env=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
        --env=GOSU_VERSION=1.14 \
        --env=MYSQL_MAJOR=5.7 \
        --env=MYSQL_VERSION=5.7.39-1.el7 \
        --env=MYSQL_SHELL_VERSION=8.0.30-1.el7 \
        --volume=/mnt/d/devEnv/dockervolume/mysql/data:/var/lib/mysql \
        --volume=/mnt/d/devEnv/dockervolume/mysql/conf:/etc/mysql/conf.d \
        --volume=/mnt/d/devEnv/dockervolume/mysql/log:/var/log/mysql \
        --volume=/var/lib/mysql \
        --privileged \
        -p 3306:3306 \
        --expose=33060 \
        --restart=no \
        --runtime=runc \
        --detach=true \
        mysql:5.7.39 \
        --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

### 从镜像导出Dockerfile

```bash
docker run -t --rm -v /var/run/docker.sock:/var/run/docker.sock:ro pegleg/whaler -sV=1.36 [imageName]
```

例如：我们查看`nginx:1.22.0`这个镜像的Dockerfile

```bash
root@Ubuntu:~# docker run -t --rm -v /var/run/docker.sock:/var/run/docker.sock:ro pegleg/whaler -sV=1.36 nginx:1.22.0
Analyzing nginx:1.22.0
Docker Version: 20.10.12
GraphDriver: overlay2
Environment Variables
|PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
|NGINX_VERSION=1.22.0
|NJS_VERSION=0.7.6
|PKG_RELEASE=1~bullseye

Open Ports
|80

Image user
|User is root

Potential secrets:
Dockerfile:
CMD ["bash"]
LABEL maintainer=NGINX Docker Maintainers <docker-maint@nginx.com>
ENV NGINX_VERSION=1.22.0
ENV NJS_VERSION=0.7.6
ENV PKG_RELEASE=1~bullseye
RUN set -x  \
        && addgroup --system --gid 101 nginx  \
        && adduser --system --disabled-login --ingroup nginx --no-create-home --home /nonexistent --gecos "nginx user" --shell /bin/false --uid 101 nginx  \
        && apt-get update  \
        && apt-get install --no-install-recommends --no-install-suggests -y gnupg1 ca-certificates  \
        && NGINX_GPGKEY=573BFD6B3D8FBC641079A6ABABF5BD827BD9BF62; found=''; for server in hkp://keyserver.ubuntu.com:80 pgp.mit.edu ; do echo "Fetching GPG key $NGINX_GPGKEY from $server"; apt-key adv --keyserver "$server" --keyserver-options timeout=10 --recv-keys "$NGINX_GPGKEY"  \
        && found=yes  \
        && break; done; test -z "$found"  \
        && echo >&2 "error: failed to fetch GPG key $NGINX_GPGKEY"  \
        && exit 1; apt-get remove --purge --auto-remove -y gnupg1  \
        && rm -rf /var/lib/apt/lists/*  \
        && dpkgArch="$(dpkg --print-architecture)"  \
        && nginxPackages=" nginx=${NGINX_VERSION}-${PKG_RELEASE} nginx-module-xslt=${NGINX_VERSION}-${PKG_RELEASE} nginx-module-geoip=${NGINX_VERSION}-${PKG_RELEASE} nginx-module-image-filter=${NGINX_VERSION}-${PKG_RELEASE} nginx-module-njs=${NGINX_VERSION}+${NJS_VERSION}-${PKG_RELEASE} "  \
        && case "$dpkgArch" in amd64|arm64) echo "deb https://nginx.org/packages/debian/ bullseye nginx" >> /etc/apt/sources.list.d/nginx.list  \
        && apt-get update ;; *) echo "deb-src https://nginx.org/packages/debian/ bullseye nginx" >> /etc/apt/sources.list.d/nginx.list  \
        && tempDir="$(mktemp -d)"  \
        && chmod 777 "$tempDir"  \
        && savedAptMark="$(apt-mark showmanual)"  \
        && apt-get update  \
        && apt-get build-dep -y $nginxPackages  \
        && ( cd "$tempDir"  \
        && DEB_BUILD_OPTIONS="nocheck parallel=$(nproc)" apt-get source --compile $nginxPackages )  \
        && apt-mark showmanual | xargs apt-mark auto > /dev/null  \
        && { [ -z "$savedAptMark" ] || apt-mark manual $savedAptMark; }  \
        && ls -lAFh "$tempDir"  \
        && ( cd "$tempDir"  \
        && dpkg-scanpackages . > Packages )  \
        && grep '^Package: ' "$tempDir/Packages"  \
        && echo "deb [ trusted=yes ] file://$tempDir ./" > /etc/apt/sources.list.d/temp.list  \
        && apt-get -o Acquire::GzipIndexes=false update ;; esac  \
        && apt-get install --no-install-recommends --no-install-suggests -y $nginxPackages gettext-base curl  \
        && apt-get remove --purge --auto-remove -y  \
        && rm -rf /var/lib/apt/lists/* /etc/apt/sources.list.d/nginx.list  \
        && if [ -n "$tempDir" ]; then apt-get purge -y --auto-remove  \
        && rm -rf "$tempDir" /etc/apt/sources.list.d/temp.list; fi  \
        && ln -sf /dev/stdout /var/log/nginx/access.log  \
        && ln -sf /dev/stderr /var/log/nginx/error.log  \
        && mkdir /docker-entrypoint.d
COPY file:65504f71f5855ca017fb64d502ce873a31b2e0decd75297a8fb0a287f97acf92 in /
        docker-entrypoint.sh

COPY file:0b866ff3fc1ef5b03c4e6c8c513ae014f691fb05d530257dfffd07035c1b75da in /docker-entrypoint.d
        docker-entrypoint.d/
        docker-entrypoint.d/10-listen-on-ipv6-by-default.sh

COPY file:0fd5fca330dcd6a7de297435e32af634f29f7132ed0550d342cad9fd20158258 in /docker-entrypoint.d
        docker-entrypoint.d/
        docker-entrypoint.d/20-envsubst-on-templates.sh

COPY file:09a214a3e07c919af2fb2d7c749ccbc446b8c10eb217366e5a65640ee9edcc25 in /docker-entrypoint.d
        docker-entrypoint.d/
        docker-entrypoint.d/30-tune-worker-processes.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
EXPOSE 80
STOPSIGNAL SIGQUIT
CMD ["nginx" "-g" "daemon off;"]
```



### *参考：*

<https://github.com/lavie/runlike>

<https://github.com/P3GLEG/Whaler>

<https://glory.blog.csdn.net/article/details/118994320>
