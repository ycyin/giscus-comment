---
title: 'docker-compose网络和内网服务IP冲突问题'
date: 2023-07-05 17:52:43
tag:
  - Docker
category: 云原生
description: 在一次使用docker-compose部署应用时，发现应用调用内网另一个IP以`172.20`开头的应用全都调用失败，看起来是网络无法联通。立马在执行docker-compose部署的机器上进行验证发现机器是可以联通的，可以断定是Docker网络的问题。在一次使用docker-compose部署应用时，发现应用调用内网另一个IP以`172.20`开头的应用全都调用失败，看起来是网络无法联通。立马在执行docker-compose部署的机器上进行验证发现机器是可以联通的，可以断定是Docker网络的问题。
---

## 现象

在一次使用docker-compose部署应用时，发现应用调用内网另一个IP以`172.20`开头的应用全都调用失败，看起来是网络无法联通。立马在执行docker-compose部署的机器上进行验证发现机器是可以联通的，可以断定是Docker网络的问题。本文包含解决办法和一些Docker桥接网络的总结，如有错误欢迎留言指正。

<!--more-->

## 临时解决

果然，通过`ip route`或`netstat -rn`命令查看有类似如下的一条路由信息：

```bash
[root@o0000344040-app ~]# ip route
172.20.0.0/16 dev br-931c5bdf794e proto kernel scope link src 172.20.0.1 
```

查看网卡信息：

```bash
[root@o0000344040-app ~]# ifconfig
br-931c5bdf794e: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.20.0.1  netmask 255.255.0.0  broadcast 172.20.255.255
        inet6 fe80::42:c0ff:fe66:fa8d  prefixlen 64  scopeid 0x20<link>
        ether 02:42:c0:66:fa:8d  txqueuelen 0  (Ethernet)
        RX packets 241563  bytes 17030523 (16.2 MiB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 241563  bytes 17030523 (16.2 MiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

查了一下原来使用docker-compose 启动时会默认创建一个`br-`开头的网卡和一条对应的路由，可以发现，这个网卡的IP网段正是`172.20`，所以就导致我们所有请求到内网应用的请求都转发到了这个网卡、导致无法访问。

使用下面的命令删除了这个路由信息后恢复正常。

```bash
ip route del 172.20.0.0/16 dev br-931c5bdf794e
```

## 不止于此

虽然临时解决了这个问题，但是下次重启服务或者部署其它应用时还是有可能出现类似问题，所以我觉得有必要彻底搞清楚这个问题。

### Docker网络

Docker网络一般会在三个地方生成网络子网。

- 默认网桥(docker0网络)

- 用户生成的桥接网络(比如docker compose中自定义会生成一个br-开头的网络就属于这种)

- 集群模式生成的覆盖网络（overlay网络：docker_gwbridge）

在一个运行有docker容器的机器上执行ifconfig命令查看网卡信息，可以发现如下信息：省略详细信息

```bash
[root@o0000344040-app ~]# ifconfig
docker0: # 省略

docker_gwbridge: # 省略

br-a1358a2e4fba:  # 省略 

veth0b8d95a:# 省略

eth0: # 省略

lo: # 省略
```

其中eth0和lo是本机和本机回环网络就不说了一个是本机网络ip，一个是127.0.0.1；

docker0 是默认的桥接网络，是运行了 docker 这个软件就会有 docker0；

docker_gwbridge这是集群模式下创建overlay模式网络后在每台机器上创建的桥接网络，[之前有文章用到过这个网络](https://ladybug.top/posts/%E4%BA%91%E5%8E%9F%E7%94%9F/Solution-for-installing-Choerodon-in-a-Docker-environment.html#%E4%B8%89%E3%80%81%E5%9F%BA%E4%BA%8Eoverlay%E7%9A%84docker%E5%AE%B9%E5%99%A8%E9%97%B4%E8%B7%A8%E5%AE%BF%E4%B8%BB%E6%9C%BA%E9%80%9A%E4%BF%A1%E3%80%90%E9%87%87%E7%94%A8%E3%80%91)

br 开头的则是 docker-compose中的自定义网络（br 就是 bridge 的缩写，如果docker compose中的networks不是自定义的比如下面这种方式定义的也不会创建br网络），每跑一个 docker-compose.yaml 都会有且只创建一个 br 虚拟网卡。

```yaml
networks:
  c7n_overlay:
    external: true
```

veth 开头是docker0 的儿子，它是正在运行的容器的网络，每当我们创建一个新容器的时候，如果不指定 network 等等参数，用默认的网络配置。那么这个新容器就是挂载到 docker0 下面去的，同时会在宿主机创建一个 veth 开头的虚拟网卡；其实这涉及 到Veth Pair的内容了，这里不再赘述（我的个人笔记里有）。

而Docker的默认桥接网络也就是docker0（当未指定自定义网络时使用）具有IP范围`172.17.0.0/16`。

Docker Compose的默认自定义桥接网络(`br-`开头)看起来是是根据`172.17`往上递增的：

- `172.18.0.0/16`
- `172.19.0.0/16`
- `172.20.0.0/16`
- `172.21.0.0/16`
- ......

具体是不是这个规律就不深究了、总之它是不固定的。

那么如何控制Docker Compose使用的子网范围呢？

## 永久解决

知道了原理，我们就可以想办法来解决了。

前面所提到的docker0 是默认的桥接网络，以及用户生成的桥接网络和overlay网络这三种Docker生成的网络子网都可以在Docker 的 `daemon.json` 配置文件中修改。主要是`bip` 和 `default-address-pools` 两个配置。注意：更改后，需要重启 Docker 守护进程使其生效。

```yaml
{
  "bip": "10.200.0.1/24",
  "default-address-pools":[
    {"base":"10.201.0.0/16","size":24},
    {"base":"10.202.0.0/16","size":24}
  ]
}
```

1. `bip`（Bridge IP）：用于配置 Docker 容器网络的网桥 IP 地址。

1. `default-address-pools`：用于配置用户生成的桥接网络和overlay网络的 IP 地址池。同时docker-compose创建的br-网络算是一种用户生成的网络桥接网络


如果是docker-compose，直接在docker-compose文件中自定义也可以实现修改br-网络的IP地址：

```yaml
version: '3'
services:
  app:
    image: your-image
    networks:
      - custom-network

networks:
  custom-network:
    ipam:
      config:
        - subnet: 10.201.0.0/16
```

## 总结

- `bip` 用于配置 Docker 网桥的 IP 地址范围。
- `default-address-pools` 用于配置用户生成的桥接网络和overlay网络的 IP 地址池。

## 参考：

1: [后端 - docker0 和 br-xxxxxx 有什么区别？ - SegmentFault 思否](https://segmentfault.com/q/1010000043361512)

2: [Docker0网络及原理探究 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/558813984)

3: https://serverfault.com/questions/916941/configuring-docker-to-not-use-the-172-17-0-0-range
